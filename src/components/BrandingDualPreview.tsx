"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  CARD_ARTBOARD_HORIZONTAL,
  CARD_ARTBOARD_VERTICAL,
  resolveBrandingDualPreviewScale,
} from "@/lib/card-preview-scale";
import { cn } from "@/lib/utils";

type BrandingDualPreviewProps = {
  socialPreview: ReactNode;
  badgePreview: ReactNode;
  className?: string;
};

const ROW_BREAKPOINT_PX = 1024;

function ScaledPreviewTile({
  label,
  artboardWidth,
  artboardHeight,
  scale,
  children,
}: {
  label: string;
  artboardWidth: number;
  artboardHeight: number;
  scale: number;
  children: ReactNode;
}) {
  const boxWidth = artboardWidth * scale;
  const boxHeight = artboardHeight * scale;

  return (
    <div className="flex min-h-0 min-w-0 max-w-full shrink-0 flex-col items-center gap-2">
      <span className="shrink-0 text-center text-[13px] font-medium tracking-[0.01em] leading-tight text-muted/60">
        {label}
      </span>
      <div
        className="relative shrink-0 overflow-hidden rounded-sm"
        style={{ width: boxWidth, height: boxHeight }}
        aria-label={`${label} preview`}
      >
        <div
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

/**
 * Responsive social + badge previews for the Card Branding modal.
 * Measures the bounded slot and scales both artboards to fit at 100% browser zoom.
 */
export function BrandingDualPreview({
  socialPreview,
  badgePreview,
  className = "",
}: BrandingDualPreviewProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isRowLayout, setIsRowLayout] = useState(
    typeof window !== "undefined"
      ? window.matchMedia(`(min-width: ${ROW_BREAKPOINT_PX}px)`).matches
      : true,
  );

  useLayoutEffect(() => {
    const mq = window.matchMedia(`(min-width: ${ROW_BREAKPOINT_PX}px)`);
    const sync = () => setIsRowLayout(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useLayoutEffect(() => {
    const el = slotRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    let rafId = 0;
    let attempts = 0;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 8 || height < 8) {
        if (attempts < 24) {
          attempts += 1;
          rafId = requestAnimationFrame(measure);
        }
        return;
      }
      attempts = 0;
      setContainerSize((prev) =>
        Math.abs(prev.width - width) > 0.5 || Math.abs(prev.height - height) > 0.5
          ? { width, height }
          : prev,
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  const layout = isRowLayout ? "row" : "column";
  const scale =
    containerSize.width > 0 && containerSize.height > 0
      ? resolveBrandingDualPreviewScale(containerSize.width, containerSize.height, layout)
      : 0.05;

  return (
    <div
      ref={slotRef}
      className={cn(
        "flex size-full min-h-0 min-w-0 items-center justify-center overflow-hidden",
        className,
      )}
    >
      <div
        className={cn(
          "flex max-h-full max-w-full min-h-0 min-w-0",
          isRowLayout
            ? "flex-row items-start justify-center gap-5 min-[1024px]:gap-7"
            : "flex-col items-center justify-center gap-5",
        )}
      >
        <ScaledPreviewTile
          label="Social post layout"
          artboardWidth={CARD_ARTBOARD_HORIZONTAL.width}
          artboardHeight={CARD_ARTBOARD_HORIZONTAL.height}
          scale={scale}
        >
          {socialPreview}
        </ScaledPreviewTile>

        <ScaledPreviewTile
          label="Event badge layout"
          artboardWidth={CARD_ARTBOARD_VERTICAL.width}
          artboardHeight={CARD_ARTBOARD_VERTICAL.height}
          scale={scale}
        >
          {badgePreview}
        </ScaledPreviewTile>
      </div>
    </div>
  );
}
