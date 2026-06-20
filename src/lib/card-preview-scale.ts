/** Native artboard sizes for card captures (px). */
export const CARD_ARTBOARD_HORIZONTAL = { width: 1200, height: 628 } as const;
export const CARD_ARTBOARD_VERTICAL = { width: 576, height: 1024 } as const;

export function clampCardPreviewScale(value: number, min = 0.1, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

/** Best-fit scale for a single artboard inside a box. */
export function scaleCardToFitBox(
  artboardWidth: number,
  artboardHeight: number,
  containerWidth: number,
  containerHeight: number,
  padding = 4,
): number {
  const innerW = Math.max(1, containerWidth - padding * 2);
  const innerH = Math.max(1, containerHeight - padding * 2);
  return clampCardPreviewScale(Math.min(innerW / artboardWidth, innerH / artboardHeight));
}

/** Best-fit scale when width is the only constraint (height follows aspect ratio). */
export function scaleCardToFitWidth(
  artboardWidth: number,
  containerWidth: number,
  padding = 2,
  maxScale = 1,
  minScale = 0.1,
): number {
  const innerW = Math.max(1, containerWidth - padding * 2);
  return clampCardPreviewScale(innerW / artboardWidth, minScale, maxScale);
}

export type DualPreviewLayout = "row" | "column";

export type DualPreviewScaleOptions = {
  /** Vertical space consumed by captions, gaps between caption and card, etc. */
  chromeHeightPx?: number;
  /** Slight undershoot so scaled artboards never clip at subpixel boundaries */
  safetyFactor?: number;
};

/**
 * Unified scale so social (1200×628) and badge (576×1024) both fit in the container together.
 */
export function scaleDualCardPreviews(
  containerWidth: number,
  containerHeight: number,
  layout: DualPreviewLayout,
  gap = 24,
  padding = 8,
  options: DualPreviewScaleOptions = {},
): number {
  const { width: sw, height: sh } = CARD_ARTBOARD_HORIZONTAL;
  const { width: bw, height: bh } = CARD_ARTBOARD_VERTICAL;
  const chromeHeightPx = options.chromeHeightPx ?? 0;
  const safetyFactor = options.safetyFactor ?? 0.96;
  const innerW = Math.max(1, containerWidth - padding * 2);
  const innerH = Math.max(1, containerHeight - padding * 2 - chromeHeightPx);

  let scale: number;
  if (layout === "row") {
    const scaleW = (innerW - gap) / (sw + bw);
    const scaleH = innerH / Math.max(sh, bh);
    scale = Math.min(scaleW, scaleH);
  } else {
    const scaleW = Math.min(innerW / sw, innerW / bw);
    const scaleH = (innerH - gap) / (sh + bh);
    scale = Math.min(scaleW, scaleH);
  }

  return clampCardPreviewScale(scale * safetyFactor);
}

const BRANDING_LABEL_CHROME_PX = 34;
const BRANDING_ROW_GAP_PX = 28;
const BRANDING_COLUMN_GAP_PX = 20;

/**
 * Unified scale for Card Branding modal dual previews (social + badge).
 * Accounts for caption labels, column gaps, and per-tile box caps.
 */
export function resolveBrandingDualPreviewScale(
  containerWidth: number,
  containerHeight: number,
  layout: DualPreviewLayout,
): number {
  const gap = layout === "row" ? BRANDING_ROW_GAP_PX : BRANDING_COLUMN_GAP_PX;
  const { width: sw, height: sh } = CARD_ARTBOARD_HORIZONTAL;
  const { width: bw, height: bh } = CARD_ARTBOARD_VERTICAL;

  const dual = scaleDualCardPreviews(containerWidth, containerHeight, layout, gap, 4, {
    chromeHeightPx: layout === "row" ? BRANDING_LABEL_CHROME_PX : BRANDING_LABEL_CHROME_PX * 2 + gap,
    safetyFactor: 0.96,
  });

  let cap = dual;

  if (layout === "row") {
    const columnWidth = Math.max(1, (containerWidth - gap) / 2);
    const cardAreaHeight = Math.max(1, containerHeight - BRANDING_LABEL_CHROME_PX);
    cap = Math.min(
      cap,
      scaleCardToFitBox(sw, sh, columnWidth, cardAreaHeight, 4),
      scaleCardToFitBox(bw, bh, columnWidth, cardAreaHeight, 4),
    );
  } else {
    const cardAreaHeight = Math.max(1, (containerHeight - BRANDING_LABEL_CHROME_PX * 2 - gap) / 2);
    cap = Math.min(
      cap,
      scaleCardToFitBox(sw, sh, containerWidth, cardAreaHeight, 4),
      scaleCardToFitBox(bw, bh, containerWidth, cardAreaHeight, 4),
    );
  }

  return clampCardPreviewScale(cap, 0.05, 1);
}
