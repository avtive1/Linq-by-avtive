"use client";
import { useState, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import { CardData, SponsorEntry } from "@/types/card";

const FALLBACK_H1_SPONSORS =
  "https://www.figma.com/api/mcp/asset/60137d44-eb2a-4405-bd79-67be246fc1ec";
const FALLBACK_H2_SPONSORS =
  "https://www.figma.com/api/mcp/asset/304933ce-cbdb-4ff8-a402-c39459b6d08d";
const FALLBACK_VERTICAL_PARTNERS =
  "https://www.figma.com/api/mcp/asset/3afad43f-8750-426f-8511-10ff0d714f6e";

/** Custom sponsors: larger row so marks read like the reference artwork (most of the 123px footer) */
const SPONSOR_LOGO_HEIGHT_H1_PX = 84;
const SPONSOR_STRIP_MAX_W_H1_PX = 1120;
const SPONSOR_LOGO_HEIGHT_H2_PX = 72;
const SPONSOR_STRIP_MAX_W_H2_PX = 861;
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

  if (count === 0) return null;

  const innerBudget = maxStripWidthPx * 0.94;
  const fairShareW = innerBudget / count;
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
  return s.filter((x) => x.logo_url?.trim()).slice(0, 5);
}

function HorizontalSponsorsDesign1({ sponsors }: { sponsors?: SponsorEntry[] }) {
  const list = filterSponsors(sponsors);
  if (!list.length) {
    return (
      <img
        src={FALLBACK_H1_SPONSORS}
        className="h-[46px] w-[1045px] max-w-full object-contain"
        alt="Sponsors"
      />
    );
  }
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

function HorizontalSponsorsDesign2({ sponsors }: { sponsors?: SponsorEntry[] }) {
  const list = filterSponsors(sponsors);
  if (!list.length) {
    return (
      <img
        className="absolute left-[276px] top-[42px] h-[38px] w-[861px] object-contain"
        src={FALLBACK_H2_SPONSORS}
        alt="Sponsors"
      />
    );
  }
  return (
    <div className="absolute left-[276px] top-[28px] flex h-[78px] w-[861px] items-center justify-center">
      <SponsorStripRow
        sponsors={list}
        logoHeightPx={SPONSOR_LOGO_HEIGHT_H2_PX}
        maxStripWidthPx={SPONSOR_STRIP_MAX_W_H2_PX}
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

  if (!list.length) {
    return (
      <img
        src={FALLBACK_VERTICAL_PARTNERS}
        className="absolute z-4 object-contain"
        style={{ left: 77, bottom: 35, width: 423, height: 33 }}
        alt="Partners"
      />
    );
  }
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
    <img src="/default-avatar-placeholder.svg" className={`${className} object-cover`} alt="Default profile" />
  );
}

const COLOR_THEMES: Record<
  string,
  {
    start: string;
    end: string;
    accent: string;
    textColor?: string;
    titleColor?: string;
    /** Event title on vertical card white panel (horizontal posters still use `titleColor` on the gradient). */
    verticalEventTitleColor?: string;
  }
> = {
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

  const theme = COLOR_THEMES[data.color || "purple"] || COLOR_THEMES.purple;
  
  // Font Mapping
  const fontMap: Record<string, string> = {
    inter: "var(--font-inter), sans-serif",
    poppins: "var(--font-poppins), sans-serif",
    outfit: "var(--font-outfit), sans-serif",
    times: "'Times New Roman', Times, serif",
  };
  const selectedFont = fontMap[data.fontFamily || "inter"] || fontMap.inter;

  // LinkedIn / QR Logic
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
    updateQr();
    return () => { cancelled = true; };
  }, [finalQrUrl]);

  if (isVertical) {
    const isDesign1 = data.designType === "design1";
    return (
      <div 
        className="relative overflow-hidden shadow-2xl bg-[#141414] animate-fade-in"
        style={{ 
          width: "576px", 
          height: "1024px", 
          fontFamily: selectedFont,
          background: `linear-gradient(180deg, ${theme.start} 0%, ${theme.end} 100%)`,
        }}
      >
        {/* Background Overlays */}
        <img 
          src="https://www.figma.com/api/mcp/asset/cfa963ed-fe15-42b0-a98e-e2e901c4176a" 
          className="absolute left-[-151px] top-[438px] w-[878px] h-[586px] object-cover opacity-[0.11] pointer-events-none max-w-none" 
          alt="" 
        />
        {!isDesign1 && (
          <img 
            src="https://www.figma.com/api/mcp/asset/25c34327-5732-42c0-bf51-b701006d1883" 
            className="absolute left-[-11px] -top-px w-[590px] h-[543px] pointer-events-none max-w-none" 
            alt="" 
          />
        )}


        {/* Top Panel (White portion) */}
        <div 
          className="absolute left-0 top-0 w-[576px] bg-white pointer-events-none"
          style={{ 
            height: isDesign1 ? "447px" : "459px",
            clipPath: isDesign1 
              ? "none" 
              : "polygon(0 0, 100% 0, 100% 447px, 464px 447px, 464px 542px, 369px 447px, 0 447px)"
          }}
        />



        {/* Branding */}
        <img 
          src="https://www.figma.com/api/mcp/asset/7716a834-6d7b-4dbe-8553-370f4fddf5fc" 
          className="absolute left-[86px] top-[40px] w-[154px] h-[44px] object-contain" 
          alt="Avtive" 
        />
        <img 
          src="https://www.figma.com/api/mcp/asset/be4bd848-b76e-4630-808c-cf77963ce6a7" 
          className="absolute left-[31px] top-[42px] w-[47px] h-[44px] object-contain z-5" 
          alt="" 
        />

        <p className="absolute left-[31px] top-[131px] m-0 text-black text-[30px] font-medium tracking-[3px] uppercase leading-none">
          {data.cardRole === "guest" ? "OUR GUEST AT" : "I'M ATTENDING"}
        </p>

        <h1 
          className="absolute left-[27px] top-[184px] m-0 text-[74.67px] font-bold leading-[69.33px] tracking-[-2.99px]" 
          style={{ 
            color: theme.verticalEventTitleColor ?? theme.titleColor ?? "#5a2ed3",
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
        <p className="absolute left-[30px] top-[356px] m-0 flex items-center gap-[7px] text-black text-[16px] font-medium leading-[24px]">
          <img src="https://www.figma.com/api/mcp/asset/911c0336-0dbe-4d71-abd3-95e367313410" className="w-[15px] h-[15px]" alt="" />
          {data.sessionDate || "Friday, 11th April, 2026"}
        </p>
        <p className="absolute left-[261px] top-[356px] m-0 flex items-center gap-[7px] text-black text-[16px] font-medium leading-[24px]">
          <img src="https://www.figma.com/api/mcp/asset/c70396aa-fad6-4461-a222-1ef86c1215c8" className="w-[15px] h-[15px]" alt="" />
          {data.sessionTime || "05:00 PM"}
        </p>
        <p className="absolute left-[30px] top-[390px] m-0 flex items-center gap-[7px] text-black text-[16px] font-medium leading-[24px]">
          {isWebinarLocation ? (
            <svg className="w-[15px] h-[15px] fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm7.94 9h-3.27A15.7 15.7 0 0 0 15.4 5.5 8.05 8.05 0 0 1 19.94 11ZM12 4.06c.86 1.08 1.95 3.43 2.42 6.94H9.58C10.05 7.49 11.14 5.14 12 4.06ZM4.06 13h3.27a15.7 15.7 0 0 0 1.27 5.5A8.05 8.05 0 0 1 4.06 13ZM4.06 11A8.05 8.05 0 0 1 8.6 5.5 15.7 15.7 0 0 0 7.33 11Zm7.94 8.94c-.86-1.08-1.95-3.43-2.42-6.94h4.84c-.47 3.51-1.56 5.86-2.42 6.94ZM15.4 18.5A15.7 15.7 0 0 0 16.67 13h3.27a8.05 8.05 0 0 1-4.54 5.5Z" />
            </svg>
          ) : (
            <img src="https://www.figma.com/api/mcp/asset/09c9f77b-5728-4fe6-8b34-b3ad59fe884d" className="w-[15px] h-[15px]" alt="" />
          )}
          {data.location || "Expo Center, Islamabad, Pakistan"}
        </p>

        {/* Central Element (Photo or QR) */}
        {verticalSide === 1 ? (
          /* SIDE 1: User Photo - Matching qr-wrap positioning and size */
          <div 
            className="absolute left-[166px] top-[541px] w-[244px] h-[244px] rounded-sm overflow-hidden border-2 border-white/20 bg-white/10 flex items-center justify-center z-4"
          >
            {data.photo ? (
              <img src={data.photo} className="w-full h-full object-cover" />
            ) : (
              <DefaultAvatarPlaceholder className="w-full h-full" />
            )}
          </div>
        ) : (
          /* SIDE 2: QR Code - Exactly matching qr-wrap and internal qr-image/qr-center */
          <div className="absolute left-[166px] top-[541px] w-[244px] h-[244px] rounded-sm bg-white z-4">
             {qrUrl ? (
               <>
                  <img 
                    src={qrUrl} 
                    className="absolute left-[25.28px] top-[25.28px] w-[193.3px] h-[193.3px]" 
                    alt="QR Code" 
                  />
                  <img 
                    src="https://www.figma.com/api/mcp/asset/7aa825de-d504-49de-b966-373e13e071b6" 
                    className="absolute left-[95.53px] top-[97.7px] w-[52.24px] h-[48.88px]" 
                    alt=""
                  />
               </>
             ) : (
               <div className="w-full h-full bg-slate-100 animate-pulse" />
             )}
          </div>

        )}

        {/* Attendee Info - Exactly matching speaker-name, role, company positioning */}
        <p className="absolute left-0 top-[820px] w-full text-center text-white z-4 m-0 text-[35px] font-bold leading-none">
          {data.name || "Full Name"}
        </p>
        <p className="absolute left-0 top-[869px] w-full text-center text-white z-4 m-0 text-[21px] font-medium leading-none">
          {data.role || "Role/Title"}
        </p>
        <p className="absolute left-0 top-[900px] w-full text-center text-white z-4 m-0 text-[21px] font-medium leading-none">
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

  if (data.designType === "design2") {
    return (
      <div 
        id={id} 
        key={data.designType}
        className="relative overflow-hidden shadow-2xl poster animate-fade-in will-change-transform" 
        style={posterStyle}
      >
        <img className="absolute inset-[-292px_-6px_auto_-5px] w-[1212px] h-[808px] opacity-[0.11] object-cover pointer-events-none" src="https://www.figma.com/api/mcp/asset/1e6c3590-a66a-4bc5-b575-adfb66dc1bb8" alt="" />
        
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
            <span>{data.sessionTime || "05:00 PM"}</span>
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

        <div className="absolute right-[80px] top-[70px] flex items-center gap-2">
          <img src="https://www.figma.com/api/mcp/asset/56b614de-2622-49f5-ac7b-a0ed09ebaeac" className="w-[63px] h-[59px] object-contain" alt="" />
          <img src="https://www.figma.com/api/mcp/asset/22c9e87c-f736-4755-b4a7-402c9070d2b3" className="w-[191px] h-[56px] object-contain" alt="" />
        </div>

        <section className="absolute right-[26px] top-[172px] w-[340px] text-left" style={metaTextColor}>
          <div className="mb-[20px] flex h-[175px] w-[175px] items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/10">
            {data.photo ? (
              <img src={data.photo} className="w-full h-full object-cover" />
            ) : (
              <DefaultAvatarPlaceholder className="w-full h-full" />
            )}
          </div>
          <h2 className="m-0 font-bold text-[22px] leading-[1.2] whitespace-nowrap mb-[4px]">{data.name || "Full Name"}</h2>
          <p className="m-0 font-normal text-[18px] leading-[1.35] whitespace-nowrap">{data.role || "Role/Title"}</p>
          <p className="m-0 font-normal text-[18px] leading-[1.35] whitespace-nowrap opacity-80">{data.company || "Organization"}</p>
        </section>

        <footer className="absolute left-0 bottom-0 h-[123px] w-full">
          <img className="absolute bottom-0 left-0 h-full w-full" src="https://www.figma.com/api/mcp/asset/19a4081a-3d42-499b-8b23-eaca86dedae6" alt="" />
          <HorizontalSponsorsDesign2 sponsors={data.sponsors} />
        </footer>
      </div>
    );
  }

  // Horizontal Card (Design 1 - Default)
  return (
    <div
      id={id}
      key={data.designType}
      className="relative overflow-hidden shadow-2xl poster animate-fade-in will-change-transform transition-all duration-500 group"
      style={posterStyle}
    >
      <img className="absolute inset-[-292px_-6px_auto_-5px] w-[1212px] h-[808px] opacity-[0.11] object-cover pointer-events-none" src="https://www.figma.com/api/mcp/asset/a068f32c-5159-4502-a8f7-c3748e1a7c88" alt="" />
      
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
          <span>{data.sessionTime || "05:00 PM"}</span>
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
        <img src="https://www.figma.com/api/mcp/asset/f933f73f-4602-4c5f-a7f1-8e9e24f19129" className="w-[59px] h-[59px] object-contain" alt="" />
        <img src="https://www.figma.com/api/mcp/asset/a433a3fb-dace-43ff-ace4-ac1ff37cb838" className="w-[165px] h-[48px] object-contain" alt="" />
      </div>

      <section className="absolute right-[20px] top-[172px] w-[300px] text-left" style={metaTextColor}>
        <div className="mb-5 flex h-[175px] w-[175px] items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/10">
          {data.photo ? (
            <img src={data.photo} className="w-full h-full object-cover" />
          ) : (
            <DefaultAvatarPlaceholder className="w-full h-full" />
          )}
        </div>
        <h2 className="m-0 font-bold text-[22px] leading-[1.2] whitespace-nowrap">{data.name || "Full Name"}</h2>
        <p className="m-0 font-normal text-[18px] leading-[1.35] whitespace-nowrap">{data.role || "Role/Title"}</p>
        <p className="m-0 font-normal text-[18px] leading-[1.35] whitespace-nowrap opacity-80">{data.company || "Organization"}</p>
      </section>

      <footer className="absolute bottom-0 left-0 right-0 grid h-[123px] place-items-center bg-white px-[40px]">
        <HorizontalSponsorsDesign1 sponsors={data.sponsors} />
      </footer>
    </div>
  );
}

