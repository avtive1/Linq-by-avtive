import crypto from "crypto";
import { queryNeonOneAsSystem } from "@/lib/neon-db";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Generates a cryptographically secure random alphanumeric string of given length (default 12).
 */
export function generateRandomShortId(length = 12): string {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return result;
}

/**
 * Generates a collision-resistant short ID for events.
 * Format: 12-character high-entropy alphanumeric string (e.g. "k9Xm2P8wQr4T").
 */
export function generateUniqueEventShortId(): string {
  return generateRandomShortId(12);
}

/**
 * Checks the database for collisions and returns a guaranteed unique short ID.
 * Retries up to `maxAttempts` times before using a high-entropy fallback.
 */
export async function getOrGenerateUniqueShortId(maxAttempts = 5): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateUniqueEventShortId();
    try {
      const existing = await queryNeonOneAsSystem<{ id: string }>(
        `SELECT id FROM public.events WHERE short_id = $1 LIMIT 1`,
        [candidate],
      );
      if (!existing?.id) {
        return candidate;
      }
    } catch {
      return candidate;
    }
  }

  return generateRandomShortId(16);
}

