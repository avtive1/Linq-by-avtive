/**
 * Card typography: preset keys bundled via next/font, or Google Fonts via stored token `gf~` + encoded family name.
 */

export const CARD_FONT_GOOGLE_PREFIX = "gf~" as const;

/** Keys aligned with CardPreview `fontMap` and next/font CSS variables in `layout.tsx`. */
export const CARD_FONT_PRESETS = ["inter", "poppins", "outfit", "times"] as const;
export type CardFontPreset = (typeof CARD_FONT_PRESETS)[number];

export function isCardFontPresetKey(value: string): value is CardFontPreset {
  return (CARD_FONT_PRESETS as readonly string[]).includes(value);
}

export function isStoredGoogleCardFont(value: string): boolean {
  return value.startsWith(CARD_FONT_GOOGLE_PREFIX);
}

/** Canonical token for persistence (normalize encoding). */
export function googleCardFontToken(family: string): string {
  const trimmed = family.trim().replace(/\s+/g, " ");
  return `${CARD_FONT_GOOGLE_PREFIX}${encodeURIComponent(trimmed)}`;
}

export function parseGoogleFamilyFromStored(value: string): string | null {
  if (!isStoredGoogleCardFont(value)) return null;
  const raw = value.slice(CARD_FONT_GOOGLE_PREFIX.length);
  try {
    const decoded = decodeURIComponent(raw);
    const trimmed = decoded.trim().replace(/\s+/g, " ");
    return trimmed || null;
  } catch {
    return null;
  }
}

/** Safe CSS font-family snippet for Google-loaded faces (quotes + fallback). */
export function cssFontStackForGoogleFamily(family: string): string {
  const escaped = family.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}", sans-serif`;
}

export function googleFontsCss2Url(family: string): string {
  const familyParam = family.trim().replace(/\s+/g, "+");
  return `https://fonts.googleapis.com/css2?family=${familyParam}:wght@400;500;600;700;800&display=swap`;
}

/** Server-safe: coerce API/body values into a persisted string that renderers understand. */
export function sanitizeStoredCardFont(input: unknown): string {
  const raw = String(input ?? "").trim();
  const fallback = "inter";
  if (!raw) return fallback;
  if (raw.length > 220) return fallback;
  if (isCardFontPresetKey(raw.toLowerCase())) return raw.toLowerCase();
  if (!isStoredGoogleCardFont(raw)) return fallback;
  const family = parseGoogleFamilyFromStored(raw);
  if (!family || family.length > 120) return fallback;
  if (/[\u0000-\u001f\\"<>{}\x7f;`]/.test(family)) return fallback;
  return googleCardFontToken(family);
}

export function labelForStoredCardFont(
  stored: string,
): { title: string; subtitle?: string } {
  const s = stored || "inter";
  if (isCardFontPresetKey(s)) {
    const titles: Record<CardFontPreset, string> = {
      inter: "Inter",
      poppins: "Poppins",
      outfit: "Outfit (Google Sans style)",
      times: "Times New Roman",
    };
    return { title: titles[s], subtitle: s === "inter" ? "Default" : undefined };
  }
  const g = parseGoogleFamilyFromStored(s);
  if (g) return { title: g, subtitle: "Google Font" };
  return { title: "Inter", subtitle: "Default" };
}
