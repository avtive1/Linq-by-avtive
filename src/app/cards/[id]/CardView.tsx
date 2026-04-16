"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";
import { CardPreview } from "@/components/CardPreview";
import { ArrowLeft, Download, Share2, Printer, RefreshCw } from "lucide-react";
import { toPng } from "html-to-image";
import { CardData } from "@/types/card";
import { toast } from "sonner";

export default function CardView({ card, isShareMode = false }: { card: CardData; isShareMode?: boolean }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [viewMode, setViewMode] = useState<"horizontal" | "vertical">("horizontal");
  const [verticalSide, setVerticalSide] = useState<1 | 2>(1);
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
    // We set the view mode to vertical and side 1 for printing
    setViewMode("vertical");
    setTimeout(() => {
        window.print();
    }, 500);
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
    <main className="relative min-h-screen w-full bg-transparent flex flex-col items-center py-8 md:py-12 px-4 sm:px-6 overflow-x-hidden print:p-0">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[860px] flex flex-col gap-8 md:gap-10 animate-slide-up print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-4">
             {isShareMode ? (
                <div className="flex items-center gap-3">
                   <span className="text-[16px] font-bold tracking-[0.2em] text-muted/50 uppercase">
                     AVTIVE ATTENDEE PORTAL
                   </span>
                </div>
             ) : (
                <div className="flex items-center gap-3">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-heading hover:text-primary-strong transition-all group"
                  >
                    <ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" />
                    HOME
                  </Link>
                  <span className="text-muted/20">/</span>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-heading hover:text-primary-strong transition-all group"
                  >
                    DASHBOARD
                  </Link>
                </div>
             )}

             {/* View Toggles */}
             {card.linkedin && (
                <div className="flex bg-white/5 p-1 rounded-xl w-fit border border-white/10">
                   <button 
                      onClick={() => setViewMode("horizontal")}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === "horizontal" ? "bg-primary text-white shadow-lg" : "text-muted hover:text-heading"}`}
                   >
                      Post View
                   </button>
                   <button 
                      onClick={() => setViewMode("vertical")}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === "vertical" ? "bg-primary text-white shadow-lg" : "text-muted hover:text-heading"}`}
                   >
                      Badge View
                   </button>
                </div>
             )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleShareLinkedIn}
              disabled={isDownloading}
              variant="blue"
              icon={<Share2 size={16} />}
              className="shadow-lg flex-1 md:flex-initial min-w-[140px]"
            >
              Share
            </Button>
            {viewMode === "vertical" ? (
               <Button
                  onClick={handlePrint}
                  disabled={isDownloading}
                  variant="secondary"
                  icon={<Printer size={18} />}
                  className="shadow-lg flex-1 md:flex-initial min-w-[140px]"
               >
                  Print Badge
               </Button>
            ) : (
               <Button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  icon={<Download size={18} />}
                  className="shadow-lg shadow-primary/20 flex-1 md:flex-initial min-w-[140px]"
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
               verticalSide={verticalSide} 
            />
          </div>
        </div>

        <div className="w-full flex flex-col items-center gap-6">
          <div className="card-scale-wrapper w-full">
            <div
              className="card-capture"
              style={{ width: viewMode === "horizontal" ? "1200px" : "576px", height: viewMode === "horizontal" ? "628px" : "1024px" }}
            >
              <CardPreview 
                 data={card} 
                 isVertical={viewMode === "vertical"} 
                 verticalSide={verticalSide} 
              />
            </div>
          </div>

          {viewMode === "vertical" && (
             <div className="flex gap-4">
                <Button 
                   variant={verticalSide === 1 ? "primary" : "secondary"}
                   size="sm"
                   onClick={() => setVerticalSide(1)}
                   icon={<RefreshCw size={14} />}
                   className="h-10 px-6 rounded-full"
                >
                   Flip to Side 2 (QR)
                </Button>
             </div>
          )}
        </div>

        <div className="text-center flex flex-col gap-2">
          <p className="text-sm text-slate-400 font-medium leading-relaxed">
            {viewMode === "horizontal" 
               ? "This design is optimized for LinkedIn posts and social sharing."
               : "This design is optimized for physical printing and event registration."
            }
          </p>
          <span className="text-[10px] font-bold tracking-[0.25em] text-heading/30 uppercase">
            Attendee ID: {card.id.slice(-8).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Printer optimized container */}
      <div className="hidden print:block w-full h-full">
         <div className="flex flex-col items-center gap-12 py-8">
            <div style={{ width: "400px", height: "600px" }}>
               <CardPreview data={card} isVertical verticalSide={1} />
            </div>
            <div style={{ width: "400px", height: "600px" }}>
               <CardPreview data={card} isVertical verticalSide={2} />
            </div>
         </div>
      </div>

      <style>{`
        @media print {
           @page { margin: 0; size: auto; }
           body { margin: 1cm; background: white !important; }
           main { background: white !important; padding: 0 !important; }
        }
        .card-scale-wrapper {
          display: flex;
          justify-content: center;
          overflow: visible;
        }
        .card-capture {
          transform-origin: top center;
        }
        @media (max-width: 1024px) {
          .card-scale-wrapper { overflow: hidden; }
          .card-capture {
            transform: scale(calc((100vw - 32px) / ${viewMode === "horizontal" ? "1200" : "400"}));
            margin-bottom: calc((${viewMode === "horizontal" ? "628px" : "600px"} * ((100vw - 32px) / ${viewMode === "horizontal" ? "1200" : "400"})) - ${viewMode === "horizontal" ? "628px" : "600px"});
          }
        }
        @media (min-width: 1025px) {
          .card-capture {
            transform: scale(${viewMode === "horizontal" ? "0.6" : "1"});
            margin-bottom: ${viewMode === "horizontal" ? "-251px" : "0"};
          }
        }
      `}</style>
    </main>
  );
}
