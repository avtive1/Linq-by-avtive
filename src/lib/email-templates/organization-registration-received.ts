import {
  emailDetailBox,
  emailLinkFallback,
  emailParagraph,
  emailPrimaryButton,
  escapeHtml,
  wrapAvtiveEmailLayout,
} from "@/lib/email-templates/layout";

export function generateOrganizationRegistrationReceivedEmailHtml(params: {
  contactName: string;
  organizationName: string;
  referenceNumber: string;
  statusUrl: string;
}): string {
  const contactName = escapeHtml(params.contactName);
  const organizationName = escapeHtml(params.organizationName);
  const referenceNumber = escapeHtml(params.referenceNumber);

  return wrapAvtiveEmailLayout({
    pageTitle: "Organization Registration Received",
    headline: "Registration Request Received",
    bodyHtml: `
      ${emailParagraph(`Hi <strong style="color:#1c1c1e;">${contactName}</strong>,`)}
      ${emailParagraph(`Thank you for submitting a registration request for <strong style="color:#1c1c1e;">${organizationName}</strong> on Linq.`)}
      ${emailParagraph(`Our team is currently reviewing your submission. You will receive an email once your organization has been approved.`)}
      ${emailDetailBox("Registration Details", [
        { label: "Organization", value: params.organizationName },
        { label: "Reference Number", value: referenceNumber, monospace: true },
        { label: "Status", value: "Pending Review" },
      ])}
      ${emailPrimaryButton("Track Registration Status", params.statusUrl)}
      ${emailLinkFallback(params.statusUrl)}`,
  });
}
