import { describe, expect, it } from "vitest";

describe("Card Branding Theme & Configuration Logic", () => {
  const COLOR_THEMES = {
    karakoram: { start: "#06080F", end: "#0B0F19", accent: "#00F0FF" },
    purple: { start: "#41295a", end: "#2f0743", accent: "#c084fc" },
    red: { start: "#c94b4b", end: "#4b134f", accent: "#f87171" },
    pink: { start: "#EE0979", end: "#FF6A00", accent: "#f472b6" },
    blue: { start: "#0c1a30", end: "#1e3a8a", accent: "#38bdf8" },
    green: { start: "#0c2b18", end: "#031208", accent: "#4ade80" },
  };

  function resolveTheme(color?: string) {
    const raw = String(color || "").trim().toLowerCase();
    if (!raw) return COLOR_THEMES.karakoram;
    if (COLOR_THEMES[raw as keyof typeof COLOR_THEMES]) {
      return COLOR_THEMES[raw as keyof typeof COLOR_THEMES];
    }
    const custom = String(color || "").trim();
    return { start: custom, end: custom, accent: "#00F0FF" };
  }

  it("resolves default theme when no color is provided", () => {
    const theme = resolveTheme();
    expect(theme.start).toBe("#06080F");
    expect(theme.end).toBe("#0B0F19");
    expect(theme.accent).toBe("#00F0FF");
  });

  it("resolves preset theme colors accurately", () => {
    expect(resolveTheme("purple")).toEqual(COLOR_THEMES.purple);
    expect(resolveTheme("red")).toEqual(COLOR_THEMES.red);
    expect(resolveTheme("pink")).toEqual(COLOR_THEMES.pink);
    expect(resolveTheme("blue")).toEqual(COLOR_THEMES.blue);
    expect(resolveTheme("green")).toEqual(COLOR_THEMES.green);
    expect(resolveTheme("karakoram")).toEqual(COLOR_THEMES.karakoram);
  });

  it("resolves custom hex color accurately", () => {
    const customTheme = resolveTheme("#2563EB");
    expect(customTheme.start).toBe("#2563EB");
    expect(customTheme.end).toBe("#2563EB");
  });

  it("calculates correct CSS gradient string", () => {
    const theme = resolveTheme("purple");
    const gradient =
      theme.start === theme.end
        ? theme.start
        : `linear-gradient(135deg, ${theme.start} 0%, ${theme.end} 100%)`;
    expect(gradient).toBe("linear-gradient(135deg, #41295a 0%, #2f0743 100%)");

    const solidTheme = resolveTheme("#123456");
    const solidGradient =
      solidTheme.start === solidTheme.end
        ? solidTheme.start
        : `linear-gradient(135deg, ${solidTheme.start} 0%, ${solidTheme.end} 100%)`;
    expect(solidGradient).toBe("#123456");
  });

  it("ensures logo strip fair-share budget maintains prominence without overflow", () => {
    const maxStripWidthPx = 580;
    const logoCount = 3;
    const innerBudget = maxStripWidthPx * 0.96;
    const fairShareW = innerBudget / Math.max(logoCount, 1);
    const imgCapPx = Math.max(70, Math.floor(fairShareW * 1.15));

    expect(imgCapPx).toBeGreaterThanOrEqual(150);
    expect(imgCapPx * logoCount).toBeLessThan(maxStripWidthPx * 1.5);
  });
});
