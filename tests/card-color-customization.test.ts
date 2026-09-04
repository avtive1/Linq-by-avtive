import { describe, it, expect, vi } from "vitest";
import { isValidCssColor, parseColorLuminance } from "@/components/CardPreview";
import {
  stripAttendeeBrandingFields,
  applyEventBrandingToAttendeePayload,
} from "@/lib/services/event.service";
import { attendeeRegistrationBodySchema } from "@/lib/validators/registration.validator";

vi.mock("@/lib/neon-db", () => ({
  queryNeonOne: vi.fn(async (_sql: string, params: unknown[]) => {
    const eventId = params[0];
    if (eventId === "mock-event-id") {
      return {
        card_color: "#1E3A8A",
        card_font: "inter",
        horizontal_text_color: "#FFFFFF",
        vertical_text_color: "#FFFFFF",
      };
    }
    return null;
  }),
  insertRow: vi.fn(),
}));

describe("Card Color Customization & Validation", () => {
  it("validates standard 6-digit hex color codes", () => {
    expect(isValidCssColor("#FF5733")).toBe(true);
    expect(isValidCssColor("#2563EB")).toBe(true);
    expect(isValidCssColor("#000000")).toBe(true);
    expect(isValidCssColor("#ffffff")).toBe(true);
  });

  it("validates 3-digit shorthand hex colors", () => {
    expect(isValidCssColor("#fff")).toBe(true);
    expect(isValidCssColor("#000")).toBe(true);
    expect(isValidCssColor("#F53")).toBe(true);
  });

  it("validates rgb and rgba colors", () => {
    expect(isValidCssColor("rgb(255, 87, 51)")).toBe(true);
    expect(isValidCssColor("rgb(0, 0, 0)")).toBe(true);
    expect(isValidCssColor("rgba(37, 99, 235, 0.8)")).toBe(true);
  });

  it("validates hsl and hsla colors", () => {
    expect(isValidCssColor("hsl(14, 100%, 60%)")).toBe(true);
    expect(isValidCssColor("hsla(210, 100%, 50%, 0.5)")).toBe(true);
  });

  it("validates named CSS and theme colors", () => {
    expect(isValidCssColor("purple")).toBe(true);
    expect(isValidCssColor("red")).toBe(true);
    expect(isValidCssColor("blue")).toBe(true);
    expect(isValidCssColor("pink")).toBe(true);
    expect(isValidCssColor("navy")).toBe(true);
    expect(isValidCssColor("orange")).toBe(true);
  });

  it("rejects invalid or unsafe color inputs safely", () => {
    expect(isValidCssColor("")).toBe(false);
    expect(isValidCssColor("   ")).toBe(false);
    expect(isValidCssColor("not-a-color")).toBe(false);
    expect(isValidCssColor("#GGGGGG")).toBe(false);
    expect(isValidCssColor("###")).toBe(false);
    expect(isValidCssColor("<script>alert(1)</script>")).toBe(false);
    expect(isValidCssColor("javascript:void(0)")).toBe(false);
    expect(isValidCssColor(undefined)).toBe(false);
  });

  it("calculates luminance correctly for high contrast determination", () => {
    const whiteLuminance = parseColorLuminance("#FFFFFF");
    const blackLuminance = parseColorLuminance("#000000");
    const darkBlueLuminance = parseColorLuminance("#1E3A8A");

    expect(whiteLuminance).toBeGreaterThan(0.9);
    expect(blackLuminance).toBe(0);
    expect(darkBlueLuminance).toBeLessThan(0.3);
  });

  it("strips attendee card_color when stripping branding fields", () => {
    const input = {
      name: "Jane Doe",
      card_color: "#10B981",
      design_type: "design1",
      card_font: "roboto",
      custom_fields: {
        company_role: "Developer",
        __horizontal_text_color: "#111",
      },
    };
    const stripped = stripAttendeeBrandingFields(input);
    expect(stripped).not.toHaveProperty("card_color");
    expect(stripped).not.toHaveProperty("design_type");
    expect(stripped).not.toHaveProperty("card_font");
    expect((stripped.custom_fields as Record<string, unknown>).__horizontal_text_color).toBeUndefined();
  });

  it("strictly enforces event default branding color from admin configuration", async () => {
    const payloadWithCustomColor = {
      event_id: "mock-event-id",
      name: "Jane Doe",
      card_color: "#EF4444",
    };
    const result = await applyEventBrandingToAttendeePayload(payloadWithCustomColor);
    expect(result.card_color).toBe("#1E3A8A");
    expect(result.card_font).toBe("inter");
  });

  it("applies event branding color when attendee payload has no color", async () => {
    const payloadWithoutColor = {
      event_id: "mock-event-id",
      name: "Jane Doe",
    };
    const result = await applyEventBrandingToAttendeePayload(payloadWithoutColor);
    expect(result.card_color).toBe("#1E3A8A");
    expect(result.card_font).toBe("inter");
  });

  it("validates attendee registration schema with custom card_color", () => {
    const parsed = attendeeRegistrationBodySchema.safeParse({
      name: "John Doe",
      role: "Engineer",
      company: "Acme Corp",
      card_color: "#6366F1",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.card_color).toBe("#6366F1");
    }
  });
});
