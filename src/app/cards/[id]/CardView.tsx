"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";
import { CardPreview } from "@/components/CardPreview";
import { ArrowLeft, Download, Share2, Printer } from "lucide-react";
import { toPng } from "html-to-image";
import { CardData } from "@/types/card";
import { toast } from "sonner";

export default function CardView({ card, isShareMode = false }: { card: CardData; isShareMode?: boolean }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [viewMode, setViewMode] = useState<"horizontal" | "vertical">("horizontal");
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        skipFonts: false,
      });

      const link = document.createElement("a");
      link.download = `avtive-${viewMode}-${
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

  const handlePrint = () => {
    setViewMode("vertical");
    // Print uses `.print-only` (not on-screen preview); wait for layout flush before dialog
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
  };

  const handleShareLinkedIn = () => {
    setIsDownloading(true);
    try {
      toast.success("Opening LinkedIn share...");
      
      setTimeout(() => {
        const shareUrl = encodeURIComponent(window.location.href);
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`, "_blank", "width=800,height=600");
      }, 500);
    } catch (err) {
      console.error("Failed to open LinkedIn:", err);
      toast.error("Failed to open LinkedIn. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full bg-transparent flex flex-col items-center py-12 md:py-16 px-6 sm:px-12 lg:px-16 overflow-x-hidden print:p-0">
      <GradientBackground />

      <div className="no-print relative z-10 w-full max-w-[860px] flex flex-col gap-8 md:gap-10 animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-4">
             {isShareMode ? (
                <div className="flex items-center gap-3">
                   <span className="text-sm font-normal tracking-[0.01em] leading-[1.25] text-muted/65">
                     Avtive attendee portal
                   </span>
                </div>
             ) : (
                <div className="flex items-center gap-3">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm font-medium text-heading hover:text-primary-strong hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-md group"
                  >
                    <ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" />
                    Home
                  </Link>
                  <span className="text-muted/20">/</span>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 text-sm font-medium text-heading hover:text-primary-strong hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-md group"
                  >
                    Dashboard
                  </Link>
                </div>
             )}

             {/* View toggles: badge/print must work even without LinkedIn (QR back may be empty). */}
             <div className="flex bg-white/10 p-1 rounded-md w-fit border border-white/20">
                <button
                  type="button"
                  onClick={() => setViewMode("horizontal")}
                  className={`px-4 py-2 rounded-md text-[13px] leading-[1.25] font-medium tracking-[0.01em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-[0.97] ${viewMode === "horizontal" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted hover:text-heading hover:bg-white/20"}`}
                >
                  Post View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("vertical")}
                  className={`px-4 py-2 rounded-md text-[13px] leading-[1.25] font-medium tracking-[0.01em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-[0.97] ${viewMode === "vertical" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted hover:text-heading hover:bg-white/20"}`}
                >
                  Badge View
                </button>
             </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleShareLinkedIn}
              disabled={isDownloading}
              variant="blue"
              icon={<Share2 size={16} />}
              className="shadow-lg flex-1 md:flex-initial h-10 px-4 min-w-[116px]"
            >
              Share
            </Button>
            {viewMode === "vertical" ? (
               <Button
                  onClick={handlePrint}
                  disabled={isDownloading}
                  variant="secondary"
                  icon={<Printer size={18} />}
                  className="shadow-lg flex-1 md:flex-initial h-10 px-4 min-w-[116px]"
               >
                  Print Badge
               </Button>
            ) : (
               <Button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  icon={<Download size={18} />}
                  className="shadow-lg shadow-primary/20 flex-1 md:flex-initial h-10 px-4 min-w-[116px]"
               >
                  {isDownloading ? "Preparing…" : "Download"}
               </Button>
            )}
          </div>
        </div>

        {/* Hidden 1:1 scale container strictly for clean, unscaled downloads */}
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', overflow: 'hidden' }}>
          <div 
            ref={cardRef} 
            style={{ 
              width: viewMode === "horizontal" ? "1200px" : "576px", 
              height: viewMode === "horizontal" ? "628px" : "1024px" 
            }}
          >
            <CardPreview 
               data={card} 
               isVertical={viewMode === "vertical"} 
               verticalSide={1} 
            />
          </div>
        </div>

        <div className="w-full flex flex-col items-center gap-6">
          {viewMode === "horizontal" ? (
            <div className="card-scale-wrapper w-full">
              <div className="card-capture" style={{ width: "1200px", height: "628px" }}>
                <CardPreview data={card} isVertical={false} />
              </div>
            </div>
          ) : (
            <div className="vertical-pair-wrapper">
              <div className="vertical-card-frame">
                <div className="card-capture card-capture-vertical" style={{ width: "576px", height: "1024px" }}>
                  <CardPreview data={card} isVertical verticalSide={1} />
                </div>
              </div>
              <div className="vertical-card-frame">
                <div className="card-capture card-capture-vertical" style={{ width: "576px", height: "1024px" }}>
                  <CardPreview data={card} isVertical verticalSide={2} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="text-center flex flex-col gap-2">
          <p className="text-sm text-slate-400 font-normal leading-[1.6]">
            {viewMode === "horizontal" 
               ? "This design is optimized for LinkedIn posts and social sharing."
               : "This design is optimized for physical printing and event registration."
            }
          </p>
          <span className="text-[13px] font-normal tracking-[0.01em] leading-[1.25] text-heading/45">
            Attendee ID: {card.id.slice(-8).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Printer optimized container */}
      <div className="print-only absolute top-0 left-0 w-full bg-white justify-center items-start pt-[1cm]">
         <div style={{ width: "762px", height: "666px", position: "relative" }}>
            <div style={{ transform: "scale(0.65)", transformOrigin: "top left", display: "flex", gap: "20px" }}>
               <div style={{ width: "576px", height: "1024px" }}>
                  <CardPreview data={card} isVertical={true} verticalSide={1} />
               </div>
               <div style={{ width: "576px", height: "1024px" }}>
                  <CardPreview data={card} isVertical={true} verticalSide={2} />
               </div>
            </div>
         </div>
      </div>

      <style>{`
        @media screen {
          .print-only { display: none !important; }
        }
        @media print {
           @page { margin: 0; size: A4 portrait; }
           
           /* Force hide EVERYTHING that shouldn't be printed */
           .no-print, .no-print * { display: none !important; }
           
           /* Force show ONLY the physical print layout */
           .print-only {
              display: flex !important;
              flex-direction: row;
              justify-content: center;
              align-items: flex-start;
           }

           /* Bruteforce exact colors so the purple background renders on paper */
           * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
              print-color-adjust: exact !important;
           }

           body, main { 
              margin: 0 !important; 
              padding: 0 !important; 
              background: white !important; 
           }
        }
        .card-scale-wrapper {
          display: flex;
          justify-content: center;
          overflow: visible;
        }
        .vertical-pair-wrapper {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          gap: 180px;
        }
        .vertical-card-frame {
          width: 288px;
          height: 512px;
          overflow: hidden;
          display: flex;
          justify-content: center;
        }
        .card-capture {
          transform-origin: top center;
        }
        .card-capture-vertical {
          transform-origin: top center;
        }
        @media (max-width: 1024px) {
          .card-scale-wrapper { overflow: hidden; }
          .vertical-pair-wrapper {
            gap: 20px;
            overflow-x: auto;
            justify-content: flex-start;
            padding-bottom: 6px;
          }
          .vertical-card-frame {
            width: 260px;
            height: 462px;
            flex: 0 0 auto;
          }
          .card-capture {
            transform: scale(calc((100vw - 32px) / ${viewMode === "horizontal" ? "1200" : "576"}));
            margin-bottom: calc((${viewMode === "horizontal" ? "628px" : "1024px"} * ((100vw - 32px) / ${viewMode === "horizontal" ? "1200" : "576"})) - ${viewMode === "horizontal" ? "628px" : "1024px"});
          }
          .card-capture-vertical {
            transform: scale(calc((100vw - 56px) / 1300));
            margin-bottom: calc((1024px * ((100vw - 56px) / 1300)) - 1024px);
          }
        }
        @media (min-width: 1025px) {
          .card-capture {
            transform: scale(${viewMode === "horizontal" ? "0.6" : "0.72"});
            margin-bottom: ${viewMode === "horizontal" ? "-251px" : "-287px"};
          }
          .card-capture-vertical {
            transform: scale(0.5);
            margin-bottom: -512px;
          }
        }
      `}</style>
    </main>
  );
}
