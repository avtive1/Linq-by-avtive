import "server-only";

import { headers } from "next/headers";
import { getServerAuthSession } from "@/auth";
import { enterLogContext } from "@/lib/logger-context";

export function requestIdFromHeaders(h: Headers): string {
  return h.get("x-request-id")?.trim() || crypto.randomUUID();
}

export function enterApiLogContext(req: Request, userId?: string): void {
  enterLogContext({
    requestId: requestIdFromHeaders(req.headers),
    ...(userId ? { userId } : {}),
  });
}

export async function resolveRequestUserId(): Promise<string | undefined> {
  try {
    const session = await getServerAuthSession();
    const userId = String(session?.user?.id || "").trim();
    if (userId) return userId;
  } catch {
    // session unavailable
  }

  return undefined;
}

export async function enterServerLogContext(): Promise<void> {
  const h = await headers();
  const userId = await resolveRequestUserId();
  enterLogContext({
    requestId: requestIdFromHeaders(h),
    ...(userId ? { userId } : {}),
  });
}

export async function enterApiLogContextFromRequest(req: Request): Promise<void> {
  const userId = await resolveRequestUserId();
  enterApiLogContext(req, userId);
}
