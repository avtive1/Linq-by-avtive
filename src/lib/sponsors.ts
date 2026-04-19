import type { SupabaseClient } from "@supabase/supabase-js";
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
  supabase: SupabaseClient,
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
      const blob = await fetch(logo_url).then((r) => r.blob());
      const ext = (blob.type.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "") || "png";
      const path = `${userId}/sponsors/${eventId}/${Date.now()}-${seq}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("event-logos")
        .upload(path, blob, { contentType: blob.type || "image/png" });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from("event-logos").getPublicUrl(uploadData.path);
      logo_url = pub.publicUrl;
    }
    out.push({ name, logo_url });
    seq++;
  }
  return out;
}
