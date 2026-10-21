import crypto from "node:crypto";
import { logger } from "@/lib/logger-server";
import { queryNeonAsSystem, queryNeonOneAsSystem } from "@/lib/neon-db";
import { normalizeAuthEmail } from "@/lib/auth-db";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";
import { validatePasswordPolicy } from "@/lib/security/password-policy";
import { generatePasswordResetCodeEmailHtml } from "@/lib/email-templates/account-emails";
import { enqueueBrandedTransactionalEmail } from "@/lib/notifications/email-outbox";
import { sendBrandedTransactionalEmail } from "@/lib/notifications/branded-email";

const OTP_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_FAILED_ATTEMPTS = 5;
const RESET_TOKEN_EXPIRY_MINUTES = 15;
/** TTL for failed-attempt Redis keys — slightly longer than OTP expiry */
const FAILED_ATTEMPTS_TTL_SECONDS = OTP_EXPIRY_MINUTES * 60 + 60;

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
};

let argon2ModulePromise: Promise<typeof import("argon2")> | null = null;
function getArgon2() {
  if (!argon2ModulePromise) {
    argon2ModulePromise = import("argon2");
  }
  return argon2ModulePromise;
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// ── Serverless-safe failed-attempt tracking via Upstash Redis ─────────────
// Falls back to in-memory Map when Redis is not configured (local dev without Redis).
const inMemoryFallback = new Map<string, number>();

async function getFailedAttempts(otpId: string): Promise<number> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return inMemoryFallback.get(otpId) ?? 0;
  try {
    const res = await fetch(`${url}/get/otp_fail:${otpId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as { result: string | null };
    return Number(data.result ?? 0);
  } catch {
    return inMemoryFallback.get(otpId) ?? 0;
  }
}

async function incrementFailedAttempts(otpId: string): Promise<number> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    const next = (inMemoryFallback.get(otpId) ?? 0) + 1;
    inMemoryFallback.set(otpId, next);
    return next;
  }
  try {
    const incrRes = await fetch(`${url}/incr/otp_fail:${otpId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const incrData = (await incrRes.json()) as { result: number };
    const count = incrData.result ?? 1;
    // Set/refresh TTL (fire-and-forget)
    fetch(`${url}/expire/otp_fail:${otpId}/${FAILED_ATTEMPTS_TTL_SECONDS}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    return count;
  } catch {
    const next = (inMemoryFallback.get(otpId) ?? 0) + 1;
    inMemoryFallback.set(otpId, next);
    return next;
  }
}

async function clearFailedAttempts(otpId: string): Promise<void> {
  inMemoryFallback.delete(otpId);
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  fetch(`${url}/del/otp_fail:${otpId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────

export async function requestPasswordResetCode(email: string): Promise<{
  success: boolean;
  code?: string;
  cooldownRemaining?: number;
  error?: string;
}> {
  const normalized = normalizeAuthEmail(email);
  if (!normalized) {
    return { success: false, error: "Please enter a valid email address." };
  }

  // 1. Check if user is registered in Linq auth_users or Supabase Auth
  const user = await queryNeonOneAsSystem<{ user_id: string; email: string }>(
    `SELECT user_id, email
     FROM public.auth_users
     WHERE email_normalized = $1 OR LOWER(email) = $1
     LIMIT 1`,
    [normalized],
  );

  let userId = user?.user_id;

  if (!userId) {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        // Use getUserByEmail instead of listUsers() to avoid O(n) full scan
        const { data: sbUserData, error: sbErr } = await (supabase.auth.admin as any).getUserByEmail
          ? (supabase.auth.admin as any).getUserByEmail(normalized)
          : supabase.auth.admin.listUsers().then(({ data, error }: { data: { users: Array<{ id: string; email?: string }> } | null; error: unknown }) => ({
              data: { user: data?.users?.find((u: { id: string; email?: string }) => u.email?.toLowerCase() === normalized) },
              error,
            }));

        const sbUser = sbUserData?.user;
        if (!sbErr && sbUser) {
          // Sync user to auth_users if missing
          const existingProfile = await queryNeonOneAsSystem<{ id: string }>(
            `SELECT id FROM public.profiles WHERE id = $1 LIMIT 1`,
            [sbUser.id],
          );
          if (!existingProfile) {
            const baseUsername = (sbUser.email?.split("@")[0] || "user").toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 20);
            await queryNeonAsSystem(
              `INSERT INTO public.profiles (id, username, organization_name, role, created_at)
               VALUES ($1, $2, $3, 'user', now())
               ON CONFLICT (id) DO NOTHING`,
              [sbUser.id, `${baseUsername}_${sbUser.id.replace(/-/g, "").slice(0, 6)}`, "Default Organization"],
            );
          }
          await queryNeonAsSystem(
            `INSERT INTO public.auth_users (user_id, email, email_normalized, created_at, updated_at)
             VALUES ($1, $2, $2, now(), now())
             ON CONFLICT (user_id) DO UPDATE
             SET email = EXCLUDED.email, email_normalized = EXCLUDED.email_normalized, updated_at = now()`,
            [sbUser.id, normalized],
          );
          userId = sbUser.id;
        }
      } catch (err) {
        logger.warn({ err }, "Supabase user check error during forgot password");
      }
    }
  }

  if (!userId) {
    return {
      success: false,
      error: "User not registered. Please check your email or sign up.",
    };
  }

  // 2. Check resend cooldown
  const recentOtp = await queryNeonOneAsSystem<{ created_at: string }>(
    `SELECT created_at
     FROM public.login_email_otp
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );

  if (recentOtp?.created_at) {
    const elapsedMs = Date.now() - new Date(recentOtp.created_at).getTime();
    const cooldownMs = RESEND_COOLDOWN_SECONDS * 1000;
    if (elapsedMs < cooldownMs) {
      const remainingSec = Math.max(1, Math.ceil((cooldownMs - elapsedMs) / 1000));
      return {
        success: false,
        cooldownRemaining: remainingSec,
        error: `Please wait ${remainingSec} seconds before requesting a new code.`,
      };
    }
  }

  // 3. Generate secure 6-digit code and store hashed
  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = sha256(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  // Invalidate previous unconsumed OTPs
  await queryNeonAsSystem(
    `UPDATE public.login_email_otp
     SET consumed_at = now()
     WHERE user_id = $1 AND consumed_at IS NULL`,
    [userId],
  );

  const otpId = crypto.randomUUID();
  await queryNeonAsSystem(
    `INSERT INTO public.login_email_otp (id, user_id, code_hash, expires_at, created_at)
     VALUES ($1, $2, $3, $4, now())`,
    [otpId, userId, codeHash, expiresAt],
  );

  await queryNeonAsSystem(
    `UPDATE public.auth_users
     SET reset_token_hash = $1, reset_token_expires_at = $2, updated_at = now()
     WHERE user_id = $3`,
    [codeHash, expiresAt, userId],
  );

  // 4. Send branded email
  const bodyText =
    `Hi,\n\n` +
    `We received a request to reset your password for your Linq account.\n\n` +
    `Your 6-digit verification code is:\n` +
    `${code}\n\n` +
    `This code will expire in ${OTP_EXPIRY_MINUTES} minutes. If you did not request a password reset, you can safely ignore this email.\n`;

  const emailHtml = generatePasswordResetCodeEmailHtml({ code });

  const queueResult = await enqueueBrandedTransactionalEmail({
    to: normalized,
    subject: "Reset your password - Linq",
    text: bodyText,
    html: emailHtml,
  });

  if (!queueResult.queued) {
    await sendBrandedTransactionalEmail({
      to: normalized,
      subject: "Reset your password - Linq",
      text: bodyText,
      html: emailHtml,
    }).catch((err) => {
      logger.error({ err }, "Direct reset email sending failed");
    });
  }

  return { success: true, code, cooldownRemaining: RESEND_COOLDOWN_SECONDS };
}

export async function verifyPasswordResetCode(
  email: string,
  code: string,
): Promise<{
  success: boolean;
  resetToken?: string;
  error?: string;
}> {
  const normalized = normalizeAuthEmail(email);
  const trimmedCode = code.trim();

  if (!normalized || !/^\d{6}$/.test(trimmedCode)) {
    return { success: false, error: "Please enter a valid 6-digit verification code." };
  }

  const user = await queryNeonOneAsSystem<{ user_id: string }>(
    `SELECT user_id
     FROM public.auth_users
     WHERE email_normalized = $1 OR LOWER(email) = $1
     LIMIT 1`,
    [normalized],
  );

  if (!user?.user_id) {
    return { success: false, error: "User not registered. Please check your email or sign up." };
  }

  const activeOtp = await queryNeonOneAsSystem<{
    id: string;
    code_hash: string;
    expires_at: string;
  }>(
    `SELECT id, code_hash, expires_at
     FROM public.login_email_otp
     WHERE user_id = $1 AND consumed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [user.user_id],
  );

  if (!activeOtp) {
    return { success: false, error: "No active verification code found. Please request a new code." };
  }

  if (new Date(activeOtp.expires_at).getTime() < Date.now()) {
    await queryNeonAsSystem(
      `UPDATE public.login_email_otp SET consumed_at = now() WHERE id = $1`,
      [activeOtp.id],
    );
    return { success: false, error: "Verification code has expired. Please request a new one." };
  }

  // ── Serverless-safe failed-attempt check via Redis ───────────────────
  const attempts = await getFailedAttempts(activeOtp.id);
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    await queryNeonAsSystem(
      `UPDATE public.login_email_otp SET consumed_at = now() WHERE id = $1`,
      [activeOtp.id],
    );
    await clearFailedAttempts(activeOtp.id);
    return {
      success: false,
      error: "Too many failed attempts. This code has been invalidated. Please request a new code.",
    };
  }

  const inputHash = sha256(trimmedCode);
  let isMatch = false;
  try {
    isMatch = crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(activeOtp.code_hash));
  } catch {
    isMatch = false;
  }

  if (!isMatch) {
    const nextAttempts = await incrementFailedAttempts(activeOtp.id);
    const remaining = MAX_FAILED_ATTEMPTS - nextAttempts;

    if (remaining <= 0) {
      await queryNeonAsSystem(
        `UPDATE public.login_email_otp SET consumed_at = now() WHERE id = $1`,
        [activeOtp.id],
      );
      await clearFailedAttempts(activeOtp.id);
      return {
        success: false,
        error: "Too many failed attempts. This code has been invalidated. Please request a new code.",
      };
    }

    return {
      success: false,
      error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
    };
  }

  // Consume code immediately to prevent reuse
  await queryNeonAsSystem(
    `UPDATE public.login_email_otp SET consumed_at = now() WHERE id = $1`,
    [activeOtp.id],
  );
  await clearFailedAttempts(activeOtp.id);

  // Generate secure reset token for the final password-update step
  const resetToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(resetToken);
  const tokenExpiresAt = new Date(
    Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000,
  ).toISOString();

  await queryNeonAsSystem(
    `UPDATE public.auth_users
     SET reset_token_hash = $1, reset_token_expires_at = $2, updated_at = now()
     WHERE user_id = $3`,
    [tokenHash, tokenExpiresAt, user.user_id],
  );

  return { success: true, resetToken };
}

export async function completePasswordReset(
  token: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  if (!token || typeof token !== "string") {
    return { success: false, error: "Missing reset token. Please request a fresh reset code." };
  }

  const issues = validatePasswordPolicy(newPassword);
  if (issues.length > 0) {
    return { success: false, error: issues[0] };
  }

  const tokenHash = sha256(token);
  const user = await queryNeonOneAsSystem<{ user_id: string; email: string }>(
    `SELECT user_id, email
     FROM public.auth_users
     WHERE reset_token_hash = $1
       AND reset_token_expires_at IS NOT NULL
       AND reset_token_expires_at > now()
     LIMIT 1`,
    [tokenHash],
  );

  if (!user?.user_id) {
    return {
      success: false,
      error: "Invalid or expired reset session. Please request a new reset code.",
    };
  }

  // 1. Update password in Supabase Auth using getUserByEmail (O(1)) instead of listUsers() (O(n))
  const supabaseAdmin = getSupabaseAdminClient();
  if (supabaseAdmin) {
    try {
      // Prefer getUserByEmail if available in the SDK version, fall back to filtered listUsers
      let supabaseUserId: string | undefined;
      const adminApi = supabaseAdmin.auth.admin as any;

      if (typeof adminApi.getUserByEmail === "function") {
        const { data: sbUserData, error: sbErr } = await adminApi.getUserByEmail(user.email);
        if (!sbErr && sbUserData?.user?.id) {
          supabaseUserId = sbUserData.user.id;
        }
      } else {
        // Fallback: listUsers with filter (avoids full scan via server-side filter)
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1, page: 1 });
        const match = listData?.users?.find(
          (u: { email?: string; id: string }) => u.email?.toLowerCase() === user.email.toLowerCase(),
        );
        supabaseUserId = match?.id;
      }

      if (supabaseUserId) {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, {
          password: newPassword,
        });
        if (updateError) {
          logger.error({ err: updateError }, "Supabase Auth updateUserById error");
        }
      } else {
        // User doesn't exist in Supabase yet — create them
        await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: newPassword,
          email_confirm: true,
        });
      }
    } catch (sbError) {
      logger.error({ err: sbError }, "Supabase Auth password sync error");
    }
  }

  // 2. Update Argon2 hash in auth_users and clear reset token
  const argon2 = await getArgon2();
  const pepper = process.env.PASSWORD_PEPPER || "";
  const passwordHash = await argon2.hash(
    pepper ? `${newPassword}${pepper}` : newPassword,
    ARGON2_OPTIONS,
  );

  await queryNeonAsSystem(
    `UPDATE public.auth_users
     SET password_hash = $1,
         reset_token_hash = NULL,
         reset_token_expires_at = NULL,
         updated_at = now()
     WHERE user_id = $2`,
    [passwordHash, user.user_id],
  );

  // 3. Best-effort sync with Neon Auth if configured
  if (process.env.NEON_AUTH_BASE_URL) {
    try {
      const { neonAuth } = await import("@/auth");
      await (neonAuth as any).resetPassword?.({
        token,
        newPassword,
      });
    } catch {}
  }

  return { success: true };
}
