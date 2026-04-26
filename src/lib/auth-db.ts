import crypto from "node:crypto";
import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import { normalizeOrganizationName, toOrganizationKey } from "@/lib/organization/normalize";

export type AuthUserRecord = {
  user_id: string;
  email: string;
  password_hash: string;
  role: string | null;
  username: string | null;
  organization_name: string | null;
};

let schemaEnsured = false;
let superAdminEnsured = false;
let argon2ModulePromise: Promise<typeof import("argon2")> | null = null;

function getArgon2() {
  if (!argon2ModulePromise) {
    argon2ModulePromise = import("argon2");
  }
  return argon2ModulePromise;
}

export async function ensureAuthSchema() {
  if (schemaEnsured) return;
  await queryNeon(
    `CREATE TABLE IF NOT EXISTS public.auth_users (
      user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
      email text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      reset_token_hash text NULL,
      reset_token_expires_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
  );
  await queryNeon(
    `CREATE INDEX IF NOT EXISTS auth_users_email_idx
     ON public.auth_users (email)`,
  );
  // Older Neon DBs may lack these columns; signup + cards expect them.
  await queryNeon(
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_logo_url text`,
  );
  await queryNeon(
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS owner_onboarding_team_step_completed_at timestamptz`,
  );
  await queryNeon(
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()`,
  );
  schemaEnsured = true;
}

function normalizeBootstrapUsername(email: string) {
  const base = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "") || "superadmin";
  return base.slice(0, 30) || "superadmin";
}

