import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import type { NextRequest, NextResponse } from "next/server";

export const NEXT_AUTH_SESSION_COOKIES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "__Host-next-auth.session-token",
] as const;

export function hasNextAuthSessionCookie(
  source: Pick<ReadonlyRequestCookies, "get"> | Pick<NextRequest["cookies"], "get">,
): boolean {
  return NEXT_AUTH_SESSION_COOKIES.some((name) => Boolean(source.get(name)?.value));
}

export function clearNextAuthSessionCookies(
  target: Pick<ReadonlyRequestCookies, "delete"> | NextResponse["cookies"],
): void {
  for (const name of NEXT_AUTH_SESSION_COOKIES) {
    target.delete(name);
  }
}
