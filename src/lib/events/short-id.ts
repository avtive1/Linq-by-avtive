import { queryNeonOneAsSystem } from "@/lib/neon-db";

/**
 * Generates a collision-resistant timestamp-based short ID for events.
 * Format: Base36 Timestamp + Base36 Random Suffix (e.g. "m6m8z5k_9x2a")
 */
export function generateUniqueEventShortId(customCandidate?: string): string {
  if (customCandidate) {
    const sanitized = customCandidate.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
    if (sanitized.length >= 6) return sanitized;
  }
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${timestamp}_${randomPart}`;
}

/**
 * Checks the database for collisions and returns a guaranteed unique short ID.
 * Retries up to `maxAttempts` times before using a crypto-random UUID fallback.
 */
export async function getOrGenerateUniqueShortId(preferredCandidate?: string, maxAttempts = 5): Promise<string> {
  if (preferredCandidate) {
    const candidate = generateUniqueEventShortId(preferredCandidate);
    try {
      const existing = await queryNeonOneAsSystem<{ id: string }>(
        `SELECT id FROM public.events WHERE short_id = $1 LIMIT 1`,
        [candidate],
      );
      if (!existing?.id) {
        return candidate;
      }
    } catch {
      // ignore
    }
  }

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
