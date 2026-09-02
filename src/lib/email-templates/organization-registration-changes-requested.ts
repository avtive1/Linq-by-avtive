import {
  emailDetailBox,
  emailLinkFallback,
  emailParagraph,
  emailPrimaryButton,
  escapeHtml,
  wrapAvtiveEmailLayout,
} from "@/lib/email-templates/layout";

export function generateOrganizationRegistrationChangesRequestedEmailHtml(params: {
  contactName: string;
  organizationName: string;
  referenceNumber: string;
  changesRequestedNotes: string;
  editUrl: string;
}): string {
  const contactName = escapeHtml(params.contactName);
  const organizationName = escapeHtml(params.organizationName);
  const referenceNumber = escapeHtml(params.referenceNumber);
  const changesNotes = escapeHtml(params.changesRequestedNotes);

  return wrapAvtiveEmailLayout({
    pageTitle: "Action Required: Update Organization Registration",
    headline: "Action Required: Update Details",
    bodyHtml: `
      ${emailParagraph(`Hi <strong style="color:#1c1c1e;">${contactName}</strong>,`)}
      ${emailParagraph(`We have reviewed your registration request for <strong style="color:#1c1c1e;">${organizationName}</strong>. Our team needs additional information or revisions before we can proceed with approval.`)}
      ${emailDetailBox("Reviewer Feedback", [
        { label: "Organization", value: params.organizationName },
        { label: "Reference Number", value: referenceNumber, monospace: true },
        { label: "Requested Changes", value: changesNotes },
      ])}
      ${emailParagraph(`Please click the button below to update and resubmit your registration details.`)}
      ${emailPrimaryButton("Update & Resubmit Registration", params.editUrl)}
      ${emailLinkFallback(params.editUrl)}`,
  });
}
