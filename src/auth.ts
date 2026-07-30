import { neonAuth } from "@/lib/auth/neon";
import {
  getAuthSessionPayloadByUserId,
  linkAuthUserToNeonAuthUser,
} from "@/lib/auth-db";

export type AppAuthSession = {
  expires: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    organizationName: string;
  };
};

type NeonSessionUser = {
  id?: string;
  email?: string;
  name?: string | null;
};

function isAdminEmail(email: string) {
  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.trim().toLowerCase());
}

export async function getServerAuthSession(): Promise<AppAuthSession | null> {
  const { data: session } = await neonAuth.getSession();
  const neonUser = session?.user as NeonSessionUser | undefined;
  const neonAuthUserId = String(neonUser?.id || "").trim();
  const email = String(neonUser?.email || "").trim().toLowerCase();

  if (!neonAuthUserId || !email) return null;

  const internalUserId = await linkAuthUserToNeonAuthUser(neonAuthUserId, email);
  if (!internalUserId) return null;

  const payload = await getAuthSessionPayloadByUserId(internalUserId);
  if (!payload) return null;

  const role = isAdminEmail(payload.email) ? "admin" : payload.role || "user";
  const expiresAt = session?.session?.expiresAt;
  const expires =
    expiresAt instanceof Date
      ? expiresAt.toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  return {
    expires,
    user: {
      id: payload.userId,
      email: payload.email,
      name: payload.username || neonUser?.name || payload.email,
      role,
      organizationName: payload.organizationName || "",
    },
  };
}

export { neonAuth };
