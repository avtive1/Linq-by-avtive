import {
  emailCodeDisplay,
  emailLinkFallback,
  emailParagraph,
  emailPrimaryButton,
  wrapAvtiveEmailLayout,
} from "@/lib/email-templates/layout";

export function generatePasswordResetEmailHtml(params: {
  resetUrl: string;
}): string {
  return wrapAvtiveEmailLayout({
    pageTitle: "Reset your password",
    headline: "Reset your password",
    bodyHtml: `
              ${emailParagraph("We received a request to reset your AVTIVE password. Click the button below to choose a new password.")}
              ${emailParagraph("This link expires in 30 minutes. If you did not request a reset, you can safely ignore this email.", 22)}
              ${emailPrimaryButton("Reset Password", params.resetUrl)}
              ${emailLinkFallback(params.resetUrl)}`,
  });
}

export function generatePasswordResetCodeEmailHtml(params: {
  code: string;
}): string {
  return wrapAvtiveEmailLayout({
    pageTitle: "Password Reset Code - Linq",
    headline: "Password Reset Code",
    greeting: "Hi there,",
    bodyHtml: `
              ${emailParagraph("We received a request to reset your password for your Linq account. Use the 6-digit verification code below to proceed with resetting your password.")}
              ${emailCodeDisplay("Your 6-digit reset code", params.code)}
              ${emailParagraph("This code will expire in 10 minutes. For security reasons, never share this verification code with anyone.", 20)}
              ${emailParagraph("If you did not request a password reset, you can safely ignore this message. Your password will remain unchanged.", 16)}`,
  });
}

export function generateLoginOtpEmailHtml(params: {
  code: string;
  loginUrl: string;
}): string {
  return wrapAvtiveEmailLayout({
    pageTitle: "Sign-in verification code",
    headline: "Your sign-in verification code",
    bodyHtml: `
              ${emailParagraph("You are signing in to an organization account on AVTIVE. Enter the code below on the login screen to finish signing in.")}
              ${emailCodeDisplay("Verification code (valid 10 minutes)", params.code)}
              ${emailParagraph("Didn't try to sign in? Secure your account using the link below.")}
              ${emailPrimaryButton("Go to Login", params.loginUrl)}
              ${emailLinkFallback(params.loginUrl)}`,
  });
}
