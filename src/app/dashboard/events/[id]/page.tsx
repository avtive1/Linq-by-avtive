"use client";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";
import { pb } from "@/lib/pocketbase";
import { Plus, Users, Calendar, MapPin, Search, Trash2, Download, ArrowLeft, User, ExternalLink, BarChart3 } from "lucide-react";
import { CardData, EventData } from "@/types/card";

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [eventData, setEventData] = useState<EventData | null>(null);
  const [cards, setCards] = useState<CardData[]>([]);
  const [filteredCards, setFilteredCards] = useState<CardData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.replace("/login");
      return;
    }

    const fetchEventData = async () => {
      setIsLoading(true);
      try {
        // Fetch Event Details
        const eventRecord = await pb.collection("events").getOne(id, { $autoCancel: false });
        setEventData({
          id: eventRecord.id,
          name: eventRecord.name,
          location: eventRecord.location,
          date: eventRecord.date,
        });

        // Fetch Attendees for this event
        // Note: Filtering by eventId. For legacy records, we might also filter by eventName if needed.
        const attendeeRecords = await pb.collection("attendees").getFullList({
          sort: '-created',
          filter: `eventId = "${id}"`,
          $autoCancel: false,
        });
        
        const mappedCards = attendeeRecords.map(r => ({
          id: r.id,
          name: r.name,
          role: r.role,
          company: r.company,
          email: r.cardEmail,
          eventName: r.eventName,
          sessionDate: r.sessionDate,
          location: r.location,
          track: r.track,
          year: r.year,
          linkedin: r.linkedin,
          eventId: r.eventId,
          photo: r.photo ? `${pb.baseUrl}/api/files/attendees/${r.id}/${r.photo}` : undefined,
        }));
        
        setCards(mappedCards);
        setFilteredCards(mappedCards);

      } catch (err) {
        console.error("Error fetching event data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEventData();
  }, [id, router]);

  useEffect(() => {
    const filtered = cards.filter(card => {
      const searchStr = `${card.name} ${card.company} ${card.role}`.toLowerCase();
      return searchStr.includes(searchQuery.toLowerCase());
    });
    setFilteredCards(filtered);
  }, [searchQuery, cards]);

  const handleDelete = async (cardId: string) => {
    if (!confirm("Are you sure you want to delete this attendee card?")) return;
    
    try {
      await pb.collection("attendees").delete(cardId);
      setCards(prev => prev.filter(c => c.id !== cardId));
    } catch (err) {
      console.error("Error deleting card:", err);
      alert("Failed to delete card.");
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
      <main className="relative min-h-screen w-full bg-white flex items-center justify-center">
        <GradientBackground />
        <div className="relative z-10 text-muted">Loading event details...</div>
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
    <main className="relative min-h-screen w-full bg-white">
      <GradientBackground />

      <div className="relative z-10 max-w-[860px] mx-auto px-4 sm:px-6 py-10 sm:py-16 md:py-20">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 mb-10 sm:mb-12">
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
            <div className="flex items-center gap-4 text-sm text-muted mt-1">
              <span className="flex items-center gap-1.5"><Calendar size={14} className="opacity-60" /> {eventData.date}</span>
              <span className="flex items-center gap-1.5"><MapPin size={14} className="opacity-60" /> {eventData.location}</span>
            </div>
          </div>

          <div className="flex gap-2.5 sm:gap-3 items-center">
            <Link href={`/cards/new?eventId=${eventData.id}`}>
              <Button icon={<Plus size={18} />}>Create Card</Button>
            </Link>
          </div>
        </div>

        {/* Stats Section */}
        <div className="bg-white/50 backdrop-blur-sm border border-border p-6 rounded-3xl flex items-center justify-between shadow-sm mb-10">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Users size={24} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold text-muted uppercase tracking-[0.1em]">Event Attendees</span>
              <span className="text-2xl font-bold text-heading tracking-tight">{cards.length}</span>
            </div>
          </div>
          {cards.length > 0 && (
            <Button 
              variant="secondary" 
              onClick={handleExport}
              icon={<Download size={16} />}
              className="hidden sm:flex"
            >
              Export Event
            </Button>
          )}
        </div>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted/50" size={18} />
            <input
              type="text"
              placeholder="Search attendees in this event..."
              className="w-full pl-11 pr-4 py-3 bg-white border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Cards list */}
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 sm:py-32 bg-surface/30 border border-dashed border-border rounded-3xl gap-4 px-6">
            <div className="flex flex-col gap-1">
              <p className="text-heading font-medium">No attendees yet</p>
              <p className="text-sm text-muted">Create the first card for this event.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredCards.length > 0 ? (
              filteredCards.map((card) => (
                <div
                  key={card.id}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-border p-4 sm:p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-primary/20 transition-all"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center text-slate-300">
                      {card.photo ? (
                        <img src={card.photo} alt={card.name} className="w-full h-full object-cover" />
                      ) : (
                        <User size={18} strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-base sm:text-lg text-heading group-hover:text-primary transition-colors truncate">
                          {card.name}
                        </h3>
                        <span className="text-[10px] bg-surface px-1.5 py-0.5 rounded border border-border text-muted font-bold uppercase tracking-tighter shrink-0">
                          {card.company}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted font-medium uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <BarChart3 size={11} className="text-primary/60" />
                          {card.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link href={`/cards/${card.id}`} className="flex-shrink-0">
                      <Button variant="secondary" size="sm" icon={<ExternalLink size={14} />}>
                        View
                      </Button>
                    </Link>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={() => handleDelete(card.id)}
                      className="px-2 text-muted hover:text-red-500 hover:border-red-200"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-surface/20 rounded-2xl border border-dashed border-border">
                <p className="text-muted text-sm">No cards found matching your search.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
