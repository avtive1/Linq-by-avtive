import { getServerAuthSession } from "@/auth";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { runWithTenantContextAsync, type TenantContext } from "@/lib/tenant/context";
import { buildTenantContextForUser } from "@/lib/tenant/resolve";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

function isSessionAdmin(session: Awaited<ReturnType<typeof getServerAuthSession>>): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const role = String(session?.user?.role || "").toLowerCase();
  const email = String(session?.user?.email || "").trim().toLowerCase();
  return role === "admin" || Boolean(email && adminEmails.includes(email));
}

export async function resolveTenantContextFromCookies(
  cookieStore: ReadonlyRequestCookies,
  options?: { allowAdminBypass?: boolean },
): Promise<TenantContext | null> {
  const userId = await getServerUserIdFromCookies(cookieStore);
  if (!userId) return null;

  const session = await getServerAuthSession();
  const bypassRls = Boolean(options?.allowAdminBypass && isSessionAdmin(session));
  return buildTenantContextForUser(userId, { bypassRls });
}

export async function withApiTenantContext<T>(
  cookieStore: ReadonlyRequestCookies,
  fn: () => Promise<T>,
  options?: { allowAdminBypass?: boolean },
): Promise<T> {
  const context = await resolveTenantContextFromCookies(cookieStore, options);
  if (!context) {
    throw new Error("Unauthorized");
  }
  return runWithTenantContextAsync(context, fn);
}
