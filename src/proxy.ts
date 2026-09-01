import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { neonAuth } from "@/lib/auth/neon";
import { classifyApiRoute, clientIp, getRateLimiters, rateLimitKey } from "@/lib/rate-limit";

const isProtectedRoute = /^\/(dashboard|admin)(\/.*)?$/;
const isAuthRoute = createRouteMatcher(["/login(.*)", "/signup(.*)"]);
const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isSameOriginMutation(request: NextRequest) {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  try {
    if (origin) return new URL(origin).origin === expectedOrigin;
    if (referer) return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }

  return false;
}

function createRouteMatcher(patterns: string[]) {
  const regexes = patterns.map((p) => new RegExp(`^${p.replace(/\(\.\*\)/g, ".*")}$`));
  return (request: NextRequest) => regexes.some((re) => re.test(new URL(request.url).pathname));
}

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const reqHeaders = new Headers(request.headers);
  reqHeaders.set("x-request-id", requestId);

  if (pathname.startsWith("/api/")) {
    // Neon Auth owns its callback protocol. All product API mutations are
    // browser-origin checked here so individual routes cannot forget CSRF protection.
    if (
      unsafeMethods.has(request.method) &&
      !pathname.startsWith("/api/auth/") &&
      !isSameOriginMutation(request)
    ) {
      return new NextResponse(JSON.stringify({ error: "Invalid request origin." }), {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "x-request-id": requestId,
        },
      });
    }

    const limiters = getRateLimiters();
    if (limiters) {
      const ip = clientIp(request);
      const tier = classifyApiRoute(pathname, request.method);
      const limiter = limiters[tier];
      const { success, reset, limit, remaining } = await limiter.limit(rateLimitKey(tier, ip));
      if (!success) {
        const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        return new NextResponse(JSON.stringify({ error: "Too many requests. Please try again later." }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(Math.max(0, remaining)),
            "X-RateLimit-Reset": String(Math.ceil(reset / 1000)),
            "x-request-id": requestId,
          },
        });
      }
      const res = NextResponse.next({ request: { headers: reqHeaders } });
      res.headers.set("X-RateLimit-Limit", String(limit));
      res.headers.set("X-RateLimit-Remaining", String(Math.max(0, remaining)));
      res.headers.set("X-RateLimit-Reset", String(Math.ceil(reset / 1000)));
      res.headers.set("x-request-id", requestId);
      return res;
    }
    const res = NextResponse.next({ request: { headers: reqHeaders } });
    res.headers.set("x-request-id", requestId);
    return res;
  }

  const { AUTH_COOKIE_NAME, verifySessionToken } = await import("@/lib/auth/session-token");
  const jwtCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  let jwtPayload: { userId: string; email: string } | null = null;
  if (jwtCookie) {
    jwtPayload = await verifySessionToken(jwtCookie);
  }

  let session: Awaited<ReturnType<typeof neonAuth.getSession>>["data"] = null;
  if (!jwtPayload) {
    try {
      session = (await neonAuth.getSession({ headers: request.headers })).data;
    } catch {
      session = null;
    }
  }

  const { userId: clerkUserId } = await auth();
  const neonUserId = String(session?.user?.id || "").trim();
  const userId = jwtPayload?.userId || neonUserId || clerkUserId || undefined;

  const tokenRole = String(session?.user?.role || "").toLowerCase();
  const tokenEmail = String(jwtPayload?.email || session?.user?.email || "").trim().toLowerCase();
  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdminUser = tokenRole === "admin" || Boolean(tokenEmail && adminEmails.includes(tokenEmail));

  const withRequestId = (response: NextResponse) => {
    response.headers.set("x-request-id", requestId);
    return response;
  };

  if (isProtectedRoute.test(pathname) && !userId) {
    return withRequestId(NextResponse.redirect(new URL("/login", request.url)));
  }
  if (pathname.startsWith("/dashboard") && userId && isAdminUser && !url.searchParams.get("impersonate")) {
    return withRequestId(NextResponse.redirect(new URL("/admin", request.url)));
  }
  if (isAuthRoute(request) && userId) {
    return withRequestId(
      NextResponse.redirect(new URL(isAdminUser ? "/admin" : "/dashboard", request.url)),
    );
  }

  return withRequestId(NextResponse.next({ request: { headers: reqHeaders } }));
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
