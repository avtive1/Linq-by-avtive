"use client";

import {
  googleFontsCss2Url,
  isStoredGoogleCardFont,
  parseGoogleFamilyFromStored,
} from "@/lib/card-fonts";

function linkIdForFamily(family: string): string {
  let h = 0;
  for (let i = 0; i < family.length; i += 1) h = (Math.imul(31, h) + family.charCodeAt(i)) | 0;
  return `card-gf-css-${Math.abs(h)}`;
}

async function awaitLink(link: HTMLLinkElement): Promise<void> {
  if (link.sheet) return;
  await new Promise<void>((resolve) => {
    const done = () => resolve();
    link.addEventListener("load", done, { once: true });
    link.addEventListener("error", done, { once: true });
  });
}

/** Ensure the Google Fonts stylesheet exists; resolves when usable (best-effort). */
export async function preloadGoogleCardFontCss(storedFontKey: string): Promise<void> {
  if (!isStoredGoogleCardFont(storedFontKey)) return;
  const family = parseGoogleFamilyFromStored(storedFontKey);
  if (!family || typeof document === "undefined") return;

  const id = linkIdForFamily(family);
  const href = googleFontsCss2Url(family);
  const existing = document.getElementById(id);
  if (existing instanceof HTMLLinkElement && existing.getAttribute("data-card-gf-family") === family) {
    await awaitLink(existing);
  } else {
    existing?.remove();
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-card-gf-family", family);
    document.head.appendChild(link);
    await awaitLink(link);
  }

  const weights = [400, 500, 600, 700, 800];
  try {
    await Promise.all(weights.map((w) => document.fonts.load(`${w} 16px "${family}"`)));
  } catch {
    /* best-effort */
  }
}

/** Call before PNG capture so html-to-image embeds glyphs correctly when possible. */
export async function waitForCardFontsReadyForCapture(storedFontKey: string): Promise<void> {
  if (typeof document === "undefined") return;
  await preloadGoogleCardFontCss(storedFontKey);
  try {
    await document.fonts.ready;
  } catch {
    /* ignore */
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}
