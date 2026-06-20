"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import {
  CARD_FONT_PRESETS,
  googleCardFontToken,
  labelForStoredCardFont,
  type CardFontPreset,
} from "@/lib/card-fonts";

type CatalogRow = { family: string; c: string; p: number };

let catalogMemo: CatalogRow[] | null = null;
let catalogInflight: Promise<CatalogRow[]> | null = null;

async function loadGoogleFontCatalog(): Promise<CatalogRow[]> {
  if (catalogMemo) return catalogMemo;
  if (!catalogInflight) {
    catalogInflight = fetch("/data/google-fonts-catalog.json", { cache: "force-cache" })
      .then((res) => {
        if (!res.ok) throw new Error("Font catalog unavailable");
        return res.json();
      })
      .then((body: { families?: CatalogRow[] }) => {
        const rows = Array.isArray(body?.families) ? body!.families! : [];
        catalogMemo = rows;
        return rows;
      })
      .catch(() => []);
  }
  return catalogInflight;
}

function presetLabel(key: CardFontPreset): string {
  switch (key) {
    case "inter":
      return "Inter (default)";
    case "poppins":
      return "Poppins";
    case "outfit":
      return "Outfit · Google Sans style";
    case "times":
      return "Times New Roman (system)";
    default:
      return key;
  }
}

const SKIP_IN_POPULAR = new Set([
  "Noto Color Emoji",
  "Noto Emoji",
  "Google Sans",
  /** Bundled presets — avoid suggesting the redundant Google-hosted row */
  "Inter",
  "Poppins",
  "Outfit",
]);

