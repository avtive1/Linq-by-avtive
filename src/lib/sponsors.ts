import type { SponsorEntry } from "@/types/card";

export const MAX_EVENT_SPONSORS = 5;

export function parseEventSponsors(raw: unknown): SponsorEntry[] {
  if (raw == null) return [];
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      return [];
    }
  } else return [];

  const out: SponsorEntry[] = [];
  for (const item of arr) {
    if (out.length >= MAX_EVENT_SPONSORS) break;
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const logo_url = typeof o.logo_url === "string" ? o.logo_url.trim() : "";
    if (logo_url) out.push({ name: name || "Sponsor", logo_url });
  }
  return out;
}

export type SponsorFormRow = { name: string; logo: string };

export async function resolveSponsorRowsToEntries(
  userId: string,
  eventId: string,
  rows: SponsorFormRow[],
): Promise<SponsorEntry[]> {
  const out: SponsorEntry[] = [];
  let seq = 0;
  for (const row of rows) {
    if (out.length >= MAX_EVENT_SPONSORS) break;
    const name = row.name.trim();
    if (!name || !row.logo?.trim()) continue;

    let logo_url = row.logo.trim();
    if (logo_url.startsWith("data:")) {
      const uploadRes = await fetch("/api/media/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataUrl: logo_url,
          folder: `${userId}/sponsors/${eventId}`,
        }),
      });
      const uploadPayload = await uploadRes.json();
      if (!uploadRes.ok || !uploadPayload?.data?.url) {
        throw new Error(uploadPayload?.error || "Failed to upload sponsor logo.");
      }
      logo_url = String(uploadPayload.data.url);
    }
    out.push({ name, logo_url });
    seq++;
  }
  return out;
}
