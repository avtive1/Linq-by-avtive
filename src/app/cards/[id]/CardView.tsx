"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";
import { CardPreview } from "@/components/CardPreview";
import { CardArtboardScaler } from "@/components/CardArtboardScaler";
import { CARD_ARTBOARD_HORIZONTAL, CARD_ARTBOARD_VERTICAL } from "@/lib/card-preview-scale";
import { ArrowLeft, Download, Share2 } from "lucide-react";
import { toPng } from "html-to-image";
import { waitForCardFontsReadyForCapture } from "@/lib/card-font-runtime";
import { CardData } from "@/types/card";
import { toast } from "sonner";
import { openLinkedInCardShare } from "@/lib/share/linkedin-card-share";
import { logger } from "@/lib/logger-client";

export default function CardView({
  card,
  isShareMode = false,
  initialViewMode = "horizontal",
  impersonateId = "",
  shareToken = "",
}: {
  card: CardData;
  isShareMode?: boolean;
  initialViewMode?: "horizontal" | "vertical";
  impersonateId?: string;
  shareToken?: string;
}) {
  const router = useRouter();
  const [isDownloading, setIsDownloading] = useState(false);
  const [viewMode, setViewMode] = useState<"horizontal" | "vertical">(initialViewMode);
  const [badgeSide, setBadgeSide] = useState<1 | 2>(1);
  const [horizontalPreviewFailed, setHorizontalPreviewFailed] = useState(false);
  const [verticalFrontPreviewFailed, setVerticalFrontPreviewFailed] = useState(false);
  const [verticalBackPreviewFailed, setVerticalBackPreviewFailed] = useState(false);
  const [showBadgeDownloadMenu, setShowBadgeDownloadMenu] = useState(false);
  const [showPostDownloadMenu, setShowPostDownloadMenu] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const verticalFrontExportRef = useRef<HTMLDivElement>(null);
  const verticalBackExportRef = useRef<HTMLDivElement>(null);
  const horizontalPreviewUrl = useMemo(
    () => String(card.cardPreviewUrl || "").trim(),
    [card.cardPreviewUrl],
  );
  const verticalFrontPreviewUrl = useMemo(
    () => String(card.verticalFrontUrl || "").trim(),
    [card.verticalFrontUrl],
  );
  const verticalBackPreviewUrl = useMemo(
    () => String(card.verticalBackUrl || "").trim(),
    [card.verticalBackUrl],
  );
  const backHref = useMemo(() => {
    if (card?.eventId) {
      return impersonateId
        ? `/dashboard/events/${card.eventId}?impersonate=${encodeURIComponent(impersonateId)}`
        : `/dashboard/events/${card.eventId}`;
    }
    return impersonateId ? `/dashboard?impersonate=${encodeURIComponent(impersonateId)}` : "/dashboard";
  }, [card?.eventId, impersonateId]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("cardViewMode");
      if ((saved === "horizontal" || saved === "vertical") && saved !== viewMode) {
        setViewMode(saved);
      }
    } catch {
    }
  }, [viewMode]);

  const changeViewMode = (mode: "horizontal" | "vertical") => {
    setViewMode(mode);
    if (mode === "vertical") {
      setBadgeSide(1);
    }
    try {
      window.localStorage.setItem("cardViewMode", mode);
      document.cookie = `cardViewMode=${mode}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch {
    }
  };

  useEffect(() => {
    setHorizontalPreviewFailed(false);
    setVerticalFrontPreviewFailed(false);
    setVerticalBackPreviewFailed(false);
  }, [card.id, horizontalPreviewUrl, verticalFrontPreviewUrl, verticalBackPreviewUrl]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      await waitForCardFontsReadyForCapture(String(card.fontFamily || "inter"));
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
      logger.error({ err }, "Failed to download card");
      toast.error("Failed to generate download. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadPostPdf = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    setShowPostDownloadMenu(false);
    try {
      await waitForCardFontsReadyForCapture(String(card.fontFamily || "inter"));
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        skipFonts: false,
      });
      const [{ jsPDF }] = await Promise.all([import("jspdf")]);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 8;
      const cardAspect = 628 / 1200;
      let renderWidth = pageWidth - margin * 2;
      let renderHeight = renderWidth * cardAspect;
      if (renderHeight > pageHeight - margin * 2) {
        renderHeight = pageHeight - margin * 2;
        renderWidth = renderHeight / cardAspect;
      }
      const x = (pageWidth - renderWidth) / 2;
      const y = (pageHeight - renderHeight) / 2;
      doc.addImage(dataUrl, "PNG", x, y, renderWidth, renderHeight, undefined, "FAST");
      const filename = `avtive-post-${card?.name?.replace(/\s+/g, "-").toLowerCase() || "attendee"}.pdf`;
      doc.save(filename);
      toast.success("Post PDF downloaded successfully!");
    } catch (err) {
      logger.error({ err }, "Failed to download post PDF");
      toast.error("Failed to generate post PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const getVerticalExports = async () => {
    const blobToDataUrl = (blob: Blob) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read badge image blob."));
        reader.readAsDataURL(blob);
      });
    const getBlobFromUrl = async (url: string) => {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch badge image (${res.status}).`);
      return res.blob();
    };
    const getBlobFromRef = async (ref: HTMLDivElement | null) => {
      if (!ref) throw new Error("Badge previews are not ready yet.");
      await waitForCardFontsReadyForCapture(String(card.fontFamily || "inter"));
      const dataUrl = await toPng(ref, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        skipFonts: false,
      });
      const res = await fetch(dataUrl);
      if (!res.ok) throw new Error("Failed to render badge export image.");
      return res.blob();
    };

    const [frontBlob, backBlob] = await Promise.all([
      verticalFrontPreviewUrl && !verticalFrontPreviewFailed
        ? getBlobFromUrl(verticalFrontPreviewUrl)
        : getBlobFromRef(verticalFrontExportRef.current),
      verticalBackPreviewUrl && !verticalBackPreviewFailed
        ? getBlobFromUrl(verticalBackPreviewUrl)
        : getBlobFromRef(verticalBackExportRef.current),
    ]);
    const [frontDataUrl, backDataUrl] = await Promise.all([blobToDataUrl(frontBlob), blobToDataUrl(backBlob)]);
    return { frontDataUrl, backDataUrl, frontBlob, backBlob };
  };

  const handleDownloadBadgePdf = async () => {
    setIsDownloading(true);
    setShowBadgeDownloadMenu(false);
    try {
      const { frontDataUrl, backDataUrl } = await getVerticalExports();
      const [{ jsPDF }] = await Promise.all([import("jspdf")]);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const addCardPage = (dataUrl: string) => {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        const cardAspect = 1024 / 576;
        let renderWidth = pageWidth - margin * 2;
        let renderHeight = renderWidth * cardAspect;
        if (renderHeight > pageHeight - margin * 2) {
          renderHeight = pageHeight - margin * 2;
          renderWidth = renderHeight / cardAspect;
        }
        const x = (pageWidth - renderWidth) / 2;
        const y = (pageHeight - renderHeight) / 2;
        doc.addImage(dataUrl, "PNG", x, y, renderWidth, renderHeight, undefined, "FAST");
      };
      addCardPage(frontDataUrl);
      doc.addPage("a4", "portrait");
      addCardPage(backDataUrl);
      const filename = `avtive-badge-${card?.name?.replace(/\s+/g, "-").toLowerCase() || "attendee"}.pdf`;
      doc.save(filename);
      toast.success("Badge PDF downloaded successfully!");
    } catch (err) {
      logger.error({ err }, "Failed to download badge PDF");
      toast.error("Failed to generate badge PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadBadgeZip = async () => {
    setIsDownloading(true);
    setShowBadgeDownloadMenu(false);
    try {
      const { frontBlob, backBlob } = await getVerticalExports();
      const [{ default: JSZip }] = await Promise.all([import("jszip")]);
      const zip = new JSZip();
      const base = card?.name?.replace(/\s+/g, "-").toLowerCase() || "attendee";
      zip.file(`${base}-badge-front.png`, frontBlob);
      zip.file(`${base}-badge-back.png`, backBlob);
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = `avtive-badge-${base}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success("Badge ZIP downloaded successfully!");
    } catch (err) {
      logger.error({ err }, "Failed to download badge ZIP");
      toast.error("Failed to generate badge ZIP. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareLinkedIn = () => {
    openLinkedInCardShare({
      cardId: card.id,
      name: card.name,
      eventName: card.eventName,
      role: card.role,
      company: card.company,
      cardRole: card.cardRole,
      organizationName: card.organizationName,
    });
    toast.success("Opening LinkedIn — caption copied to clipboard.");
  };

  return (
    <main className="relative min-h-screen w-full bg-transparent flex flex-col items-center py-12 md:py-16 px-2 sm:px-4 lg:px-6 print:p-0">
      <GradientBackground />

      <div className="no-print relative z-10 w-full max-w-[860px] flex flex-col gap-8 md:gap-10 animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-4">
             {isShareMode ? (
                <div className="flex items-center gap-3">
                   <span className="text-sm font-normal tracking-[0.01em] leading-tight text-muted/65">
                     Avtive attendee portal
                   </span>
                </div>
             ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      router.push(backHref);
                      router.refresh();
                    }}
                    className="inline-flex items-center gap-2.5 text-base font-semibold text-heading hover:text-ink hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-md group py-1 cursor-pointer bg-transparent border-none text-left"
                  >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Back
                  </button>
                </div>
             )}

             {/* View toggles: badge/print must work even without LinkedIn (QR back may be empty). */}
             <div className="flex bg-white/10 p-1 rounded-md w-fit border border-white/20 gap-1">
                <button
                  type="button"
                  onClick={() => changeViewMode("horizontal")}
                  className={`h-12 min-w-[132px] px-4 rounded-md text-sm leading-tight font-semibold tracking-[0.01em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-[0.97] ${viewMode === "horizontal" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted hover:text-heading hover:bg-white/20"}`}
                >
                  Post View
                </button>
                <button
                  type="button"
                  onClick={() => changeViewMode("vertical")}
                  className={`h-12 min-w-[132px] px-4 rounded-md text-sm leading-tight font-semibold tracking-[0.01em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-[0.97] ${viewMode === "vertical" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted hover:text-heading hover:bg-white/20"}`}
                >
                  Badge View
                </button>
             </div>
          </div>

          <div className="flex items-center gap-3">
            {isShareMode && shareToken && (
              <Button
                href={`/cards/${card.id}/edit?share=true&token=${encodeURIComponent(shareToken)}`}
                variant="secondary"
                className="shadow-lg flex-1 md:flex-initial h-12 px-4 min-w-[116px]"
              >
                Edit
              </Button>
            )}
            {viewMode === "horizontal" && (
              <Button
                onClick={handleShareLinkedIn}
                disabled={isDownloading}
                variant="blue"
                icon={<Share2 size={16} />}
                className="shadow-lg flex-1 md:flex-initial h-12 px-4 min-w-[116px]"
              >
                Share
              </Button>
            )}
            {viewMode === "vertical" ? (
              <div className="relative">
                <Button
                  onClick={() => setShowBadgeDownloadMenu((prev) => !prev)}
                  disabled={isDownloading}
                  variant="secondary"
                  icon={<Download size={18} />}
                  className="shadow-lg flex-1 md:flex-initial h-12 px-4 min-w-[132px]"
                >
                  {isDownloading ? "Preparing…" : "Download"}
                </Button>
                {showBadgeDownloadMenu && (
                  <div className="absolute right-0 mt-2 w-52 rounded-md border border-border/70 bg-white shadow-xl z-50 overflow-hidden">
                    <button
                      type="button"
                      onClick={handleDownloadBadgePdf}
                      className="w-full px-4 py-2.5 text-left text-sm text-heading hover:bg-slate-50 transition-colors"
                    >
                      Download as PDF
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadBadgeZip}
                      className="w-full px-4 py-2.5 text-left text-sm text-heading hover:bg-slate-50 transition-colors border-t border-border/60"
                    >
                      Download as ZIP
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <Button
                  onClick={() => setShowPostDownloadMenu((prev) => !prev)}
                  disabled={isDownloading}
                  icon={<Download size={18} />}
                  className="shadow-lg shadow-black/10 flex-1 md:flex-initial h-12 px-4 min-w-[132px]"
                >
                  {isDownloading ? "Preparing…" : "Download"}
                </Button>
                {showPostDownloadMenu && (
                  <div className="absolute right-0 mt-2 w-52 rounded-md border border-border/70 bg-white shadow-xl z-50 overflow-hidden">
                    <button
                      type="button"
                      onClick={handleDownloadPostPdf}
                      className="w-full px-4 py-2.5 text-left text-sm text-heading hover:bg-slate-50 transition-colors"
                    >
                      Download as PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPostDownloadMenu(false);
                        void handleDownload();
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-heading hover:bg-slate-50 transition-colors border-t border-border/60"
                    >
                      Download as Image
                    </button>
                  </div>
                )}
              </div>
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
          <div ref={verticalFrontExportRef} style={{ width: "576px", height: "1024px" }}>
            <CardPreview data={card} isVertical verticalSide={1} />
          </div>
          <div ref={verticalBackExportRef} style={{ width: "576px", height: "1024px" }}>
            <CardPreview data={card} isVertical verticalSide={2} />
          </div>
        </div>

        <div className="w-full flex flex-col items-center gap-6">
          {viewMode === "horizontal" ? (
            <CardArtboardScaler
              artboardWidth={CARD_ARTBOARD_HORIZONTAL.width}
              artboardHeight={CARD_ARTBOARD_HORIZONTAL.height}
              className="w-full max-w-[860px]"
              maxScale={0.82}
            >
              {horizontalPreviewUrl && !horizontalPreviewFailed ? (
                // eslint-disable-next-line @next/next/no-img-element -- Remote preview URL from storage; next/image would need allowlist churn
                <img
                  src={horizontalPreviewUrl}
                  alt="Horizontal card preview"
                  className="h-full w-full object-contain"
                  loading="eager"
                  onError={() => setHorizontalPreviewFailed(true)}
                />
              ) : (
                <CardPreview data={card} isVertical={false} />
              )}
            </CardArtboardScaler>
          ) : (
            <>
              <div className="flex bg-white/10 p-1 rounded-md w-fit border border-white/20 gap-1">
                <button
                  type="button"
                  onClick={() => setBadgeSide(1)}
                  className={`h-9 min-w-[108px] px-4 rounded-md text-sm font-semibold tracking-[0.01em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-[0.97] ${badgeSide === 1 ? "bg-primary text-primary-foreground shadow-lg" : "text-muted hover:text-heading hover:bg-white/20"}`}
                >
                  Front
                </button>
                <button
                  type="button"
                  onClick={() => setBadgeSide(2)}
                  className={`h-9 min-w-[108px] px-4 rounded-md text-sm font-semibold tracking-[0.01em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-[0.97] ${badgeSide === 2 ? "bg-primary text-primary-foreground shadow-lg" : "text-muted hover:text-heading hover:bg-white/20"}`}
                >
                  Back
                </button>
              </div>
              <CardArtboardScaler
                artboardWidth={CARD_ARTBOARD_VERTICAL.width}
                artboardHeight={CARD_ARTBOARD_VERTICAL.height}
                className="w-full max-w-[395px]"
                maxScale={0.72}
              >
                <CardPreview data={card} isVertical verticalSide={badgeSide} />
              </CardArtboardScaler>
            </>
          )}
        </div>

        <div className="text-center flex flex-col gap-2">
          <p className="text-sm text-slate-400 font-normal leading-[1.6]">
            {viewMode === "horizontal" 
               ? "This design is optimized for LinkedIn posts and social sharing."
               : "This design is optimized for physical printing and event registration."
            }
          </p>
          <span className="text-[13px] font-normal tracking-[0.01em] leading-tight text-heading/45">
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
           .no-print, .no-print * { display: none !important; }
           .print-only {
              display: flex !important;
              flex-direction: row;
              justify-content: center;
              align-items: flex-start;
           }
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
      `}</style>
    </main>
  );
}
