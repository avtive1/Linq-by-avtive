"use client";
/* eslint-disable @next/next/no-img-element --
 * Card canvases use dynamic URLs (avatars, sponsors, CDN assets) and are captured via html-to-image;
 * opting out of next/image avoids brittle remotePatterns and sizing constraints.
 */
import { useState, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import { CardData, SponsorEntry } from "@/types/card";
import { cssFontStackForGoogleFamily, parseGoogleFamilyFromStored } from "@/lib/card-fonts";
import { preloadGoogleCardFontCss } from "@/lib/card-font-runtime";
import { isValidImageDataUrl } from "@/lib/utils/image-data-url";

const SPONSOR_STRIP_MAX_W_H1_PX = 1120;

/**
 * Sponsor row: intrinsic logo widths + uniform flex gap (not equal-width columns).
 * After each image loads, adds optical horizontal padding when a mark renders narrower than its fair
 * share so dense / “heavy” logos don’t feel cramped against airy wordmarks.
 */
function SponsorStripRow({
  sponsors,
  logoHeightPx,
  maxStripWidthPx = SPONSOR_STRIP_MAX_W_H1_PX,
}: {
  sponsors: SponsorEntry[];
  logoHeightPx: number;
  maxStripWidthPx?: number;
}) {
  const items = sponsors.slice(0, 6);
  const count = items.length;
  const [opticalPadByKey, setOpticalPadByKey] = useState<Record<string, number>>({});

  const innerBudget = maxStripWidthPx * 0.96;
  const fairShareW = innerBudget / Math.max(count, 1);
  /** Cap near fair share so N logos + optical padding rarely overflow the strip */
  const imgCapPx = Math.max(70, Math.floor(fairShareW * 1.15));

  const onLogoLoad = useCallback(
    (key: string, el: HTMLImageElement) => {
      const nw = el.naturalWidth;
      const nh = el.naturalHeight;
      if (!nw || !nh) return;
      const renderedW = Math.min(imgCapPx, (nw / nh) * logoHeightPx);
      const deficit = Math.max(0, fairShareW - renderedW);
      const pad = Math.min(18, Math.round(deficit * 0.28));
      setOpticalPadByKey((prev) => (prev[key] === pad ? prev : { ...prev, [key]: pad }));
    },
    [fairShareW, imgCapPx, logoHeightPx],
  );

  if (count === 0) return null;

  return (
    <div
      className={`flex h-full w-full max-w-full flex-nowrap items-center px-1 sm:px-2 ${
        count === 1 ? "justify-center" : "justify-between"
      }`}
      style={{
        maxWidth: maxStripWidthPx,
        ...(count > 1
          ? {}
          : { gap: "clamp(12px, 2vmin, 28px)" }),
      }}
    >
      {items.map((s, i) => {
        const key = `${s.logo_url}-${i}`;
        const pad = opticalPadByKey[key] ?? 0;
        return (
          <div
            key={key}
            className="flex min-h-0 shrink-0 items-center justify-center"
            style={{ paddingInline: pad }}
          >
            <img
              src={s.logo_url}
              alt={s.name?.trim() || "Sponsor"}
              title={s.name?.trim() || undefined}
              className="object-contain"
              crossOrigin="anonymous"
              style={{
                height: logoHeightPx,
                width: "auto",
                maxWidth: imgCapPx,
                maxHeight: logoHeightPx,
                background: "transparent",
                filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.35))",
              }}
              onLoad={(e) => onLogoLoad(key, e.currentTarget)}
            />
          </div>
        );
      })}
    </div>
  );
}

function formatSessionTimeWithZone(raw?: string): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const period = hours >= 12 ? "PM" : "AM";
  const normalizedHours = hours % 12 === 0 ? 12 : hours % 12;
  const formattedMinutes = String(minutes).padStart(2, "0");
  return `${normalizedHours}:${formattedMinutes} ${period} (GMT+5)`;
}

