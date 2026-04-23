import { queryNeon, queryNeonOne } from "@/lib/neon-db";

export async function listAdminUsers() {
  const rows = await queryNeon<{
    id: string;
    email: string;
    role: string | null;
    username: string | null;
    organization_name: string | null;
    organization_logo_url: string | null;
    created_at: string | null;
  }>(
    `SELECT p.id, au.email, p.role, p.username, p.organization_name,
            to_jsonb(p.*)->>'organization_logo_url' AS organization_logo_url,
            p.created_at
     FROM public.profiles p
     LEFT JOIN public.auth_users au ON au.user_id = p.id
     ORDER BY p.created_at DESC
     LIMIT 500`,
  );
  return {
    data: rows.map((r) => ({
      ...r,
      user_metadata: {
        organization_name: r.organization_name || "",
        organization_logo_url: r.organization_logo_url || "",
      },
    })),
  };
}

export async function getAdminUserById(userId: string) {
  const row = await queryNeonOne<{
    id: string;
    email: string | null;
    role: string | null;
    username: string | null;
    organization_name: string | null;
    organization_logo_url: string | null;
  }>(
    `SELECT p.id, au.email, p.role, p.username, p.organization_name,
            to_jsonb(p.*)->>'organization_logo_url' AS organization_logo_url
     FROM public.profiles p
     LEFT JOIN public.auth_users au ON au.user_id = p.id
     WHERE p.id = $1
     LIMIT 1`,
    [userId],
  );
  if (!row) throw new Error("User not found.");
  return {
    id: row.id,
    emailAddresses: row.email ? [{ emailAddress: row.email }] : [],
    publicMetadata: {
      role: row.role || "user",
      organization_name: row.organization_name || "",
      organization_logo_url: row.organization_logo_url || "",
    },
    username: row.username || "",
  };
}

export async function getAdminUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const row = await queryNeonOne<{ id: string; email: string | null; role: string | null; organization_name: string | null; organization_logo_url: string | null }>(
    `SELECT p.id, au.email, p.role, p.organization_name,
            to_jsonb(p.*)->>'organization_logo_url' AS organization_logo_url
     FROM public.auth_users au
     JOIN public.profiles p ON p.id = au.user_id
     WHERE lower(au.email) = lower($1)
     LIMIT 1`,
    [normalized],
  );
  if (!row) return null;
  return {
    id: row.id,
    emailAddresses: row.email ? [{ emailAddress: row.email }] : [],
    publicMetadata: {
      role: row.role || "user",
      organization_name: row.organization_name || "",
      organization_logo_url: row.organization_logo_url || "",
    },
  };
}

export async function getAdminUserEmailById(userId: string) {
  const row = await queryNeonOne<{ email: string | null }>(
    `SELECT email FROM public.auth_users WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  return row?.email || null;
}
