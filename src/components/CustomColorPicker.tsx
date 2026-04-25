"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const SWATCHES = ["#C71B1B", "#F3F4F6", "#E5E7EB", "#D1D5DB", "#9CA3AF", "#6B7280", "#4B5563", "#1F2937"];

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
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const currentRgb = useMemo(() => hsvToRgb(hsv), [hsv]);
  const currentHex = useMemo(() => rgbToHex(currentRgb), [currentRgb]);
  const pureHue = useMemo(() => rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 })), [hsv.h]);
  const panelPosition = useMemo(() => {
    const panelW = 340;
    const panelH = 330;
    const gap = 10;
    if (!anchorRect || typeof window === "undefined") {
      return { top: 120, left: 120 };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = anchorRect.right + gap;
    let top = anchorRect.top;

    // Prefer side placement, then fall back to above.
    if (left + panelW > vw - 12) left = anchorRect.left - panelW - gap;
    if (left < 12) left = Math.max(12, Math.min(vw - panelW - 12, anchorRect.left));

    if (top + panelH > vh - 12) top = anchorRect.top - panelH - gap;
    if (top < 12) top = Math.max(12, Math.min(vh - panelH - 12, anchorRect.bottom + gap));

    return { top, left };
  }, [anchorRect]);

  const commitColor = (next: Hsv) => {
    setHsv(next);
    onChange(rgbToHex(hsvToRgb(next)));
  };

  const pickSV = (clientX: number, clientY: number) => {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const y = clamp(clientY - rect.top, 0, rect.height);
    commitColor({ h: hsv.h, s: x / rect.width, v: 1 - y / rect.height });
  };

  const pickHue = (clientY: number) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const y = clamp(clientY - rect.top, 0, rect.height);
    commitColor({ ...hsv, h: Math.round((y / rect.height) * 360) });
  };

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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

  if (!mounted) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[120] rounded-lg border border-white/15 bg-[#101217] p-3 text-white shadow-2xl"
      style={{ top: panelPosition.top, left: panelPosition.left }}
    >
      <div className="mb-2 text-xs font-medium text-white/85">Select Color</div>
      <div className="flex gap-3">
        <div
          ref={svRef}
          className="relative h-44 w-44 cursor-crosshair overflow-hidden rounded-sm"
          style={{
            backgroundColor: pureHue,
            backgroundImage: "linear-gradient(to right, #ffffff, rgba(255,255,255,0)), linear-gradient(to top, #000000, rgba(0,0,0,0))",
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
        >
          <span
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
          />
        </div>
        <div
          ref={hueRef}
          className="relative h-44 w-4 cursor-ns-resize rounded-sm"
          style={{
            background:
              "linear-gradient(to bottom, #ff0000, #ff00ff, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)",
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
        >
          <span
            className="pointer-events-none absolute left-0 right-0 h-1 rounded bg-white shadow"
            style={{ top: `${(hsv.h / 360) * 100}%` }}
          />
        </div>
        <div className="flex min-w-[90px] flex-col gap-2">
          <div className="h-10 w-full rounded-sm border border-white/15" style={{ background: currentHex }} />
          {(["r", "g", "b"] as const).map((key) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-3 text-xs uppercase text-white/70">{key}</span>
              <input
                type="number"
                min={0}
                max={255}
                value={currentRgb[key]}
                onChange={(e) => {
                  const val = clamp(Number(e.target.value || 0), 0, 255);
                  const nextRgb = { ...currentRgb, [key]: val };
                  commitColor(rgbToHsv(nextRgb));
                }}
                className="h-7 w-14 rounded border border-white/20 bg-white px-1 text-xs text-black"
              />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="w-3 text-xs text-white/70">#</span>
            <input
              type="text"
              value={currentHex.replace("#", "")}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                if (raw.length === 6) commitColor(rgbToHsv(hexToRgb(`#${raw}`)));
              }}
              className="h-7 w-16 rounded border border-white/20 bg-white px-1 text-xs uppercase text-black"
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-1">
        {SWATCHES.map((sw) => (
          <button
            key={sw}
            type="button"
            onClick={() => commitColor(rgbToHsv(hexToRgb(sw)))}
            className="h-5 w-5 rounded-sm border border-white/20"
            style={{ background: sw }}
            aria-label={`Select ${sw}`}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            className="!h-6 min-h-0 px-2.5 text-xs font-medium leading-none bg-[#fcfffd] text-[#1f4a90] border border-[#eef8f1] hover:bg-[#f7fdf9] rounded-md"
            onClick={onConfirm}
          >
            Confirm
          </Button>
          <Button
            type="button"
            className="!h-6 min-h-0 px-2.5 text-xs font-medium leading-none bg-white text-[#1f4a90] border border-white/70 hover:bg-white/95 rounded-md"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
        <Button
          type="button"
          className="!h-6 min-h-0 px-2.5 text-xs font-medium leading-none bg-[#fcfffd] text-[#1f4a90] border border-[#eef8f1] hover:bg-[#f7fdf9] rounded-md"
          onClick={onConfirm}
        >
          Replace
        </Button>
      </div>
    </div>,
    document.body
  );
}

