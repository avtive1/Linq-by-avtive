/**
 * Creates (or reuses) a compact `/ev/{slug}` link for an existing registration path.
 * Falls back to the original URL if the API is unavailable — preserves current behavior.
 */
export async function toCompactShareUrl(longUrl: string): Promise<string> {
  try {
    const url = new URL(longUrl);
    const targetPath = `${url.pathname}${url.search}`;

    const res = await fetch("/api/short-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPath }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.data?.shortPath) {
      return longUrl;
    }
    return `${url.origin}${payload.data.shortPath}`;
  } catch {
    return longUrl;
  }
}
