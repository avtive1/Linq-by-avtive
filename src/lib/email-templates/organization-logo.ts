import path from "node:path";

/** Inline attachment id for the organization welcome email logo. */
export const ORGANIZATION_EMAIL_LOGO_CID = "avtive-logo@avtive.app";

export function getOrganizationEmailLogoSrc(): string {
  return `cid:${ORGANIZATION_EMAIL_LOGO_CID}`;
}

export function getOrganizationEmailLogoAttachment() {
  return {
    filename: "avtive-logo.png",
    path: path.join(process.cwd(), "public", "avtive-logo.png"),
    cid: ORGANIZATION_EMAIL_LOGO_CID,
  };
}
