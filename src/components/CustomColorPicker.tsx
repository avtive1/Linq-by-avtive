"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useId } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";

type Props = {
  value: string;
  onChange: (color: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  anchorRect?: DOMRect | null;
};

type Rgb = { r: number; g: number; b: number };
type Hsv = { h: number; s: number; v: number };

const DEFAULT_SWATCHES = ["#C71B1B", "#2563EB", "#10B981", "#8B5CF6", "#F59E0B"];
const SWATCHES_STORAGE_KEY = "customColorPickerSlotsV1";

const subscribeNoop: (onStoreChange: () => void) => () => void = () => () => {};

function useIsClient() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const toHex = (n: number) => n.toString(16).padStart(2, "0");

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "").trim();
  const safe = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean.padEnd(6, "0").slice(0, 6);
  return {
    r: parseInt(safe.slice(0, 2), 16) || 0,
    g: parseInt(safe.slice(2, 4), 16) || 0,
    b: parseInt(safe.slice(4, 6), 16) || 0,
  };
}

function rgbToHex({ r, g, b }: Rgb) {
  return `#${toHex(clamp(Math.round(r), 0, 255))}${toHex(clamp(Math.round(g), 0, 255))}${toHex(clamp(Math.round(b), 0, 255))}`.toUpperCase();
}

function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

