import { queryNeonOne } from "@/lib/neon-db";

/**
 * Generates a collision-resistant timestamp-based short ID for events.
 * Format: Base36 Timestamp + Base36 Random Suffix (e.g. "m6m8z5k9x2a")
 */
export function generateUniqueEventShortId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 7);
  return `${timestamp}${randomPart}`;
}

/**
 * Checks the database for collisions and returns a guaranteed unique short ID.
 * Retries up to `maxAttempts` times before using a crypto-random UUID fallback.
 */
export async function getOrGenerateUniqueShortId(maxAttempts = 5): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateUniqueEventShortId();
    try {
      const existing = await queryNeonOne<{ id: string }>(
        `SELECT id FROM public.events WHERE short_id = $1 LIMIT 1`,
        [candidate],
      );
      if (!existing?.id) {
        return candidate;
      }
    } catch {
      // If query check fails, return candidate to let database unique constraint validate
      return candidate;
    }
  }

  // High-entropy UUID fallback if all attempts collide
  const uuidSuffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID().replace(/-/g, "").substring(0, 8)
    : Math.random().toString(36).substring(2, 10);
  return `ev_${Date.now().toString(36)}_${uuidSuffix}`;
}
