import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptAttendeeSensitiveFields,
  encryptAttendeeSensitiveFields,
} from "@/lib/security/attendee-sensitive";

const originalKeks = process.env.SECURITY_KEKS_JSON;
const originalActiveKek = process.env.SECURITY_ACTIVE_KEK_ID;
const originalHmacKey = process.env.SECURITY_HMAC_KEY;
const testKey = Buffer.alloc(32, 7).toString("base64");

beforeEach(() => {
  process.env.SECURITY_KEKS_JSON = JSON.stringify({ test_kek: testKey });
  process.env.SECURITY_ACTIVE_KEK_ID = "test_kek";
  process.env.SECURITY_HMAC_KEY = testKey;
});

afterEach(() => {
  process.env.SECURITY_KEKS_JSON = originalKeks;
  process.env.SECURITY_ACTIVE_KEK_ID = originalActiveKek;
  process.env.SECURITY_HMAC_KEY = originalHmacKey;
});

describe("attendee sensitive field migration", () => {
  it("does not schedule a lookup-tag update when the existing tag is current", () => {
    const stored = encryptAttendeeSensitiveFields({
      card_email: "attendee@example.com",
    });

    const { row, migrationPatch } = decryptAttendeeSensitiveFields(stored);

    expect(row.card_email).toBe("attendee@example.com");
    expect(migrationPatch).toEqual({});
  });

  it("schedules a lookup-tag update when the stored tag is stale", () => {
    const stored = encryptAttendeeSensitiveFields({
      card_email: "attendee@example.com",
      card_email_lookup_tag: "stale",
    });
    stored.card_email_lookup_tag = "stale";

    const { migrationPatch } = decryptAttendeeSensitiveFields(stored);

    expect(migrationPatch.card_email_lookup_tag).toBeTruthy();
    expect(migrationPatch.card_email_lookup_tag).not.toBe("stale");
  });
});
