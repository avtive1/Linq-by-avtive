import { describe, expect, it, vi, beforeEach } from "vitest";

const mockCreatePasswordResetToken = vi.fn();
const mockEnqueueEmail = vi.fn().mockResolvedValue({ queued: true, id: "msg_123" });
const mockSendBrandedEmail = vi.fn().mockResolvedValue({ sent: true });

vi.mock("@/auth", () => ({
  neonAuth: {
    handler: () => ({
      GET: vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
      POST: vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    }),
    requestPasswordReset: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

vi.mock("@/lib/auth-db", () => ({
  verifyPassword: vi.fn(),
  registerUser: vi.fn(),
  getAuthSessionPayloadByUserId: vi.fn(),
  createPasswordResetToken: (...args: unknown[]) => mockCreatePasswordResetToken(...args),
}));

vi.mock("@/lib/notifications/email-outbox", () => ({
  enqueueBrandedTransactionalEmail: (...args: unknown[]) => mockEnqueueEmail(...args),
}));

vi.mock("@/lib/notifications/branded-email", () => ({
  sendBrandedTransactionalEmail: (...args: unknown[]) => mockSendBrandedEmail(...args),
}));

import { POST as authPostHandler, GET as authGetHandler } from "@/app/api/auth/[...path]/route";
import { POST as forgotPasswordHandler } from "@/app/api/auth/forgot-password/route";
import { AUTH_COOKIE_NAME } from "@/lib/auth/session-token";

describe("Forgot Password and Sign Out Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("sends password reset email when the email belongs to a registered user", async () => {
    mockCreatePasswordResetToken.mockResolvedValueOnce("sample_reset_token_xyz");

    const req = new Request("http://localhost:3000/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "registered@example.com" }),
    });

    const res = await forgotPasswordHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ data: { ok: true } });

    expect(mockCreatePasswordResetToken).toHaveBeenCalledWith("registered@example.com");
    expect(mockEnqueueEmail).toHaveBeenCalledTimes(1);

    const queuedPayload = mockEnqueueEmail.mock.calls[0][0];
    expect(queuedPayload.to).toBe("registered@example.com");
    expect(queuedPayload.subject).toContain("Reset your password");
    expect(queuedPayload.text).toContain("sample_reset_token_xyz");
    expect(queuedPayload.html).toContain("sample_reset_token_xyz");
  });

  it("does not send email if the email is not registered, but still returns 200", async () => {
    mockCreatePasswordResetToken.mockResolvedValueOnce(null);

    const req = new Request("http://localhost:3000/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "unknown@example.com" }),
    });

    const res = await forgotPasswordHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ data: { ok: true } });

    expect(mockCreatePasswordResetToken).toHaveBeenCalledWith("unknown@example.com");
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
    expect(mockSendBrandedEmail).not.toHaveBeenCalled();
  });
});