function getCombinedLogos(data: Partial<CardData>): SponsorEntry[] {
  const list: SponsorEntry[] = [];
  const seen = new Set<string>();

  const orgLogo = String(data.organizationLogoUrl || "").trim();
  const orgName = String(data.organizationName || "").trim();
  if (orgLogo && !seen.has(orgLogo)) {
    seen.add(orgLogo);
    list.push({ logo_url: orgLogo, name: orgName || "Host Organization" });
  }

  const primaryEventLogo = String(data.logo || "").trim();
  if (primaryEventLogo && !seen.has(primaryEventLogo)) {
    seen.add(primaryEventLogo);
    list.push({ logo_url: primaryEventLogo, name: data.eventName || "Event Partner" });
  }

  if (Array.isArray(data.sponsors)) {
    for (const s of data.sponsors) {
      const url = String(s?.logo_url || "").trim();
      if (url && !seen.has(url)) {
        seen.add(url);
        list.push({ logo_url: url, name: s.name || "Partner" });
      }
    }
  }

  if (list.length === 0) {
    list.push({
      logo_url: "/card-assets/safar-linq-logo.svg",
      name: "LINQ",
    });
  }

  return list;
}

export type ColorTheme = {
  start: string;
  end: string;
  accent: string;
  textColor?: string;
  titleColor?: string;
};

export const COLOR_THEMES: Record<string, ColorTheme> = {
  karakoram: {
    start: "#06080F",
    end: "#0B0F19",
    accent: "#00F0FF",
    textColor: "#FFFFFF",
    titleColor: "#FFFFFF",
  },
  "dark-neon": {
    start: "#06080F",
    end: "#0B0F19",
    accent: "#00F0FF",
    textColor: "#FFFFFF",
    titleColor: "#FFFFFF",
  },
  purple: {
    start: "#41295a",
    end: "#2f0743",
    accent: "#c084fc",
    textColor: "#FFFFFF",
    titleColor: "#FFFFFF",
  },
  red: {
    start: "#c94b4b",
    end: "#4b134f",
    accent: "#f87171",
    textColor: "#FFFFFF",
    titleColor: "#FFFFFF",
  },
  pink: {
    start: "#EE0979",
    end: "#FF6A00",
    accent: "#f472b6",
    textColor: "#FFFFFF",
    titleColor: "#FFFFFF",
  },
  blue: {
    start: "#0c1a30",
    end: "#1e3a8a",
    accent: "#38bdf8",
    textColor: "#FFFFFF",
    titleColor: "#FFFFFF",
  },
  green: {
    start: "#0c2b18",
    end: "#031208",
    accent: "#4ade80",
    textColor: "#FFFFFF",
    titleColor: "#FFFFFF",
  },
};

function resolveTheme(color?: string): ColorTheme {
  const raw = String(color || "").trim().toLowerCase();
  if (!raw) return COLOR_THEMES.karakoram;
  if (COLOR_THEMES[raw]) return COLOR_THEMES[raw];

  const custom = String(color || "").trim();
  return {
    start: custom,
    end: custom,
    accent: custom.startsWith("#") || custom.startsWith("rgb") ? custom : "#00F0FF",
    textColor: "#FFFFFF",
    titleColor: "#FFFFFF",
  };
}

