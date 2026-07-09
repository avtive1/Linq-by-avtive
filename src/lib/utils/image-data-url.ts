/** True when `value` is a non-empty image data URL suitable for preview/upload. */
export function isValidImageDataUrl(value: string): boolean {
  const raw = String(value || "").trim();
  if (!raw.startsWith("data:image/")) return false;
  const comma = raw.indexOf(",");
  if (comma < 0) return false;
  const payload = raw.slice(comma + 1).trim();
  return payload.length >= 32;
}
