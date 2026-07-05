import {
  emailDetailBox,
  emailHighlightBox,
  emailLinkFallback,
  emailParagraph,
  emailPrimaryButton,
  escapeHtml,
  wrapAvtiveEmailLayout,
} from "@/lib/email-templates/layout";

export function generateOrgJoinRequestOwnerEmailHtml(params: {
  organizationName: string;
  requesterEmail: string;
  requestId: string;
  dashboardUrl: string;
}): string {
  const organizationName = escapeHtml(params.organizationName);

  return wrapAvtiveEmailLayout({
    pageTitle: "Organization verification request",
    headline: "Organization verification request",
    bodyHtml: `
              ${emailParagraph(`A user requested to join your organization: <strong style="color:#1c1c1e;">${organizationName}</strong>.`)}
              ${emailDetailBox("Request details", [
                { label: "Requester email", value: params.requesterEmail },
                { label: "Request ID", value: params.requestId, monospace: true },
              ])}
              ${emailParagraph("Please review this request in your dashboard inbox.")}
              ${emailPrimaryButton("Review Request", params.dashboardUrl)}
              ${emailLinkFallback(params.dashboardUrl)}`,
  });
}

export function generateOrgJoinRequestDecisionEmailHtml(params: {
  organizationName: string;
  status: string;
  dashboardUrl: string;
  approved: boolean;
}): string {
  const organizationName = escapeHtml(params.organizationName);
  const status = escapeHtml(params.status);

  return wrapAvtiveEmailLayout({
    pageTitle: "Organization join request update",
    headline: "Organization join request update",
    bodyHtml: `
              ${emailHighlightBox(
                `Your request to join <strong>${organizationName}</strong> was <strong>${status}</strong>.`,
                params.approved ? "success" : "warning",
              )}
              ${emailParagraph(
                params.approved
                  ? "You can now continue in the dashboard as an organization member."
                  : "If this seems incorrect, contact your organization admin.",
              )}
              ${emailPrimaryButton("Open Dashboard", params.dashboardUrl)}
              ${emailLinkFallback(params.dashboardUrl)}`,
  });
}
