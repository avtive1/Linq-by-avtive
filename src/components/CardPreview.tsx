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
import { optimizeCdnImageUrl } from "@/lib/utils/cdn-image";
import { isValidImageDataUrl } from "@/lib/utils/image-data-url";

/** Custom sponsors: larger row so marks read like the reference artwork (most of the 123px footer) */
const SPONSOR_LOGO_HEIGHT_H1_PX = 84;
const SPONSOR_STRIP_MAX_W_H1_PX = 1120;
const SPONSOR_LOGO_HEIGHT_V_PX = 56;
const SPONSOR_STRIP_MAX_W_V_PX = 528;

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

  const innerBudget = maxStripWidthPx * 0.94;
  const fairShareW = innerBudget / Math.max(count, 1);
  /** Cap near fair share so N logos + optical padding rarely overflow the strip */
  const imgCapPx = Math.max(40, Math.floor(fairShareW * 0.92));

  const onLogoLoad = useCallback(
    (key: string, el: HTMLImageElement) => {
      const nw = el.naturalWidth;
      const nh = el.naturalHeight;
      if (!nw || !nh) return;
      const renderedW = Math.min(imgCapPx, (nw / nh) * logoHeightPx);
      const deficit = Math.max(0, fairShareW - renderedW);
      const pad = Math.min(22, Math.round(deficit * 0.34));
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
          : { gap: "clamp(10px, 1.9vmin, 26px)" }),
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
              }}
              onLoad={(e) => onLogoLoad(key, e.currentTarget)}
            />
          </div>
        );
      })}
    </div>
  );
}

function filterSponsors(s?: SponsorEntry[] | null): SponsorEntry[] {
  if (!s?.length) return [];
  return s
    .filter((x) => x.logo_url?.trim())
    .filter((x) => {
      const url = String(x.logo_url || "").toLowerCase();
      // Ignore legacy placeholder assets so the strip stays empty unless real logos were uploaded.
      if (!url) return false;
      if (url.includes("figma.com/api/mcp/asset")) return false;
      return true;
    })
    .slice(0, 6);
}

function HorizontalSponsorsDesign1({ sponsors }: { sponsors?: SponsorEntry[] }) {
  const list = filterSponsors(sponsors);
  if (!list.length) return null;
  return (
    <div className="flex h-full w-full max-w-[1120px] items-center justify-center">
      <SponsorStripRow
        sponsors={list}
        logoHeightPx={SPONSOR_LOGO_HEIGHT_H1_PX}
        maxStripWidthPx={SPONSOR_STRIP_MAX_W_H1_PX}
      />
    </div>
  );
}

function VerticalSponsorsStrip({ sponsors }: { sponsors?: SponsorEntry[] }) {
  const list = filterSponsors(sponsors);
  /** Pin to card bottom — avoids `top:auto` static-position bug when all siblings are `absolute` */
  const stripStyle: React.CSSProperties = {
    position: "absolute",
    left: 24,
    bottom: 24,
    width: SPONSOR_STRIP_MAX_W_V_PX,
    height: SPONSOR_LOGO_HEIGHT_V_PX + 10,
    zIndex: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  if (!list.length) return null;
  return (
    <div style={stripStyle}>
      <SponsorStripRow
        sponsors={list}
        logoHeightPx={SPONSOR_LOGO_HEIGHT_V_PX}
        maxStripWidthPx={SPONSOR_STRIP_MAX_W_V_PX}
      />
    </div>
  );
}

function DefaultAvatarPlaceholder({ className = "w-20 h-20" }: { className?: string }) {
  return (
    <img src="/default-avatar-placeholder.svg" className={`${className} object-cover bg-white`} alt="Default profile" />
  );
}

function getLocalTimeZoneLabel() {
  try {
    const offsetParts = new Intl.DateTimeFormat(undefined, { timeZoneName: "shortOffset" }).formatToParts(new Date());
    const gmtOffset = offsetParts.find((part) => part.type === "timeZoneName")?.value?.trim();
    if (gmtOffset) return gmtOffset;

    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(new Date());
    const fallbackTz = parts.find((part) => part.type === "timeZoneName")?.value?.trim();
    return fallbackTz || "";
  } catch {
    return "";
  }
}

function formatSessionTimeWithZone(rawTime?: string) {
  const fallback = "05:00 PM";
  const input = String(rawTime || "").trim();
  const timeValue = input || fallback;
  const tz = getLocalTimeZoneLabel();

  const hasAmPm = /\b(am|pm)\b/i.test(timeValue);
  const hasTzToken = /\b(?:gmt|utc|[a-z]{2,5})[+\-]?\d*:?\d*\b/i.test(timeValue);
  const hhmmMatch = timeValue.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);

  let display = timeValue;
  if (!hasAmPm && hhmmMatch) {
    const hour24 = Number(hhmmMatch[1]);
    const minute = hhmmMatch[2];
    const meridiem = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;
    display = `${String(hour12).padStart(2, "0")}:${minute} ${meridiem}`;
  }

  if (tz && !hasTzToken) {
    return `${display} (${tz})`;
  }
  return display;
}