async function ensureBootstrapSuperAdmin() {
  if (superAdminEnsured) return;
  try {
    const email = String(process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
    const password = String(process.env.SUPERADMIN_PASSWORD || "");
    if (!email || !password) return;

    await ensureAuthSchema();

    const organizationName = normalizeOrganizationName(
      String(process.env.SUPERADMIN_ORGANIZATION_NAME || "Platform Admin"),
    );
    const organizationKey = toOrganizationKey(organizationName);
    const requestedUsername = normalizeBootstrapUsername(
      String(process.env.SUPERADMIN_USERNAME || email),
    );

    const existingAuth = await queryNeonOne<{ user_id: string }>(
      `SELECT user_id
       FROM public.auth_users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [email],
    );

    let userId = existingAuth?.user_id || "";
    if (!userId) userId = crypto.randomUUID();

    const usernameTakenByOther = await queryNeonOne<{ id: string }>(
      `SELECT id
       FROM public.profiles
       WHERE username = $1
         AND id <> $2
       LIMIT 1`,
      [requestedUsername, userId],
    );
    const username = usernameTakenByOther?.id
      ? `${requestedUsername}_${userId.replace(/-/g, "").slice(0, 8)}`
      : requestedUsername;

    const argon2 = await getArgon2();
    const passwordHash = await argon2.hash(password);

    const existingProfile = await queryNeonOne<{ id: string }>(
      `SELECT id FROM public.profiles WHERE id = $1 LIMIT 1`,
      [userId],
    );
    if (existingProfile?.id) {
      await queryNeon(
        `UPDATE public.profiles
         SET role = 'admin',
             username = $1,
             organization_name = $2,
             organization_name_key = $3
         WHERE id = $4`,
        [username, organizationName, organizationKey || null, userId],
      );
    } else {
      await queryNeon(
        `INSERT INTO public.profiles (id, username, organization_name, organization_name_key, role, created_at)
         VALUES ($1, $2, $3, $4, 'admin', now())`,
        [userId, username, organizationName, organizationKey || null],
      );
    }

    if (existingAuth?.user_id) {
      await queryNeon(
        `UPDATE public.auth_users
         SET email = $1,
             password_hash = $2,
             updated_at = now()
         WHERE user_id = $3`,
        [email, passwordHash, userId],
      );
    } else {
      await queryNeon(
        `INSERT INTO public.auth_users (user_id, email, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, now(), now())`,
        [userId, email, passwordHash],
      );
    }

    if (organizationKey) {
      await queryNeon(
        `INSERT INTO public.organizations (organization_name, organization_name_key, owner_user_id, created_at, updated_at)
         VALUES ($1, $2, $3, now(), now())
         ON CONFLICT (organization_name_key)
         DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id, organization_name = EXCLUDED.organization_name, updated_at = now()`,
        [organizationName, organizationKey, userId],
      );
    }

    superAdminEnsured = true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown bootstrap error";
    console.error("SUPERADMIN bootstrap failed:", message);
  }
}

export async function getAuthUserByEmail(email: string): Promise<AuthUserRecord | null> {
  await ensureAuthSchema();
  await ensureBootstrapSuperAdmin();
  return queryNeonOne<AuthUserRecord>(
    `SELECT au.user_id, au.email, au.password_hash, p.role, p.username, p.organization_name
     FROM public.auth_users au
     JOIN public.profiles p ON p.id = au.user_id
     WHERE lower(au.email) = lower($1)
     LIMIT 1`,
    [email.trim()],
  );
}

export async function verifyPassword(email: string, password: string): Promise<AuthUserRecord | null> {
  const user = await getAuthUserByEmail(email);
  if (!user) return null;
  const argon2 = await getArgon2();
  const ok = await argon2.verify(user.password_hash, password);
  return ok ? user : null;
}

export async function registerUser(input: {
  email: string;
  password: string;
  username: string;
  organizationName: string;
  organizationLogoUrl?: string;
  linkedin?: string;
}): Promise<{ userId: string; email: string; role: string }> {
  await ensureAuthSchema();
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim().toLowerCase();
  const organizationName = normalizeOrganizationName(input.organizationName);
  const organizationKey = toOrganizationKey(organizationName);
  const organizationLogoUrl = String(input.organizationLogoUrl || "").trim();
  const linkedin = String(input.linkedin || "").trim();

  const existingEmail = await queryNeonOne<{ user_id: string }>(
    `SELECT user_id FROM public.auth_users WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );
  if (existingEmail?.user_id) {
    throw new Error("An account with this email already exists.");
  }

  const existingUsername = await queryNeonOne<{ id: string }>(
    `SELECT id FROM public.profiles WHERE username = $1 LIMIT 1`,
    [username],
  );
  if (existingUsername?.id) {
    throw new Error("Username already exists.");
  }

  const userId = crypto.randomUUID();
  const argon2 = await getArgon2();
  const hash = await argon2.hash(input.password);

  await queryNeon(
    `INSERT INTO public.profiles (id, username, organization_name, organization_name_key, role, created_at)
     VALUES ($1, $2, $3, $4, 'user', now())`,
    [userId, username, organizationName, organizationKey],
  );

  await queryNeon(
    `INSERT INTO public.auth_users (user_id, email, password_hash, created_at, updated_at)
     VALUES ($1, $2, $3, now(), now())`,
    [userId, email, hash],
  );

  if (organizationKey) {
    await queryNeon(
      `INSERT INTO public.organizations (organization_name, organization_name_key, owner_user_id, created_at, updated_at)
       VALUES ($1, $2, $3, now(), now())
       ON CONFLICT (organization_name_key)
       DO UPDATE SET organization_name = EXCLUDED.organization_name, updated_at = now()`,
      [organizationName, organizationKey, userId],
    );
  }

  // Optional column support: persist uploaded organization logo if schema has organization_logo_url.
  if (organizationLogoUrl) {
    try {
      await queryNeon(
        `UPDATE public.profiles
         SET organization_logo_url = $1, updated_at = now()
         WHERE id = $2`,
        [organizationLogoUrl, userId],
      );
    } catch {
      try {
        await queryNeon(
          `UPDATE public.profiles SET organization_logo_url = $1 WHERE id = $2`,
          [organizationLogoUrl, userId],
        );
      } catch {
        console.warn("[registerUser] organization_logo_url not persisted; check profiles schema/columns.");
      }
    }
  }

  if (linkedin) {
    await queryNeon(
      `UPDATE public.profiles SET updated_at = now() WHERE id = $1`,
      [userId],
    );
  }

  return { userId, email, role: "user" };
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function createPasswordResetToken(email: string): Promise<string | null> {
  await ensureAuthSchema();
  const user = await queryNeonOne<{ user_id: string }>(
    `SELECT user_id FROM public.auth_users WHERE lower(email) = lower($1) LIMIT 1`,
    [email.trim().toLowerCase()],
  );
  if (!user?.user_id) return null;

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(token);
  const expires = new Date(Date.now() + 1000 * 60 * 30).toISOString();

  await queryNeon(
    `UPDATE public.auth_users
     SET reset_token_hash = $1, reset_token_expires_at = $2, updated_at = now()
     WHERE user_id = $3`,
    [tokenHash, expires, user.user_id],
  );

  return token;
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
  await ensureAuthSchema();
  const tokenHash = sha256(token);
  const row = await queryNeonOne<{ user_id: string }>(
    `SELECT user_id
     FROM public.auth_users
     WHERE reset_token_hash = $1
       AND reset_token_expires_at IS NOT NULL
       AND reset_token_expires_at > now()
     LIMIT 1`,
    [tokenHash],
  );
  if (!row?.user_id) return false;

  const argon2 = await getArgon2();
  const hash = await argon2.hash(newPassword);
  await queryNeon(
    `UPDATE public.auth_users
     SET password_hash = $1,
         reset_token_hash = NULL,
         reset_token_expires_at = NULL,
         updated_at = now()
     WHERE user_id = $2`,
    [hash, row.user_id],
  );
  return true;
}
