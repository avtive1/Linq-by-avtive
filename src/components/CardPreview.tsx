"use client";
import { useState } from "react";
import { User, Briefcase, Mail, MapPin, Calendar, Globe } from "lucide-react";
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

  return (
    <div 
      id={id}
      onClick={() => !preview && setIsZoomed(!isZoomed)}
      className={`
        relative w-full aspect-square bg-white border border-border rounded-[2.5rem] overflow-hidden shadow-2xl transition-all duration-500 cursor-pointer
        ${preview ? "scale-100" : isZoomed ? "scale-[1.1] z-50" : "scale-100"}
        mx-auto
      `}
      style={{ maxWidth: preview ? '100%' : '480px' }}
    >
      {/* Brand Accent */}
      <div className="absolute top-0 inset-x-0 h-2 bg-primary" />
      
      <div className="h-full flex flex-col p-8 sm:p-10 md:p-12">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 md:mb-10">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold tracking-[0.2em] text-muted/40 uppercase mb-1">
              Event
            </span>
            <h3 className="text-lg md:text-xl font-bold text-heading leading-tight">
              {data.eventName || "Event Name"}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-primary/40 font-bold italic flex-shrink-0">
            A
          </div>
        </div>

        {/* Profile */}
        <div className="flex items-center gap-4 md:gap-6 mb-8 md:mb-10">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-primary shadow-inner border-4 border-white flex-shrink-0">
            {data.photo ? (
              <img src={data.photo} alt={data.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <User size={40} className="md:w-12 md:h-12" strokeWidth={1.5} />
            )}
          </div>
          <div className="flex flex-col gap-0.5 md:gap-1 min-w-0">
            <h2 className="text-xl md:text-2xl font-bold text-heading truncate">
              {data.name || "Your Name"}
            </h2>
            <div className="flex items-center gap-2 text-xs md:text-sm text-muted font-medium truncate">
              <Briefcase size={14} className="text-primary/40 flex-shrink-0" />
              <span className="truncate">{data.role || "Your Role"}</span>
              {data.company && (
                <>
                  <span className="text-border flex-shrink-0">•</span>
                  <span className="truncate">{data.company}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-x-4 md:gap-x-8 gap-y-4 md:gap-y-6 flex-1">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[9px] font-bold tracking-[0.2em] text-muted/50 uppercase flex items-center gap-1.5">
              <Mail size={10} /> Email
            </span>
            <p className="text-[11px] md:text-xs font-semibold text-heading truncate">
              {data.email || "hello@example.com"}
            </p>
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[9px] font-bold tracking-[0.2em] text-muted/50 uppercase flex items-center gap-1.5">
              <MapPin size={10} /> Location
            </span>
            <p className="text-[11px] md:text-xs font-semibold text-heading truncate">
              {data.location || "City, Country"}
            </p>
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[9px] font-bold tracking-[0.2em] text-muted/50 uppercase flex items-center gap-1.5">
              <Calendar size={10} /> Date
            </span>
            <p className="text-[11px] md:text-xs font-semibold text-heading truncate">
              {data.sessionDate || "March 2026"}
            </p>
          </div>
          {data.linkedin && (
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[9px] font-bold tracking-[0.2em] text-muted/50 uppercase flex items-center gap-1.5">
                <Globe size={10} /> LinkedIn
              </span>
              <a 
                href={`https://linkedin.com/in/${data.linkedin}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[11px] md:text-xs font-semibold text-primary truncate hover:underline"
              >
                @{data.linkedin}
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 md:mt-auto pt-6 md:pt-8 border-t border-border flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] font-extrabold tracking-[0.25em] text-primary uppercase">
              Confirmed Attendee
            </span>
            <span className="text-[10px] font-medium text-muted/40">
              avtive.co/verify
            </span>
          </div>
          {/* QR Pattern - Now a real scannable QR code */}
          {data.linkedin && (
            <div className="w-12 h-12 bg-white border border-border rounded-lg overflow-hidden flex-shrink-0">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://linkedin.com/in/${data.linkedin}`)}`} 
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