export function CardTypographyPicker({
  value,
  onChange,
  disabled,
  buttonClassName = "",
  preferBelow = true,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  buttonClassName?: string;
  /** When true, anchor the menu directly below the trigger (default). */
  preferBelow?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<CatalogRow[]>(catalogMemo ?? []);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = value || "inter";

  useEffect(() => {
    let cancelled = false;
    loadGoogleFontCatalog().then((rows) => {
      if (!cancelled) setCatalog(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const popular = useMemo(() => {
    const out: CatalogRow[] = [];
    for (const row of catalog) {
      if (SKIP_IN_POPULAR.has(row.family)) continue;
      out.push(row);
      if (out.length >= 32) break;
    }
    return out;
  }, [catalog]);

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || catalog.length === 0) return [];
    const hits: CatalogRow[] = [];
    for (const row of catalog) {
      if (row.family.toLowerCase().includes(q)) {
        hits.push(row);
        if (hits.length >= 60) break;
      }
    }
    return hits;
  }, [query, catalog]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const [panelRect, setPanelRect] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  }>({ top: 0, left: 0, width: 320, maxHeight: 360 });

  const positionPanel = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const width = Math.min(Math.max(r.width, 288), vw - 16);
    const left = Math.min(Math.max(8, r.left), vw - width - 8);
    const belowTop = r.bottom + 6;
    const spaceBelow = vh - belowTop - 12;
    const spaceAbove = r.top - 12;

    if (preferBelow) {
      let maxHeight = Math.min(380, Math.max(140, spaceBelow));
      let top = belowTop;
      if (top + maxHeight > vh - 12) {
        top = Math.max(12, vh - 12 - maxHeight);
      }
      setPanelRect({ top, left, width, maxHeight });
      return;
    }

    const maxHeight = Math.min(380, Math.max(160, spaceAbove - 8));
    setPanelRect({ top: Math.max(8, r.top - maxHeight - 6), left, width, maxHeight });
  }, [preferBelow]);

  useEffect(() => {
    if (!open) return;
    positionPanel();
    const onWin = () => positionPanel();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, positionPanel]);

  const currentLabel = labelForStoredCardFont(selected);

  const pickGoogle = (family: string) => {
    onChange(googleCardFontToken(family));
    setOpen(false);
    setQuery("");
  };

  const panel =
    open && typeof document !== "undefined" ? (
      <div
        ref={panelRef}
        role="listbox"
        className="fixed z-[200] rounded-md border border-border/70 bg-white py-2 shadow-xl"
        style={{
          top: panelRect.top,
          left: panelRect.left,
          width: panelRect.width,
          maxHeight: panelRect.maxHeight,
          overflow: "hidden",
        }}
      >
        <div className="border-b border-border/50 px-2 pb-2">
          <div className="flex h-9 items-center gap-2 rounded-md border border-border/60 bg-surface px-2">
            <Search size={16} className="shrink-0 text-muted/80" aria-hidden />
            <input
              autoFocus
              placeholder="Search all Google Fonts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-full min-w-0 flex-1 border-none bg-transparent text-[14px] text-heading outline-none placeholder:text-muted/50"
            />
          </div>
        </div>

        <div className="max-h-[calc(100%-52px)] overflow-y-auto overflow-x-hidden px-2 pt-2">
          {query.trim().length === 0 ? (
            <>
              <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted/60">
                Built-in fonts
              </p>
              {CARD_FONT_PRESETS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="option"
                  aria-selected={selected === k}
                  onClick={() => {
                    onChange(k);
                    setOpen(false);
                  }}
                  className={`flex w-full rounded-md px-2 py-2 text-left text-[14px] hover:bg-primary/10 ${
                    selected === k ? "bg-primary/12 font-semibold text-heading" : "text-heading/90"
                  }`}
                >
                  {presetLabel(k)}
                </button>
              ))}

              <p className="mt-2 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted/60">
                Popular on Google Fonts
              </p>
              {popular.length === 0 ? (
                <p className="px-2 py-2 text-[13px] text-muted">Loading catalog…</p>
              ) : (
                popular.map((row) => {
                  const token = googleCardFontToken(row.family);
                  const isSel = selected === token;
                  return (
                    <button
                      key={row.family}
                      type="button"
                      role="option"
                      aria-selected={isSel}
                      onClick={() => pickGoogle(row.family)}
                      className={`flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-primary/10 ${
                        isSel ? "bg-primary/12" : ""
                      }`}
                    >
                      <span className={`text-[14px] ${isSel ? "font-semibold" : ""}`}>{row.family}</span>
                      {row.c ? (
                        <span className="text-[11px] text-muted/80">{row.c}</span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </>
          ) : (
            <>
              <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted/60">
                Search results
              </p>
              {searchHits.length === 0 ? (
                <p className="px-2 py-3 text-[13px] text-muted">No fonts match that search.</p>
              ) : (
                searchHits.map((row) => {
                  const token = googleCardFontToken(row.family);
                  const isSel = selected === token;
                  return (
                    <button
                      key={row.family}
                      type="button"
                      role="option"
                      aria-selected={isSel}
                      onClick={() => pickGoogle(row.family)}
                      className={`flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-primary/10 ${
                        isSel ? "bg-primary/12" : ""
                      }`}
                    >
                      <span className={`text-[14px] ${isSel ? "font-semibold" : ""}`}>{row.family}</span>
                      {row.c ? <span className="text-[11px] text-muted/80">{row.c}</span> : null}
                    </button>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    ) : null;

  return (
    <div ref={wrapRef} className={`relative w-full ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
        }}
        className={`
          flex h-11 w-full items-center justify-between gap-2 rounded-md border border-border/60 bg-white px-4 text-left text-[16px] leading-[1.6] text-heading shadow-sm transition-all duration-200
          hover:border-primary/50 focus-visible:outline-none focus-visible:border-primary/80 focus-visible:border-[1.5px]
          ${open ? "border-primary/80 border-[1.5px]" : ""}
          ${buttonClassName}
        `}
      >
        <span className="min-w-0 truncate">
          {currentLabel.title}
          {currentLabel.subtitle ? (
            <span className="text-muted/70 text-[13px] font-normal"> · {currentLabel.subtitle}</span>
          ) : null}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 text-muted" aria-hidden>
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
