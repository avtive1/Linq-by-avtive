import crypto from "node:crypto";
export async function ensureOrganizationMemberInviteColumns() {
  // Schema is provisioned by Prisma migrations. Kept for call-site compatibility.
}

export function createInviteRawToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}