function OrganizationBrand({
  name,
  logoUrl,
  iconClassName,
  nameBoxClassName,
  nameTextClassName,
  textColorClassName = "text-white",
  nameTextStyle,
}: {
  name: string;
  logoUrl?: string;
  iconClassName: string;
  nameBoxClassName: string;
  nameTextClassName: string;
  textColorClassName?: string;
  nameTextStyle?: React.CSSProperties;
}) {
  return (
    <>
      <div className={`overflow-hidden rounded-md bg-white/95 ${iconClassName}`}>
        {logoUrl && (!logoUrl.startsWith("data:") || isValidImageDataUrl(logoUrl)) ? (
          <img
            src={logoUrl.startsWith("data:") ? logoUrl : optimizeCdnImageUrl(logoUrl, { width: 128, quality: "auto" })}
            alt={name || "Organization logo"}
            className="h-full w-full object-cover"
            crossOrigin="anonymous"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-heading/70">
            {name?.trim()?.slice(0, 2).toUpperCase() || "OR"}
          </div>
        )}
      </div>
      <div className={`flex items-center overflow-hidden ${nameBoxClassName}`}>
        <p className={`m-0 w-full truncate font-extrabold ${textColorClassName} ${nameTextClassName}`} style={nameTextStyle}>{name || "Organization"}</p>
      </div>
    </>
  );
}

type ColorTheme = {
  start: string;
  end: string;
  accent: string;
  textColor?: string;
  titleColor?: string;
  /** Event title on vertical card white panel (horizontal posters still use `titleColor` on the gradient). */
  verticalEventTitleColor?: string;
};

const COLOR_THEMES: Record<string, ColorTheme> = {
  karakoram: {
    start: "#06080F",
    end: "#0B0F19",
    accent: "#00F0FF",
    textColor: "#FFFFFF",
    titleColor: "#FFFFFF",
    verticalEventTitleColor: "#FFFFFF",
  },
  "dark-neon": {
    start: "#06080F",
    end: "#0B0F19",
    accent: "#00F0FF",
    textColor: "#FFFFFF",
    titleColor: "#FFFFFF",
    verticalEventTitleColor: "#FFFFFF",
  },
  purple: {
    start: "#41295a",
    end: "#2f0743",
    accent: "#FFD400",
    textColor: "#FFFFFF",
    titleColor: "#FFFFFF",
    verticalEventTitleColor: "#05060A",
  },
  red: {
    start: "#c94b4b",
    end: "#4b134f",
    accent: "#FFFFFF",
    textColor: "#FFFFFF",
    titleColor: "#FFFFFF",
    verticalEventTitleColor: "#05060A",
  },
  pink: {
    start: "#EE0979",
    end: "#FF6A00",
    accent: "#FFFFFF",
    textColor: "#FFFFFF",
    titleColor: "#FFFFFF",
    verticalEventTitleColor: "#05060A",
  },
  blue: {
    start: "#D3CCE3",
    end: "#E9E4F0",
    accent: "#000000",
    textColor: "#000000",
    titleColor: "#5A2ED3",
  },
};

function longestEventNameLineLength(eventName?: string): number {
  const raw = String(eventName || "").trim();
  if (!raw) return 0;
  const lines = raw
    .split(/<br\s*\/?>/i)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return 0;
  return Math.max(...lines.map((line) => line.length));
}

function getHorizontalEventTitleStyle(baseStyle: React.CSSProperties, eventName?: string): React.CSSProperties {
  const len = longestEventNameLineLength(eventName);
  if (len <= 12) {
    return { ...baseStyle, fontSize: "100px", lineHeight: "0.91", letterSpacing: "-0.04em", maxWidth: "750px" };
  }
  if (len <= 16) {
    return { ...baseStyle, fontSize: "82px", lineHeight: "0.92", letterSpacing: "-0.035em", maxWidth: "720px" };
  }
  if (len <= 20) {
    return { ...baseStyle, fontSize: "68px", lineHeight: "0.93", letterSpacing: "-0.03em", maxWidth: "680px" };
  }
  if (len <= 24) {
    return { ...baseStyle, fontSize: "56px", lineHeight: "0.94", letterSpacing: "-0.025em", maxWidth: "640px" };
  }
  return { ...baseStyle, fontSize: "46px", lineHeight: "0.95", letterSpacing: "-0.02em", maxWidth: "600px" };
}

