import path from "node:path";

/** Inline attachment id for the organization welcome email logo. */
export const ORGANIZATION_EMAIL_LOGO_CID = "avtive-logo@avtive.app";

export function getOrganizationEmailLogoSrc(): string {
  return `cid:${ORGANIZATION_EMAIL_LOGO_CID}`;
}

export function createInlineImageAttachment(input: {
  filename: string;
  filePath: string;
  cid: string;
}) {
  return {
    filename: input.filename,
    path: input.filePath,
    cid: input.cid,
    contentType: "image/png",
    contentDisposition: "inline" as const,
  };
}

export function getOrganizationEmailLogoAttachment() {
  return createInlineImageAttachment({
    filename: "avtive-logo.png",
    filePath: path.join(process.cwd(), "public", "avtive-logo.png"),
    cid: ORGANIZATION_EMAIL_LOGO_CID,
  });
}
