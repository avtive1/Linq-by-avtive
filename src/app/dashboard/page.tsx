"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { Button, TextInput } from "@/components/ui";
import { pb } from "@/lib/pocketbase";
import { Plus, LogOut, Calendar, MapPin, User, Search, Users, BarChart3, ArrowLeft, X, ChevronRight } from "lucide-react";
import { EventData } from "@/types/card";
import { toast } from "sonner";

// Extended event type for the dashboard view
type DashboardEventData = EventData & { attendeeCount: number };

export default function DashboardPage() {
  const router = useRouter();
  const [events, setEvents] = useState<DashboardEventData[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<DashboardEventData[]>([]);
  const [userName, setUserName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.replace("/login");
      return;
    }
    setUserName(pb.authStore.model?.email?.split("@")[0] || "");
    // Only fetch data once we've confirmed the user is authenticated
    if (pb.authStore.token) {
      fetchData();
    }
  }, [router]);

  const fetchData = async () => {
    // Abort if somehow called without a valid session
    if (!pb.authStore.isValid) return;
    try {
      const [attendeeRecords, eventRecords] = await Promise.all([
        pb.collection("attendees").getFullList({ sort: '-created', $autoCancel: false }),
        pb.collection("events").getFullList({ sort: '-created', $autoCancel: false })
      ]);
      
      const eventCounts = new Map<string, number>();
      attendeeRecords.forEach(a => {
        // Count by eventId if it exists, otherwise fallback to eventName for legacy records
        if (a.eventId) {
          eventCounts.set(a.eventId, (eventCounts.get(a.eventId) || 0) + 1);
        } else if (a.eventName) {
          eventCounts.set(a.eventName, (eventCounts.get(a.eventName) || 0) + 1);
        }
      });

      const mappedEvents: DashboardEventData[] = eventRecords.map(r => ({
        id: r.id,
        name: r.name,
        location: r.location,
        date: r.date,
        attendeeCount: eventCounts.get(r.id) || eventCounts.get(r.name) || 0,
      }));
      
      setEvents(mappedEvents);
      setFilteredEvents(mappedEvents);
      
      setStats({
        totalEvents: mappedEvents.length,
        totalAttendees: attendeeRecords.length,
      });

    } catch (err: any) {
      // Ignore auto-cancel noise; surface real errors
      if (err?.status !== 0) {
        console.error("Error fetching dashboard data:", err);
        toast.error("Could not load data. Check your database connection.");
      }
    }
  };

  useEffect(() => {
    const filtered = events.filter(evt => {
      const searchStr = `${evt.name} ${evt.location} ${evt.date}`.toLowerCase();
      return searchStr.includes(searchQuery.toLowerCase());
    });
    setFilteredEvents(filtered);
  }, [searchQuery, events]);

  const handleLogout = () => {
    pb.authStore.clear();
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
      const data = {
        name: eventForm.name,
        location: eventForm.location,
        date: eventForm.date,
        user: pb.authStore.model?.id
      };
      
      await pb.collection("events").create(data);
      toast.success(`Event "${eventForm.name}" created successfully!`);
      setIsEventModalOpen(false);
      setEventForm({ name: "", location: "", date: "" });
      fetchData(); // Refresh the list
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to create event. Is your database running?");
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full bg-white">
      <GradientBackground />

      <div className="relative z-10 max-w-[860px] mx-auto px-4 sm:px-6 py-10 sm:py-16 md:py-20">
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
        
        {/* Statistics Section */}
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

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted/50" size={18} />
            <input
              type="text"
              placeholder="Search events..."
              className="w-full pl-11 pr-4 py-3 bg-white border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
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
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredEvents.length > 0 ? (
              filteredEvents.map((evt) => (
                <Link key={evt.id} href={`/dashboard/events/${evt.id}`}>
                  <div className="group flex flex-col justify-between h-full bg-white border border-border p-5 rounded-3xl shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
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
                    
                    <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-sm font-bold text-heading group-hover:text-primary transition-colors">
                      View Event
                      <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-full text-center py-12 bg-surface/20 rounded-2xl border border-dashed border-border">
                <p className="text-muted text-sm">No events found matching your search.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Event Modal */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in" 
            onClick={() => setIsEventModalOpen(false)}
          />
          <div className="relative w-full max-w-[460px] bg-white border border-border rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
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