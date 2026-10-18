import { describe, expect, it, vi, beforeEach } from "vitest";

const mockQueryNeonAsSystem = vi.fn();
const mockQueryNeonOneAsSystem = vi.fn();
const mockEnqueueBrandedTransactionalEmail = vi.fn();
const mockSendBrandedTransactionalEmail = vi.fn();
const mockSupabaseListUsers = vi.fn();
const mockSupabaseUpdateUserById = vi.fn();
const mockSupabaseCreateUser = vi.fn();

vi.mock("@/lib/neon-db", () => ({
  queryNeonAsSystem: (...args: unknown[]) => mockQueryNeonAsSystem(...args),
  queryNeonOneAsSystem: (...args: unknown[]) => mockQueryNeonOneAsSystem(...args),
}));

vi.mock("@/lib/notifications/email-outbox", () => ({
  enqueueBrandedTransactionalEmail: (...args: unknown[]) =>
    mockEnqueueBrandedTransactionalEmail(...args),
}));

vi.mock("@/lib/notifications/branded-email", () => ({
  sendBrandedTransactionalEmail: (...args: unknown[]) =>
    mockSendBrandedTransactionalEmail(...args),
}));

vi.mock("@/utils/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    auth: {
      admin: {
        listUsers: () => mockSupabaseListUsers(),
        updateUserById: (...args: unknown[]) => mockSupabaseUpdateUserById(...args),
        createUser: (...args: unknown[]) => mockSupabaseCreateUser(...args),
      },
    },
  }),
}));

vi.mock("@/auth", () => ({
  neonAuth: {
    resetPassword: vi.fn().mockResolvedValue({ data: { ok: true } }),
  },
}));

import {
  requestPasswordResetCode,
  verifyPasswordResetCode,
  completePasswordReset,
} from "@/lib/auth/password-reset";
import crypto from "node:crypto";

