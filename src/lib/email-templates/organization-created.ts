import {
  emailDetailBox,
  emailLinkFallback,
  emailParagraph,
  emailPrimaryButton,
  escapeHtml,
  wrapAvtiveEmailLayout,
} from "@/lib/email-templates/layout";

export function generateOrganizationCreatedWelcomeEmailHtml(params: {
  organizationName: string;
  loginEmail: string;
  temporaryPassword: string;
  loginUrl: string;
}): string {
  const organizationName = escapeHtml(params.organizationName);

  return wrapAvtiveEmailLayout({
    pageTitle: "Your organization is ready on AVTIVE",
    headline: "Your organization is ready on AVTIVE",
    bodyHtml: `
              ${emailParagraph(`Your organization <strong style="color:#1c1c1e;">${organizationName}</strong> has been created. Use the login details below to access your dashboard and get started.`)}
              ${emailParagraph(`Use this email address (<strong style="color:#1c1c1e;">${escapeHtml(params.loginEmail)}</strong>) along with the temporary password below to log in. For security, change your password after your first sign-in (Profile / security).`, 22)}
              ${emailDetailBox("Your login credentials", [
                { label: "Login email", value: params.loginEmail },
                { label: "Temporary password", value: params.temporaryPassword, monospace: true },
              ])}
              ${emailPrimaryButton("Go to Login", params.loginUrl)}
              ${emailLinkFallback(params.loginUrl)}`,
  });
}
