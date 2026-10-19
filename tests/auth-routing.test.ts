import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (handler: any) => handler,
}));

vi.mock("@/lib/auth/neon", () => ({
  neonAuth: {
    getSession: vi.fn().mockResolvedValue({ data: null }),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  classifyApiRoute: vi.fn(),
  clientIp: vi.fn().mockReturnValue("127.0.0.1"),
  getRateLimiters: vi.fn().mockReturnValue(null),
  rateLimitKey: vi.fn(),
}));

vi.mock("@/lib/auth/session-token", () => ({
  AUTH_COOKIE_NAME: "linq_session_token",
  verifySessionToken: vi.fn(),
}));

import proxyMiddleware from "@/proxy";
import { verifySessionToken } from "@/lib/auth/session-token";

describe("Authentication & Dashboard Routing Rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects root '/' to '/login' so every user lands on the login page", async () => {
    const req = new NextRequest("http://localhost:3000/");
    const res = await (proxyMiddleware as any)(() => null, req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBe("http://localhost:3000/login");
  });

  it("allows access to '/login' and clears any residual sessions so users must authenticate freshly", async () => {
    const req = new NextRequest("http://localhost:3000/login", {
      headers: {
        cookie: "linq_session_token=old_token_123; neon-auth.session=old_neon_456",
      },
    });
    const res = await (proxyMiddleware as any)(() => null, req);

    // It should not redirect to /dashboard
    expect(res.status).not.toBe(307);
    const location = res.headers.get("location");
    expect(location).toBeNull();

    // It should clear residual session cookies
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain("linq_session_token");
    expect(setCookie.toLowerCase()).toContain("max-age=0");
  });

  it("blocks unauthenticated users from viewing the dashboard and redirects them to '/login'", async () => {
    vi.mocked(verifySessionToken).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/dashboard");
    const res = await (proxyMiddleware as any)(() => null, req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBe("http://localhost:3000/login");
  });

  it("blocks unauthenticated users from viewing protected admin routes and redirects to '/login'", async () => {
    vi.mocked(verifySessionToken).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/admin");
    const res = await (proxyMiddleware as any)(() => null, req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBe("http://localhost:3000/login");
  });

  it("allows authenticated users to view the dashboard after authentication", async () => {
    vi.mocked(verifySessionToken).mockResolvedValue({
      userId: "user_active_789",
      email: "user@example.com",
    });

    const req = new NextRequest("http://localhost:3000/dashboard", {
      headers: {
        cookie: "linq_session_token=valid_token_789",
      },
    });
    const res = await (proxyMiddleware as any)(() => null, req);

    // It allows through to the dashboard
    expect(res.status).toBe(200);
    const location = res.headers.get("location");
    expect(location).toBeNull();
  });
});
