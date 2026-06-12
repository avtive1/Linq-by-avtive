import "server-only";

import { auth } from "@clerk/nextjs/server";
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
    const nextAuthId = String(session?.user?.id || "").trim();
    if (nextAuthId) return nextAuthId;
  } catch {
    // session unavailable
  }

  try {
    const { userId: clerkUserId } = await auth();
    if (clerkUserId) return clerkUserId;
  } catch {
    // clerk unavailable
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