export function CustomColorPicker({ value, onChange, onConfirm, onCancel, anchorRect }: Props) {
  const initialHsv = rgbToHsv(hexToRgb(value || "#2563EB"));
  const [hsv, setHsv] = useState<Hsv>(initialHsv);
  const [mode, setMode] = useState<"wheel" | "square">("wheel");
  const [swatches, setSwatches] = useState<string[]>(DEFAULT_SWATCHES);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const isClient = useIsClient();
  const fieldUid = useId().replace(/:/g, "");
  const panelRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const wheelValRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const currentRgb = useMemo(() => hsvToRgb(hsv), [hsv]);
  const currentHex = useMemo(() => rgbToHex(currentRgb), [currentRgb]);
  const pureHue = useMemo(() => rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 })), [hsv.h]);
  const pureHueSatHex = useMemo(() => rgbToHex(hsvToRgb({ h: hsv.h, s: hsv.s, v: 1 })), [hsv.h, hsv.s]);
  const hueIndicatorTop = useMemo(() => (clamp(hsv.h, 0, 359) / 359) * 100, [hsv.h]);

  // Color wheel indicator coordinate calculation
  const wheelIndicatorPos = useMemo(() => {
    // 0 deg is Top in conic-gradient(from 0deg, ...)
    const rad = (hsv.h - 90) * (Math.PI / 180);
    const radius = 96; // 192px / 2
    const cx = 96;
    const cy = 96;
    const x = cx + Math.cos(rad) * (hsv.s * radius);
    const y = cy + Math.sin(rad) * (hsv.s * radius);
    return { x, y };
  }, [hsv.h, hsv.s]);

  const panelPosition = useMemo(() => {
    const panelW = 430;
    const panelH = 390;
    const gap = 6;
    const verticalNudge = 10;
    if (!anchorRect || typeof window === "undefined") {
      return { top: 120, left: 120 };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = anchorRect.right + gap;
    let top = anchorRect.bottom + gap + verticalNudge;

    if (left + panelW > vw - 12) left = anchorRect.left - panelW - gap;
    if (left < 12) left = Math.max(12, Math.min(vw - panelW - 12, anchorRect.left));

    if (top + panelH > vh - 12) top = vh - panelH - 12;
    if (top < 12) top = Math.max(12, Math.min(vh - panelH - 12, anchorRect.bottom + gap));

    return { top, left };
  }, [anchorRect]);

  const commitColor = (next: Hsv) => {
    setHsv(next);
    onChange(rgbToHex(hsvToRgb(next)));
  };

  const updateSwatchSlot = (index: number, color: string) => {
    setSwatches((prev) => {
      const next = [...prev];
      next[index] = color;
      return next;
    });
  };

  // 1. Color Wheel Interaction (Hue & Saturation)
  const pickWheel = (clientX: number, clientY: number) => {
    const el = wheelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = clientX - (rect.left + cx);
    const dy = clientY - (rect.top + cy);

    let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
    if (angle < 0) angle += 360;

    const dist = Math.sqrt(dx * dx + dy * dy);
    const radius = rect.width / 2;
    const s = clamp(dist / radius, 0, 1);
    const h = clamp(Math.round(angle), 0, 359);

    commitColor({ ...hsv, h, s });
  };

  // 2. Wheel Brightness Slider Interaction
  const pickWheelValue = (clientX: number) => {
    const el = wheelValRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const v = clamp(x / rect.width, 0, 1);
    commitColor({ ...hsv, v });
  };

  // 3. Square (SV Box) Interaction
  const pickSV = (clientX: number, clientY: number) => {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const y = clamp(clientY - rect.top, 0, rect.height);
    commitColor({ h: hsv.h, s: x / rect.width, v: 1 - y / rect.height });
  };

  // 4. Hue Bar Interaction
  const pickHue = (clientY: number) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const y = clamp(clientY - rect.top, 0, rect.height);
    const nextHue = clamp(Math.round((y / rect.height) * 359), 0, 359);
    commitColor({ ...hsv, h: nextHue });
  };

  useEffect(() => {
    if (!isClient) return;
    try {
      const raw = window.localStorage.getItem(SWATCHES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const cleaned = parsed
        .map((v) => String(v || "").trim())
        .filter((v) => /^#[0-9a-fA-F]{6}$/.test(v))
        .slice(0, DEFAULT_SWATCHES.length);
      if (cleaned.length === DEFAULT_SWATCHES.length) {
        queueMicrotask(() => setSwatches(cleaned));
      }
    } catch {
      // no-op
    }
  }, [isClient]);

  useEffect(() => {
    if (!isClient) return;
    try {
      window.localStorage.setItem(SWATCHES_STORAGE_KEY, JSON.stringify(swatches));
    } catch {
      // no-op
    }
  }, [swatches, isClient]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      onCancel();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onCancel]);

  if (!isClient) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[120] rounded-[10px] border border-white/15 bg-[#101217] p-3.5 text-white shadow-2xl backdrop-blur-xl animate-scale-in"
      style={{ top: panelPosition.top, left: panelPosition.left }}
    >
      {/* Mode Switch Tabs (Wheel vs Square) */}
      <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-1 rounded-md bg-white/5 p-0.5 border border-white/10">
          <button
            type="button"
            onClick={() => setMode("wheel")}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-semibold rounded-sm transition-all ${
              mode === "wheel"
                ? "bg-primary text-white shadow-sm"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
            Color Wheel
          </button>
          <button
            type="button"
            onClick={() => setMode("square")}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-semibold rounded-sm transition-all ${
              mode === "square"
                ? "bg-primary text-white shadow-sm"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
            Grid / Box
          </button>
        </div>
        <span className="text-[11px] font-medium text-white/50 uppercase tracking-wider">
          {mode === "wheel" ? "Hue & Saturation Wheel" : "Classic SV Box"}
        </span>
      </div>

      {/* Main Interactive Visual Canvas */}
      <div className="flex gap-3">
        {mode === "wheel" ? (
          /* ================= COLOR WHEEL MODE ================= */
          <div className="flex flex-col gap-2.5 items-center">
            {/* 360-Degree Circular Color Wheel */}
            <div
              ref={wheelRef}
              className="relative h-48 w-48 cursor-crosshair rounded-full overflow-hidden shadow-inner border border-white/20 select-none"
              style={{
                background:
                  "conic-gradient(from 0deg, #ff0000 0deg, #ffff00 60deg, #00ff00 120deg, #00ffff 180deg, #0000ff 240deg, #ff00ff 300deg, #ff0000 360deg)",
              }}
              onMouseDown={(e) => {
                pickWheel(e.clientX, e.clientY);
                const onMove = (ev: MouseEvent) => pickWheel(ev.clientX, ev.clientY);
                const onUp = () => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                if (!touch) return;
                pickWheel(touch.clientX, touch.clientY);
                const onMove = (ev: TouchEvent) => {
                  const t = ev.touches[0];
                  if (!t) return;
                  pickWheel(t.clientX, t.clientY);
                };
                const onEnd = () => {
                  window.removeEventListener("touchmove", onMove);
                  window.removeEventListener("touchend", onEnd);
                };
                window.addEventListener("touchmove", onMove, { passive: true });
                window.addEventListener("touchend", onEnd, { passive: true });
              }}
            >
              {/* Radial Saturation Overlay (Center white fading to transparent edge) */}
              <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background: "radial-gradient(circle at center, #ffffff 0%, rgba(255,255,255,0.7) 35%, rgba(255,255,255,0) 100%)",
                }}
              />

              {/* Dynamic Value/Brightness Dark Overlay */}
              <div
                className="absolute inset-0 rounded-full pointer-events-none transition-opacity duration-75"
                style={{
                  backgroundColor: "#000000",
                  opacity: (1 - hsv.v) * 0.92,
                }}
              />

              {/* Interactive Wheel Handle Indicator */}
              <span
                className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-white shadow-[0_0_4px_rgba(0,0,0,0.8),inset_0_0_2px_rgba(0,0,0,0.6)]"
                style={{
                  left: `${wheelIndicatorPos.x}px`,
                  top: `${wheelIndicatorPos.y}px`,
                  backgroundColor: currentHex,
                }}
              />
            </div>

            {/* Brightness / Value Slider Bar */}
            <div className="w-48 flex flex-col gap-1">
              <div className="flex justify-between text-[11px] font-medium text-white/70">
                <span>Brightness</span>
                <span>{Math.round(hsv.v * 100)}%</span>
              </div>
              <div
                ref={wheelValRef}
                className="relative h-4 w-full cursor-ew-resize rounded-full border border-white/20 select-none overflow-hidden shadow-inner"
                style={{
                  background: `linear-gradient(to right, #000000 0%, ${pureHueSatHex} 100%)`,
                }}
                onMouseDown={(e) => {
                  pickWheelValue(e.clientX);
                  const onMove = (ev: MouseEvent) => pickWheelValue(ev.clientX);
                  const onUp = () => {
                    window.removeEventListener("mousemove", onMove);
                    window.removeEventListener("mouseup", onUp);
                  };
                  window.addEventListener("mousemove", onMove);
                  window.addEventListener("mouseup", onUp);
                }}
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  if (!touch) return;
                  pickWheelValue(touch.clientX);
                  const onMove = (ev: TouchEvent) => {
                    const t = ev.touches[0];
                    if (!t) return;
                    pickWheelValue(t.clientX);
                  };
                  const onEnd = () => {
                    window.removeEventListener("touchmove", onMove);
                    window.removeEventListener("touchend", onEnd);
                  };
                  window.addEventListener("touchmove", onMove, { passive: true });
                  window.addEventListener("touchend", onEnd, { passive: true });
                }}
              >
                <span
                  className="pointer-events-none absolute top-0 bottom-0 w-2.5 -translate-x-1/2 rounded-full border border-black/50 bg-white shadow-md"
                  style={{ left: `${hsv.v * 100}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          /* ================= CLASSIC SQUARE MODE ================= */
          <div className="flex gap-3">
            <div
              ref={svRef}
              className="relative h-48 w-48 cursor-crosshair overflow-hidden rounded-[6px] border border-white/20"
              style={{
                backgroundColor: pureHue,
                backgroundImage:
                  "linear-gradient(to right, #ffffff, rgba(255,255,255,0)), linear-gradient(to top, #000000, rgba(0,0,0,0))",
              }}
              onMouseDown={(e) => {
                pickSV(e.clientX, e.clientY);
                const onMove = (ev: MouseEvent) => pickSV(ev.clientX, ev.clientY);
                const onUp = () => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                if (!touch) return;
                pickSV(touch.clientX, touch.clientY);
                const onMove = (ev: TouchEvent) => {
                  const t = ev.touches[0];
                  if (!t) return;
                  pickSV(t.clientX, t.clientY);
                };
                const onEnd = () => {
                  window.removeEventListener("touchmove", onMove);
                  window.removeEventListener("touchend", onEnd);
                };
                window.addEventListener("touchmove", onMove, { passive: true });
                window.addEventListener("touchend", onEnd, { passive: true });
              }}
            >
              <span
                className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
              />
            </div>
            <div
              ref={hueRef}
              className="relative h-48 w-4 cursor-ns-resize rounded-sm border border-white/20"
              style={{
                background:
                  "linear-gradient(to bottom, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
              }}
              onMouseDown={(e) => {
                pickHue(e.clientY);
                const onMove = (ev: MouseEvent) => pickHue(ev.clientY);
                const onUp = () => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                if (!touch) return;
                pickHue(touch.clientY);
                const onMove = (ev: TouchEvent) => {
                  const t = ev.touches[0];
                  if (!t) return;
                  pickHue(t.clientY);
                };
                const onEnd = () => {
                  window.removeEventListener("touchmove", onMove);
                  window.removeEventListener("touchend", onEnd);
                };
                window.addEventListener("touchmove", onMove, { passive: true });
                window.addEventListener("touchend", onEnd, { passive: true });
              }}
            >
              <span
                className="pointer-events-none absolute left-0 right-0 h-1 bg-white shadow"
                style={{ top: `calc(${hueIndicatorTop}% - 2px)` }}
              />
              <span
                className="pointer-events-none absolute h-0 w-0 border-y-[4px] border-y-transparent border-r-[6px] border-r-[#aab3c2]"
                style={{ left: -6, top: `calc(${hueIndicatorTop}% - 4px)` }}
              />
              <span
                className="pointer-events-none absolute h-0 w-0 border-y-[4px] border-y-transparent border-l-[6px] border-l-[#aab3c2]"
                style={{ right: -6, top: `calc(${hueIndicatorTop}% - 4px)` }}
              />
            </div>
          </div>
        )}

        {/* Right Info Column: Color Preview Swatch + RGB + HEX Inputs */}
        <div className="flex w-[112px] min-w-[112px] flex-col justify-between py-0.5">
          <div className="flex flex-col gap-2">
            {/* Active Color Preview Block */}
            <div
              className="h-11 w-full rounded-[6px] border border-white/20 shadow-md flex items-center justify-center transition-colors"
              style={{ background: currentHex }}
            >
              <span className="text-[11px] font-mono font-bold tracking-tight bg-black/40 text-white px-1.5 py-0.5 rounded">
                {currentHex}
              </span>
            </div>

            {/* RGB Inputs */}
            <div className="flex flex-col gap-1.5">
              {(["r", "g", "b"] as const).map((key) => (
                <div key={key} className="flex w-full items-center justify-end gap-1.5">
                  <span className="w-3 shrink-0 text-right text-[13px] font-bold uppercase text-white/70">
                    {key}
                  </span>
                  <input
                    id={`${fieldUid}-rgb-${key}`}
                    name={`colorRgb${key}`}
                    type="number"
                    min={0}
                    max={255}
                    value={currentRgb[key]}
                    onChange={(e) => {
                      const val = clamp(Number(e.target.value || 0), 0, 255);
                      const nextRgb = { ...currentRgb, [key]: val };
                      commitColor(rgbToHsv(nextRgb));
                    }}
                    className="h-6 w-[74px] rounded-[4px] border border-white/20 bg-white/95 px-1.5 text-[12px] font-medium text-black focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ))}

              {/* Hex Input */}
              <div className="flex w-full items-center justify-end gap-1.5 mt-0.5">
                <span className="w-3 shrink-0 text-right text-[13px] font-bold text-white/70">#</span>
                <input
                  id={`${fieldUid}-hex`}
                  name="colorHex"
                  type="text"
                  value={currentHex.replace("#", "")}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                    if (raw.length === 6) commitColor(rgbToHsv(hexToRgb(`#${raw}`)));
                  }}
                  className="h-6 w-[74px] rounded-[4px] border border-white/20 bg-white/95 px-1.5 text-[12px] font-mono font-bold uppercase tracking-tight text-black focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Swatches Row */}
      <div className="mt-3.5 flex gap-2.5 items-center border-t border-white/10 pt-2.5">
        <span className="text-[11px] text-white/60 font-medium mr-1">Presets:</span>
        {swatches.map((sw, idx) => (
          <button
            key={`${sw}-${idx}`}
            type="button"
            onClick={() => {
              setSelectedSlot(idx);
              commitColor(rgbToHsv(hexToRgb(sw)));
            }}
            className={`h-6 w-6 rounded-[4px] border transition-transform hover:scale-110 ${
              selectedSlot === idx
                ? "border-white ring-2 ring-primary ring-offset-1 ring-offset-black scale-105"
                : "border-white/25"
            }`}
            style={{ background: sw }}
            aria-label={`Select ${sw}`}
          />
        ))}
      </div>

      {/* Bottom Actions (Confirm, Cancel, Save Swatch) */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-2.5">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            className="!h-7 min-h-0 px-3 text-[12px] font-semibold bg-primary hover:bg-primary/90 text-white rounded-[6px] shadow-sm"
            onClick={onConfirm}
          >
            Apply Color
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="!h-7 min-h-0 px-2.5 text-[12px] font-medium bg-white/15 text-white hover:bg-white/25 border-0 rounded-[6px]"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="!h-7 min-h-0 px-2.5 text-[11px] font-medium bg-white/10 text-white/90 hover:bg-white/20 border border-white/15 rounded-[6px]"
          onClick={() => updateSwatchSlot(selectedSlot, currentHex)}
          title="Save current color into selected preset slot"
        >
          Save Slot
        </Button>
      </div>
    </div>,
    document.body
  );
}
