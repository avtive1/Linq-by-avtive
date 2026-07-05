import {
  emailDetailBox,
  emailLinkFallback,
  emailParagraph,
  emailPrimaryButton,
  escapeHtml,
  wrapAvtiveEmailLayout,
} from "@/lib/email-templates/layout";

export function generateTeamMemberInviteEmailHtml(params: {
  organizationName: string;
  roleLabel: string;
  loginEmail: string;
  acceptInviteUrl: string;
  loginUrl: string;
}): string {
  const organizationName = escapeHtml(params.organizationName);

  return wrapAvtiveEmailLayout({
    pageTitle: "Organization invitation",
    headline: "You're invited to join an organization",
    bodyHtml: `
              ${emailParagraph(`You have been invited to join <strong style="color:#1c1c1e;">${organizationName}</strong> on AVTIVE as <strong style="color:#1c1c1e;">${escapeHtml(params.roleLabel)}</strong>.`)}
              ${emailParagraph(`Use this email address (<strong style="color:#1c1c1e;">${escapeHtml(params.loginEmail)}</strong>) when accepting the invitation or signing in.`, 22)}
              ${emailPrimaryButton("Accept Invitation", params.acceptInviteUrl)}
              ${emailLinkFallback(params.acceptInviteUrl)}
              ${emailParagraph(`Already added by your admin? <a href="${escapeHtml(params.loginUrl)}" style="color:#4262ff;">Sign in here</a>.`, 0)}`,
  });
}

export function generateTeamMemberAddedOwnerNoticeEmailHtml(params: {
  organizationName: string;
  memberEmail: string;
  roleLabel: string;
  dashboardUrl: string;
}): string {
  const organizationName = escapeHtml(params.organizationName);

  return wrapAvtiveEmailLayout({
    pageTitle: "Team member added",
    headline: "Team member added",
    bodyHtml: `
              ${emailParagraph(`A team member was added to <strong style="color:#1c1c1e;">${organizationName}</strong>.`)}
              ${emailDetailBox("Member details", [
                { label: "Member email", value: params.memberEmail },
                { label: "Role", value: params.roleLabel },
              ])}
              ${emailParagraph("If you did not perform this action, sign in and review Team Access on your dashboard.")}
              ${emailPrimaryButton("Open Dashboard", params.dashboardUrl)}
              ${emailLinkFallback(params.dashboardUrl)}`,
  });
}
