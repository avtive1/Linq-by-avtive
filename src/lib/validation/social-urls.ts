import { SocialPlatform, AttendeeSocialLinks } from "@/types/card";

export const SUPPORTED_SOCIAL_PLATFORMS: readonly SocialPlatform[] = [
  "linkedin",
  "instagram",
  "twitter",
  "facebook",
  "github",
  "tiktok",
  "youtube",
  "website",
] as const;

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  twitter: "X / Twitter",
  facebook: "Facebook",
  github: "GitHub",
  tiktok: "TikTok",
  youtube: "YouTube",
  website: "Personal Website",
};

const DANGEROUS_PROTOCOLS = [
  "javascript:",
  "data:",
  "vbscript:",
  "file:",
  "blob:",
  "about:",
];

/**
 * Normalizes an attendee's LinkedIn profile string to a valid URL.
 */
export function formatAttendeeLinkedInUrl(raw?: string | null): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.includes(".")) {
    return `https://${trimmed}`;
  }
  return `https://linkedin.com/in/${trimmed}`;
}

/**
 * Checks if a URL string contains dangerous or non-http(s) protocols.
 */
export function containsDangerousProtocol(raw: string): boolean {
  if (!raw || typeof raw !== "string") return false;
  const cleaned = raw.trim().toLowerCase().replace(/[\x00-\x1F\x7F\s]+/g, "");
  return DANGEROUS_PROTOCOLS.some((p) => cleaned.startsWith(p));
}

/**
 * Checks if an IP or hostname is private/internal (SSRF / metadata protection).
 */
function isDisallowedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h === "169.254.169.254" ||
    h === "metadata.google.internal" ||
    /^(127\.|10\.|192\.168\.|169\.254\.)/.test(h) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)
  ) {
    return true;
  }
  return false;
}

/**
 * Normalizes user input into a full HTTPS URL string.
 */
