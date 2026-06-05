import crypto from "node:crypto";

const DEFAULT_SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Collision-resistant URL slug (default 6 chars ≈ 56 bits of entropy).
 */
export function generateUrlSlug(length = 6, alphabet = DEFAULT_SLUG_ALPHABET): string {
  const size = Math.max(4, Math.min(length, 32));
  const bytes = crypto.randomBytes(size);
  let slug = "";
  for (let i = 0; i < size; i += 1) {
    slug += alphabet[bytes[i] % alphabet.length];
  }
  return slug;
}
