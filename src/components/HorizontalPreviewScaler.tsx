"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

const CARD_ARTBOARD_W = 1200;
const CARD_ARTBOARD_H = 628;
/** Matches the desktop preview (~780×408) relative to the 1200 capture */
const MAX_SCALE_CAP = 0.65;
const MIN_SCALE_CAP = 0.14;

function clampScale(n: number) {
  return Math.min(MAX_SCALE_CAP, Math.max(MIN_SCALE_CAP, n));
}

/**
 * Fits a 1200×628 horizontal CardPreview inside its parent width.
 * Uses measured width — CSS `scale()` alone does not shrink layout width,
 * which caused horizontal clipping on phones when combined with flex `min-width: auto`.
 */
export function HorizontalPreviewScaler({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(MAX_SCALE_CAP);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      const w = el.getBoundingClientRect().width;
      const gutterPx = 2;
      const s = clampScale((w - gutterPx) / CARD_ARTBOARD_W);
      setScale((prev) => (Math.abs(prev - s) > 0.002 ? s : prev));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={frameRef} className={className}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: CARD_ARTBOARD_W,
          height: CARD_ARTBOARD_H,
          marginLeft: -CARD_ARTBOARD_W / 2,
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
