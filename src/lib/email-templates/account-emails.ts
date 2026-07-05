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
