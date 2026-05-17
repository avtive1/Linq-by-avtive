import { sendTransactionalEmail } from "@/lib/notifications/email";
import { getPublicAppUrl } from "@/lib/app-url";

export async function sendOrganizationCreatedWelcomeEmail(input: {
  to: string;
  organizationName: string;
  temporaryPassword: string;
}): Promise<{ sent: boolean; error?: string }> {
  const loginUrl = `${getPublicAppUrl()}/login`;
  const body =
    `Your organization "${input.organizationName}" has been created on AVTIVE.\n\n` +
    `You can sign in with this email address and the temporary password below.\n` +
    `Change your password after first login (Profile / security).\n\n` +
    `Temporary password: ${input.temporaryPassword}\n\n` +
    `Sign in: ${loginUrl}\n`;
  return sendTransactionalEmail({
    to: input.to,
    subject: `Your organization "${input.organizationName}" is ready on AVTIVE`,
    text: body,
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