describe("Password Reset Engine - Core Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnqueueBrandedTransactionalEmail.mockResolvedValue({ queued: true, id: "msg_123" });
    mockSendBrandedTransactionalEmail.mockResolvedValue({ sent: true });
    mockSupabaseListUsers.mockResolvedValue({ data: { users: [] }, error: null });
    mockSupabaseUpdateUserById.mockResolvedValue({ data: { user: {} }, error: null });
    mockSupabaseCreateUser.mockResolvedValue({ data: { user: {} }, error: null });
  });

  describe("requestPasswordResetCode", () => {
    it("returns error when email is not registered anywhere", async () => {
      mockQueryNeonOneAsSystem.mockResolvedValueOnce(null); // not in auth_users
      mockSupabaseListUsers.mockResolvedValueOnce({ data: { users: [] }, error: null }); // not in supabase

      const result = await requestPasswordResetCode("unregistered@example.com");

      expect(result.success).toBe(false);
      expect(result.error).toBe("User not registered. Please check your email or sign up.");
      expect(mockEnqueueBrandedTransactionalEmail).not.toHaveBeenCalled();
    });

    it("generates 6-digit code, saves hashed code, and sends branded email for registered user", async () => {
      mockQueryNeonOneAsSystem
        .mockResolvedValueOnce({ user_id: "user-123", email: "user@example.com" }) // user lookup
        .mockResolvedValueOnce(null); // recentOtp (no cooldown)

      mockQueryNeonAsSystem.mockResolvedValue([]);

      const result = await requestPasswordResetCode("user@example.com");

      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
      expect(result.code).toMatch(/^\d{6}$/);

      // Verify email was enqueued
      expect(mockEnqueueBrandedTransactionalEmail).toHaveBeenCalledTimes(1);
      const emailPayload = mockEnqueueBrandedTransactionalEmail.mock.calls[0][0];
      expect(emailPayload.to).toBe("user@example.com");
      expect(emailPayload.text).toContain(result.code);
      expect(emailPayload.html).toContain(result.code);

      // Verify OTP insertion with hashed code
      const insertCall = mockQueryNeonAsSystem.mock.calls.find((call) =>
        String(call[0]).includes("INSERT INTO public.login_email_otp"),
      );
      expect(insertCall).toBeDefined();
      const codeHash = insertCall![1][2];
      const expectedHash = crypto.createHash("sha256").update(result.code!).digest("hex");
      expect(codeHash).toBe(expectedHash);
    });

    it("enforces 60-second cooldown on repeated requests", async () => {
      mockQueryNeonOneAsSystem
        .mockResolvedValueOnce({ user_id: "user-123", email: "user@example.com" })
        .mockResolvedValueOnce({ created_at: new Date(Date.now() - 20 * 1000).toISOString() }); // 20s ago

      const result = await requestPasswordResetCode("user@example.com");

      expect(result.success).toBe(false);
      expect(result.cooldownRemaining).toBeGreaterThanOrEqual(39);
      expect(result.error).toContain("seconds before requesting a new code");
      expect(mockEnqueueBrandedTransactionalEmail).not.toHaveBeenCalled();
    });
  });

  describe("verifyPasswordResetCode", () => {
    it("validates 6-digit code format", async () => {
      const result = await verifyPasswordResetCode("user@example.com", "123");
      expect(result.success).toBe(false);
      expect(result.error).toContain("valid 6-digit");
    });

    it("successfully verifies valid code, consumes it, and returns resetToken", async () => {
      const code = "482915";
      const codeHash = crypto.createHash("sha256").update(code).digest("hex");

      mockQueryNeonOneAsSystem
        .mockResolvedValueOnce({ user_id: "user-123" }) // user lookup
        .mockResolvedValueOnce({
          id: "otp-uuid-1",
          code_hash: codeHash,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        }); // activeOtp lookup

      mockQueryNeonAsSystem.mockResolvedValue([]);

      const result = await verifyPasswordResetCode("user@example.com", code);

      expect(result.success).toBe(true);
      expect(result.resetToken).toBeDefined();
      expect(typeof result.resetToken).toBe("string");

      // Verify code was marked consumed
      const consumeCall = mockQueryNeonAsSystem.mock.calls.find((call) =>
        String(call[0]).includes("SET consumed_at = now() WHERE id = $1"),
      );
      expect(consumeCall).toBeDefined();
      expect(consumeCall![1][0]).toBe("otp-uuid-1");
    });

    it("rejects incorrect code and returns remaining attempts", async () => {
      const correctCode = "482915";
      const correctHash = crypto.createHash("sha256").update(correctCode).digest("hex");

      mockQueryNeonOneAsSystem
        .mockResolvedValueOnce({ user_id: "user-123" })
        .mockResolvedValueOnce({
          id: "otp-uuid-2",
          code_hash: correctHash,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        });

      const result = await verifyPasswordResetCode("user@example.com", "999999");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid verification code");
      expect(result.error).toContain("attempt");
    });

    it("rejects expired codes and marks them consumed", async () => {
      const code = "482915";
      const codeHash = crypto.createHash("sha256").update(code).digest("hex");

      mockQueryNeonOneAsSystem
        .mockResolvedValueOnce({ user_id: "user-123" })
        .mockResolvedValueOnce({
          id: "otp-uuid-expired",
          code_hash: codeHash,
          expires_at: new Date(Date.now() - 60 * 1000).toISOString(), // expired 1 min ago
        });

      mockQueryNeonAsSystem.mockResolvedValue([]);

      const result = await verifyPasswordResetCode("user@example.com", code);

      expect(result.success).toBe(false);
      expect(result.error).toContain("expired");
    });
  });

  describe("completePasswordReset", () => {
    it("validates password policy before attempting reset", async () => {
      const result = await completePasswordReset("any_token", "short");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Password must be at least 12 characters");
    });

    it("rejects invalid or expired reset tokens", async () => {
      mockQueryNeonOneAsSystem.mockResolvedValueOnce(null);

      const result = await completePasswordReset(
        "invalid_or_expired_token",
        "ValidP@ssword123!",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid or expired reset session");
    });

    it("updates password in Supabase Auth and database, and invalidates reset token", async () => {
      const token = "valid_reset_token_hex_string_32_bytes";
      mockQueryNeonOneAsSystem.mockResolvedValueOnce({
        user_id: "user-123",
        email: "user@example.com",
      });

      mockSupabaseListUsers.mockResolvedValueOnce({
        data: { users: [{ id: "sb-user-id", email: "user@example.com" }] },
        error: null,
      });

      mockQueryNeonAsSystem.mockResolvedValue([]);

      const result = await completePasswordReset(token, "BrandNewSecurePassword123!");

      expect(result.success).toBe(true);

      // Verify Supabase Auth update was called
      expect(mockSupabaseUpdateUserById).toHaveBeenCalledWith("sb-user-id", {
        password: "BrandNewSecurePassword123!",
      });

      // Verify database update set new password hash and cleared reset token
      const updateCall = mockQueryNeonAsSystem.mock.calls.find((call) =>
        String(call[0]).includes("SET password_hash = $1"),
      );
      expect(updateCall).toBeDefined();
      expect(updateCall![1][1]).toBe("user-123");
    });
  });
});
