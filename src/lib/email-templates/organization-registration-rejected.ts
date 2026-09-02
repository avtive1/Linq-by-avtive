import {
  emailDetailBox,
  emailParagraph,
  escapeHtml,
  wrapAvtiveEmailLayout,
} from "@/lib/email-templates/layout";

export function generateOrganizationRegistrationRejectedEmailHtml(params: {
  contactName: string;
  organizationName: string;
  rejectionReason: string;
}): string {
  const contactName = escapeHtml(params.contactName);
  const organizationName = escapeHtml(params.organizationName);
  const rejectionReason = escapeHtml(params.rejectionReason);

  return wrapAvtiveEmailLayout({
    pageTitle: "Organization Registration Update",
    headline: "Registration Request Update",
    bodyHtml: `
      ${emailParagraph(`Hi <strong style="color:#1c1c1e;">${contactName}</strong>,`)}
      ${emailParagraph(`Thank you for your interest in Linq. After reviewing the registration request for <strong style="color:#1c1c1e;">${organizationName}</strong>, we are unable to approve your application at this time.`)}
      ${emailDetailBox("Reason for Decision", [
        { label: "Organization", value: params.organizationName },
        { label: "Feedback", value: rejectionReason },
      ])}
      ${emailParagraph(`If you have questions or believe this is an error, please reach out to our support team.`)}`,
  });
}
