import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getPublicAppUrl, normalizeAppUrl, CANONICAL_APP_URL } from "@/lib/app-url";

describe("app-url utilities", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("normalizes .com domain variants to .app", () => {
    expect(normalizeAppUrl("https://linq.avtive.com")).toBe("https://linq.avtive.app");
    expect(normalizeAppUrl("https://avtive.com")).toBe("https://avtive.app");
    expect(normalizeAppUrl("http://linq.avtive.com/")).toBe("http://linq.avtive.app");
    expect(normalizeAppUrl("linq.avtive.app")).toBe("https://linq.avtive.app");
  });

  it("defaults to https://linq.avtive.app in production when env is not set", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    delete process.env.VERCEL_URL;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    expect(getPublicAppUrl()).toBe(CANONICAL_APP_URL);
  });

  it("auto-corrects NEXT_PUBLIC_APP_URL if it has .com", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://linq.avtive.com";
    expect(getPublicAppUrl()).toBe("https://linq.avtive.app");
  });

  it("extracts origin from request header when present", () => {
    const req = new Request("https://linq.avtive.app/api/organization-members", {
      headers: {
        origin: "https://linq.avtive.app",
      },
    });

    expect(getPublicAppUrl(req)).toBe("https://linq.avtive.app");
  });

  it("corrects .com in request headers if client passed old domain", () => {
    const req = new Request("https://linq.avtive.com/api/organization-members", {
      headers: {
        origin: "https://linq.avtive.com",
      },
    });

    expect(getPublicAppUrl(req)).toBe("https://linq.avtive.app");
  });
});
