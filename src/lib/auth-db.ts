import argon2 from "argon2";
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
  schemaEnsured = true;
}

export async function getAuthUserByEmail(email: string): Promise<AuthUserRecord | null> {
  await ensureAuthSchema();
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
  const ok = await argon2.verify(user.password_hash, password);
  return ok ? user : null;
}

export async function registerUser(input: {
  email: string;
  password: string;
  username: string;
  organizationName: string;
  linkedin?: string;
}): Promise<{ userId: string; email: string; role: string }> {
  await ensureAuthSchema();
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim().toLowerCase();
  const organizationName = normalizeOrganizationName(input.organizationName);
  const organizationKey = toOrganizationKey(organizationName);
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
