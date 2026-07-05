import {
  emailDetailBox,
  emailHighlightBox,
  emailLinkFallback,
  emailParagraph,
  emailPrimaryButton,
  escapeHtml,
  wrapAvtiveEmailLayout,
} from "@/lib/email-templates/layout";

export function generateAccessRequestOwnerEmailHtml(params: {
  eventName: string;
  requesterEmail: string;
  requestedAction: string;
  note: string;
  dashboardUrl: string;
}): string {
  const eventName = escapeHtml(params.eventName);

  return wrapAvtiveEmailLayout({
    pageTitle: "Access request",
    headline: "New access request",
    bodyHtml: `
              ${emailParagraph(`A team member requested access for <strong style="color:#1c1c1e;">${eventName}</strong>.`)}
              ${emailDetailBox("Request details", [
                { label: "Requester", value: params.requesterEmail },
                { label: "Action", value: params.requestedAction },
                { label: "Reason", value: params.note || "N/A" },
              ])}
              ${emailParagraph("Please review this request in your dashboard.")}
              ${emailPrimaryButton("Review Request", params.dashboardUrl)}
              ${emailLinkFallback(params.dashboardUrl)}`,
  });
}

export function generateAccessRequestDecisionEmailHtml(params: {
  eventName: string;
  decisionLabel: string;
  requestedAction: string;
  dashboardUrl: string;
}): string {
  const eventName = escapeHtml(params.eventName);
  const decision = escapeHtml(params.decisionLabel);
  const tone = params.decisionLabel.toLowerCase().includes("reject") ? "warning" : "success";

  return wrapAvtiveEmailLayout({
    pageTitle: "Access request update",
    headline: "Access request update",
    bodyHtml: `
              ${emailHighlightBox(`Your access request for <strong>${eventName}</strong> was <strong>${decision}</strong>.`, tone)}
              ${emailDetailBox("Request summary", [
                { label: "Requested action", value: params.requestedAction },
                { label: "Status", value: params.decisionLabel.toUpperCase() },
              ])}
              ${emailParagraph("Check your dashboard for updated capabilities.")}
              ${emailPrimaryButton("Open Dashboard", params.dashboardUrl)}
              ${emailLinkFallback(params.dashboardUrl)}`,
  });
}
