"use client";
import { useState } from "react";
import { CardData } from "@/types/card";

export function CardPreview({
  data,
  preview,
  id,
}: {
  data: Partial<CardData>;
  preview?: boolean;
  id?: string;
}) {
  const [isZoomed, setIsZoomed] = useState(false);

  const badgeId = data.id?.slice(-8).toUpperCase() || "WMKDEV";
  // QR code: only show if user has a linkedin handle
  const hasLinkedin = !!data.linkedin?.trim();
  const linkedinUrl = hasLinkedin
    ? `https://linkedin.com/in/${data.linkedin}`
    : null;
  const qrUrl = hasLinkedin
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(linkedinUrl!)}&margin=4&color=0-0-0&bgcolor=255-255-255`
    : null;

  return (
    <div
      id={id}
      onClick={() => setIsZoomed((z) => !z)}
      className={`
        relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl
        transition-all duration-500 w-full cursor-pointer select-none
        ${isZoomed ? "scale-[1.04] shadow-2xl z-50" : "scale-100"}
      `}
      style={{ aspectRatio: "800/420", maxWidth: "800px", margin: "0 auto" }}
    >
      {/* ── Main layout: left (info) | divider | right (photo + qr) ── */}
      <div className="h-full flex">

        {/* ── LEFT PANEL ── */}
        <div className="flex flex-col flex-1 min-w-0 p-[5%]">

          {/* Event header */}
          <div className="flex items-start justify-between mb-[4%]">
            <div>
              <p className="text-[clamp(7px,1vw,10px)] font-bold tracking-[0.22em] text-slate-400 uppercase mb-0.5">
                EVENT
              </p>
              <h3 className="text-[clamp(11px,1.5vw,18px)] font-bold text-slate-900 leading-tight">
                {data.eventName || "Event Name"}
              </h3>
            </div>
            {/* Initial badge */}
            <div className="w-[clamp(20px,3.5%,36px)] h-[clamp(20px,3.5%,36px)] rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-primary/30 font-bold italic text-[clamp(8px,1.2vw,14px)] flex-shrink-0">
              {data.name?.charAt(0) || "A"}
            </div>
          </div>

          {/* Small profile row (name + role) */}
          <div className="flex items-center gap-[4%] mb-[5%]">
            <div
              className="rounded-full overflow-hidden bg-slate-100 border-[3px] border-white shadow-md flex-shrink-0 flex items-center justify-center text-slate-300"
              style={{ width: "clamp(44px, 9%, 76px)", height: "clamp(44px, 9%, 76px)" }}
            >
              {data.photo ? (
                <img src={data.photo} alt={data.name} className="w-full h-full object-cover" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-[55%] h-[55%]">
                  <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-[clamp(13px,2vw,26px)] font-extrabold text-slate-900 leading-tight truncate">
                {data.name || "Your Name"}
              </h2>
              <p className="text-[clamp(8px,1.1vw,13px)] text-slate-400 font-medium truncate">
                {data.role || "Role"}
                {data.company && <span> &bull; {data.company}</span>}
              </p>
            </div>
          </div>

          {/* Info grid — 2 col × 2 row */}
          <div className="grid grid-cols-2 gap-x-[6%] gap-y-[4%] flex-1">
            <div>
              <p className="text-[clamp(6px,0.8vw,9px)] font-bold tracking-[0.22em] text-slate-400 uppercase mb-0.5">EMAIL</p>
              <p className="text-[clamp(8px,1vw,12px)] font-semibold text-slate-800 truncate">{data.email || "hello@example.com"}</p>
            </div>
            <div>
              <p className="text-[clamp(6px,0.8vw,9px)] font-bold tracking-[0.22em] text-slate-400 uppercase mb-0.5">LOCATION</p>
              <p className="text-[clamp(8px,1vw,12px)] font-semibold text-slate-800 truncate">{data.location || "City, Country"}</p>
            </div>
            <div>
              <p className="text-[clamp(6px,0.8vw,9px)] font-bold tracking-[0.22em] text-slate-400 uppercase mb-0.5">SESSION DATE</p>
              <p className="text-[clamp(8px,1vw,12px)] font-semibold text-slate-800 truncate">{data.sessionDate || "March 2026"}</p>
            </div>
            <div>
              <p className="text-[clamp(6px,0.8vw,9px)] font-bold tracking-[0.22em] text-slate-400 uppercase mb-0.5">BADGE ID</p>
              <p className="text-[clamp(8px,1vw,12px)] font-semibold text-slate-800 truncate">{badgeId}</p>
            </div>
          </div>

          {/* Footer: Confirmed Attendee + avtive.co */}
          <div className="mt-auto pt-[4%] border-t border-slate-100">
            <p className="text-[clamp(5px,0.75vw,9px)] font-bold tracking-[0.22em] text-slate-300 uppercase">
              CONFIRMED ATTENDEE
            </p>
            <p className="text-[clamp(9px,1.2vw,15px)] font-extrabold text-slate-900 tracking-tight">
              avtive.co
            </p>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="w-px bg-slate-100 self-stretch my-[4%]" />

        {/* ── RIGHT PANEL — large photo + QR (only if linkedin exists) ── */}
        <div
          className="flex flex-col items-center justify-between flex-shrink-0 p-[4%]"
          style={{ width: "clamp(100px, 28%, 240px)" }}
        >
          {/* Large profile photo */}
          <div
            className="rounded-full overflow-hidden bg-slate-100 border-4 border-white shadow-lg flex items-center justify-center text-slate-300 w-full"
            style={{ aspectRatio: "1/1" }}
          >
            {data.photo ? (
              <img src={data.photo} alt={data.name} className="w-full h-full object-cover" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-1/2 h-1/2">
                <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            )}
          </div>

          {/* QR Code — ONLY shown when user has a LinkedIn handle */}
          {qrUrl && (
            <div
              className="bg-white border border-slate-200 rounded-lg overflow-hidden flex-shrink-0 mt-[6%]"
              style={{ width: "clamp(40px, 55%, 90px)", height: "clamp(40px, 55%, 90px)" }}
            >
              <img
                src={qrUrl}
                alt="LinkedIn QR Code"
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
