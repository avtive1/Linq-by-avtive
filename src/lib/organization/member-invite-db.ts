import crypto from "node:crypto";
import { queryNeon } from "@/lib/neon-db";

let inviteColumnsEnsured = false;

export async function ensureOrganizationMemberInviteColumns() {
  if (inviteColumnsEnsured) return;
  await queryNeon(`ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS invite_token_hash text NULL`);
  await queryNeon(
    `ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS invite_token_expires_at timestamptz NULL`,
  );
  inviteColumnsEnsured = true;
}

export function createInviteRawToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}
