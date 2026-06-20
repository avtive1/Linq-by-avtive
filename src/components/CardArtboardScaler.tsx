"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  clampCardPreviewScale,
  scaleCardToFitBox,
  scaleCardToFitWidth,
} from "@/lib/card-preview-scale";

type FitMode = "width" | "box";

type CardArtboardScalerProps = {
  artboardWidth: number;
  artboardHeight: number;
  children: ReactNode;
  className?: string;
  /** Fit to container width (height derived) or full width+height box */
  fitMode?: FitMode;
  /** Fill a positioned parent (use with fitMode="box" inside flex/grid slots) */
  fillParent?: boolean;
  minScale?: number;
  maxScale?: number;
  padding?: number;
  /** Slight undershoot for box fit so subpixel rounding never clips edges */
  safetyFactor?: number;
};

/**
 * Scales a fixed-size card artboard to fit its parent without cropping or internal scroll.
 */
export function CardArtboardScaler({
  artboardWidth,
  artboardHeight,
  children,
  className,
  fitMode = "width",
  fillParent = false,
  minScale = 0.1,
  maxScale = 1,
  padding = 2,
  safetyFactor,
}: CardArtboardScalerProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const resolvedSafety = safetyFactor ?? (fitMode === "box" ? 0.92 : 1);
  const [scale, setScale] = useState(minScale);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 8 || height < 8) return;

      const raw =
        fitMode === "box"
          ? scaleCardToFitBox(artboardWidth, artboardHeight, width, height, padding)
          : scaleCardToFitWidth(artboardWidth, width, padding, maxScale, minScale);
      const next = raw * resolvedSafety;
      const clamped = clampCardPreviewScale(next, minScale, maxScale);
      setScale((prev) => (Math.abs(prev - clamped) > 0.002 ? clamped : prev));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [artboardWidth, artboardHeight, fitMode, minScale, maxScale, padding, resolvedSafety]);

  const scaledWidth = artboardWidth * scale;
  const scaledHeight = artboardHeight * scale;

  if (fitMode === "box") {
    return (
      <div
        ref={frameRef}
        className={cn(
          "flex min-w-0 items-center justify-center overflow-hidden",
          fillParent ? "absolute inset-0" : "relative h-full w-full",
          className,
        )}
      >
        <div
          className="relative shrink-0 overflow-clip"
          style={{ width: scaledWidth, height: scaledHeight }}
        >
          <div
            className="absolute left-0 top-0"
            style={{
              width: artboardWidth,
              height: artboardHeight,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={frameRef}
      className={cn(
        "min-w-0 overflow-hidden",
        fillParent ? "absolute inset-0" : "relative w-full",
        className,
      )}
      style={fillParent ? undefined : { height: scaledHeight }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: artboardWidth,
          height: artboardHeight,
          marginLeft: -artboardWidth / 2,
          transform: `scale(${scale})`,
          transformOrigin: "top center",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
