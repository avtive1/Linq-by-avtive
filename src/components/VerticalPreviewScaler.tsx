"use client";

import type { ReactNode } from "react";
import { CardArtboardScaler } from "@/components/CardArtboardScaler";
import { CARD_ARTBOARD_VERTICAL } from "@/lib/card-preview-scale";

/** Fits a 576×1024 vertical CardPreview inside its parent width. */
export function VerticalPreviewScaler({
  className,
  children,
  maxScale = 0.65,
}: {
  className?: string;
  children: ReactNode;
  maxScale?: number;
}) {
  return (
    <CardArtboardScaler
      artboardWidth={CARD_ARTBOARD_VERTICAL.width}
      artboardHeight={CARD_ARTBOARD_VERTICAL.height}
      className={className}
      fitMode="width"
      maxScale={maxScale}
    >
      {children}
    </CardArtboardScaler>
  );
}
