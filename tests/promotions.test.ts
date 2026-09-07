import { describe, it, expect } from "vitest";
import { analyzeEmailSpamScore, interpolateEmailContent } from "@/lib/promotions/campaign-sender";
import { EMAIL_TEMPLATES } from "@/lib/promotions/templates";
import { fetchGmailPromotions } from "@/lib/promotions/gmail-inbound";

describe("Promotions & Campaign Engine", () => {
  it("calculates high spam score and clean grade for compliant promotional emails", () => {
    const analysis = analyzeEmailSpamScore(
      "🚀 Introducing our latest breakthrough: Designed for you",
      "We're thrilled to introduce our newest capabilities engineered to transform how you connect and showcase your credentials.",
    );

    expect(analysis.score).toBeGreaterThanOrEqual(85);
    expect(["A+", "A", "B"]).toContain(analysis.grade);
    expect(analysis.issues.length).toBe(0);
  });

  it("penalizes spam triggers like excessive caps and risky promotional words", () => {
    const analysis = analyzeEmailSpamScore(
      "CLAIM 100% FREE CASH RIGHT NOW RISK FREE!!!!!!!",
      "100% free cash miracle",
    );

    expect(analysis.score).toBeLessThan(70);
    expect(analysis.issues.some((i) => i.toLowerCase().includes("caps") || i.toLowerCase().includes("spam"))).toBe(true);
  });

  it("interpolates personalization tags into subject and body correctly", () => {
    const template = "Hello {{first_name}}, welcome to {{organization_name}}! Unsubscribe: {{unsubscribe_url}}";
    const lead = {
      email: "jane.doe@example.com",
      name: "Jane Doe",
      company: "Acme Corp",
      source: "attendee" as const,
    };

    const result = interpolateEmailContent(
      template,
      lead,
      "Linq by Avtive",
      "https://linq.avtive.app/unsubscribe?token=123",
    );

    expect(result).toContain("Hello Jane,");
    expect(result).toContain("welcome to Linq by Avtive!");
    expect(result).toContain("https://linq.avtive.app/unsubscribe?token=123");
  });

  it("renders all pre-built promotional email templates with valid HTML and unsubscribe links", () => {
    EMAIL_TEMPLATES.forEach((tpl) => {
      const rendered = tpl.render({
        organizationName: "Avtive",
        headline: "Test Headline",
        bodyText: "Test body text with sufficient content.",
        ctaText: "Click Here",
        ctaUrl: "https://linq.avtive.app",
        unsubscribeUrl: "https://linq.avtive.app/unsubscribe",
      });

      expect(rendered.html).toContain("<!DOCTYPE html>");
      expect(rendered.html).toContain("Test Headline");
      expect(rendered.html).toContain("https://linq.avtive.app/unsubscribe");
      expect(rendered.html).toContain("Unsubscribe immediately");
    });
  });

  it("fetches sandbox promotional feed when no live Gmail API credentials are set", async () => {
    const result = await fetchGmailPromotions({
      q: "category:promotions",
    });

    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0]).toHaveProperty("subject");
    expect(result.messages[0]).toHaveProperty("sender");
    expect(result.messages[0].category).toBe("CATEGORY_PROMOTIONS");
  });

  it("handles lead personalization with fallback values gracefully", () => {
    const template = "Hi {{first_name}} from {{company}}!";
    const leadWithoutName = {
      email: "lead@test.com",
      source: "attendee" as const,
    };

    const result = interpolateEmailContent(template, leadWithoutName, "Linq");
    expect(result).toBe("Hi there from Linq!");
  });
});