function getVerticalEventTitleStyle(
  baseStyle: React.CSSProperties,
  eventName?: string,
): React.CSSProperties {
  const len = longestEventNameLineLength(eventName);
  if (len <= 12) {
    return { ...baseStyle, fontSize: "74.67px", lineHeight: "69.33px", letterSpacing: "-2.99px" };
  }
  if (len <= 16) {
    return { ...baseStyle, fontSize: "58px", lineHeight: "1.02", letterSpacing: "-2px" };
  }
  if (len <= 20) {
    return { ...baseStyle, fontSize: "48px", lineHeight: "1.04", letterSpacing: "-1.5px" };
  }
  if (len <= 24) {
    return { ...baseStyle, fontSize: "40px", lineHeight: "1.06", letterSpacing: "-1px" };
  }
  return { ...baseStyle, fontSize: "34px", lineHeight: "1.08", letterSpacing: "-0.5px" };
}

function resolveTheme(color?: string): ColorTheme {
  const raw = String(color || "").trim();
  if (!raw) return COLOR_THEMES.purple;
  if (COLOR_THEMES[raw]) return COLOR_THEMES[raw];

  // Custom user-picked color variant: preserve layout, force dark typography.
  return {
    start: raw,
    end: raw,
    accent: "#0B0B0B",
    textColor: "#0B0B0B",
    titleColor: "#0B0B0B",
    verticalEventTitleColor: "#0B0B0B",
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
  const isWebinarLocation = (data.location || "").trim().toLowerCase() === "webinar";
  const hasOrganizationBranding = Boolean((data.organizationName || "").trim() || (data.organizationLogoUrl || "").trim());
  const sessionTimeLabel = formatSessionTimeWithZone(data.sessionTime);
  const isCustomTheme = !COLOR_THEMES[String(data.color || "").trim()];
  const surfaceMotionClass = preview
    ? ""
    : "animate-fade-in will-change-transform transition-all duration-500 group";

  const theme = resolveTheme(data.color);
  const horizontalTextColorOverride = String(data.horizontalTextColor || "").trim();
  const verticalTextColorOverride = String(data.verticalTextColor || "").trim();
  const hasHorizontalTextOverride = Boolean(horizontalTextColorOverride);
  const hasVerticalTextOverride = Boolean(verticalTextColorOverride);
  const horizontalTextColor = horizontalTextColorOverride || (theme.textColor || "#FFFFFF");
  const verticalTextColor = verticalTextColorOverride || (theme.textColor || "#FFFFFF");
  
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

  const colorKey = String(data.color || "").trim().toLowerCase();
  const isKarakoram = colorKey === "karakoram" || colorKey === "dark-neon" || String(data.designType || "").trim().toLowerCase() === "karakoram" || colorKey === "#06080f";

  if (isVertical) {
    if (isKarakoram) {
      return (
        <div 
          id={id}
          className={`relative overflow-hidden shadow-2xl bg-[#06080F] ${surfaceMotionClass}`}
          style={{ 
            width: "576px", 
            height: "1024px", 
            fontFamily: selectedFont,
            background: "#06080F",
          }}
        >
          {/* Background Neon Vector Artwork */}
          <img 
            src="/card-assets/safar-neon-curves-vertical.svg" 
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0" 
            alt="" 
          />
          <div 
            className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none z-[1]" 
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} 
          />

          {/* Top Header */}
          <div className="absolute left-[36px] top-[44px] z-20 max-w-[500px]">
            <h2 className="m-0 text-[26px] font-black text-white tracking-[-0.02em] leading-none uppercase">
              {data.location?.trim() ? `MEET YOU AT ${data.location.split(",")[0].trim().toUpperCase()}` : "MEET YOU AT NSTP"}
            </h2>
            <div className="mt-4 inline-flex items-center px-4 py-1.5 rounded-md bg-[#2A1B4E] border border-[#8B5CF6]/60 shadow-[0_0_15px_rgba(139,92,246,0.35)]">
              <span className="text-[16px] font-bold tracking-[2px] uppercase text-white leading-none">
                {data.cardRole === "guest" ? "OUR GUEST AT" : "I'M ATTENDING"}
              </span>
            </div>
            <h1 className="m-0 mt-3 text-[32px] font-extrabold text-white tracking-[-0.02em] leading-tight uppercase">
              {data.eventName || "SAFAR-E-KARAKORAM"}
            </h1>
            <p className="m-0 mt-2 text-[17px] font-medium text-slate-300">
              {data.sessionDate || "10th September 2026"} {sessionTimeLabel ? `(${sessionTimeLabel})` : "(1:00pm - 2:00 pm)"}
            </p>
          </div>

          {/* Profile Circle or QR */}
          {verticalSide === 1 ? (
            <div className="absolute left-1/2 top-[440px] -translate-x-1/2 z-20 flex flex-col items-center text-center w-full px-6">
              <div className="relative isolate mb-5 flex h-[210px] w-[210px] items-center justify-center overflow-hidden rounded-full border-[3px] border-white/50 ring-4 ring-[#00F0FF]/40 shadow-[0_0_35px_rgba(0,240,255,0.45)] bg-[#0c121e]">
                {hasRealPhoto ? (
                  <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <img src="/card-assets/safar-default-avatar.svg" className="h-full w-full object-cover" alt="Default profile" />
                )}
              </div>
              <p className="m-0 text-[32px] font-bold text-white leading-tight">
                {data.name || "Zia-ur-Rehman"}
              </p>
              <p className="m-0 mt-1 text-[20px] font-semibold text-slate-200 uppercase tracking-wider">
                {data.role || "CEO"}
              </p>
              <p className="m-0 mt-0.5 text-[17px] font-medium text-slate-300 opacity-90">
                {data.company || "The Leap Pakistan"}
              </p>
            </div>
          ) : (
            <div className="absolute left-1/2 top-[440px] -translate-x-1/2 z-20 flex flex-col items-center text-center">
              <div className="h-[210px] w-[210px] overflow-hidden rounded-2xl border-2 border-white/30 bg-white p-3 shadow-xl">
                {qrUrl ? (
                  <img src={qrUrl} className="h-full w-full object-contain" alt="QR Code" />
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
            <p className="m-0 text-[17px] font-semibold tracking-[1px] text-white uppercase mb-2.5">
              START HERE, GO ANYWHERE
            </p>
            <p className="m-0 text-[12px] font-medium text-slate-400 mb-2">Co-organized by:</p>
            <div className="flex items-center justify-center gap-5">
              {filterSponsors(data.sponsors).length > 0 ? (
                <SponsorStripRow
                  sponsors={filterSponsors(data.sponsors)}
                  logoHeightPx={36}
                  maxStripWidthPx={500}
                />
              ) : (
                <>
                  <img src="/card-assets/avtive-white-logo.svg" className="h-[30px] w-auto object-contain" alt="avtive" />
                  <img src="/card-assets/nstp-logo.svg" className="h-[30px] w-auto object-contain" alt="NSTP" />
                  <img src="/card-assets/leap-pakistan-logo.svg" className="h-[30px] w-auto object-contain" alt="LEAP Pakistan" />
                </>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div 
        className={`relative overflow-hidden shadow-2xl bg-[#141414] ${surfaceMotionClass}`}
        style={{ 
          width: "576px", 
          height: "1024px", 
          fontFamily: selectedFont,
          background: `linear-gradient(180deg, ${theme.start} 42%, ${theme.end} 100%)`,
        }}
      >
        {/* Premium Atmospheric Spotlights & Noise */}
        <div 
          className="absolute left-1/2 top-[580px] h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.22] blur-[90px] pointer-events-none mix-blend-screen z-0"
          style={{ background: theme.accent === "#000000" ? "#FFFFFF" : theme.accent || "#FFFFFF" }}
        />
        <div 
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none z-[1]" 
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} 
        />

        {/* Background Overlays - masked by z-index */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img 
            src="/card-assets/buildings-overlay-vertical.png" 
            className="absolute left-[-151px] top-0 w-[878px] h-[1024px] object-cover opacity-[0.11] z-[1] max-w-none" 
            alt=""
            loading="lazy"
            decoding="async"
          />
        </div>

        {/* Top Panel (White portion) */}
        <div 
          className="absolute left-0 top-0 w-[576px] bg-white pointer-events-none z-10"
          style={{ 
            height: "447px",
            clipPath: "none",
          }}
        />

        {/* Branding */}
        {hasOrganizationBranding ? (
          <div className="absolute left-[31px] top-[40px] z-20 flex items-center gap-3">
            <OrganizationBrand
              name={data.organizationName || "Organization"}
              logoUrl={data.organizationLogoUrl}
              iconClassName="h-[63px] w-[63px]"
              nameBoxClassName="h-[66.81px] w-[236.56px]"
              nameTextClassName="text-[44px] leading-none"
              textColorClassName={isCustomTheme ? "text-[#0B0B0B]" : "text-black"}
              nameTextStyle={hasVerticalTextOverride ? { color: verticalTextColor } : { color: "#000000" }}
            />
          </div>
        ) : (
          <div className="z-20">
            <img
              src="https://www.figma.com/api/mcp/asset/7716a834-6d7b-4dbe-8553-370f4fddf5fc"
              className="absolute left-[86px] top-[40px] h-[44px] w-[154px] object-contain"
              alt="Avtive"
            />
            <img
              src="https://www.figma.com/api/mcp/asset/be4bd848-b76e-4630-808c-cf77963ce6a7"
              className="absolute left-[31px] top-[42px] z-20 h-[44px] w-[47px] object-contain"
              alt=""
            />
          </div>
        )}

        <div
          className="absolute left-[24px] top-[124px] z-20 max-w-[528px] rounded-md bg-white/95 px-3 py-2 shadow-sm"
        >
          <p className="m-0 text-[30px] font-medium tracking-[3px] uppercase leading-none" style={{ color: hasVerticalTextOverride ? verticalTextColor : "#000000" }}>
            {data.cardRole === "guest" ? "OUR GUEST AT" : "I'M ATTENDING"}
          </p>

          <h1
            className="m-0 mt-2 font-bold"
            style={getVerticalEventTitleStyle(
              {
                color: hasVerticalTextOverride ? verticalTextColor : "#000000",
                fontFamily: selectedFont,
              },
              data.eventName,
            )}
          >
            {data.eventName?.split("<br />").map((t, i) => <span key={i} className="block">{t}</span>) ||
              (<>
                <span className="block">Pakistan Tech</span>
                <span className="block">Summit</span>
              </>)}
            {data.cardRole === "guest" && data.guestCategory && (
              <span className="block text-[35px] font-bold tracking-[1px] uppercase mt-[16px] leading-none" style={{ color: hasVerticalTextOverride ? verticalTextColor : (theme.accent === "#000000" ? "#000000" : theme.accent || "#000000") }}>
                AS {data.guestCategory}
              </span>
            )}
          </h1>
        </div>

        {/* Meta Info */}
        <p className="absolute left-[30px] top-[346px] m-0 flex items-center gap-[10px] text-[24px] font-medium leading-[34px] z-20" style={{ color: hasVerticalTextOverride ? verticalTextColor : "#000000" }}>
          <svg className="w-[20px] h-[20px] fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 15H5V10h14ZM7 12h5v5H7Z" />
          </svg>
          {data.sessionDate || "Friday, 11th April, 2026"}
        </p>
        <p className="absolute left-[261px] top-[346px] m-0 flex items-center gap-[10px] text-[24px] font-medium leading-[34px] z-20" style={{ color: hasVerticalTextOverride ? verticalTextColor : "#000000" }}>
          <svg className="w-[20px] h-[20px] fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 1.75A10.25 10.25 0 1 0 22.25 12 10.26 10.26 0 0 0 12 1.75Zm4.22 11h-4.97V7.78h1.5v3.47h3.47Z" />
          </svg>
          {sessionTimeLabel}
        </p>
        <p className="absolute left-[30px] top-[392px] m-0 flex items-center gap-[10px] text-[24px] font-medium leading-[34px] z-20" style={{ color: hasVerticalTextOverride ? verticalTextColor : "#000000" }}>
          {isWebinarLocation ? (
            <svg className="w-[20px] h-[20px] fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm7.94 9h-3.27A15.7 15.7 0 0 0 15.4 5.5 8.05 8.05 0 0 1 19.94 11ZM12 4.06c.86 1.08 1.95 3.43 2.42 6.94H9.58C10.05 7.49 11.14 5.14 12 4.06ZM4.06 13h3.27a15.7 15.7 0 0 0 1.27 5.5A8.05 8.05 0 0 1 4.06 13ZM4.06 11A8.05 8.05 0 0 1 8.6 5.5 15.7 15.7 0 0 0 7.33 11Zm7.94 8.94c-.86-1.08-1.95-3.43-2.42-6.94h4.84c-.47 3.51-1.56 5.86-2.42 6.94ZM15.4 18.5A15.7 15.7 0 0 0 16.67 13h3.27a8.05 8.05 0 0 1-4.54 5.5Z" />
            </svg>
          ) : (
            <svg className="w-[20px] h-[20px] fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2a7 7 0 0 0-7 7c0 4.86 7 13 7 13s7-8.14 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5Z" />
            </svg>
          )}
          {data.location || "Expo Center, Islamabad, Pakistan"}
        </p>

        {/* Front / Back */}
        {verticalSide === 1 ? (
          <div className={`absolute left-[166px] top-[541px] z-40 isolate flex h-[244px] w-[244px] items-center justify-center overflow-hidden rounded-lg border border-white/25 shadow-md ${hasRealPhoto ? "bg-white/10" : "bg-white"}`}>
            {hasRealPhoto ? (
              <img src={photoUrl} alt="" className="h-full w-full object-cover" crossOrigin="anonymous" />
            ) : (
              <DefaultAvatarPlaceholder className="h-full w-full object-cover" />
            )}
          </div>
        ) : (
          <div className="absolute left-[166px] top-[541px] z-4 h-[244px] w-[244px] overflow-hidden rounded-lg border border-white/25 bg-white shadow-md">
            {qrUrl ? (
              <img src={qrUrl} className="h-full w-full object-contain" alt="QR Code" crossOrigin="anonymous" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-linear-to-br from-[#eceff3] to-[#dbe3ec] px-3 text-center">
                <p className="m-0 text-[13px] font-semibold leading-snug text-slate-600">
                  Add a LinkedIn URL or link in the card form to show a QR code on the badge back.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Attendee Info */}
        <div
          className="absolute left-1/2 top-[808px] z-4 w-[92%] max-w-[520px] -translate-x-1/2 text-center"
          style={{ background: "transparent", backdropFilter: "none", boxShadow: "none" }}
        >
          <p
            className="m-0 text-[35px] font-bold leading-none"
            style={{ color: hasVerticalTextOverride ? verticalTextColor : (theme.textColor || "#FFFFFF") }}
          >
            {data.name || "Full Name"}
          </p>
          <p
            className="m-0 mt-2 text-[21px] font-medium leading-none"
            style={{ color: hasVerticalTextOverride ? verticalTextColor : (theme.textColor || "#FFFFFF") }}
          >
            {data.role || "Role/Title"}
          </p>
          <p
            className="m-0 mt-2 text-[21px] font-medium leading-none"
            style={{ color: hasVerticalTextOverride ? verticalTextColor : (theme.textColor || "#FFFFFF") }}
          >
            {data.company || "Organization"}
          </p>
        </div>

        {/* Partners / sponsors */}
        <VerticalSponsorsStrip sponsors={data.sponsors} />
      </div>
    );
  }

  // Common styles for both designs
  const posterStyle: React.CSSProperties = {
    width: "1200px",
    height: "628px",
    background: isKarakoram ? "#06080F" : `linear-gradient(180deg, ${theme.start} 0%, ${theme.end} 100%)`,
    fontFamily: selectedFont,
  };

  const titleKickerStyle: React.CSSProperties = {
    color: hasHorizontalTextOverride ? horizontalTextColor : theme.accent,
  };

  const titleStyle = getHorizontalEventTitleStyle(
    {
      color: hasHorizontalTextOverride ? horizontalTextColor : (theme.titleColor || theme.textColor || "white"),
      fontWeight: "800",
    },
    data.eventName,
  );

  const metaTextColor = { color: hasHorizontalTextOverride ? horizontalTextColor : (theme.textColor || "white") };

  // Horizontal Card — Custom Karakoram Neon Design
  if (isKarakoram) {
    return (
      <div
        id={id}
        key={data.designType}
        className={`relative overflow-hidden shadow-2xl poster bg-[#06080F] ${surfaceMotionClass}`}
        style={posterStyle}
      >
        {/* Luminous Neon Waves Overlay */}
        <img 
          src="/card-assets/safar-neon-curves.svg" 
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0" 
          alt="" 
        />
        <div 
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none z-[1]" 
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} 
        />

        {/* Top-Left Header: MEET YOU AT [LOCATION / NSTP] */}
        <div className="absolute left-[58px] top-[48px] z-20">
          <h2 className="m-0 text-[38px] font-black text-white tracking-[-0.02em] leading-none uppercase">
            {data.location?.trim() ? `MEET YOU AT ${data.location.split(",")[0].trim().toUpperCase()}` : "MEET YOU AT NSTP"}
          </h2>
        </div>

        {/* Attending Pill Badge + Event Name */}
        <div className="absolute left-[58px] top-[145px] z-20 flex items-center gap-4">
          <div className="px-4 py-2 rounded-md bg-[#2A1B4E] border border-[#8B5CF6]/50 shadow-[0_0_15px_rgba(139,92,246,0.3)] flex items-center justify-center">
            <span className="text-[20px] font-bold tracking-[2.5px] uppercase text-white leading-none">
              {data.cardRole === "guest" ? "OUR GUEST AT" : "I'M ATTENDING"}
            </span>
          </div>
          <h1 className="m-0 text-[34px] font-extrabold text-white tracking-[-0.02em] leading-none uppercase">
            {data.eventName || "SAFAR-E-KARAKORAM"}
          </h1>
        </div>

        {/* Session Date & Time */}
        <div className="absolute left-[58px] top-[260px] z-20 flex flex-col gap-1 text-white">
          <p className="m-0 text-[23px] font-bold tracking-tight text-white leading-tight">
            {data.sessionDate || "10th September 2026"}
          </p>
          <p className="m-0 text-[18px] font-medium text-slate-300 leading-tight">
            {sessionTimeLabel ? `(${sessionTimeLabel})` : "(1:00pm - 2:00 pm)"}
          </p>
        </div>

        {/* Slogan */}
        <div className="absolute left-[58px] top-[365px] z-20">
          <p className="m-0 text-[21px] font-semibold tracking-[0.5px] text-white uppercase">
            START HERE, GO ANYWHERE
          </p>
        </div>

        {/* Co-organized by & 3 Logos */}
        <div className="absolute left-[58px] bottom-[38px] z-20 flex flex-col gap-2">
          <p className="m-0 text-[14px] font-medium text-slate-400">Co-organized by:</p>
          <div className="flex items-center gap-6">
            {filterSponsors(data.sponsors).length > 0 ? (
              <SponsorStripRow
                sponsors={filterSponsors(data.sponsors)}
                logoHeightPx={42}
                maxStripWidthPx={500}
              />
            ) : (
              <>
                <img src="/card-assets/avtive-white-logo.svg" className="h-[36px] w-auto object-contain" alt="avtive" />
                <img src="/card-assets/nstp-logo.svg" className="h-[36px] w-auto object-contain" alt="NSTP" />
                <img src="/card-assets/leap-pakistan-logo.svg" className="h-[36px] w-auto object-contain" alt="LEAP Pakistan" />
              </>
            )}
          </div>
        </div>

        {/* Attendee Profile Section on Right */}
        <section className="absolute right-[50px] top-[95px] z-20 w-[320px] flex flex-col items-center text-center">
          <div className="relative isolate mb-5 flex h-[210px] w-[210px] items-center justify-center overflow-hidden rounded-full border-[3px] border-white/50 ring-4 ring-[#00F0FF]/40 shadow-[0_0_35px_rgba(0,240,255,0.4)] bg-[#0b0f19]">
            {hasRealPhoto ? (
              <img
                src={photoUrl}
                className="w-full h-full object-cover"
                alt={data.name?.trim() ? `Photo of ${data.name.trim()}` : "Attendee photo"}
              />
            ) : (
              <img
                src="/card-assets/safar-default-avatar.svg"
                className="w-full h-full object-cover"
                alt="Default profile"
              />
            )}
          </div>
          <h2 className="m-0 font-extrabold text-[27px] text-white leading-tight">
            {data.name || "Zia-ur-Rehman"}
          </h2>
          <p className="m-0 font-bold text-[18px] text-slate-200 mt-1 uppercase tracking-wider">
            {data.role || "CEO"}
          </p>
          <p className="m-0 font-medium text-[16px] text-slate-300 mt-0.5 opacity-90">
            {data.company || "The Leap Pakistan"}
          </p>
        </section>
      </div>
    );
  }

  // Horizontal Card (Design 1 - Default Classic)
  return (
    <div
      id={id}
      key={data.designType}
      className={`relative overflow-hidden shadow-2xl poster bg-[#141414] ${surfaceMotionClass}`}
      style={posterStyle}
    >
      {/* Premium Atmospheric Spotlights & Noise */}
      <div 
        className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.20] blur-[100px] pointer-events-none mix-blend-screen z-0"
        style={{ background: theme.accent === "#000000" ? "#FFFFFF" : theme.accent || "#FFFFFF" }}
      />
      <div 
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none z-[1]" 
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} 
      />

      {/* Background Overlays */}
      <img className="absolute inset-[-292px_-6px_auto_-5px] w-[1212px] h-[808px] opacity-[0.11] object-cover pointer-events-none z-[1]" src="/card-assets/buildings-overlay-horizontal.png" alt="" loading="lazy" decoding="async" />
      
      <p className="absolute left-[58px] top-[81px] m-0 font-medium text-[25px] leading-none tracking-[3px] uppercase" style={titleKickerStyle}>
        {data.cardRole === "guest" ? "OUR GUEST AT" : "I'M ATTENDING"}
      </p>
      
      <h1 className="absolute left-[50px] top-[116px] m-0 flex flex-col" style={titleStyle}>
        {data.eventName ? (
          data.eventName.split("<br />").map((text, i) => <span key={i} className="block">{text}</span>)
        ) : (
          <>
            <span className="block">Pakistan Tech</span>
            <span className="block">Summit</span>
          </>
        )}
        {data.cardRole === "guest" && data.guestCategory && (
          <span className="block text-[30px] font-bold tracking-[1px] uppercase mt-[18px] leading-none" style={{ color: hasHorizontalTextOverride ? horizontalTextColor : theme.accent || "#FFFFFF" }}>
            AS {data.guestCategory}
          </span>
        )}
      </h1>

      <div className="absolute left-[58px] top-[360px] flex gap-[35px] items-center flex-wrap" style={metaTextColor}>
        <div className="flex items-center gap-2 text-[18px] font-medium whitespace-nowrap">
          <svg className="w-[25px] h-[25px] fill-current" viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 15H5V10h14ZM7 12h5v5H7Z"/></svg>
          <span>{data.sessionDate || "Friday, 11th April, 2026"}</span>
        </div>
        <div className="flex items-center gap-2 text-[18px] font-medium whitespace-nowrap">
          <svg className="w-[25px] h-[25px] fill-current" viewBox="0 0 24 24"><path d="M12 1.75A10.25 10.25 0 1 0 22.25 12 10.26 10.26 0 0 0 12 1.75Zm4.22 11h-4.97V7.78h1.5v3.47h3.47Z"/></svg>
          <span>{sessionTimeLabel}</span>
        </div>
      </div>

      <div className="absolute left-[58px] top-[402px] flex items-center gap-2 text-[18px] font-medium whitespace-nowrap" style={metaTextColor}>
        {isWebinarLocation ? (
          <svg className="w-[25px] h-[25px] fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm7.94 9h-3.27A15.7 15.7 0 0 0 15.4 5.5 8.05 8.05 0 0 1 19.94 11ZM12 4.06c.86 1.08 1.95 3.43 2.42 6.94H9.58C10.05 7.49 11.14 5.14 12 4.06ZM4.06 13h3.27a15.7 15.7 0 0 0 1.27 5.5A8.05 8.05 0 0 1 4.06 13ZM4.06 11A8.05 8.05 0 0 1 8.6 5.5 15.7 15.7 0 0 0 7.33 11Zm7.94 8.94c-.86-1.08-1.95-3.43-2.42-6.94h4.84c-.47 3.51-1.56 5.86-2.42 6.94ZM15.4 18.5A15.7 15.7 0 0 0 16.67 13h3.27a8.05 8.05 0 0 1-4.54 5.5Z"/></svg>
        ) : (
          <svg className="w-[25px] h-[25px] fill-current" viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 4.86 7 13 7 13s7-8.14 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5Z"/></svg>
        )}
        <span>{data.location || "Expo Center, Islamabad, Pakistan"}</span>
      </div>

      <div className="absolute right-[58px] top-[70px] z-20 max-w-[262px] overflow-hidden">
        {hasOrganizationBranding ? (
          <div className="flex items-center justify-end gap-2">
            <OrganizationBrand
              name={data.organizationName || "Organization"}
              logoUrl={data.organizationLogoUrl}
              iconClassName="h-[63px] w-[63px] shrink-0"
              nameBoxClassName="h-[48px] min-w-0 max-w-[165px]"
              nameTextClassName="text-[31px] leading-none"
              textColorClassName={isCustomTheme ? "text-[#0B0B0B]" : undefined}
              nameTextStyle={hasHorizontalTextOverride ? { color: horizontalTextColor } : undefined}
            />
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <img src="https://www.figma.com/api/mcp/asset/f933f73f-4602-4c5f-a7f1-8e9e24f19129" className="h-[59px] w-[59px] shrink-0 object-contain" alt="" />
            <img src="https://www.figma.com/api/mcp/asset/a433a3fb-dace-43ff-ace4-ac1ff37cb838" className="h-[48px] w-[165px] shrink-0 object-contain" alt="" />
          </div>
        )}
      </div>

      <section className="absolute right-[20px] top-[172px] w-[300px] text-left" style={metaTextColor}>
        <div className={`relative z-40 isolate mb-5 flex h-[175px] w-[175px] items-center justify-center overflow-hidden rounded-lg border border-white/10 ${hasRealPhoto ? "bg-white/10" : "bg-white"}`}>
          {hasRealPhoto ? (
            <img
              src={photoUrl}
              className="w-full h-full object-cover"
              alt={data.name?.trim() ? `Photo of ${data.name.trim()}` : "Attendee photo"}
              crossOrigin="anonymous"
            />
          ) : (
            <DefaultAvatarPlaceholder className="w-full h-full" />
          )}
        </div>
        <h2 className="m-0 font-bold text-[22px] leading-[1.2] whitespace-nowrap" style={metaTextColor}>
          {data.name || "Full Name"}
        </h2>
        <p className="m-0 font-normal text-[18px] leading-[1.35] whitespace-nowrap">{data.role || "Role/Title"}</p>
        <p className="m-0 font-normal text-[18px] leading-[1.35] whitespace-nowrap opacity-80">{data.company || "Organization"}</p>
      </section>

      {/* z-10+ so noise/buildings overlays (z-1) cannot paint on top of the white sponsor strip */}
      <footer className="absolute bottom-0 left-0 right-0 z-10 grid h-[123px] place-items-center bg-white px-[40px]">
        <HorizontalSponsorsDesign1 sponsors={data.sponsors} />
      </footer>
    </div>
  );
}

