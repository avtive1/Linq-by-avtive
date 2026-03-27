"use client";
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
  return (
    <div 
      id={id}
      className={`
        relative w-full max-w-[480px] aspect-square bg-white border border-border rounded-3xl overflow-hidden shadow-2xl transition-all duration-500
        ${preview ? "scale-90 md:scale-100 opacity-95" : "scale-100"}
      `}
    >
      {/* Brand Accent */}
      <div className="absolute top-0 inset-x-0 h-2 bg-primary" />
      
      <div className="h-full flex flex-col p-10 md:p-12">
        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold tracking-[0.2em] text-muted/40 uppercase mb-1">
              Event
            </span>
            <h3 className="text-xl font-bold text-heading">
              {data.eventName || "Event Name"}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-primary/40 font-bold italic">
            A
          </div>
        </div>

        {/* Profile */}
        <div className="flex items-center gap-6 mb-10">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-primary shadow-inner border-4 border-white">
            <User size={48} strokeWidth={1.5} />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold text-heading">
              {data.name || "Your Name"}
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted font-medium">
              <Briefcase size={14} className="text-primary/40" />
              <span>{data.role || "Your Role"}</span>
              {data.company && (
                <>
                  <span className="text-border">•</span>
                  <span>{data.company}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 flex-1">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold tracking-[0.2em] text-muted/50 uppercase flex items-center gap-1.5">
              <Mail size={10} /> Email
            </span>
            <p className="text-xs font-semibold text-heading truncate">
              {data.email || "hello@example.com"}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold tracking-[0.2em] text-muted/50 uppercase flex items-center gap-1.5">
              <MapPin size={10} /> Location
            </span>
            <p className="text-xs font-semibold text-heading truncate">
              {data.location || "City, Country"}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold tracking-[0.2em] text-muted/50 uppercase flex items-center gap-1.5">
              <Calendar size={10} /> Date
            </span>
            <p className="text-xs font-semibold text-heading">
              {data.sessionDate || data.year || "March 2026"}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold tracking-[0.2em] text-muted/50 uppercase flex items-center gap-1.5">
              <Globe size={10} /> LinkedIn
            </span>
            <p className="text-xs font-semibold text-primary truncate">
              {data.linkedin ? `@${data.linkedin}` : "@handle"}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-8 border-t border-border flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] font-extrabold tracking-[0.25em] text-primary uppercase">
              Confirmed Attendee
            </span>
            <span className="text-[10px] font-medium text-muted/40">
              avtive.co/verify
            </span>
          </div>
          {/* QR Pattern Placeholder */}
          <div className="w-12 h-12 bg-surface border border-border rounded-lg p-2 grid grid-cols-3 grid-rows-3 gap-0.5">
            {[...Array(9)].map((_, i) => (
              <div key={i} className={`rounded-[1px] ${[0, 2, 4, 6, 8].includes(i) ? "bg-muted/20" : "bg-transparent"}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
