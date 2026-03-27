"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";
import { Plus, LogOut, ExternalLink, Calendar, MapPin } from "lucide-react";
import { CardData } from "@/types/card";

export default function DashboardPage() {
  const router = useRouter();
  const [cards, setCards] = useState<CardData[]>([]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    const stored = localStorage.getItem("avtive_cards");
    if (stored) {
      try {
        const parsedCards = JSON.parse(stored);
        setCards(parsedCards);
      } catch (error) {
        console.error("Error parsing cards from localStorage:", error);
      }
    }
  }, []);

  const handleLogout = () => {
    router.push("/");
  };

  return (
    <main className="relative min-h-screen w-full bg-white">
      <GradientBackground />

      <div className="relative z-10 max-w-[860px] mx-auto px-6 py-20">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-bold tracking-[0.2em] text-muted/40 uppercase">
              AVTIVE
            </span>
            <h1 className="text-4xl font-bold text-heading tracking-tight">Your Cards</h1>
          </div>

          <div className="flex gap-3 items-center">
            <Link href="/cards/new">
              <Button icon={<Plus size={18} />}>New card</Button>
            </Link>
            <Button variant="secondary" onClick={handleLogout} className="px-3">
              <LogOut size={18} />
            </Button>
          </div>
        </div>

        {/* Cards list */}
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-32 bg-surface/30 border border-dashed border-border rounded-3xl gap-4">
            <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-muted/40">
              <Plus size={24} />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-heading font-medium">No cards yet</p>
              <p className="text-sm text-muted">Create your first card to start networking.</p>
            </div>
            <Link href="/cards/new" className="mt-2">
              <Button variant="secondary">Create Card</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {cards.map((card) => (
              <div
                key={card.id}
                className="group flex items-center justify-between bg-white border border-border p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-primary/20 transition-all"
              >
                <div className="flex flex-col gap-2">
                  <h3 className="font-semibold text-lg text-heading group-hover:text-primary transition-colors">
                    {card.eventName}
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-muted font-medium uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} className="text-primary/60" />
                      {card.year}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-primary/60" />
                      {card.location}
                    </span>
                  </div>
                </div>

                <Link href={`/cards/${card.id}`}>
                  <Button variant="secondary" size="sm" icon={<ExternalLink size={14} />}>
                    View
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}