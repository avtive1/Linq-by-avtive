import crypto from "node:crypto";
import { queryNeonAsSystem, queryNeonOneAsSystem } from "@/lib/neon-db";
import { sendBrandedTransactionalEmail } from "@/lib/notifications/branded-email";
import { getPublicAppUrl } from "@/lib/app-url";
import { generateLoginOtpEmailHtml } from "@/lib/email-templates/account-emails";

let schemaReady = false;

export async function ensureLoginEmailOtpSchema() {
  if (schemaReady) return;
  await queryNeonAsSystem(`
    CREATE TABLE IF NOT EXISTS public.login_email_otp (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES public.auth_users(user_id) ON DELETE CASCADE,
      code_hash text NOT NULL,
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await queryNeonAsSystem(
    `CREATE INDEX IF NOT EXISTS login_email_otp_user_expires_idx ON public.login_email_otp (user_id, expires_at DESC)`,
  );
  schemaReady = true;
}

/** When false, organization users skip email OTP (e.g. local dev without Resend). */
export function isOrgLoginEmailOtpGloballyEnabled(): boolean {
  return Boolean(process.env.SMTP_USER?.trim()) && process.env.ORG_LOGIN_EMAIL_OTP !== "false";
}

export async function isOrganizationAccountUser(userId: string): Promise<boolean> {
  await ensureLoginEmailOtpSchema();

  // Bypass OTP for the superadmin
  const user = await queryNeonOneAsSystem<{ email: string }>(
    `SELECT email FROM public.auth_users WHERE user_id = $1::uuid LIMIT 1`,
    [userId]
  );
  const superAdminEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase() || "";
  if (user && superAdminEmail && user.email.toLowerCase() === superAdminEmail) {
    return false;
  }

  const owner = await queryNeonOneAsSystem<{ setup_completed: string | null }>(
    `SELECT p.owner_profile_setup_completed_at AS setup_completed 
     FROM public.organizations o 
     JOIN public.profiles p ON p.id = o.owner_user_id 
     WHERE o.owner_user_id = $1::uuid LIMIT 1`,
    [userId],
  );
  if (owner) {
    // Only require OTP if they haven't completed their profile setup (first login)
    return owner.setup_completed == null;
  }
  
  const member = await queryNeonOneAsSystem<{ one: string }>(
    `SELECT '1' AS one
     FROM public.organization_members
     WHERE member_user_id = $1::uuid AND status = 'active'
     LIMIT 1`,
    [userId],
  );
  return Boolean(member);
}

export async function createAndEmailLoginOtp(userId: string, email: string): Promise<{ ok: boolean; error?: string }> {
  if (!isOrgLoginEmailOtpGloballyEnabled()) {
    return { ok: false, error: "Login email verification is not configured (set SMTP_USER)." };
  }
  await ensureLoginEmailOtpSchema();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const id = crypto.randomUUID();
  await queryNeonAsSystem(`DELETE FROM public.login_email_otp WHERE user_id = $1::uuid AND consumed_at IS NULL`, [userId]);
  await queryNeonAsSystem(
    `INSERT INTO public.login_email_otp (id, user_id, code_hash, expires_at) VALUES ($1::uuid, $2::uuid, $3, $4::timestamptz)`,
    [id, userId, codeHash, expires],
  );
  const loginUrl = `${getPublicAppUrl()}/login`;
  const result = await sendBrandedTransactionalEmail({
    to: email,
    subject: "Your AVTIVE sign-in verification code",
    text:
      `Hi there,\n\n` +
      `You are signing in to an organization account on AVTIVE.\n\n` +
      `Verification code (valid 10 minutes): ${code}\n\n` +
      `Enter this code on the login screen to finish signing in.\n\n` +
      `Didn't try to sign in? Secure your account: ${loginUrl}\n`,
    html: generateLoginOtpEmailHtml({ code, loginUrl }),
  });
  return result.sent ? { ok: true } : { ok: false, error: result.error };
}

export async function verifyActiveLoginOtp(userId: string, plainCode: string): Promise<boolean> {
  await ensureLoginEmailOtpSchema();
  const codeHash = crypto.createHash("sha256").update(plainCode.trim()).digest("hex");
  const row = await queryNeonOneAsSystem<{ id: string }>(
    `SELECT id FROM public.login_email_otp
     WHERE user_id = $1::uuid AND code_hash = $2 AND expires_at > now() AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [userId, codeHash],
  );
  return Boolean(row?.id);
}

export async function consumeLoginOtp(userId: string, plainCode: string): Promise<void> {
  await ensureLoginEmailOtpSchema();
  const codeHash = crypto.createHash("sha256").update(plainCode.trim()).digest("hex");
  await queryNeonAsSystem(
    `UPDATE public.login_email_otp SET consumed_at = now()
     WHERE user_id = $1::uuid AND code_hash = $2 AND consumed_at IS NULL`,
    [userId, codeHash],
  );
}
