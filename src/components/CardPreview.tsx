"use client";
import { useState, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import { CardData, SponsorEntry } from "@/types/card";

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
  const items = sponsors.slice(0, 5);
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
    .slice(0, 5);
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
}: {
  name: string;
  logoUrl?: string;
  iconClassName: string;
  nameBoxClassName: string;
  nameTextClassName: string;
  textColorClassName?: string;
}) {
  return (
    <>
      <div className={`overflow-hidden rounded-md bg-white/95 ${iconClassName}`}>
        {logoUrl ? (
          <img src={logoUrl} alt={name || "Organization logo"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-heading/70">
            {name?.trim()?.slice(0, 2).toUpperCase() || "OR"}
          </div>
        )}
      </div>
      <div className={`flex items-center overflow-hidden ${nameBoxClassName}`}>
        <p className={`m-0 w-full truncate font-extrabold ${textColorClassName} ${nameTextClassName}`}>{name || "Organization"}</p>
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
  preview,
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
  const hasSponsors = filterSponsors(data.sponsors).length > 0;
  const sessionTimeLabel = formatSessionTimeWithZone(data.sessionTime);
  const isCustomTheme = !COLOR_THEMES[String(data.color || "").trim()];

  const theme = resolveTheme(data.color);
  
  // Font Mapping
  const fontMap: Record<string, string> = {
    inter: "var(--font-inter-tight), sans-serif",
    poppins: "var(--font-poppins), sans-serif",
    outfit: "var(--font-outfit), sans-serif",
    times: "'Times New Roman', Times, serif",
  };
  const selectedFont = fontMap[data.fontFamily || "inter"] || fontMap.inter;
  const photoUrl = String(data.photo || "").trim();
  const hasRealPhoto =
    Boolean(photoUrl) &&
    !photoUrl.endsWith("/default-avatar-placeholder.svg") &&
    photoUrl !== "/default-avatar-placeholder.svg";

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

  if (isVertical) {
    return (
      <div 
        className="relative overflow-hidden shadow-2xl bg-[#141414] animate-fade-in"
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
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none z-1" 
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} 
        />

        {/* Background Overlays - masked by z-index */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img 
            src="https://www.figma.com/api/mcp/asset/cfa963ed-fe15-42b0-a98e-e2e901c4176a" 
            className="absolute left-[-151px] top-0 w-[878px] h-[1024px] object-cover opacity-[0.11] max-w-none" 
            alt="" 
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

        <p className="absolute left-[31px] top-[131px] m-0 text-black text-[30px] font-medium tracking-[3px] uppercase leading-none z-20">
          {data.cardRole === "guest" ? "OUR GUEST AT" : "I'M ATTENDING"}
        </p>

        <h1 
          className="absolute left-[27px] top-[184px] m-0 text-[74.67px] font-bold leading-[69.33px] tracking-[-2.99px] z-20"
          style={{ 
            color: "#000000",
            fontFamily: selectedFont,
            letterSpacing: "-2.99px"
          }}
        >
          {data.eventName?.split("<br />").map((t, i) => <span key={i} className="block">{t}</span>) || 
            (<>
              <span className="block">Pakistan Tech</span>
              <span className="block">Summit</span>
            </>)}
        </h1>


        {/* Meta Info - Precisely positioned per provided CSS */}
        <p className="absolute left-[30px] top-[346px] m-0 flex items-center gap-[10px] text-black text-[24px] font-medium leading-[34px] z-20">
          <svg className="w-[20px] h-[20px] fill-current text-black" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 15H5V10h14ZM7 12h5v5H7Z" />
          </svg>
          {data.sessionDate || "Friday, 11th April, 2026"}
        </p>
        <p className="absolute left-[261px] top-[346px] m-0 flex items-center gap-[10px] text-black text-[24px] font-medium leading-[34px] z-20">
          <svg className="w-[20px] h-[20px] fill-current text-black" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 1.75A10.25 10.25 0 1 0 22.25 12 10.26 10.26 0 0 0 12 1.75Zm4.22 11h-4.97V7.78h1.5v3.47h3.47Z" />
          </svg>
          {sessionTimeLabel}
        </p>
        <p className="absolute left-[30px] top-[392px] m-0 flex items-center gap-[10px] text-black text-[24px] font-medium leading-[34px] z-20">
          {isWebinarLocation ? (
            <svg className="w-[20px] h-[20px] fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm7.94 9h-3.27A15.7 15.7 0 0 0 15.4 5.5 8.05 8.05 0 0 1 19.94 11ZM12 4.06c.86 1.08 1.95 3.43 2.42 6.94H9.58C10.05 7.49 11.14 5.14 12 4.06ZM4.06 13h3.27a15.7 15.7 0 0 0 1.27 5.5A8.05 8.05 0 0 1 4.06 13ZM4.06 11A8.05 8.05 0 0 1 8.6 5.5 15.7 15.7 0 0 0 7.33 11Zm7.94 8.94c-.86-1.08-1.95-3.43-2.42-6.94h4.84c-.47 3.51-1.56 5.86-2.42 6.94ZM15.4 18.5A15.7 15.7 0 0 0 16.67 13h3.27a8.05 8.05 0 0 1-4.54 5.5Z" />
            </svg>
          ) : (
            <svg className="w-[20px] h-[20px] fill-current text-black" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2a7 7 0 0 0-7 7c0 4.86 7 13 7 13s7-8.14 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5Z" />
            </svg>
          )}
          {data.location || "Expo Center, Islamabad, Pakistan"}
        </p>

        {/* Front (verticalSide 1): profile photo. Back (verticalSide 2): scannable QR from LinkedIn / URL field */}
        {verticalSide === 1 ? (
          <div className={`absolute left-[166px] top-[541px] z-40 isolate flex h-[244px] w-[244px] items-center justify-center overflow-hidden rounded-lg border border-white/25 shadow-md ${hasRealPhoto ? "bg-white/10" : "bg-white"}`}>
            {hasRealPhoto ? (
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <DefaultAvatarPlaceholder className="h-full w-full object-cover" />
            )}
          </div>
        ) : (
          <div className="absolute left-[166px] top-[541px] z-4 h-[244px] w-[244px] overflow-hidden rounded-lg border border-white/25 bg-white shadow-md">
            {qrUrl ? (
              <img src={qrUrl} className="h-full w-full object-contain" alt="QR Code" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-linear-to-br from-[#eceff3] to-[#dbe3ec] px-3 text-center">
                <p className="m-0 text-[13px] font-semibold leading-snug text-slate-600">
                  Add a LinkedIn URL or link in the card form to show a QR code on the badge back.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Attendee Info - Exactly matching speaker-name, role, company positioning */}
        <p
          className="absolute left-0 top-[820px] w-full text-center z-4 m-0 text-[35px] font-bold leading-none"
          style={{ color: theme.textColor || "#FFFFFF" }}
        >
          {data.name || "Full Name"}
        </p>
        <p
          className="absolute left-0 top-[869px] w-full text-center z-4 m-0 text-[21px] font-medium leading-none"
          style={{ color: theme.textColor || "#FFFFFF" }}
        >
          {data.role || "Role/Title"}
        </p>
        <p
          className="absolute left-0 top-[900px] w-full text-center z-4 m-0 text-[21px] font-medium leading-none"
          style={{ color: theme.textColor || "#FFFFFF" }}
        >
          {data.company || "Organization"}
        </p>


        {/* Partners / sponsors */}
        <VerticalSponsorsStrip sponsors={data.sponsors} />
      </div>
    );
  }


  // Common styles for both designs
  const posterStyle: React.CSSProperties = {
    width: "1200px",
    height: "628px",
    background: `linear-gradient(180deg, ${theme.start} 0%, ${theme.end} 100%)`,
    fontFamily: selectedFont,
  };

  const titleKickerStyle: React.CSSProperties = {
    color: theme.accent,
  };

  const titleStyle: React.CSSProperties = {
    color: theme.titleColor || theme.textColor || "white",
    lineHeight: "0.91",
    letterSpacing: "-0.04em",
    fontWeight: "800",
  };

  const metaTextColor = { color: theme.textColor || "white" };

  // Horizontal Card (Design 1 - Default)
  return (
    <div
      id={id}
      key={data.designType}
      className="relative overflow-hidden shadow-2xl poster animate-fade-in will-change-transform transition-all duration-500 group bg-[#141414]"
      style={posterStyle}
    >
      {/* Premium Atmospheric Spotlights & Noise */}
      <div 
        className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.20] blur-[100px] pointer-events-none mix-blend-screen z-0"
        style={{ background: theme.accent === "#000000" ? "#FFFFFF" : theme.accent || "#FFFFFF" }}
      />
      <div 
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none z-1" 
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} 
      />

      {/* Background Overlays */}
      <img className="absolute inset-[-292px_-6px_auto_-5px] w-[1212px] h-[808px] opacity-[0.11] object-cover pointer-events-none z-1" src="https://www.figma.com/api/mcp/asset/a068f32c-5159-4502-a8f7-c3748e1a7c88" alt="" />
      
      <p className="absolute left-[58px] top-[81px] m-0 font-medium text-[25px] leading-none tracking-[3px] uppercase" style={titleKickerStyle}>
        {data.cardRole === "guest" ? "OUR GUEST AT" : "I'M ATTENDING"}
      </p>
      
      <h1 className="absolute left-[50px] top-[138px] m-0 text-[100px] tracking-[-4px] max-w-[750px] flex flex-col" style={titleStyle}>
        {data.eventName ? (
          data.eventName.split("<br />").map((text, i) => <span key={i} className="block">{text}</span>)
        ) : (
          <>
            <span className="block">Pakistan Tech</span>
            <span className="block">Summit</span>
          </>
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

      <div className="absolute right-[78px] top-[70px] flex items-center gap-2">
        {hasOrganizationBranding ? (
          <OrganizationBrand
            name={data.organizationName || "Organization"}
            logoUrl={data.organizationLogoUrl}
            iconClassName="h-[63px] w-[63px]"
            nameBoxClassName="h-[48px] w-[165px]"
            nameTextClassName="text-[31px] leading-none"
            textColorClassName={isCustomTheme ? "text-[#0B0B0B]" : undefined}
          />
        ) : (
          <>
            <img src="https://www.figma.com/api/mcp/asset/f933f73f-4602-4c5f-a7f1-8e9e24f19129" className="h-[59px] w-[59px] object-contain" alt="" />
            <img src="https://www.figma.com/api/mcp/asset/a433a3fb-dace-43ff-ace4-ac1ff37cb838" className="h-[48px] w-[165px] object-contain" alt="" />
          </>
        )}
      </div>

      <section className="absolute right-[20px] top-[172px] w-[300px] text-left" style={metaTextColor}>
        <div className={`relative z-40 isolate mb-5 flex h-[175px] w-[175px] items-center justify-center overflow-hidden rounded-lg border border-white/10 ${hasRealPhoto ? "bg-white/10" : "bg-white"}`}>
          {hasRealPhoto ? (
            <img src={photoUrl} className="w-full h-full object-cover" />
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

      <footer className="absolute bottom-0 left-0 right-0 grid h-[123px] place-items-center bg-white px-[40px]">
        <HorizontalSponsorsDesign1 sponsors={data.sponsors} />
      </footer>
    </div>
  );
}

