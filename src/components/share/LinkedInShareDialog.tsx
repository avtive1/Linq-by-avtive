"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CardData } from "@/types/card";
import { openManualLinkedInShareFallback } from "@/lib/share/linkedin-card-share";
import { toast } from "sonner";

interface LinkedInShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  card: CardData;
  shareToken?: string;
  onManualShareFallback?: () => void;
  onEnsurePreviewUploaded?: () => Promise<string | undefined>;
}

function LinkedInIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.64a1.65 1.65 0 0 0-1.66 1.66 1.66 1.66 0 0 0 1.66 1.66 1.65 1.65 0 0 0 1.65-1.66 1.66 1.66 0 0 0-1.65-1.66" />
    </svg>
  );
}

export function LinkedInShareDialog({
  isOpen,
  onClose,
  card,
  onEnsurePreviewUploaded,
}: LinkedInShareDialogProps) {
  const [clientOrigin, setClientOrigin] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setClientOrigin(window.location.origin);
    }
  }, []);

  const handleConnectLinkedIn = async () => {
    if (onEnsurePreviewUploaded) {
      try {
        await onEnsurePreviewUploaded();
      } catch {
        // Non-blocking if upload fails or is already complete
      }
    }

    openManualLinkedInShareFallback({
      cardId: card.id,
      name: card.name,
      eventName: card.eventName,
      role: card.role,
      company: card.company,
      cardRole: card.cardRole,
      organizationName: card.organizationName,
      origin: clientOrigin || undefined,
    });

    toast.success("Opening LinkedIn — post caption copied to clipboard!");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-full max-w-lg bg-slate-900/95 text-slate-100 border border-slate-700/80 shadow-2xl backdrop-blur-xl p-6 sm:p-7 rounded-2xl"
        showCloseButton={true}
      >
        <DialogHeader className="gap-2 pb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#0A66C2] flex items-center justify-center text-white shadow-md shadow-[#0A66C2]/20">
              <LinkedInIcon className="w-5 h-5" />
            </div>
            <DialogTitle className="text-xl font-semibold tracking-tight text-white">
              Share on LinkedIn
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* Event Badge Preview */}
          <div className="relative w-full aspect-[1200/628] rounded-xl overflow-hidden border border-slate-700/60 bg-slate-950 shadow-inner">
            {card.cardPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.cardPreviewUrl}
                alt={`${card.name}'s badge`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-xs text-slate-400 gap-1 bg-slate-900/60">
                <span className="font-medium text-slate-300">Attendee Badge</span>
                <span className="text-[11px] text-slate-500">{card.name} · {card.eventName}</span>
              </div>
            )}
          </div>

          {/* Connect LinkedIn button */}
          <Button
            type="button"
            onClick={handleConnectLinkedIn}
            className="w-full bg-[#0A66C2] hover:bg-[#004182] text-white text-sm font-semibold h-11 gap-2.5 rounded-xl shadow-lg shadow-[#0A66C2]/25 transition-all duration-200 hover:scale-[1.01] cursor-pointer"
          >
            <LinkedInIcon className="w-5 h-5 shrink-0" />
            Connect LinkedIn
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
