import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  neonAuth: {
    handler: () => ({
      GET: vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
      POST: vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    }),
  },
}));

vi.mock("@/lib/auth-db", () => ({
  verifyPassword: vi.fn(),
  registerUser: vi.fn(),
  getAuthSessionPayloadByUserId: vi.fn(),
}));

import { POST as authPostHandler, GET as authGetHandler } from "@/app/api/auth/[...path]/route";
import { AUTH_COOKIE_NAME } from "@/lib/auth/session-token";

describe("Forgot Password and Sign Out Workflow", () => {
  it("sign-out endpoint via POST clears the AUTH_COOKIE_NAME with maxAge 0 and path /", async () => {
    const req = new Request("http://localhost:3000/api/auth/sign-out", {
      method: "POST",
    });
    const res = await authPostHandler(req, {
      params: Promise.resolve({ path: ["sign-out"] }),
    });

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain(AUTH_COOKIE_NAME);
    expect(setCookie.toLowerCase()).toContain("max-age=0");
    expect(setCookie.toLowerCase()).toContain("path=/");
  });

  it("sign-out endpoint via GET also clears the AUTH_COOKIE_NAME with maxAge 0 and path /", async () => {
    const req = new Request("http://localhost:3000/api/auth/sign-out", {
      method: "GET",
    });
    const res = await authGetHandler(req, {
      params: Promise.resolve({ path: ["sign-out"] }),
    });

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain(AUTH_COOKIE_NAME);
    expect(setCookie.toLowerCase()).toContain("max-age=0");
    expect(setCookie.toLowerCase()).toContain("path=/");
  });
});
