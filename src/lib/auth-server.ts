import { getServerAuthSession } from "@/auth";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

export async function getServerUserIdFromCookies(cookieStore: ReadonlyRequestCookies): Promise<string | null> {
  void cookieStore;
  const session = await getServerAuthSession();
  return session?.user?.id || null;
}
