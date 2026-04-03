"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { Button, TextInput, Skeleton, AnimatedCounter } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { Plus, LogOut, Calendar, MapPin, User, Search, Users, BarChart3, ArrowLeft, X, ChevronRight, Sparkles } from "lucide-react";
import { EventData } from "@/types/card";
import { toast } from "sonner";
import confetti from "canvas-confetti";

type DashboardEventData = EventData & { attendeeCount: number };

export default function DashboardPage() {
  const router = useRouter();
  const [events, setEvents] = useState<DashboardEventData[]>([]);
  const [userName, setUserName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  const [eventForm, setEventForm] = useState({
    name: "",
    location: "",
    date: "",
  });
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalAttendees: 0,
  });

  useEffect(() => {
    let isMounted = true;
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;
      
      if (!session) {
        router.replace("/login");
        return;
      }
      setUserName(session.user.email?.split("@")[0] || "");
      fetchData(session.user.id, () => isMounted);
      setIsCheckingAuth(false);
    };
    checkUser();
    return () => { isMounted = false; };
  }, [router]);

  const fetchData = async (userId: string, getIsMounted?: () => boolean) => {
    try {
      const [attendeeRes, eventRes] = await Promise.all([
        supabase.from("attendees").select("*", { count: 'exact' }).eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from("events").select("*").eq('user_id', userId).order('created_at', { ascending: false })
      ]);
      
      if (attendeeRes.error) throw attendeeRes.error;
      if (eventRes.error) throw eventRes.error;

      const attendeeRecords = attendeeRes.data || [];
      const eventRecords = eventRes.data || [];
      
      const eventCounts = new Map<string, number>();
      attendeeRecords.forEach(a => {
        // In Supabase we use snake_case
        if (a.event_id) {
          eventCounts.set(a.event_id, (eventCounts.get(a.event_id) || 0) + 1);
        } else if (a.event_name) {
          eventCounts.set(a.event_name, (eventCounts.get(a.event_name) || 0) + 1);
        }
      });

      const mappedEvents: DashboardEventData[] = eventRecords.map(r => ({
        id: r.id,
        name: r.name,
        location: r.location,
        date: r.date,
        attendeeCount: eventCounts.get(r.id) || eventCounts.get(r.name) || 0,
      }));
      
      if (getIsMounted && !getIsMounted()) return;

      if (getIsMounted && !getIsMounted()) return;
      setEvents(mappedEvents);
      
      setStats({
        totalEvents: mappedEvents.length,
        totalAttendees: attendeeRecords.length,
      });

    } catch (err: any) {
      console.error("Error fetching dashboard data:", err);
      toast.error("Could not load data. Check your database connection.");
    }
  };

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return events;
    
    return events.filter(evt => {
      const name = (evt.name || "").toLowerCase();
      const location = (evt.location || "").toLowerCase();
      const date = (evt.date || "").toLowerCase();
      // Concatenate for a broader search matches
      const searchBlob = `${name} ${location} ${date}`;
      return searchBlob.includes(query);
    });
  }, [searchQuery, events]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.name || !eventForm.location || !eventForm.date) {
      toast.error("Please fill all required fields.");
      return;
    }

    setIsSubmittingEvent(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const data = {
        name: eventForm.name,
        location: eventForm.location,
        date: eventForm.date,
        user_id: user?.id
      };
      
      const { error } = await supabase.from("events").insert(data);
      if (error) throw error;

      toast.success(`Event "${eventForm.name}" created successfully!`);

      setIsEventModalOpen(false);
      setEventForm({ name: "", location: "", date: "" });
      if (user) fetchData(user.id);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to create event. Is your database running?");
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full bg-transparent">
      <GradientBackground />

      <div className="relative z-10 max-w-[1240px] mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16">
        {isCheckingAuth ? (
          <>
            <div className="flex flex-col gap-6 mb-12">
              <Skeleton className="w-24 h-4" />
              <Skeleton className="w-48 h-10" />
              <Skeleton className="w-32 h-4" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
              <Skeleton className="md:col-span-2 h-32" />
              <Skeleton className="md:col-span-1 h-32" />
              <Skeleton className="md:col-span-1 h-32" />
            </div>

            <div className="flex gap-3 mb-6">
              <Skeleton className="flex-1 h-12" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          </>
        ) : (
          <>
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 mb-10 sm:mb-12">
          <div className="flex flex-col gap-1 sm:gap-2">
            <Link 
              href="/" 
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:opacity-80 transition-all mb-1 group"
            >
              <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
              BACK TO HOME
            </Link>
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

          <div className="flex gap-2.5 sm:gap-3 items-center">
             <Button
              variant="secondary"
              onClick={() => setIsEventModalOpen(true)}
              className="bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 px-4"
              icon={<Calendar size={18} />}
            >
              <span className="hidden sm:inline">New Event</span>
              <span className="inline sm:hidden">Event</span>
            </Button>
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
        
        {/* Bento Grid Statistics Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-10 delay-100">
          {/* Main Stat - Large Tile */}
          <div className="glass-panel p-6 rounded-[24px] md:col-span-2 flex flex-col justify-between group hover:bg-white transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/30 shrink-0 mb-6 group-hover:scale-110 transition-transform">
              <Users size={24} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-muted uppercase tracking-[0.2em]">Live Network Presence</span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-heading tracking-tight">
                  <AnimatedCounter value={stats.totalAttendees} />
                </span>
                <span className="text-sm font-semibold text-primary">Attendees</span>
              </div>
            </div>
          </div>
          
          {/* Secondary Stat - Active Events */}
          <div className="glass-panel p-6 rounded-[24px] md:col-span-2 flex flex-col justify-between group hover:bg-white transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 mb-4 group-hover:rotate-6 transition-transform hover:bg-primary/20">
              <BarChart3 size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] mb-1">Activity Tracking</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-heading tracking-tight">
                  <AnimatedCounter value={stats.totalEvents} />
                </span>
                <span className="text-xs font-semibold text-primary">Total Events</span>
              </div>
            </div>
          </div>

        </div>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 delay-200">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={18} />
            <input
              type="text"
              placeholder="Search events..."
              className="w-full pl-11 pr-4 py-3 bg-white/70 backdrop-blur-md border border-white/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white transition-all text-sm shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Event Cards List */}
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 sm:py-32 bg-surface/30 border border-dashed border-border rounded-3xl gap-4 px-6">
            <div className="flex flex-col gap-1">
              <p className="text-heading font-medium">No events yet</p>
              <p className="text-sm text-muted">Create your first event to start inviting attendees.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 delay-300">
            {filteredEvents.length > 0 ? (
              filteredEvents.map((evt) => (
                <div key={evt.id} className="group flex flex-col justify-between h-full glass-panel p-4 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/40">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-primary/5 flex items-center justify-center text-primary border border-primary/10">
                      <Calendar size={18} />
                    </div>
                    <div className="flex items-center text-xs font-bold text-primary bg-primary/5 px-2.5 py-1 rounded-full">
                      {evt.attendeeCount} Attendee{evt.attendeeCount !== 1 && 's'}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1.5 grow">
                    <h3 className="font-bold text-xl text-heading group-hover:text-primary transition-colors line-clamp-2">
                      {evt.name}
                    </h3>
                    
                    <div className="flex flex-col gap-2 mt-auto pt-4 text-[13px] text-muted font-medium">
                      <span className="flex items-center gap-2">
                        <Calendar size={14} className="opacity-60" />
                        {evt.date}
                      </span>
                      <span className="flex items-center gap-2">
                        <MapPin size={14} className="opacity-60" />
                        {evt.location}
                      </span>
                    </div>
                  </div>
                  
                  <Link href={`/dashboard/events/${evt.id}`} className="mt-5 pt-4 border-t border-border flex items-center justify-between text-sm font-bold text-heading hover:text-primary transition-colors cursor-pointer group-hover:text-primary">
                    View Event
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 glass-panel rounded-3xl border-dashed">
                <p className="text-muted text-sm">No events found matching your search.</p>
              </div>
            )}
          </div>
        )}
          </>
        )}
      </div>

      {/* Event Creation Modal */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in" 
            onClick={() => setIsEventModalOpen(false)}
          />
          <div className="relative w-full max-w-[460px] glass-panel bg-white/90 border border-white/60 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-8 pt-8 pb-4 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-heading tracking-tight">Create New Event</h2>
                <p className="text-sm text-muted">Add details for the upcoming conference.</p>
              </div>
              <button 
                onClick={() => setIsEventModalOpen(false)}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleEventSubmit} className="p-8 pt-4 flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <TextInput
                  label="Name of the Event"
                  required
                  placeholder="e.g. TechConf 2026"
                  value={eventForm.name}
                  onChange={(v) => setEventForm({ ...eventForm, name: v })}
                />
                <TextInput
                  label="Location"
                  required
                  placeholder="e.g. San Francisco, CA"
                  value={eventForm.location}
                  onChange={(v) => setEventForm({ ...eventForm, location: v })}
                />
                <TextInput
                  label="Event Date"
                  required
                  type="date"
                  value={eventForm.date}
                  onChange={(v) => setEventForm({ ...eventForm, date: v })}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button 
                  variant="secondary" 
                  fullWidth 
                  onClick={() => setIsEventModalOpen(false)}
                  className="order-2 sm:order-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  fullWidth 
                  disabled={isSubmittingEvent}
                  className="order-1 sm:order-2 shadow-lg shadow-primary/20"
                >
                  {isSubmittingEvent ? "Creating..." : "Create Event"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}