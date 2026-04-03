"use client";
import { useState, useEffect, use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { Button, Skeleton, AnimatedCounter } from "@/components/ui";
import { supabase, getFileUrl as getSupabaseFileUrl } from "@/lib/supabase";
import { Plus, Users, Calendar, MapPin, Search, Trash2, Download, ArrowLeft, User, ExternalLink, BarChart3, Link as LinkIcon } from "lucide-react";
import { CardData, EventData } from "@/types/card";
import { toast } from "sonner";

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [eventData, setEventData] = useState<EventData | null>(null);
  const [cards, setCards] = useState<CardData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      fetchEventData();
    };

    const fetchEventData = async () => {
      if (!id || id === "id") return; 
      
      setIsLoading(true);
      try {
        const { data: eventRecord, error: eventError } = await supabase
          .from("events")
          .select("*")
          .eq("id", id)
          .single();

        if (eventError) throw eventError;

        setEventData({
          id: eventRecord.id,
          name: eventRecord.name,
          location: eventRecord.location,
          date: eventRecord.date,
        });

        const { data: attendeeRecords, error: attendeeError } = await supabase
          .from("attendees")
          .select("*")
          .eq("event_id", id)
          .order('created_at', { ascending: false });

        if (attendeeError) throw attendeeError;
        
        const mappedCards = (attendeeRecords || []).map(r => ({
          id: r.id,
          name: r.name,
          role: r.role || "Attendee",
          company: r.company,
          email: r.card_email,
          eventName: r.event_name,
          sessionDate: r.session_date,
          location: r.location,
          track: r.track,
          year: r.year,
          linkedin: r.linkedin,
          event_id: r.event_id,
          photo: r.photo_url ? getSupabaseFileUrl("attendee_photos", r.photo_url) : undefined,
        }));
        
        setCards(mappedCards);

      } catch (err: any) {
        console.error("Supabase Fetch Error:", err.message || err);
        toast.error(`Error: ${err.message || "Failed to load event data"}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkUser();
  }, [id, router]);

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return cards;
    
    return cards.filter(card => {
      const name = (card.name || "").toLowerCase();
      const company = (card.company || "").toLowerCase();
      const role = (card.role || "").toLowerCase();
      // Concatenate for a broader search matches
      const searchBlob = `${name} ${company} ${role}`;
      return searchBlob.includes(query);
    });
  }, [searchQuery, cards]);

  const handleDelete = async (cardId: string) => {
    if (!confirm("Are you sure you want to delete this attendee card?")) return;
    
    try {
      const { error } = await supabase.from("attendees").delete().eq("id", cardId);
      if (error) throw error;
      
      setCards(prev => prev.filter(c => c.id !== cardId));
      toast.success("Card deleted successfully.");
    } catch (err) {
      console.error("Error deleting card:", err);
      toast.error("Failed to delete card.");
    }
  };

  const handleExport = () => {
    if (filteredCards.length === 0) return;
    
    const headers = ["Name", "Role", "Company", "Email", "Event", "Date", "Location", "LinkedIn"];
    const rows = filteredCards.map(c => [
      c.name,
      c.role,
      c.company,
      c.email,
      c.eventName,
      c.sessionDate || c.year,
      c.location,
      c.linkedin ? `https://linkedin.com/in/${c.linkedin}` : ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${eventData?.name || 'event'}-attendees-export.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <main className="relative min-h-screen w-full bg-transparent flex flex-col items-center">
        <GradientBackground />
        <div className="relative z-10 w-full max-w-[1240px] px-4 sm:px-6 py-10 sm:py-16 md:py-20">
          <div className="flex flex-col gap-6 mb-12">
            <Skeleton className="w-24 h-4" />
            <Skeleton className="w-64 h-12" />
            <div className="flex gap-4">
              <Skeleton className="w-32 h-6" />
              <Skeleton className="w-32 h-6" />
            </div>
          </div>
          
          <Skeleton className="w-full h-32 rounded-[32px] mb-10" />
          <Skeleton className="w-full h-14 rounded-2xl mb-8" />
          
          <div className="flex flex-col gap-4">
            <Skeleton className="w-full h-24 rounded-[28px]" />
            <Skeleton className="w-full h-24 rounded-[28px]" />
            <Skeleton className="w-full h-24 rounded-[28px]" />
          </div>
        </div>
      </main>
    );
  }

  if (!eventData) {
    return (
      <main className="relative min-h-screen w-full bg-white flex flex-col items-center justify-center gap-4">
        <GradientBackground />
        <div className="relative z-10 text-xl font-bold text-heading">Event not found</div>
        <Link href="/dashboard" className="relative z-10">
          <Button variant="secondary" icon={<ArrowLeft size={16} />}>Back to Dashboard</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen w-full bg-transparent">
      <GradientBackground />

      <div className="relative z-10 max-w-[1240px] mx-auto px-4 sm:px-6 py-10 sm:py-16 md:py-20">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 mb-10 sm:mb-12 animate-slide-up">
          <div className="flex flex-col gap-1 sm:gap-2">
            <Link 
              href="/dashboard" 
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:opacity-80 transition-all mb-1 group"
            >
              <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
              BACK TO DASHBOARD
            </Link>
            <span className="text-[12px] font-bold tracking-[0.2em] text-muted/40 uppercase">
              EVENT DETAILS
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold text-heading tracking-tight">
              {eventData.name}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted mt-1 font-medium">
              <span className="flex items-center gap-1.5 bg-white/50 px-2 py-1 rounded-lg border border-white/40 shadow-sm"><Calendar size={13} className="text-primary/60" /> {eventData.date}</span>
              <span className="flex items-center gap-1.5 bg-white/50 px-2 py-1 rounded-lg border border-white/40 shadow-sm"><MapPin size={13} className="text-primary/60" /> {eventData.location}</span>
            </div>
          </div>

          <div className="flex gap-2.5 sm:gap-3 items-center">
            <Button 
              variant="secondary" 
              onClick={() => {
                const url = `${window.location.origin}/cards/new?eventId=${eventData.id}&share=true`;
                navigator.clipboard.writeText(url);
                setCopied(true);
                toast.success("Registration link copied!");
                setTimeout(() => setCopied(false), 2000);
              }}
              icon={copied ? <Plus size={18} className="rotate-45 text-primary" /> : <LinkIcon size={18} />}
              className={`hidden sm:flex transition-all duration-300 ${copied ? "border-primary/40 bg-primary/5" : ""}`}
            >
              {copied ? "Copied!" : "Share Link"}
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => {
                const url = `${window.location.origin}/cards/new?eventId=${eventData.id}&share=true`;
                navigator.clipboard.writeText(url);
                toast.success("Link copied!");
              }}
              icon={<LinkIcon size={18} />}
              className="flex sm:hidden px-3"
            >
              <span className="sr-only">Share Form Link</span>
            </Button>
            <Link href={`/cards/new?eventId=${eventData.id}`}>
              <Button icon={<Plus size={18} />}>
                <span className="hidden sm:inline">Create Card</span>
                <span className="inline sm:hidden">New</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Section */}
        <div className="glass-panel p-6 sm:p-8 rounded-[32px] flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-sm mb-10 animate-slide-up delay-100">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 shrink-0">
              <Users size={28} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold text-muted uppercase tracking-[0.2em]">Live Attendees</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-heading tracking-tight">
                  <AnimatedCounter value={cards.length} />
                </span>
                <span className="text-sm font-semibold text-primary">Generated Cards</span>
              </div>
            </div>
          </div>
          {cards.length > 0 && (
            <Button 
              variant="secondary" 
              onClick={handleExport}
              icon={<Download size={18} />}
              className="bg-white/80 hover:bg-white shadow-sm border-white/60"
            >
              Export CSV
            </Button>
          )}
        </div>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 animate-slide-up delay-200">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={18} />
            <input
              type="text"
              placeholder="Search attendees in this event..."
              className="w-full pl-11 pr-4 py-3.5 bg-white/70 backdrop-blur-md border border-white/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white transition-all text-sm shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Cards list */}
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 sm:py-32 bg-surface/30 border border-dashed border-border rounded-[32px] gap-4 px-6 animate-slide-up delay-300">
            <div className="flex flex-col gap-1">
              <p className="text-heading font-bold text-lg">No attendees yet</p>
              <p className="text-sm text-muted">Create the first card for this event to see it here.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3.5 animate-slide-up delay-300">
            {filteredCards.length > 0 ? (
              filteredCards.map((card) => (
                <div
                  key={card.id}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-4 sm:p-6 rounded-[28px] transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30"
                >
                  <div className="flex items-center gap-5 min-w-0">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl bg-white border border-border overflow-hidden flex-shrink-0 flex items-center justify-center text-slate-300 shadow-sm group-hover:scale-105 transition-transform duration-500">
                        {card.photo ? (
                          <img src={card.photo} alt={card.name} className="w-full h-full object-cover" />
                        ) : (
                          <User size={24} strokeWidth={1.5} className="text-primary/30" />
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-white font-bold border-2 border-white">
                        {card.name.charAt(0)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-base sm:text-xl text-heading group-hover:text-primary transition-colors truncate">
                          {card.name}
                        </h3>
                        {card.company && (
                          <span className="text-[10px] bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10 text-primary font-bold uppercase tracking-tight shrink-0">
                            {card.company}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted font-bold uppercase tracking-[0.1em]">
                        <span className="flex items-center gap-1.5">
                          <BarChart3 size={12} className="text-primary/50" />
                          {card.role}
                        </span>
                        {card.email && (
                          <span className="hidden sm:inline-flex items-center gap-1.5 lowercase font-medium tracking-normal opacity-60">
                            • {card.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3">
                    <Link href={`/cards/${card.id}`} className="flex-shrink-0">
                      <Button variant="secondary" size="sm" icon={<ExternalLink size={14} />} className="rounded-xl h-10 px-4 font-bold text-xs bg-white/50 border-white/60">
                        View Card
                      </Button>
                    </Link>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={() => handleDelete(card.id)}
                      className="w-10 h-10 p-0 rounded-xl text-muted hover:text-red-500 hover:bg-red-50/50 hover:border-red-200 transition-all shrink-0"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 glass-panel rounded-[32px] border-dashed">
                <p className="text-muted font-medium">No results found for &ldquo;{searchQuery}&rdquo;</p>
              </div>
            )}
          </div>
        )
}
      </div>
    </main>
  );
}
