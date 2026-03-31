"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";
import { pb } from "@/lib/pocketbase";
import { Plus, LogOut, ExternalLink, Calendar, MapPin, User, Search, Trash2, TrendingUp, Users, BarChart3, Download } from "lucide-react";
import { CardData } from "@/types/card";

export default function DashboardPage() {
  const router = useRouter();
  const [cards, setCards] = useState<CardData[]>([]);
  const [filteredCards, setFilteredCards] = useState<CardData[]>([]);
  const [userName, setUserName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalAttendees: 0,
    eventBreakdown: [] as { name: string; count: number; year: string }[],
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.replace("/login");
      return;
    }
    
    setUserName(pb.authStore.model?.email?.split("@")[0] || "");

    const fetchCards = async () => {
      try {
        const records = await pb.collection("attendees").getFullList({
          sort: '-created',
          $autoCancel: false,
        });
        
        const mappedCards = records.map(r => ({
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
          photo: r.photo ? `${pb.baseUrl}/api/files/attendees/${r.id}/${r.photo}` : undefined,
        }));
        
        setCards(mappedCards);
        setFilteredCards(mappedCards);
        
        // Calculate Statistics
        const eventMap = new Map<string, { name: string; count: number; year: string }>();
        mappedCards.forEach(card => {
          const key = `${card.eventName}-${card.year}`;
          if (eventMap.has(key)) {
            eventMap.get(key)!.count++;
          } else {
            eventMap.set(key, { name: card.eventName, count: 1, year: card.year });
          }
        });

        setStats({
          totalEvents: eventMap.size,
          totalAttendees: mappedCards.length,
          eventBreakdown: Array.from(eventMap.values()).sort((a, b) => b.count - a.count),
        });

      } catch (err) {
        console.error("Error fetching cards:", err);
      }
    };
    
    fetchCards();
  }, [router]);

  useEffect(() => {
    const filtered = cards.filter(card => {
      const searchStr = `${card.name} ${card.eventName} ${card.company} ${card.year}`.toLowerCase();
      return searchStr.includes(searchQuery.toLowerCase());
    });
    setFilteredCards(filtered);
  }, [searchQuery, cards]);

  const handleLogout = () => {
    pb.authStore.clear();
    router.push("/login");
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
    link.download = `attendees-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this attendee card?")) return;
    
    try {
      await pb.collection("attendees").delete(id);
      setCards(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error("Error deleting card:", err);
      alert("Failed to delete card.");
    }
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
              Dashboard
            </h1>
            {userName && (
              <p className="text-sm text-muted flex items-center gap-1.5">
                <User size={13} className="text-primary/50" />
                {userName}
              </p>
            )}
          </div>

          <div className="flex gap-3 items-center">
             <Link href="/">
              <Button variant="secondary">Home</Button>
            </Link>
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
        
        {/* Statistics Section */}
        {cards.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            <div className="bg-white/50 backdrop-blur-sm border border-border p-6 rounded-3xl flex items-center gap-5 shadow-sm transition-all hover:shadow-md hover:bg-white/80">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <BarChart3 size={24} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold text-muted uppercase tracking-[0.1em]">Total Events</span>
                <span className="text-2xl font-bold text-heading tracking-tight">{stats.totalEvents}</span>
              </div>
            </div>
            
            <div className="bg-white/50 backdrop-blur-sm border border-border p-6 rounded-3xl flex items-center gap-5 shadow-sm transition-all hover:shadow-md hover:bg-white/80">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Users size={24} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold text-muted uppercase tracking-[0.1em]">Total Attendees</span>
                <span className="text-2xl font-bold text-heading tracking-tight">{stats.totalAttendees}</span>
              </div>
            </div>
          </div>
        )}

        {/* Improved Event Breakdown Grid */}
        {stats.eventBreakdown.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-4 px-1">
              <TrendingUp size={16} className="text-primary" />
              <h2 className="text-[13px] font-bold text-heading uppercase tracking-widest">Event Performance</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stats.eventBreakdown.map((evt, i) => (
                <div 
                  key={i} 
                  className="flex justify-between items-center p-5 rounded-2xl bg-white border border-border shadow-sm group hover:border-primary/20 transition-all"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-base font-bold text-heading group-hover:text-primary transition-colors">
                      {evt.name}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-muted font-medium">
                      <Calendar size={12} className="opacity-40" />
                      {evt.year}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-bold text-muted uppercase tracking-tighter">Attendees</span>
                    <span className="text-xl font-bold text-primary bg-primary/5 px-3 py-1 rounded-xl border border-primary/10">
                      {evt.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Bar & Export Area */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted/50" size={18} />
            <input
              type="text"
              placeholder="Search by name, event, or organization..."
              className="w-full pl-11 pr-4 py-3 bg-white border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {filteredCards.length > 0 && (
            <Button 
              variant="secondary" 
              onClick={handleExport}
              icon={<Download size={18} />}
              className="sm:w-auto w-full"
            >
              Export CSV
            </Button>
          )}
        </div>

        {/* Cards list */}
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 sm:py-32 bg-surface/30 border border-dashed border-border rounded-3xl gap-4 px-6">
            <div className="flex flex-col gap-1">
              <p className="text-heading font-medium">No cards yet</p>
              <p className="text-sm text-muted">Create your first card to start networking.</p>
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
                    {/* Avatar */}
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
                          {card.eventName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={11} className="text-primary/60" />
                          {card.sessionDate || card.year}
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