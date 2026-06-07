import { getPublicAppUrl } from "@/lib/app-url";
import { buildCardShareLandingPath } from "@/lib/share/card-open-graph";

export function toAbsolutePublicUrl(pathOrUrl: string, baseUrl?: string): string {
  const trimmed = String(pathOrUrl || "").trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  const base = (baseUrl || getPublicAppUrl()).replace(/\/$/, "");
  return `${base}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

/** Public LinkedIn landing page — scrapers read OG tags + card image from here. */
export function buildPublicCardShareLandingUrl(cardId: string, baseUrl?: string): string {
  const base = (baseUrl || getPublicAppUrl()).replace(/\/$/, "");
  return `${base}${buildCardShareLandingPath(cardId)}`;
}

/** @deprecated Use buildPublicCardShareLandingUrl for LinkedIn sharing. */
export function buildPublicCardShareUrl(cardId: string, baseUrl?: string): string {
  return buildPublicCardShareLandingUrl(cardId, baseUrl);
}

/** Post body for LinkedIn — URL on its own line so LinkedIn embeds the OG card image. */
export function buildCardLinkedInSharePost(input: {
  name?: string;
  eventName?: string;
  role?: string;
  company?: string;
  shareUrl: string;
  /** cardRole: 'guest' | 'visitor' | 'organization' */
  cardRole?: string;
  /** organization name when an organization is sharing */
  organizationName?: string;
}): string {
  const eventName = String(input.eventName || "this event").trim();
  const name = String(input.name || "").trim();
  const role = String(input.role || "").trim();
  const company = String(input.company || "").trim();
  const orgName = String(input.organizationName || "").trim();

  let opening = `Excited to join ${eventName}! 🎉`;
  if (input.cardRole === "guest") {
    opening = `Honored to be a guest at ${eventName}.`;
  } else if (input.cardRole === "visitor") {
    opening = `Looking forward to attending ${eventName}!`;
  } else if (input.cardRole === "organization") {
    opening = orgName
      ? `Proud to represent ${orgName} at ${eventName}. Join us there!`
      : `Proud to represent our organization at ${eventName}.`;
  }

  const lines = [opening, ""];

  if (input.cardRole === "organization" && orgName) {
    // organization share benefits from a short callout
    lines.push(`${orgName} · ${eventName}`, "");
  } else if (name && role && company) {
    lines.push(`${name} · ${role} at ${company}`, "");
  } else if (name && company) {
    lines.push(`${name} · ${company}`, "");
  } else if (name) {
    lines.push(name, "");
  }

  // Include the URL on its own line so LinkedIn scrapers can unfurl the OG image.
  lines.push(String(input.shareUrl || "").trim());
  return lines.join("\n").trim();
}

/** Opens LinkedIn composer with post text pre-filled (includes URL for image preview). */
export function buildLinkedInFeedShareUrl(postText: string): string {
  return `https://www.linkedin.com/feed/?shareActive=true&mini=true&text=${encodeURIComponent(postText)}`;
}

/** Legacy link-only share — no pre-filled caption. */
export function buildLinkedInShareOffsiteUrl(pageUrl: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`;
}

export function openLinkedInCardShare(input: {
  name?: string;
  eventName?: string;
  role?: string;
  company?: string;
  cardId: string;
  origin?: string;
}): void {
  const shareUrl = buildPublicCardShareLandingUrl(input.cardId, input.origin);
  const postText = buildCardLinkedInSharePost({
    name: input.name,
    eventName: input.eventName,
    role: input.role,
    company: input.company,
    shareUrl,
    cardRole: (input as any).cardRole,
    organizationName: (input as any).organizationName,
  });

  // Open LinkedIn's share-offsite endpoint so the OG tags on our share landing page are used for preview.
  // Also attempt to copy the caption to clipboard so the user can paste it into the composer.
  // Try opening the feed composer with text first (so caption is present), then open the
  // share-offsite URL which LinkedIn's crawler uses to render the OG preview. Opening both
  // increases the chance the user sees the caption prefilled and the preview available.
  try {
    const feedWin = window.open(buildLinkedInFeedShareUrl(postText), "_blank", "noopener,noreferrer");
    // open preview URL shortly after; may be blocked by popup blockers in some browsers
    setTimeout(() => {
      try {
        window.open(buildLinkedInShareOffsiteUrl(shareUrl), "_blank", "noopener,noreferrer");
      } catch {}
    }, 500);
    if (!feedWin) {
      // If opening feed composer was blocked, fallback to opening the preview URL alone
      try {
        window.open(buildLinkedInShareOffsiteUrl(shareUrl), "_blank", "noopener,noreferrer");
      } catch {}
    }
  } catch (err) {
    // Final fallback: open preview only
    try {
      window.open(buildLinkedInShareOffsiteUrl(shareUrl), "_blank", "noopener,noreferrer");
    } catch {}
  }

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      // copy caption so user can paste while sharing
      void navigator.clipboard.writeText(postText).catch(() => {});
    }
  } catch {}
}

/** @deprecated Use buildCardLinkedInSharePost */
export function buildCardLinkedInCaption(input: {
  name?: string;
  eventName?: string;
  role?: string;
  company?: string;
  shareUrl: string;
}): string {
  return buildCardLinkedInSharePost(input);
}
