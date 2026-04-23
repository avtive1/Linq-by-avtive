import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const isProtectedRoute = /^\/(dashboard|admin)(\/.*)?$/;
const isAuthRoute = createRouteMatcher(["/login(.*)", "/signup(.*)"]);

function createRouteMatcher(patterns: string[]) {
  const regexes = patterns.map((p) => new RegExp(`^${p.replace(/\(\.\*\)/g, ".*")}$`));
  return (request: NextRequest) => regexes.some((re) => re.test(new URL(request.url).pathname));
}

export async function proxy(request: NextRequest) {
  const pathname = new URL(request.url).pathname;
  const secureCookie = process.env.NODE_ENV === "production";
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
    secureCookie,
  });
  const userId = token?.uid || token?.sub;
  if (isProtectedRoute.test(pathname) && !userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (isAuthRoute(request) && userId) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
