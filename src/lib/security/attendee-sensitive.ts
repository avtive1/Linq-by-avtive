import { ATTENDEE_CLASS_A_FIELDS } from "./classification";
import {
  decryptSensitiveString,
  deterministicLookupTag,
  encryptSensitiveString,
  getActiveKekId,
  hasEnvelopeCryptoConfigured,
  isEncryptedEnvelope,
} from "./crypto-envelope";
import { logSecurityEvent } from "./telemetry";

type GenericRow = Record<string, unknown>;

function fieldContext(field: string) {
  return `attendees.${field}`;
}

export function encryptAttendeeSensitiveFields<T extends GenericRow>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  if (!hasEnvelopeCryptoConfigured()) {
    return out as T;
  }
  for (const field of ATTENDEE_CLASS_A_FIELDS) {
    const value = out[field];
    if (typeof value !== "string" || !value.trim()) continue;
    if (isEncryptedEnvelope(value)) continue;
    out[field] = encryptSensitiveString(value, fieldContext(field));
  }

  const email = out.card_email;
  if (typeof email === "string" && email.trim()) {
    out.card_email_lookup_tag = deterministicLookupTag(email.trim().toLowerCase(), "attendees.card_email");
  }
  return out as T;
}

export function decryptAttendeeSensitiveFields<T extends GenericRow>(row: T): {
  row: T;
  migrationPatch: Partial<T>;
} {
  const out: Record<string, unknown> = { ...row };
  const migrationPatch: Record<string, unknown> = {};
  const canEncrypt = hasEnvelopeCryptoConfigured();
  const activeKek = getActiveKekId();

  for (const field of ATTENDEE_CLASS_A_FIELDS) {
    const raw = out[field];
    if (typeof raw !== "string" || !raw.trim()) continue;

    if (!isEncryptedEnvelope(raw)) {
      if (canEncrypt) {
        try {
          migrationPatch[field] = encryptSensitiveString(raw, fieldContext(field));
        } catch (err) {
          logSecurityEvent({
            event: "security.attendees.lazy_reencrypt_skipped",
            level: "warn",
            details: { field, reason: err instanceof Error ? err.message : "encrypt_failed" },
          });
        }
      }
      continue;
    }

    try {
      const dec = decryptSensitiveString(raw, fieldContext(field));
      out[field] = dec.plaintext;
      if (canEncrypt && dec.kid !== activeKek) {
        migrationPatch[field] = encryptSensitiveString(dec.plaintext, fieldContext(field));
      }
    } catch (err) {
      logSecurityEvent({
        event: "security.attendees.decrypt_failed",
        level: "error",
        details: { field, reason: err instanceof Error ? err.message : "decrypt_failed" },
      });
    }
  }

  const email = out.card_email;
  if (canEncrypt && typeof email === "string" && email.trim()) {
    migrationPatch.card_email_lookup_tag = deterministicLookupTag(
      email.trim().toLowerCase(),
      "attendees.card_email",
    );
  }

  if (Object.keys(migrationPatch).length > 0) {
    logSecurityEvent({
      event: "security.attendees.lazy_reencrypt_scheduled",
      level: "info",
      details: { fields: Object.keys(migrationPatch) },
    });
  }

  return { row: out as T, migrationPatch: migrationPatch as Partial<T> };
}