export function normalizeRawUrl(raw: string): string {
  let val = raw.trim();
  if (!val) return "";

  // Strip leading '@' for handles
  if (val.startsWith("@")) {
    val = val.slice(1).trim();
  }

  // Auto-upgrade http to https or prepend https://
  if (/^https?:\/\//i.test(val)) {
    val = val.replace(/^http:\/\//i, "https://");
  } else {
    val = `https://${val}`;
  }

  return val;
}

/**
 * Validates and normalizes a LinkedIn profile URL.
 * Accepts:
 * - https://www.linkedin.com/in/username
 * - https://linkedin.com/in/username
 * - https://uk.linkedin.com/in/username
 * - https://www.linkedin.com/company/organization
 * - linkedin.com/in/username
 * - in/username
 * - username
 */
export type SocialUrlValidationResult =
  | { ok: true; valid: true; url: string; normalizedUrl: string; error?: undefined }
  | { ok: false; valid: false; error: string; url?: undefined; normalizedUrl?: undefined };

/**
 * Validates and normalizes a LinkedIn profile URL.
 * Accepts:
 * - https://www.linkedin.com/in/username
 * - https://linkedin.com/in/username
 * - https://uk.linkedin.com/in/username
 * - https://www.linkedin.com/company/organization
 * - linkedin.com/in/username
 * - in/username
 * - username
 */
export function validateAndNormalizeLinkedInUrl(raw: unknown): SocialUrlValidationResult {
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    return { ok: false, valid: false, error: "LinkedIn profile is required." };
  }

  const rawTrimmed = raw.trim();
  if (containsDangerousProtocol(rawTrimmed)) {
    return { ok: false, valid: false, error: "Dangerous or invalid URL protocol rejected." };
  }

  let candidate = rawTrimmed;

  // If user entered just a handle or path like "in/username" or "username" without dots
  if (!candidate.includes(".")) {
    const cleanHandle = candidate.replace(/^@/, "").replace(/^\/+/, "").replace(/^in\//i, "");
    if (!cleanHandle || !/^[A-Za-z0-9_\-\u00C0-\u024F]+$/.test(cleanHandle)) {
      return { ok: false, valid: false, error: "Please enter a valid LinkedIn profile handle or URL." };
    }
    candidate = `https://www.linkedin.com/in/${cleanHandle}`;
  } else {
    candidate = normalizeRawUrl(candidate);
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, valid: false, error: "Invalid LinkedIn URL format." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, valid: false, error: "LinkedIn profile URL must use HTTPS." };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (isDisallowedHostname(hostname)) {
    return { ok: false, valid: false, error: "Internal or private IP addresses are not permitted." };
  }

  const isValidLinkedInDomain =
    hostname === "linkedin.com" ||
    hostname === "www.linkedin.com" ||
    /^[a-z]{2,3}\.linkedin\.com$/.test(hostname);

  if (!isValidLinkedInDomain) {
    return { ok: false, valid: false, error: "URL must be on linkedin.com." };
  }

  // Path check: Should not be bare root
  const pathname = parsed.pathname.replace(/\/+$/, "");
  if (!pathname || pathname === "") {
    return { ok: false, valid: false, error: "Please provide a link to your specific LinkedIn profile." };
  }

  // Canonicalize hostname
  parsed.hostname = "www.linkedin.com";

  // Remove tracking query params from LinkedIn URLs
  parsed.search = "";
  parsed.hash = "";

  const finalUrl = parsed.toString().replace(/\/$/, "");
  return { ok: true, valid: true, url: finalUrl, normalizedUrl: finalUrl };
}

/**
 * Validates and normalizes a social media URL for a specific platform.
 */
export function validateAndNormalizeSocialUrl(
  platform: SocialPlatform,
  raw: unknown,
): SocialUrlValidationResult {
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    return { ok: false, valid: false, error: "URL cannot be empty." };
  }

  const rawTrimmed = raw.trim();
  if (containsDangerousProtocol(rawTrimmed)) {
    return { ok: false, valid: false, error: "Dangerous or invalid URL protocol rejected." };
  }

  if (platform === "linkedin") {
    return validateAndNormalizeLinkedInUrl(rawTrimmed);
  }

  let candidate = rawTrimmed;

  // If user entered a username / handle (or starts with @) for known social platforms
  if ((rawTrimmed.startsWith("@") || !candidate.includes(".")) && platform !== "website") {
    const cleanHandle = candidate.replace(/^@/, "").replace(/^\/+/, "");
    if (!cleanHandle || !/^[A-Za-z0-9_.\-]+$/.test(cleanHandle)) {
      return { ok: false, valid: false, error: `Please enter a valid ${SOCIAL_PLATFORM_LABELS[platform]} handle or URL.` };
    }
    switch (platform) {
      case "instagram":
        candidate = `https://www.instagram.com/${cleanHandle}`;
        break;
      case "twitter":
        candidate = `https://x.com/${cleanHandle}`;
        break;
      case "facebook":
        candidate = `https://www.facebook.com/${cleanHandle}`;
        break;
      case "github":
        candidate = `https://github.com/${cleanHandle}`;
        break;
      case "tiktok":
        candidate = `https://www.tiktok.com/@${cleanHandle}`;
        break;
      case "youtube":
        candidate = cleanHandle.startsWith("@")
          ? `https://www.youtube.com/${cleanHandle}`
          : `https://www.youtube.com/@${cleanHandle}`;
        break;
    }
  } else {
    candidate = normalizeRawUrl(candidate);
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, valid: false, error: `Invalid ${SOCIAL_PLATFORM_LABELS[platform]} URL format.` };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, valid: false, error: "URL must use secure HTTPS." };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (isDisallowedHostname(hostname)) {
    return { ok: false, valid: false, error: "Internal or private IP addresses are not permitted." };
  }

  // Platform domain validation
  switch (platform) {
    case "instagram": {
      const valid = hostname === "instagram.com" || hostname === "www.instagram.com";
      if (!valid) return { ok: false, valid: false, error: "URL must be on instagram.com." };
      parsed.hostname = "www.instagram.com";
      break;
    }
    case "twitter": {
      const valid =
        hostname === "x.com" ||
        hostname === "www.x.com" ||
        hostname === "twitter.com" ||
        hostname === "www.twitter.com";
      if (!valid) return { ok: false, valid: false, error: "URL must be on x.com or twitter.com." };
      parsed.hostname = "x.com";
      break;
    }
    case "facebook": {
      const valid =
        hostname === "facebook.com" ||
        hostname === "www.facebook.com" ||
        hostname === "fb.com" ||
        hostname === "m.facebook.com" ||
        hostname === "web.facebook.com";
      if (!valid) return { ok: false, valid: false, error: "URL must be on facebook.com." };
      parsed.hostname = "www.facebook.com";
      break;
    }
    case "github": {
      const valid = hostname === "github.com" || hostname === "www.github.com";
      if (!valid) return { ok: false, valid: false, error: "URL must be on github.com." };
      parsed.hostname = "github.com";
      break;
    }
    case "tiktok": {
      const valid = hostname === "tiktok.com" || hostname === "www.tiktok.com";
      if (!valid) return { ok: false, valid: false, error: "URL must be on tiktok.com." };
      parsed.hostname = "www.tiktok.com";
      break;
    }
    case "youtube": {
      const valid =
        hostname === "youtube.com" ||
        hostname === "www.youtube.com" ||
        hostname === "m.youtube.com" ||
        hostname === "youtu.be";
      if (!valid) return { ok: false, valid: false, error: "URL must be on youtube.com or youtu.be." };
      if (hostname !== "youtu.be") {
        parsed.hostname = "www.youtube.com";
      }
      break;
    }
    case "website": {
      // Must have at least one dot in domain name, e.g. domain.tld
      if (!hostname.includes(".") || hostname.endsWith(".")) {
        return { ok: false, valid: false, error: "Please provide a valid website domain (e.g. yourname.com)." };
      }
      break;
    }
  }

  // Prevent open redirects / malicious tracking params on custom profiles
  parsed.hash = "";

  const finalUrl = parsed.toString().replace(/\/$/, "");
  return { ok: true, valid: true, url: finalUrl, normalizedUrl: finalUrl };
}

