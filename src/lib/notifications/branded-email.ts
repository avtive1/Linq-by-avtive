import { getOrganizationEmailLogoAttachment } from "@/lib/email-templates/organization-logo";
import { sendTransactionalEmail } from "@/lib/notifications/email";

type BrandedEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendBrandedTransactionalEmail(input: BrandedEmailInput) {
  return sendTransactionalEmail({
    ...input,
    attachments: input.html ? [getOrganizationEmailLogoAttachment()] : undefined,
  });
}
