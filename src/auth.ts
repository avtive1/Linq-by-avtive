import { cookies } from "next/headers";
import { neonAuth } from "@/lib/auth/neon";
import {
  getAuthSessionPayloadByUserId,
  linkAuthUserToNeonAuthUser,
} from "@/lib/auth-db";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session-token";

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
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (token) {
      const verified = await verifySessionToken(token);
      if (verified?.userId) {
        const payload = await getAuthSessionPayloadByUserId(verified.userId);
        if (payload) {
          const role = isAdminEmail(payload.email) ? "admin" : payload.role || "user";
          return {
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            user: {
              id: payload.userId,
              email: payload.email,
              name: payload.username || payload.email,
              role,
              organizationName: payload.organizationName || "",
            },
          };
        }
      }
    }
  } catch {
    // Non-request context fallback
  }

  try {
    const { data: session } = await neonAuth.getSession();
    const neonUser = session?.user as NeonSessionUser | undefined;
    const neonAuthUserId = String(neonUser?.id || "").trim();
    const email = String(neonUser?.email || "").trim().toLowerCase();

    if (neonAuthUserId && email) {
      const internalUserId = await linkAuthUserToNeonAuthUser(neonAuthUserId, email);
      if (internalUserId) {
        const payload = await getAuthSessionPayloadByUserId(internalUserId);
        if (payload) {
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
      }
    }
  } catch {
    // Neon Auth unavailable
  }

  return null;
}

export { neonAuth };
