/**
 * Applies Cloudinary auto-format/quality transforms for faster CDN delivery.
 * Non-Cloudinary URLs are returned unchanged (backward compatible).
 */
export function optimizeCdnImageUrl(
  url: string,
  options?: { width?: number; quality?: "auto" | number },
): string {
  const raw = String(url || "").trim();
  if (!raw || !raw.includes("res.cloudinary.com") || !raw.includes("/upload/")) {
    return raw;
  }

  const width = options?.width;
  const quality = options?.quality ?? "auto";
  const transformParts = ["f_auto", `q_${quality}`];
  if (width && width > 0) {
    transformParts.push(`w_${Math.round(width)}`, "c_limit");
  }
  const transform = transformParts.join(",");

  const marker = "/upload/";
  const idx = raw.indexOf(marker);
  if (idx < 0) return raw;

  const prefix = raw.slice(0, idx + marker.length);
  const suffix = raw.slice(idx + marker.length);
  if (suffix.startsWith(`${transform}/`) || /^v\d+\//.test(suffix) && suffix.includes(`${transform}/`)) {
    return raw;
  }
  if (/^[^/]+\//.test(suffix) && !suffix.startsWith("v")) {
    return `${prefix}${transform}/${suffix}`;
  }
  return `${prefix}${transform}/${suffix}`;
}
