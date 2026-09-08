import { describe, expect, it } from "vitest";
import {
  validateAndNormalizeLinkedInUrl,
  validateAndNormalizeSocialUrl,
  parseAttendeeSocialLinks,
  SUPPORTED_SOCIAL_PLATFORMS,
} from "@/lib/validation/social-urls";
import { formatAttendeeLinkedInUrl } from "@/lib/services/attendance.service";

describe("Social URLs Security & Normalization", () => {
  describe("LinkedIn URL & Handle Validator", () => {
    it("rejects empty or whitespace inputs", () => {
      expect(validateAndNormalizeLinkedInUrl("").valid).toBe(false);
      expect(validateAndNormalizeLinkedInUrl("   ").valid).toBe(false);
      expect(validateAndNormalizeLinkedInUrl(null as unknown as string).valid).toBe(false);
      expect(validateAndNormalizeLinkedInUrl(undefined as unknown as string).valid).toBe(false);
    });

    it("rejects dangerous URI schemes (XSS prevention)", () => {
      expect(validateAndNormalizeLinkedInUrl("javascript:alert(1)").valid).toBe(false);
      expect(validateAndNormalizeLinkedInUrl("JAVASCRIPT:alert(document.cookie)").valid).toBe(false);
      expect(validateAndNormalizeLinkedInUrl("data:text/html,<script>alert(1)</script>").valid).toBe(false);
      expect(validateAndNormalizeLinkedInUrl("vbscript:msgbox(1)").valid).toBe(false);
      expect(validateAndNormalizeLinkedInUrl("file:///etc/passwd").valid).toBe(false);
      expect(validateAndNormalizeLinkedInUrl("blob:http://localhost/uuid").valid).toBe(false);
    });

    it("rejects private IP addresses, loopback, and localhosts (SSRF prevention)", () => {
      expect(validateAndNormalizeLinkedInUrl("http://localhost/in/john").valid).toBe(false);
      expect(validateAndNormalizeLinkedInUrl("http://127.0.0.1/in/john").valid).toBe(false);
      expect(validateAndNormalizeLinkedInUrl("https://10.0.0.1/in/john").valid).toBe(false);
      expect(validateAndNormalizeLinkedInUrl("https://192.168.1.50/in/john").valid).toBe(false);
      expect(validateAndNormalizeLinkedInUrl("https://172.16.0.1/in/john").valid).toBe(false);
    });

    it("rejects untrusted domains masquerading as LinkedIn", () => {
      expect(validateAndNormalizeLinkedInUrl("https://evil-linkedin.com/in/johndoe").valid).toBe(false);
      expect(validateAndNormalizeLinkedInUrl("https://linkedin.com.attacker.com/in/johndoe").valid).toBe(false);
      expect(validateAndNormalizeLinkedInUrl("https://notlinkedin.com/in/johndoe").valid).toBe(false);
      expect(validateAndNormalizeLinkedInUrl("https://phishing.site/linkedin").valid).toBe(false);
    });

    it("normalizes standard LinkedIn profile URLs to canonical HTTPS format", () => {
      const standard = validateAndNormalizeLinkedInUrl("https://www.linkedin.com/in/john-doe-123");
      expect(standard.valid).toBe(true);
      expect(standard.normalizedUrl).toBe("https://www.linkedin.com/in/john-doe-123");

      const withoutWww = validateAndNormalizeLinkedInUrl("https://linkedin.com/in/johndoe/");
      expect(withoutWww.valid).toBe(true);
      expect(withoutWww.normalizedUrl).toBe("https://www.linkedin.com/in/johndoe");

      const withHttp = validateAndNormalizeLinkedInUrl("http://linkedin.com/in/johndoe");
      expect(withHttp.valid).toBe(true);
      expect(withHttp.normalizedUrl).toBe("https://www.linkedin.com/in/johndoe");

      const subDomain = validateAndNormalizeLinkedInUrl("https://uk.linkedin.com/in/johndoe");
      expect(subDomain.valid).toBe(true);
      expect(subDomain.normalizedUrl).toBe("https://www.linkedin.com/in/johndoe");
    });

    it("normalizes handles and shortcut paths to canonical LinkedIn URLs", () => {
      const handle = validateAndNormalizeLinkedInUrl("johndoe");
      expect(handle.valid).toBe(true);
      expect(handle.normalizedUrl).toBe("https://www.linkedin.com/in/johndoe");

      const atHandle = validateAndNormalizeLinkedInUrl("@johndoe");
      expect(atHandle.valid).toBe(true);
      expect(atHandle.normalizedUrl).toBe("https://www.linkedin.com/in/johndoe");

      const inPath = validateAndNormalizeLinkedInUrl("in/johndoe");
      expect(inPath.valid).toBe(true);
      expect(inPath.normalizedUrl).toBe("https://www.linkedin.com/in/johndoe");

      const urlWithoutScheme = validateAndNormalizeLinkedInUrl("linkedin.com/in/johndoe");
      expect(urlWithoutScheme.valid).toBe(true);
      expect(urlWithoutScheme.normalizedUrl).toBe("https://www.linkedin.com/in/johndoe");
    });
  });

  describe("Platform-specific Social URL Validators", () => {
    it("validates and normalizes Instagram links and handles", () => {
      expect(validateAndNormalizeSocialUrl("instagram", "@creative_dev").normalizedUrl)
        .toBe("https://www.instagram.com/creative_dev");
      expect(validateAndNormalizeSocialUrl("instagram", "instagram.com/creative_dev").normalizedUrl)
        .toBe("https://www.instagram.com/creative_dev");
      expect(validateAndNormalizeSocialUrl("instagram", "https://instagram.com/creative_dev/").normalizedUrl)
        .toBe("https://www.instagram.com/creative_dev");
      expect(validateAndNormalizeSocialUrl("instagram", "https://fake-instagram.com/dev").valid)
        .toBe(false);
    });

    it("validates and normalizes X / Twitter links and handles", () => {
      expect(validateAndNormalizeSocialUrl("twitter", "@techguy").normalizedUrl)
        .toBe("https://x.com/techguy");
      expect(validateAndNormalizeSocialUrl("twitter", "twitter.com/techguy").normalizedUrl)
        .toBe("https://x.com/techguy");
      expect(validateAndNormalizeSocialUrl("twitter", "https://x.com/techguy").normalizedUrl)
        .toBe("https://x.com/techguy");
      expect(validateAndNormalizeSocialUrl("twitter", "https://evil-twitter.com/techguy").valid)
        .toBe(false);
    });

    it("validates and normalizes GitHub links and handles", () => {
      expect(validateAndNormalizeSocialUrl("github", "octocat").normalizedUrl)
        .toBe("https://github.com/octocat");
      expect(validateAndNormalizeSocialUrl("github", "@octocat").normalizedUrl)
        .toBe("https://github.com/octocat");
      expect(validateAndNormalizeSocialUrl("github", "https://github.com/octocat").normalizedUrl)
        .toBe("https://github.com/octocat");
      expect(validateAndNormalizeSocialUrl("github", "https://notgithub.com/octocat").valid)
        .toBe(false);
    });

    it("validates and normalizes Facebook links", () => {
      expect(validateAndNormalizeSocialUrl("facebook", "facebook.com/john.doe").normalizedUrl)
        .toBe("https://www.facebook.com/john.doe");
      expect(validateAndNormalizeSocialUrl("facebook", "https://fb.com/john.doe").normalizedUrl)
        .toBe("https://www.facebook.com/john.doe");
      expect(validateAndNormalizeSocialUrl("facebook", "https://attacker.com/facebook").valid)
        .toBe(false);
    });

    it("validates and normalizes TikTok links and handles", () => {
      expect(validateAndNormalizeSocialUrl("tiktok", "@dancepro").normalizedUrl)
        .toBe("https://www.tiktok.com/@dancepro");
      expect(validateAndNormalizeSocialUrl("tiktok", "tiktok.com/@dancepro").normalizedUrl)
        .toBe("https://www.tiktok.com/@dancepro");
      expect(validateAndNormalizeSocialUrl("tiktok", "https://eviltiktok.com/@dancepro").valid)
        .toBe(false);
    });

    it("validates and normalizes YouTube links and handles", () => {
      expect(validateAndNormalizeSocialUrl("youtube", "@techchannel").normalizedUrl)
        .toBe("https://www.youtube.com/@techchannel");
      expect(validateAndNormalizeSocialUrl("youtube", "https://youtube.com/c/techchannel").normalizedUrl)
        .toBe("https://www.youtube.com/c/techchannel");
      expect(validateAndNormalizeSocialUrl("youtube", "https://youtu.be/dQw4w9WgXcQ").normalizedUrl)
        .toBe("https://youtu.be/dQw4w9WgXcQ");
    });

    it("validates and normalizes Personal Website links", () => {
      expect(validateAndNormalizeSocialUrl("website", "portfolio.dev").normalizedUrl)
        .toBe("https://portfolio.dev");
      expect(validateAndNormalizeSocialUrl("website", "https://mywebsite.org/about").normalizedUrl)
        .toBe("https://mywebsite.org/about");
      expect(validateAndNormalizeSocialUrl("website", "javascript:alert(1)").valid)
        .toBe(false);
      expect(validateAndNormalizeSocialUrl("website", "http://localhost:8080").valid)
        .toBe(false);
      expect(validateAndNormalizeSocialUrl("website", "http://192.168.1.1").valid)
        .toBe(false);
    });
  });

  describe("formatAttendeeLinkedInUrl (QR & badge link generation)", () => {
    it("returns empty string for empty values", () => {
      expect(formatAttendeeLinkedInUrl(null)).toBe("");
      expect(formatAttendeeLinkedInUrl(undefined)).toBe("");
      expect(formatAttendeeLinkedInUrl("")).toBe("");
      expect(formatAttendeeLinkedInUrl("   ")).toBe("");
    });

    it("formats raw handles as canonical URLs", () => {
      expect(formatAttendeeLinkedInUrl("johndoe")).toBe("https://linkedin.com/in/johndoe");
      expect(formatAttendeeLinkedInUrl("@johndoe")).toBe("https://linkedin.com/in/@johndoe");
    });

    it("formats existing URLs cleanly", () => {
      expect(formatAttendeeLinkedInUrl("https://www.linkedin.com/in/johndoe")).toBe("https://www.linkedin.com/in/johndoe");
      expect(formatAttendeeLinkedInUrl("linkedin.com/in/johndoe")).toBe("https://linkedin.com/in/johndoe");
    });
  });

  describe("parseAttendeeSocialLinks", () => {
    it("parses valid JSON string with social links", () => {
      const json = JSON.stringify({
        github: "https://github.com/octocat",
        twitter: "https://x.com/tech",
        instagram: "https://www.instagram.com/user",
      });
      const parsed = parseAttendeeSocialLinks(json);
      expect(parsed.github).toBe("https://github.com/octocat");
      expect(parsed.twitter).toBe("https://x.com/tech");
      expect(parsed.instagram).toBe("https://www.instagram.com/user");
    });

    it("safely strips invalid platforms and malformed values", () => {
      const raw = {
        github: "https://github.com/octocat",
        unsupported_platform: "https://example.com",
        website: "javascript:alert(1)",
      };
      const parsed = parseAttendeeSocialLinks(raw);
      expect(parsed.github).toBe("https://github.com/octocat");
      expect((parsed as Record<string, unknown>).unsupported_platform).toBeUndefined();
      expect(parsed.website).toBeUndefined();
    });

    it("returns empty object on null or invalid input", () => {
      expect(parseAttendeeSocialLinks(null)).toEqual({});
      expect(parseAttendeeSocialLinks(undefined)).toEqual({});
      expect(parseAttendeeSocialLinks("invalid json")).toEqual({});
    });
  });
});
