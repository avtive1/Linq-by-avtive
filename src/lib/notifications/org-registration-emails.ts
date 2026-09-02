import {
  enqueueBrandedTransactionalEmail,
  type EmailQueueResult,
} from "@/lib/notifications/email-outbox";
import { getPublicAppUrl } from "@/lib/app-url";
import { generateOrganizationRegistrationReceivedEmailHtml } from "@/lib/email-templates/organization-registration-received";
import { generateOrganizationRegistrationApprovedEmailHtml } from "@/lib/email-templates/organization-registration-approved";
import { generateOrganizationRegistrationRejectedEmailHtml } from "@/lib/email-templates/organization-registration-rejected";
import { generateOrganizationRegistrationChangesRequestedEmailHtml } from "@/lib/email-templates/organization-registration-changes-requested";

export async function sendOrganizationRegistrationReceivedEmail(input: {
  to: string;
  contactName: string;
  organizationName: string;
  referenceNumber: string;
}): Promise<EmailQueueResult> {
  const statusUrl = `${getPublicAppUrl()}/organization/status?ref=${encodeURIComponent(input.referenceNumber)}`;
  const textBody =
    `Hi ${input.contactName},\n\n` +
    `Your organization registration request for "${input.organizationName}" has been received by Linq.\n\n` +
    `Reference Number: ${input.referenceNumber}\n` +
    `Status: Pending Review\n\n` +
    `You can track your registration status here:\n${statusUrl}\n`;

  return enqueueBrandedTransactionalEmail({
    to: input.to,
    subject: `Registration received: ${input.organizationName} (Ref: ${input.referenceNumber})`,
    text: textBody,
    html: generateOrganizationRegistrationReceivedEmailHtml({
      contactName: input.contactName,
      organizationName: input.organizationName,
      referenceNumber: input.referenceNumber,
      statusUrl,
    }),
  });
}

export async function sendOrganizationRegistrationApprovedEmail(input: {
  to: string;
  contactName: string;
  organizationName: string;
  temporaryPassword?: string;
}): Promise<EmailQueueResult> {
  const loginUrl = `${getPublicAppUrl()}/login`;
  let textBody =
    `Hi ${input.contactName},\n\n` +
    `Great news! Your organization "${input.organizationName}" has been approved on Linq.\n\n`;

  if (input.temporaryPassword) {
    textBody +=
      `Use your login email (${input.to}) and temporary password below to sign in:\n` +
      `Temporary password: ${input.temporaryPassword}\n\n`;
  }

  textBody += `Sign in to Linq: ${loginUrl}\n`;

  return enqueueBrandedTransactionalEmail({
    to: input.to,
    subject: `Organization Approved: Welcome "${input.organizationName}" to Linq`,
    text: textBody,
    html: generateOrganizationRegistrationApprovedEmailHtml({
      contactName: input.contactName,
      organizationName: input.organizationName,
      loginEmail: input.to,
      temporaryPassword: input.temporaryPassword,
      loginUrl,
    }),
  });
}

export async function sendOrganizationRegistrationRejectedEmail(input: {
  to: string;
  contactName: string;
  organizationName: string;
  rejectionReason: string;
}): Promise<EmailQueueResult> {
  const textBody =
    `Hi ${input.contactName},\n\n` +
    `Thank you for your interest in Linq. After reviewing the registration for "${input.organizationName}", we are unable to approve your application at this time.\n\n` +
    `Reason: ${input.rejectionReason}\n`;

  return enqueueBrandedTransactionalEmail({
    to: input.to,
    subject: `Update on your registration for ${input.organizationName}`,
    text: textBody,
    html: generateOrganizationRegistrationRejectedEmailHtml({
      contactName: input.contactName,
      organizationName: input.organizationName,
      rejectionReason: input.rejectionReason,
    }),
  });
}

export async function sendOrganizationRegistrationChangesRequestedEmail(input: {
  to: string;
  contactName: string;
  organizationName: string;
  referenceNumber: string;
  changesRequestedNotes: string;
}): Promise<EmailQueueResult> {
  const editUrl = `${getPublicAppUrl()}/organization/register?ref=${encodeURIComponent(input.referenceNumber)}`;
  const textBody =
    `Hi ${input.contactName},\n\n` +
    `Action required for "${input.organizationName}" on Linq.\n\n` +
    `Requested Changes:\n${input.changesRequestedNotes}\n\n` +
    `Update and resubmit your registration here:\n${editUrl}\n`;

  return enqueueBrandedTransactionalEmail({
    to: input.to,
    subject: `Action Required: Update registration for ${input.organizationName} (Ref: ${input.referenceNumber})`,
    text: textBody,
    html: generateOrganizationRegistrationChangesRequestedEmailHtml({
      contactName: input.contactName,
      organizationName: input.organizationName,
      referenceNumber: input.referenceNumber,
      changesRequestedNotes: input.changesRequestedNotes,
      editUrl,
    }),
  });
}
