import { describe, expect, it } from "vitest";
import {
  CARD_ARTBOARD_HORIZONTAL,
  CARD_ARTBOARD_VERTICAL,
  resolveBrandingDualPreviewScale,
  scaleCardToFitBox,
  scaleCardToFitWidth,
  scaleDualCardPreviews,
} from "@/lib/card-preview-scale";

describe("card preview scale", () => {
  it("fits horizontal artboard to width", () => {
    expect(scaleCardToFitWidth(1200, 600)).toBeCloseTo(0.5, 2);
  });

  it("fits artboard inside a box", () => {
    expect(scaleCardToFitBox(1200, 628, 400, 300)).toBeLessThan(0.4);
  });

  it("uses a single scale for dual row layout", () => {
    const scale = scaleDualCardPreviews(1400, 700, "row", 28, 12, {
      chromeHeightPx: 30,
      safetyFactor: 1,
    });
    expect(scale).toBeGreaterThan(0.1);
    expect(1200 * scale + 576 * scale).toBeLessThanOrEqual(1400);
    expect(1024 * scale).toBeLessThanOrEqual(700 - 30);
  });

  it("uses a single scale for dual column layout", () => {
    const scale = scaleDualCardPreviews(420, 1200, "column");
    expect(scale).toBeGreaterThan(0.1);
    expect((628 + 1024) * scale).toBeLessThanOrEqual(1200);
  });

  it("fits branding dual previews inside a modal slot (row)", () => {
    const scale = resolveBrandingDualPreviewScale(1200, 500, "row");
    const colW = (1200 - 28) / 2;
    const cardH = 500 - 34;
    expect(scale).toBeGreaterThan(0.05);
    expect(CARD_ARTBOARD_HORIZONTAL.width * scale).toBeLessThanOrEqual(colW);
    expect(CARD_ARTBOARD_HORIZONTAL.height * scale).toBeLessThanOrEqual(cardH);
    expect(CARD_ARTBOARD_VERTICAL.width * scale).toBeLessThanOrEqual(colW);
    expect(CARD_ARTBOARD_VERTICAL.height * scale).toBeLessThanOrEqual(cardH);
  });

  it("fits branding dual previews inside a modal slot (column)", () => {
    const scale = resolveBrandingDualPreviewScale(420, 900, "column");
    const cardH = (900 - 34 * 2 - 20) / 2;
    expect(scale).toBeGreaterThan(0.05);
    expect(CARD_ARTBOARD_HORIZONTAL.height * scale).toBeLessThanOrEqual(cardH);
    expect(CARD_ARTBOARD_VERTICAL.height * scale).toBeLessThanOrEqual(cardH);
  });
});
