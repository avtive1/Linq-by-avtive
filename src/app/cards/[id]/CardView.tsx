"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";
import { CardPreview } from "@/components/CardPreview";
import { ArrowLeft, Download } from "lucide-react";
import { toPng } from "html-to-image";
import { CardData } from "@/types/card";
import { toast } from "sonner";

export default function CardView({ card, isShareMode = false }: { card: CardData; isShareMode?: boolean }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      toast.info("Generating high-quality card...");
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        skipFonts: false,
      });

      const link = document.createElement("a");
      link.download = `avtive-card-${
        card?.name?.replace(/\s+/g, "-").toLowerCase() || "attendee"
      }.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Card downloaded successfully!");
    } catch (err) {
      console.error("Failed to download card:", err);
      toast.error("Failed to generate download. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full bg-transparent flex flex-col items-center py-10 md:py-16 px-4 sm:px-6 overflow-x-hidden">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[860px] flex flex-col gap-8 md:gap-10 animate-slide-up">
        <div className="flex items-center justify-between">
          {isShareMode ? (
            <div className="flex items-center gap-3">
               <span className="text-[12px] font-bold tracking-[0.2em] text-muted/40 uppercase">
                 AVTIVE ATTENDEE PORTAL
               </span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-primary transition-colors group"
              >
                <ArrowLeft
                  size={14}
                  className="group-hover:-translate-x-1 transition-transform"
                />
                Home
              </Link>
              <span className="text-muted/20">/</span>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-primary transition-colors group"
              >
                Dashboard
              </Link>
            </div>
          )}

          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            icon={<Download size={18} />}
            className="shadow-lg shadow-primary/20 min-w-[160px]"
          >
            {isDownloading ? "Preparing…" : "Download Card"}
          </Button>
        </div>

        <div className="w-full flex justify-center">
          <div className="card-scale-wrapper w-full">
            <div
              ref={cardRef}
              className="card-capture"
              style={{ width: "800px", aspectRatio: "800/420" }}
            >
              <CardPreview data={card} />
            </div>
          </div>
        </div>

        <div className="text-center flex flex-col gap-2">
          <p className="text-sm text-slate-400 font-medium leading-relaxed">
            Your attendee card is ready. Click{" "}
            <span className="text-primary font-semibold">Download Card</span> to
            save it as a high-quality PNG image (800 × 420 px).
          </p>
          <span className="text-[10px] font-bold tracking-[0.25em] text-heading/30 uppercase">
            Badge ID: {card.id.slice(-8).toUpperCase()}
          </span>
        </div>
      </div>

      <style>{`
        .card-scale-wrapper {
          display: flex;
          justify-content: center;
          overflow: visible;
        }
        .card-capture {
          transform-origin: top center;
        }
        @media (max-width: 820px) {
          .card-scale-wrapper { overflow: hidden; }
          .card-capture {
            transform: scale(calc((100vw - 32px) / 800));
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