export function CardPreview({
  data,
  preview = false,
  id,
  isVertical = false,
  verticalSide = 1,
}: {
  data: Partial<CardData>;
  preview?: boolean;
  id?: string;
  isVertical?: boolean;
  verticalSide?: 1 | 2;
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const sessionTimeLabel = formatSessionTimeWithZone(data.sessionTime);
  const surfaceMotionClass = preview
    ? ""
    : "animate-fade-in will-change-transform transition-all duration-500 group";

  const storedFontKey = String(data.fontFamily || "inter").trim() || "inter";
  const googleFamily = parseGoogleFamilyFromStored(storedFontKey);

  useEffect(() => {
    void preloadGoogleCardFontCss(storedFontKey);
  }, [storedFontKey]);

  const fontMap: Record<string, string> = {
    inter: "var(--font-inter-tight), sans-serif",
    poppins: "var(--font-poppins), sans-serif",
    outfit: "var(--font-outfit), sans-serif",
    times: "'Times New Roman', Times, serif",
  };
  const selectedFont = googleFamily
    ? cssFontStackForGoogleFamily(googleFamily)
    : fontMap[storedFontKey] || fontMap.inter;
  const photoUrl = String(data.photo || "").trim();
  const hasRealPhoto =
    Boolean(photoUrl) &&
    !photoUrl.endsWith("/default-avatar-placeholder.svg") &&
    photoUrl !== "/default-avatar-placeholder.svg" &&
    (!photoUrl.startsWith("data:") || isValidImageDataUrl(photoUrl));

  const rawQrInput = data.linkedin?.trim() || "";
  let finalQrUrl = "";
  if (rawQrInput) {
    if (rawQrInput.startsWith("http://") || rawQrInput.startsWith("https://")) {
      finalQrUrl = rawQrInput;
    } else if (rawQrInput.includes(".")) {
      finalQrUrl = `https://${rawQrInput}`;
    } else {
      finalQrUrl = `https://linkedin.com/in/${rawQrInput}`;
    }
  }

  useEffect(() => {
    let cancelled = false;
    const updateQr = async () => {
      if (!finalQrUrl) {
        if (!cancelled) setQrUrl(null);
        return;
      }
      try {
        const url = await QRCode.toDataURL(finalQrUrl, {
          margin: 1,
          width: 400,
          color: { dark: "#000000", light: "#ffffff" },
        });
        if (!cancelled) setQrUrl(url);
      } catch {
        if (!cancelled) setQrUrl(null);
      }
    };
    void updateQr();
    return () => {
      cancelled = true;
    };
  }, [finalQrUrl]);

  const venueHeader = data.location?.trim()
    ? (data.location.toLowerCase() === "webinar" ? "WEBINAR" : data.location.split(",")[0].trim().toUpperCase())
    : "NSTP";

  const theme = resolveTheme(data.color);
  const cardGradient =
    theme.start === theme.end
      ? theme.start
      : `linear-gradient(135deg, ${theme.start} 0%, ${theme.end} 100%)`;

  if (isVertical) {
    const verticalTextColor = data.verticalTextColor?.trim() || "#FFFFFF";

    return (
      <div 
        id={id}
        className={`relative overflow-hidden shadow-2xl poster-vertical ${surfaceMotionClass}`}
        style={{ 
          width: "576px", 
          height: "1024px", 
          fontFamily: selectedFont,
          background: cardGradient,
          color: verticalTextColor,
        }}
      >
        {/* Background Neon Vector Artwork */}
        <img 
          src="/card-assets/safar-neon-curves-vertical.svg" 
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0" 
          style={{ mixBlendMode: "screen", opacity: 0.85 }}
          alt="" 
        />
        <div 
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none z-[1]" 
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} 
        />

        {/* Top Header */}
        <div className="absolute left-[36px] top-[44px] z-20 max-w-[500px]">
          <h2 
            className="m-0 text-[26px] font-black tracking-[-0.02em] leading-none uppercase"
            style={{ color: verticalTextColor }}
          >
            MEET YOU AT<br />{venueHeader}
          </h2>
          <div 
            className="mt-4 inline-flex items-center px-4 py-1.5 rounded-md border shadow-[0_0_15px_rgba(139,92,246,0.35)]"
            style={{ backgroundColor: "#2A1B4E", borderColor: theme.accent || "#8B5CF6" }}
          >
            <span 
              className="text-[16px] font-bold tracking-[2px] uppercase leading-none"
              style={{ color: "#FFFFFF" }}
            >
              {data.cardRole === "guest" ? "OUR GUEST AT" : "I'M ATTENDING"}
            </span>
          </div>
          <h1 
            className="m-0 mt-3 text-[32px] font-extrabold tracking-[-0.02em] leading-tight uppercase"
            style={{ color: verticalTextColor }}
          >
            {data.eventName || "SAFAR-E-KARAKORAM"}
          </h1>
          <p 
            className="m-0 mt-2 text-[17px] font-medium opacity-85"
            style={{ color: verticalTextColor }}
          >
            {data.sessionDate || "10th September 2026"} {sessionTimeLabel ? `(${sessionTimeLabel})` : "(1:00pm - 2:00 pm)"}
          </p>
        </div>

        {/* Profile Circle or QR */}
        {verticalSide === 1 ? (
          <div className="absolute left-1/2 top-[440px] -translate-x-1/2 z-20 flex flex-col items-center text-center w-full px-6">
            <div 
              className="relative isolate mb-5 flex h-[210px] w-[210px] items-center justify-center overflow-hidden rounded-full border-[3px] border-white/50 ring-4 shadow-[0_0_35px_rgba(0,240,255,0.45)]"
              style={{ ringColor: theme.accent || "#00F0FF", backgroundColor: "#0c121e" }}
            >
              {hasRealPhoto ? (
                <img src={photoUrl} alt="" className="h-full w-full object-cover" crossOrigin="anonymous" />
              ) : (
                <img src="/card-assets/safar-default-avatar.svg" className="h-full w-full object-cover" alt="Default profile" />
              )}
            </div>
            <p 
              className="m-0 text-[32px] font-bold leading-tight"
              style={{ color: verticalTextColor }}
            >
              {data.name || "Attendee Name"}
            </p>
            <p 
              className="m-0 mt-1 text-[20px] font-semibold uppercase tracking-wider opacity-90"
              style={{ color: verticalTextColor }}
            >
              {data.role || "ROLE/TITLE"}
            </p>
            <p 
              className="m-0 mt-0.5 text-[17px] font-medium opacity-85"
              style={{ color: verticalTextColor }}
            >
              {data.company || "Organization"}
            </p>
          </div>
        ) : (
          <div className="absolute left-1/2 top-[440px] -translate-x-1/2 z-20 flex flex-col items-center text-center">
            <div className="h-[210px] w-[210px] overflow-hidden rounded-2xl border-2 border-white/30 bg-white p-3 shadow-xl">
              {qrUrl ? (
                <img src={qrUrl} className="h-full w-full object-contain" alt="QR Code" crossOrigin="anonymous" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center text-slate-700 text-xs">
                  Add a link for QR Code
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom Slogan & Logos */}
        <div className="absolute left-0 bottom-[28px] w-full px-[36px] z-20 flex flex-col items-center text-center">
          <p 
            className="m-0 text-[17px] font-semibold tracking-[1px] uppercase mb-2.5"
            style={{ color: verticalTextColor }}
          >
            START HERE, GO ANYWHERE
          </p>
          <p 
            className="m-0 text-[12px] font-medium mb-2 opacity-80"
            style={{ color: verticalTextColor }}
          >
            Co-organized by:
          </p>
          <div className="flex items-center justify-center gap-5 max-w-[500px]">
            <SponsorStripRow
              sponsors={getCombinedLogos(data)}
              logoHeightPx={38}
              maxStripWidthPx={490}
            />
          </div>
        </div>
      </div>
    );
  }

  const horizontalTextColor = data.horizontalTextColor?.trim() || "#FFFFFF";

  // Common styles for horizontal card
  const posterStyle: React.CSSProperties = {
    width: "1200px",
    height: "628px",
    background: cardGradient,
    fontFamily: selectedFont,
    color: horizontalTextColor,
  };

  // Horizontal Card — Universal Modern Social Post Layout
  return (
    <div
      id={id}
      key={data.designType}
      className={`relative overflow-hidden shadow-2xl poster ${surfaceMotionClass}`}
      style={posterStyle}
    >
      {/* Luminous Neon Waves Overlay */}
      <img 
        src="/card-assets/safar-neon-curves.svg" 
        className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0" 
        style={{ mixBlendMode: "screen", opacity: 0.85 }}
        alt="" 
      />
      <div 
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none z-[1]" 
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} 
      />

      {/* Top-Left Header: MEET YOU AT [LOCATION / NSTP] */}
      <div className="absolute left-[58px] top-[48px] z-20">
        <h2 
          className="m-0 text-[38px] font-black tracking-[-0.02em] leading-none uppercase"
          style={{ color: horizontalTextColor }}
        >
          MEET YOU AT<br />{venueHeader}
        </h2>
      </div>

      {/* Attending Pill Badge + Event Name */}
      <div className="absolute left-[58px] top-[152px] z-20 flex items-center gap-4 flex-wrap max-w-[700px]">
        <div 
          className="px-4 py-2 rounded-md border shadow-[0_0_15px_rgba(139,92,246,0.35)] flex items-center justify-center shrink-0"
          style={{ backgroundColor: "#2A1B4E", borderColor: theme.accent || "#8B5CF6" }}
        >
          <span 
            className="text-[20px] font-bold tracking-[2.5px] uppercase leading-none"
            style={{ color: "#FFFFFF" }}
          >
            {data.cardRole === "guest" ? "OUR GUEST AT" : "I'M ATTENDING"}
          </span>
        </div>
        <h1 
          className="m-0 text-[34px] font-extrabold tracking-[-0.02em] leading-none uppercase"
          style={{ color: horizontalTextColor }}
        >
          {data.eventName || "SAFAR-E-KARAKORAM"}
        </h1>
        {data.cardRole === "guest" && data.guestCategory && (
          <span 
            className="text-[20px] font-bold tracking-[1px] uppercase leading-none"
            style={{ color: theme.accent || "#00F0FF" }}
          >
            AS {data.guestCategory}
          </span>
        )}
      </div>

      {/* Session Date & Time */}
      <div className="absolute left-[58px] top-[260px] z-20 flex flex-col gap-1">
        <p 
          className="m-0 text-[23px] font-bold tracking-tight leading-tight"
          style={{ color: horizontalTextColor }}
        >
          {data.sessionDate || "10th September 2026"}
        </p>
        <p 
          className="m-0 text-[18px] font-medium leading-tight opacity-85"
          style={{ color: horizontalTextColor }}
        >
          {sessionTimeLabel ? `(${sessionTimeLabel})` : "(1:00pm - 2:00 pm)"}
        </p>
      </div>

      {/* Slogan */}
      <div className="absolute left-[58px] top-[365px] z-20">
        <p 
          className="m-0 text-[21px] font-semibold tracking-[0.5px] uppercase"
          style={{ color: horizontalTextColor }}
        >
          START HERE, GO ANYWHERE
        </p>
      </div>

      {/* Co-organized by & Logos (Single line containing company + sponsor logos) */}
      <div className="absolute left-[58px] bottom-[38px] z-20 flex flex-col gap-2">
        <p 
          className="m-0 text-[14px] font-medium opacity-80"
          style={{ color: horizontalTextColor }}
        >
          Co-organized by:
        </p>
        <div className="flex items-center gap-6 max-w-[580px]">
          <SponsorStripRow
            sponsors={getCombinedLogos(data)}
            logoHeightPx={46}
            maxStripWidthPx={580}
          />
        </div>
      </div>

      {/* Attendee Profile Section on Right */}
      <section className="absolute right-[50px] top-[95px] z-20 w-[320px] flex flex-col items-center text-center">
        <div 
          className="relative isolate mb-5 flex h-[210px] w-[210px] items-center justify-center overflow-hidden rounded-full border-[3px] border-white/50 ring-4 shadow-[0_0_35px_rgba(0,240,255,0.4)]"
          style={{ ringColor: theme.accent || "#00F0FF", backgroundColor: "#0b0f19" }}
        >
          {hasRealPhoto ? (
            <img
              src={photoUrl}
              className="w-full h-full object-cover"
              alt={data.name?.trim() ? `Photo of ${data.name.trim()}` : "Attendee photo"}
              crossOrigin="anonymous"
            />
          ) : (
            <img
              src="/card-assets/safar-default-avatar.svg"
              className="w-full h-full object-cover"
              alt="Default profile"
            />
          )}
        </div>
        <h2 
          className="m-0 font-extrabold text-[27px] leading-tight"
          style={{ color: horizontalTextColor }}
        >
          {data.name || "Attendee Name"}
        </h2>
        <p 
          className="m-0 font-bold text-[18px] mt-1 uppercase tracking-wider opacity-90"
          style={{ color: horizontalTextColor }}
        >
          {data.role || "CEO"}
        </p>
        <p 
          className="m-0 font-medium text-[16px] mt-0.5 opacity-85"
          style={{ color: horizontalTextColor }}
        >
          {data.company || "Organization"}
        </p>
      </section>
    </div>
  );
}
