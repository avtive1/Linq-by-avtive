import { sendTransactionalEmail } from "@/lib/notifications/email";
import { getPublicAppUrl } from "@/lib/app-url";
import { generateOrganizationCreatedWelcomeEmailHtml } from "@/lib/email-templates/organization-created";

export async function sendOrganizationCreatedWelcomeEmail(input: {
  to: string;
  organizationName: string;
  temporaryPassword: string;
}): Promise<{ sent: boolean; error?: string }> {
  const appUrl = getPublicAppUrl();
  const loginUrl = `${appUrl}/login`;
  const logoUrl = `${appUrl}/avtive-logo.png`;
  const body =
    `Hi there,\n\n` +
    `Your organization "${input.organizationName}" has been created on AVTIVE.\n\n` +
    `Use this email address (${input.to}) along with the temporary password below to log in.\n` +
    `Change your password after first login (Profile / security).\n\n` +
    `Login email: ${input.to}\n` +
    `Temporary password: ${input.temporaryPassword}\n\n` +
    `Go to Login: ${loginUrl}\n`;
  return sendTransactionalEmail({
    to: input.to,
    subject: `Your organization "${input.organizationName}" is ready on AVTIVE`,
    text: body,
    html: generateOrganizationCreatedWelcomeEmailHtml({
      organizationName: input.organizationName,
      loginEmail: input.to,
      temporaryPassword: input.temporaryPassword,
      loginUrl,
      logoUrl,
    }),
  });
}

export async function sendTeamMemberInviteEmail(input: {
  to: string;
  organizationName: string;
  roleLabel: string;
  acceptInviteUrl: string;
}): Promise<{ sent: boolean; error?: string }> {
  const loginUrl = `${getPublicAppUrl()}/login`;
  const body =
    `You have been invited to join "${input.organizationName}" on AVTIVE as: ${input.roleLabel}.\n\n` +
    `Accept this invitation (use the same email this message was sent to):\n${input.acceptInviteUrl}\n\n` +
    `Or sign in after your admin has added you:\n${loginUrl}\n`;
  return sendTransactionalEmail({
    to: input.to,
    subject: `Invitation to join ${input.organizationName} on AVTIVE`,
    text: body,
  });
}

export async function sendTeamMemberAddedOwnerNoticeEmail(input: {
  ownerEmail: string;
  organizationName: string;
  memberEmail: string;
  roleLabel: string;
}): Promise<{ sent: boolean; error?: string }> {
  const body =
    `A team member was added to "${input.organizationName}".\n\n` +
    `Member email: ${input.memberEmail}\n` +
    `Role: ${input.roleLabel}\n\n` +
    `If you did not perform this action, sign in and review Team Access on your dashboard.\n`;
  return sendTransactionalEmail({
    to: input.ownerEmail,
    subject: `Team member added — ${input.organizationName}`,
    text: body,
  });
}
