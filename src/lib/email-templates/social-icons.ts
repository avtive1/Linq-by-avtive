import path from "node:path";
import { createInlineImageAttachment } from "@/lib/email-templates/organization-logo";

const SOCIAL_ICONS_DIR = path.join(process.cwd(), "public", "email-icons");

export const EMAIL_SOCIAL_ICON_CIDS = {
  instagram: "avtive-social-instagram@avtive.app",
  linkedin: "avtive-social-linkedin@avtive.app",
  facebook: "avtive-social-facebook@avtive.app",
  email: "avtive-social-email@avtive.app",
  whatsapp: "avtive-social-whatsapp@avtive.app",
} as const;

export type EmailSocialIconKey = keyof typeof EMAIL_SOCIAL_ICON_CIDS;

export function getEmailSocialIconSrc(key: EmailSocialIconKey): string {
  return `cid:${EMAIL_SOCIAL_ICON_CIDS[key]}`;
}

export function getEmailSocialIconAttachments() {
  return (Object.keys(EMAIL_SOCIAL_ICON_CIDS) as EmailSocialIconKey[]).map((name) =>
    createInlineImageAttachment({
      filename: `${name}.png`,
      filePath: path.join(SOCIAL_ICONS_DIR, `${name}.png`),
      cid: EMAIL_SOCIAL_ICON_CIDS[name],
    }),
  );
}
