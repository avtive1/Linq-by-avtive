"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";
import { Plus, LogOut, ExternalLink, Calendar, MapPin, User } from "lucide-react";
import { CardData } from "@/types/card";

export default function DashboardPage() {
  const router = useRouter();
  const [cards, setCards] = useState<CardData[]>([]);
  const [userName, setUserName] = useState("");

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    // Guard: redirect to login if not signed up
    const user = localStorage.getItem("avtive_user");
    if (!user) {
      router.replace("/login");
      return;
    }
    try {
      const parsed = JSON.parse(user);
      setUserName(parsed.email?.split("@")[0] || "");
    } catch {}

    const stored = localStorage.getItem("avtive_cards");
    if (stored) {
      try {
        setCards(JSON.parse(stored));
      } catch (err) {
        console.error("Error parsing cards:", err);
      }
    }
  }, [router]);

  const handleLogout = () => {
    // Clear session and go to login
    localStorage.removeItem("avtive_user");
    router.push("/login");
  };

  return (
    <main className="relative min-h-screen w-full bg-white">
      <GradientBackground />

      <div className="relative z-10 max-w-[860px] mx-auto px-4 sm:px-6 py-10 sm:py-16 md:py-20">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 mb-10 sm:mb-12">
          <div className="flex flex-col gap-1 sm:gap-2">
            <span className="text-[12px] font-bold tracking-[0.2em] text-muted/40 uppercase">
              AVTIVE
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold text-heading tracking-tight">
              Your Cards
            </h1>
            {userName && (
              <p className="text-sm text-muted flex items-center gap-1.5">
                <User size={13} className="text-primary/50" />
                {userName}
              </p>
            )}
          </div>

          <div className="flex gap-3 items-center">
            <Link href="/cards/new">
              <Button icon={<Plus size={18} />}>New card</Button>
            </Link>
            <Button
              variant="secondary"
              onClick={handleLogout}
              className="px-3"
              icon={<LogOut size={18} />}
            >
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>

        {/* Cards list */}
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 sm:py-32 bg-surface/30 border border-dashed border-border rounded-3xl gap-4 px-6">
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
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-border p-4 sm:p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-primary/20 transition-all"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center text-slate-300">
                    {card.photo ? (
                      <img src={card.photo} alt={card.name} className="w-full h-full object-cover" />
                    ) : (
                      <User size={18} strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <h3 className="font-semibold text-base sm:text-lg text-heading group-hover:text-primary transition-colors truncate">
                      {card.eventName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted font-medium uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} className="text-primary/60" />
                        {card.sessionDate || card.year}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={11} className="text-primary/60" />
                        {card.location}
                      </span>
                    </div>
                  </div>
                </div>

                <Link href={`/cards/${card.id}`} className="flex-shrink-0">
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