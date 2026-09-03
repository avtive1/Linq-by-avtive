import { describe, it, expect } from "vitest";
import { isValidCssColor, parseColorLuminance } from "@/components/CardPreview";

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
});
