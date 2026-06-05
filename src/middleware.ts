import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { classifyApiRoute, clientIp, getRateLimiters, rateLimitKey } from "@/lib/rate-limit";

const isProtectedRoute = /^\/(dashboard|admin)(\/.*)?$/;
const isAuthRoute = createRouteMatcher(["/login(.*)", "/signup(.*)"]);

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

  const secureCookie = process.env.NODE_ENV === "production";
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
    secureCookie,
  });
  const { userId: clerkUserId } = await auth();
  const nextAuthUserId = token?.uid || token?.sub;
  const userId = nextAuthUserId || clerkUserId || undefined;

  const tokenRole = String(token?.role || "").toLowerCase();
  const tokenEmail = String(token?.email || "").trim().toLowerCase();
  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdminUser = tokenRole === "admin" || Boolean(tokenEmail && adminEmails.includes(tokenEmail));

  if (isProtectedRoute.test(pathname) && !userId) {
    const r = NextResponse.redirect(new URL("/login", request.url));
    r.headers.set("x-request-id", requestId);
    return r;
  }
  if (pathname.startsWith("/dashboard") && userId && isAdminUser && !url.searchParams.get("impersonate")) {
    const r = NextResponse.redirect(new URL("/admin", request.url));
    r.headers.set("x-request-id", requestId);
    return r;
  }
  if (isAuthRoute(request) && userId) {
    const r = NextResponse.redirect(new URL(isAdminUser ? "/admin" : "/dashboard", request.url));
    r.headers.set("x-request-id", requestId);
    return r;
  }

  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set("x-request-id", requestId);
  return res;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
