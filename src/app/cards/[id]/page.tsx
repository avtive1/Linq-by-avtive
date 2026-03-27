"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";
import { CardPreview } from "@/components/CardPreview";
import { ArrowLeft, Download, Info } from "lucide-react";

import { CardData } from "@/types/card";

export default function CardViewPage() {
  const { id } = useParams<{ id: string }>();
  const [card, setCard] = useState<CardData | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const handleDownload = () => {
    window.print();
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
            <p className="text-sm text-muted">The card you're looking for doesn't exist.</p>
          </div>
          <Link href="/dashboard" className="mt-2">
            <Button variant="secondary">Back to Dashboard</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen w-full bg-white flex flex-col items-center py-20 px-6 overflow-hidden">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[860px] flex flex-col gap-12">
        {/* Top Nav */}
        <div className="flex items-center justify-between no-print">
          <Link 
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-primary transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Dashboard
          </Link>

          <Button 
            onClick={handleDownload}
            icon={<Download size={18} />}
            className="shadow-lg shadow-primary/20"
          >
            Download Card
          </Button>
        </div>

        {/* Card Display */}
        <div className="flex flex-col items-center gap-8">
          <div className="print:m-0 print:shadow-none print:border-none">
            <CardPreview data={card} id="printable-card" />
          </div>
          
          <div className="no-print max-w-sm text-center flex flex-col gap-3">
            <p className="text-sm text-muted leading-relaxed">
              This card is generated in high resolution. Click download to save it as a PDF or Print it.
            </p>
            <span className="text-[10px] font-bold tracking-[0.2em] text-muted/30 uppercase">
              Badge ID: {card.id.slice(-6)}
            </span>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; padding: 0; }
          main { padding: 0 !important; min-height: auto !important; }
          #printable-card {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vw;
            max-width: none;
            border: none;
            border-radius: 0;
            box-shadow: none;
          }
        }
      `}</style>
    </main>
  );
}