import {
  emailDetailBox,
  emailLinkFallback,
  emailParagraph,
  emailPrimaryButton,
  escapeHtml,
  wrapAvtiveEmailLayout,
} from "@/lib/email-templates/layout";

export function generateOrganizationRegistrationApprovedEmailHtml(params: {
  contactName: string;
  organizationName: string;
  loginEmail: string;
  temporaryPassword?: string;
  loginUrl: string;
}): string {
  const contactName = escapeHtml(params.contactName);
  const organizationName = escapeHtml(params.organizationName);

  const detailRows = [
    { label: "Organization", value: params.organizationName },
    { label: "Login Email", value: params.loginEmail },
  ];

  if (params.temporaryPassword) {
    detailRows.push({
      label: "Temporary Password",
      value: params.temporaryPassword,
    });
  }

  const credentialsNote = params.temporaryPassword
    ? emailParagraph(
        `We have created an administrator account for you. Use the login email (<strong style="color:#1c1c1e;">${escapeHtml(
          params.loginEmail,
        )}</strong>) and temporary password below to sign in. For security, please change your password upon initial login.`,
        20,
      )
    : emailParagraph(
        `You can now access your organization console by signing in with your existing account (<strong style="color:#1c1c1e;">${escapeHtml(
          params.loginEmail,
        )}</strong>).`,
        20,
      );

  return wrapAvtiveEmailLayout({
    pageTitle: "Organization Approved",
    headline: "Welcome to Linq!",
    bodyHtml: `
      ${emailParagraph(`Hi <strong style="color:#1c1c1e;">${contactName}</strong>,`)}
      ${emailParagraph(`Great news! Your organization <strong style="color:#1c1c1e;">${organizationName}</strong> has been approved and is now active on Linq.`)}
      ${credentialsNote}
      ${emailDetailBox("Access Credentials", detailRows)}
      ${emailPrimaryButton("Sign In to Linq", params.loginUrl)}
      ${emailLinkFallback(params.loginUrl)}`,
  });
}
