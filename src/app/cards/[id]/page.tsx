"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";
import { CardPreview } from "@/components/CardPreview";
import { ArrowLeft, Download, Info } from "lucide-react";
import { CardData } from "@/types/card";
import { toPng } from "html-to-image";

export default function CardViewPage() {
  const { id } = useParams<{ id: string }>();
  const [card, setCard] = useState<CardData | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && id) {
      const stored = localStorage.getItem(`avtive_card_${id}`);
      if (stored) {
        try {
          setCard(JSON.parse(stored));
        } catch {}
      }
    }
  }, [id]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      // Capture at exactly 800x420 — the natural render size of the card
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2, // 2× for crisp high-res output (1600x840 actual px, displays as 800x420)
        backgroundColor: "#ffffff",
        skipFonts: false,
      });

      const link = document.createElement("a");
      link.download = `avtive-card-${
        card?.name?.replace(/\s+/g, "-").toLowerCase() || "attendee"
      }.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to download card:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!card) {
    return (
      <main className="relative min-h-screen w-full flex items-center justify-center p-6 text-center">
        <GradientBackground />
        <div className="relative z-10 flex flex-col items-center gap-4 bg-white p-8 rounded-3xl border border-border shadow-xl">
          <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-muted">
            <Info size={24} />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-heading font-semibold">Card not found</p>
            <p className="text-sm text-muted">
              The card you&apos;re looking for doesn&apos;t exist.
            </p>
          </div>
          <Link href="/dashboard" className="mt-2">
            <Button variant="secondary">Back to Dashboard</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen w-full bg-white flex flex-col items-center py-10 md:py-16 px-4 sm:px-6 overflow-x-hidden">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[860px] flex flex-col gap-8 md:gap-10">

        {/* ── Top Nav ── */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors group"
          >
            <ArrowLeft
              size={16}
              className="group-hover:-translate-x-1 transition-transform"
            />
            Dashboard
          </Link>

          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            icon={<Download size={18} />}
            className="shadow-lg shadow-primary/20 min-w-[160px]"
          >
            {isDownloading ? "Preparing…" : "Download Card"}
          </Button>
        </div>

        {/* ── Card Preview ── */}
        {/* 
          The wrapper scales the card on small screens so it never overflows.
          On ≥800px screens it renders at full 800px width (natural size for capture).
        */}
        <div className="w-full flex justify-center">
          {/* 
            Outer scaler: we give the outer div the full container width,
            but scale the inner fixed-width card to fit using CSS scale + origin.
          */}
          <div className="card-scale-wrapper w-full">
            {/* This div is what html-to-image captures — fixed 800×420 ratio */}
            <div
              ref={cardRef}
              className="card-capture"
              style={{ width: "800px", aspectRatio: "800/420" }}
            >
              <CardPreview data={card} />
            </div>
          </div>
        </div>

        {/* ── Subtitle ── */}
        <div className="text-center flex flex-col gap-2">
          <p className="text-sm text-slate-400 font-medium leading-relaxed">
            Your attendee card is ready. Click{" "}
            <span className="text-primary font-semibold">Download Card</span> to
            save it as a high-quality PNG image (800 × 420 px).
          </p>
          <span className="text-[10px] font-bold tracking-[0.2em] text-slate-300 uppercase">
            Badge ID: {card.id.slice(-8).toUpperCase()}
          </span>
        </div>
      </div>

      {/* 
        Responsive scaling: 
        The card is always rendered at 800px width internally (so capture is correct),
        but we CSS-scale it down on smaller viewports so it fits the screen.
      */}
      <style>{`
        .card-scale-wrapper {
          display: flex;
          justify-content: center;
          overflow: visible;
        }
        .card-capture {
          transform-origin: top center;
        }

        /* Scale down progressively on smaller screens */
        @media (max-width: 820px) {
          .card-scale-wrapper { overflow: hidden; }
          .card-capture {
            transform: scale(calc((100vw - 32px) / 800));
            /* Compensate for the space freed up by scaling (height collapses) */
            margin-bottom: calc((420px * ((100vw - 32px) / 800)) - 420px);
          }
        }
        @media (min-width: 821px) {
          .card-capture {
            transform: scale(1);
            margin-bottom: 0;
          }
        }
      `}</style>
    </main>
  );
}