/**
 * Validates an entire collection of attendee social links.
 * Strips empty/undefined links and returns sanitized HTTPS URLs.
 */
export function validateAttendeeSocialLinks(
  raw: unknown,
): { ok: true; socialLinks: AttendeeSocialLinks } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: true, socialLinks: {} };
  }

  const entries = Object.entries(raw as Record<string, unknown>);
  const sanitized: AttendeeSocialLinks = {};

  for (const [key, value] of entries) {
    if (!value || typeof value !== "string" || !value.trim()) {
      continue;
    }

    const platformKey = key.toLowerCase().trim() as SocialPlatform;
    if (!SUPPORTED_SOCIAL_PLATFORMS.includes(platformKey)) {
      return { ok: false, error: `Unsupported social platform: "${key}".` };
    }

    const result = validateAndNormalizeSocialUrl(platformKey, value);
    if (!result.ok) {
      return { ok: false, error: `${SOCIAL_PLATFORM_LABELS[platformKey]}: ${result.error}` };
    }

    sanitized[platformKey] = result.url;
  }

  return { ok: true, socialLinks: sanitized };
}

/**
 * Parses raw JSON or record containing social links safely.
 */
export function parseAttendeeSocialLinks(raw: unknown): AttendeeSocialLinks {
  if (!raw) return {};
  let obj: Record<string, unknown> | null = null;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  } else if (typeof raw === "object" && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  }
  if (!obj) return {};

  const res: AttendeeSocialLinks = {};
  for (const [key, value] of Object.entries(obj)) {
    const platform = key.toLowerCase().trim() as SocialPlatform;
    if (SUPPORTED_SOCIAL_PLATFORMS.includes(platform) && typeof value === "string" && value.trim()) {
      const validated = validateAndNormalizeSocialUrl(platform, value);
      if (validated.ok && validated.url) {
        res[platform] = validated.url;
      }
    }
  }
  return res;
}
