"use client";
import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { CardData } from "@/types/card";

const COLOR_THEMES: Record<string, { start: string; end: string; accent: string; textColor?: string; titleColor?: string }> = {
  purple: { start: "#41295a", end: "#2f0743", accent: "#ffd400" },
  red:    { start: "#8C3C59", end: "#2F0724", accent: "#ffffff" },
  pink:   { start: "#d53f8c", end: "#702459", accent: "#ffffff" },
  blue:   { 
    start: "#DDD7E9", 
    end: "#DDD7E9", 
    accent: "#000000", 
    textColor: "#000000",
    titleColor: "#5538EE" 
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

  const theme = COLOR_THEMES[data.color || "purple"] || COLOR_THEMES.purple;
  
  // LinkedIn / QR Logic
  const rawLinkedin = data.linkedin?.trim() || "";
  const linkedinHandle = rawLinkedin
    .replace(/https?:\/\//, "")
    .replace(/www\.linkedin\.com\/in\//, "")
    .replace(/linkedin\.com\/in\//, "")
    .replace(/\/$/, "")
    .split("/")[0];

  useEffect(() => {
    let cancelled = false;
    const updateQr = async () => {
      if (!linkedinHandle) {
        if (!cancelled) setQrUrl(null);
        return;
      }
      try {
        const linkedinUrl = `https://linkedin.com/in/${linkedinHandle}`;
        const url = await QRCode.toDataURL(linkedinUrl, {
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
  }, [linkedinHandle]);

  if (isVertical) {
    return (
      <div 
        className="relative overflow-hidden bg-white shadow-2xl"
        style={{ 
          width: "400px", 
          height: "600px", 
          fontFamily: "'Inter', sans-serif",
          borderRadius: "12px"
        }}
      >
        {/* Top Section */}
        <div className="p-8 pb-0">
           <div className="flex items-center gap-2 mb-6">
              <img src="https://www.figma.com/api/mcp/asset/f933f73f-4602-4c5f-a7f1-8e9e24f19129" alt="Icon" className="w-10 h-10 object-contain" />
              <img src="https://www.figma.com/api/mcp/asset/a433a3fb-dace-43ff-ace4-ac1ff37cb838" alt="Avtive" className="w-24 h-8 object-contain" />
           </div>
           <p className="text-[12px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-1">I'M ATTENDING</p>
           <h1 className="text-3xl font-extrabold leading-tight mb-4" style={{ color: theme.titleColor || theme.textColor || "#23468C" }}>
              {data.eventName?.split("<br />").map((t, i) => <span key={i}>{t}<br/></span>) || "Pakistan Tech\nSummit"}
           </h1>
           <div className="flex flex-col gap-2 text-[11px] text-slate-500 font-medium">
              <span>📅 {data.sessionDate || "Friday, 11th April, 2026"}</span>
              <span>📍 {data.location || "Expo Center, Islamabad, Pakistan"}</span>
           </div>
        </div>

        {/* Bottom Shape & Info */}
        <div 
          className="absolute bottom-0 left-0 w-full h-[280px] flex flex-col items-center justify-center p-8"
          style={{ 
            background: `linear-gradient(180deg, ${theme.start} 0%, ${theme.end} 100%)`,
            clipPath: "polygon(0 15%, 100% 0, 100% 100%, 0 100%)",
            color: theme.textColor || "white"
          }}
        >
          {verticalSide === 1 ? (
             <div className="flex flex-col items-center text-center mt-6">
                <div className="w-24 h-24 rounded-[20px] overflow-hidden border-2 border-white/20 mb-4 bg-white/10">
                   {data.photo ? <img src={data.photo} className="w-full h-full object-cover" /> : null}
                </div>
                <h2 className="text-xl font-bold mb-1">{data.name || "Your Name"}</h2>
                <p className="text-xs opacity-80">{data.role || "Role"}</p>
                <p className="text-xs opacity-60">{data.company || "Company"}</p>
             </div>
          ) : (
             <div className="flex flex-col items-center text-center mt-6">
                <div className="bg-white p-2 rounded-xl mb-4">
                   {qrUrl ? <img src={qrUrl} className="w-24 h-24" /> : <div className="w-24 h-24 bg-slate-100" />}
                </div>
                <h2 className="text-xl font-bold mb-1">{data.name || "Your Name"}</h2>
                <p className="text-xs opacity-80">{data.role || "Role"}</p>
             </div>
          )}
          
          <div className="mt-auto flex items-center gap-4 opacity-40 grayscale brightness-200">
             <img src="https://www.figma.com/api/mcp/asset/60137d44-eb2a-4405-bd79-67be246fc1ec" alt="Logos" className="h-4 object-contain" />
          </div>
        </div>
      </div>
    );
  }

  // Common styles for both designs
  const posterStyle: React.CSSProperties = {
    width: "1200px",
    height: "628px",
    background: `linear-gradient(180deg, ${theme.start} 0%, ${theme.end} 100%)`,
    fontFamily: "'Inter', sans-serif",
  };

  const titleKickerStyle: React.CSSProperties = {
    color: theme.accent,
    fontFamily: "'Poppins', sans-serif",
  };

  const titleStyle: React.CSSProperties = {
    color: theme.titleColor || theme.textColor || "white",
    fontFamily: "'Poppins', sans-serif",
  };

  const metaTextColor = { color: theme.textColor || "white" };

  if (data.designType === "design2") {
    return (
      <div id={id} className="relative overflow-hidden shadow-2xl poster" style={posterStyle}>
        <img className="absolute inset-[-292px_-6px_auto_-5px] w-[1212px] h-[808px] opacity-[0.11] object-cover pointer-events-none" src="https://www.figma.com/api/mcp/asset/1e6c3590-a66a-4bc5-b575-adfb66dc1bb8" alt="" />
        
        <p className="absolute left-[58px] top-[81px] m-0 font-[500] text-[25px] leading-none tracking-[3px] uppercase" style={titleKickerStyle}>
          I'M ATTENDING
        </p>
        
        <h1 className="absolute left-[50px] top-[138px] m-0 font-[700] text-[96px] leading-[88px] tracking-[-4px]" style={titleStyle}>
          {data.eventName?.split("<br />").map((text, i) => <span key={i}>{text}<br /></span>) || "Pakistan Tech\nSummit"}
        </h1>

        <div className="absolute left-[58px] top-[360px] flex gap-[35px] items-center flex-wrap" style={metaTextColor}>
          <div className="flex items-center gap-2 text-[18px] font-[500] whitespace-nowrap">
            <svg className="w-[25px] h-[25px] fill-current" viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 15H5V10h14ZM7 12h5v5H7Z"/></svg>
            <span>{data.sessionDate || "Friday, 11th April, 2026"}</span>
          </div>
          <div className="flex items-center gap-2 text-[18px] font-[500] whitespace-nowrap">
            <svg className="w-[25px] h-[25px] fill-current" viewBox="0 0 24 24"><path d="M12 1.75A10.25 10.25 0 1 0 22.25 12 10.26 10.26 0 0 0 12 1.75Zm4.22 11h-4.97V7.78h1.5v3.47h3.47Z"/></svg>
            <span>05:00 PM (Pakistan Time)</span>
          </div>
        </div>

        <div className="absolute left-[58px] top-[402px] flex items-center gap-2 text-[18px] font-[500] whitespace-nowrap" style={metaTextColor}>
          <svg className="w-[25px] h-[25px] fill-current" viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 4.86 7 13 7 13s7-8.14 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5Z"/></svg>
          <span>{data.location || "Expo Center, Islamabad, Pakistan"}</span>
        </div>

        <div className="absolute right-[80px] top-[70px] flex items-center gap-2">
          <img src="https://www.figma.com/api/mcp/asset/56b614de-2622-49f5-ac7b-a0ed09ebaeac" className="w-[63px] h-[59px] object-contain" alt="" />
          <img src="https://www.figma.com/api/mcp/asset/22c9e87c-f736-4755-b4a7-402c9070d2b3" className="w-[191px] h-[56px] object-contain" alt="" />
        </div>

        <section className="absolute right-[26px] top-[172px] w-[340px] text-left" style={metaTextColor}>
          <img 
            src={data.photo || "https://www.figma.com/api/mcp/asset/8a1960ee-9b09-4d02-bb74-823ed9e1f8dd"} 
            className="w-[175px] h-[175px] rounded-[25px] object-cover block mb-[20px]" 
            alt={data.name} 
          />
          <h2 className="m-0 font-[700] text-[22px] leading-[1.2] whitespace-nowrap mb-[4px]">{data.name || "Syed Mesum Raza Shah"}</h2>
          <p className="m-0 font-[400] text-[18px] leading-[1.35] whitespace-nowrap">{data.role || "CEO & Founder"}</p>
          <p className="m-0 font-[400] text-[18px] leading-[1.35] whitespace-nowrap opacity-80">{data.company || "Avtive (Private) Limited"}</p>
        </section>

        <footer className="absolute left-0 bottom-0 w-full h-[123px]">
          <img className="absolute left-0 bottom-0 w-full h-full" src="https://www.figma.com/api/mcp/asset/19a4081a-3d42-499b-8b23-eaca86dedae6" alt="" />
          <img className="absolute left-[276px] top-[42px] w-[861px] h-[38px] object-contain" src="https://www.figma.com/api/mcp/asset/304933ce-cbdb-4ff8-a402-c39459b6d08d" alt="Sponsors" />
        </footer>
      </div>
    );
  }

  // Horizontal Card (Design 1 - Default)
  return (
    <div
      id={id}
      className="relative overflow-hidden shadow-2xl transition-all duration-500 group"
      style={posterStyle}
    >
      <img className="absolute inset-[-292px_-6px_auto_-5px] w-[1212px] h-[808px] opacity-[0.11] object-cover pointer-events-none" src="https://www.figma.com/api/mcp/asset/a068f32c-5159-4502-a8f7-c3748e1a7c88" alt="" />
      
      <p className="absolute left-[58px] top-[81px] m-0 font-[500] text-[25px] leading-none tracking-[3px] uppercase" style={titleKickerStyle}>
        I'M ATTENDING
      </p>
      
      <h1 className="absolute left-[50px] top-[138px] m-0 font-[700] text-[96px] leading-[88px] tracking-[-4px]" style={titleStyle}>
        {data.eventName?.split("<br />").map((text, i) => <span key={i}>{text}<br /></span>) || "Pakistan Tech\nSummit"}
      </h1>

      <div className="absolute left-[58px] top-[360px] flex gap-[35px] items-center flex-wrap" style={metaTextColor}>
        <div className="flex items-center gap-2 text-[18px] font-[500] whitespace-nowrap">
          <svg className="w-[25px] h-[25px] fill-current" viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 15H5V10h14ZM7 12h5v5H7Z"/></svg>
          <span>{data.sessionDate || "Friday, 11th April, 2026"}</span>
        </div>
        <div className="flex items-center gap-2 text-[18px] font-[500] whitespace-nowrap">
          <svg className="w-[25px] h-[25px] fill-current" viewBox="0 0 24 24"><path d="M12 1.75A10.25 10.25 0 1 0 22.25 12 10.26 10.26 0 0 0 12 1.75Zm4.22 11h-4.97V7.78h1.5v3.47h3.47Z"/></svg>
          <span>05:00 PM (Pakistan Time)</span>
        </div>
      </div>

      <div className="absolute left-[58px] top-[402px] flex items-center gap-2 text-[18px] font-[500] whitespace-nowrap" style={metaTextColor}>
        <svg className="w-[25px] h-[25px] fill-current" viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 4.86 7 13 7 13s7-8.14 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5Z"/></svg>
        <span>{data.location || "Expo Center, Islamabad, Pakistan"}</span>
      </div>

      <div className="absolute right-[78px] top-[70px] flex items-center gap-2">
        <img src="https://www.figma.com/api/mcp/asset/f933f73f-4602-4c5f-a7f1-8e9e24f19129" className="w-[59px] h-[59px] object-contain" alt="" />
        <img src="https://www.figma.com/api/mcp/asset/a433a3fb-dace-43ff-ace4-ac1ff37cb838" className="w-[165px] h-[48px] object-contain" alt="" />
      </div>

      <section className="absolute right-[20px] top-[172px] w-[300px] text-left" style={metaTextColor}>
        <img 
          src={data.photo || "https://www.figma.com/api/mcp/asset/30683129-9849-43e5-826b-31991c7c5e80"} 
          className="w-[175px] h-[175px] rounded-[25px] object-cover block mb-5" 
          alt={data.name} 
        />
        <h2 className="m-0 font-[700] text-[22px] leading-[1.2] whitespace-nowrap">{data.name || "Syed Mesum Raza Shah"}</h2>
        <p className="m-0 font-[400] text-[18px] leading-[1.35] whitespace-nowrap">{data.role || "CEO & Founder"}</p>
        <p className="m-0 font-[400] text-[18px] leading-[1.35] whitespace-nowrap opacity-80">{data.company || "Avtive (Private) Limited"}</p>
      </section>

      <footer className="absolute left-0 right-0 bottom-0 h-[123px] bg-white grid place-items-center px-[40px]">
        <img src="https://www.figma.com/api/mcp/asset/60137d44-eb2a-4405-bd79-67be246fc1ec" className="w-[1045px] max-w-full h-[46px] object-contain" alt="Sponsors" />
      </footer>
    </div>
  );
}
