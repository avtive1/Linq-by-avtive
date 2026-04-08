"use client";
import { useState, useEffect, use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { Button, TextInput, Skeleton, AnimatedCounter } from "@/components/ui";
import { supabase, getFileUrl as getSupabaseFileUrl } from "@/lib/supabase";
import {
  Plus,
  Users,
  Calendar,
  MapPin,
  Search,
  Trash2,
  Download,
  ArrowLeft,
  User,
  ExternalLink,
  BarChart3,
  Link as LinkIcon,
  Pencil,
  Copy,
  X,
} from "lucide-react";
import { CardData, EventData } from "@/types/card";
import { toast } from "sonner";
import { getEventStatus } from "@/lib/utils";

type AttendeeCard = CardData & { photo_path?: string };

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [eventData, setEventData] = useState<EventData | null>(null);
  const [cards, setCards] = useState<AttendeeCard[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Edit event modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", location: "", date: "" });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete event modal
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Duplicate
  const [isDuplicating, setIsDuplicating] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;
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
        if (!isMounted) return;

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
        if (!isMounted) return;

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
          photo_path: r.photo_url || undefined,
        }));

        setCards(mappedCards);

      } catch (err: any) {
        console.error("Supabase Fetch Error:", err.message || err);
        toast.error("Failed to load event data.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    checkUser();
    return () => { isMounted = false; };
  }, [id, router]);

  const status = useMemo(() => getEventStatus(eventData?.date), [eventData?.date]);

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
      // Delete the photo from storage too if there is one
      const card = cards.find(c => c.id === cardId);
      const photoPath = card?.photo_path;
      if (photoPath) {
        await supabase.storage.from("attendee_photos").remove([photoPath]);
      }

      const { error } = await supabase.from("attendees").delete().eq("id", cardId);
      if (error) throw error;

      setCards(prev => prev.filter(c => c.id !== cardId));
      toast.success("Card deleted successfully.");
    } catch (err) {
      console.error("Error deleting card:", err);
      toast.error("Failed to delete card.");
    }
  };

  const openEdit = () => {
    if (!eventData) return;
    setEditForm({
      name: eventData.name || "",
      location: eventData.location || "",
      date: eventData.date || "",
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name || !editForm.location || !editForm.date) {
      toast.error("Please fill all required fields.");
      return;
    }

    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({
          name: editForm.name,
          location: editForm.location,
          date: editForm.date,
        })
        .eq("id", id);

      if (error) throw error;

      setEventData((prev) => prev ? {
        ...prev,
        name: editForm.name,
        location: editForm.location,
        date: editForm.date,
      } : prev);
      toast.success("Event updated.");
      setIsEditOpen(false);
    } catch (err) {
      console.error("Error updating event:", err);
      toast.error("Failed to update event.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDuplicate = async () => {
    if (!eventData) return;
    setIsDuplicating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You need to be signed in to duplicate.");
        return;
      }
      const { data: created, error } = await supabase
        .from("events")
        .insert({
          name: `${eventData.name} (Copy)`,
          location: eventData.location,
          date: eventData.date,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Event duplicated.");
      if (created?.id) router.push(`/dashboard/events/${created.id}`);
    } catch (err) {
      console.error("Error duplicating event:", err);
      toast.error("Failed to duplicate event.");
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (deleteConfirm !== eventData?.name) {
      toast.error("Event name does not match.");
      return;
    }
    setIsDeleting(true);
    try {
      // Cascade: remove all attendee photos from storage, then delete attendees, then event.
      const photoPaths = cards
        .map((c) => c.photo_path)
        .filter((p): p is string => !!p);

      if (photoPaths.length > 0) {
        await supabase.storage.from("attendee_photos").remove(photoPaths);
      }

      const { error: attendeeErr } = await supabase
        .from("attendees")
        .delete()
        .eq("event_id", id);
      if (attendeeErr) throw attendeeErr;

      const { error: eventErr } = await supabase
        .from("events")
        .delete()
        .eq("id", id);
      if (eventErr) throw eventErr;

      toast.success("Event deleted.");
      router.push("/dashboard");
    } catch (err) {
      console.error("Error deleting event:", err);
      toast.error("Failed to delete event.");
    } finally {
      setIsDeleting(false);
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

      <div className="relative z-10 max-w-[1240px] mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 mb-10 sm:mb-12 animate-slide-up">
          <div className="flex flex-col gap-1 sm:gap-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs font-bold text-heading hover:opacity-80 transition-all mb-1 group -ml-1 sm:-ml-2"
            >
              <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
              BACK TO DASHBOARD
            </Link>
            <span className="text-[12px] font-bold tracking-[0.2em] text-muted/40 uppercase">
              EVENT DETAILS
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-heading tracking-tight leading-none">
                {eventData.name}
              </h1>
              <span className={`text-[10px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 rounded-full border ${status.classes}`}>
                {status.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted mt-1 font-medium">
              <span className="flex items-center gap-1.5 bg-white/50 px-2 py-1 rounded-lg border border-white/40 shadow-sm"><Calendar size={13} className="text-heading" /> {eventData.date}</span>
              <span className="flex items-center gap-1.5 bg-white/50 px-2 py-1 rounded-lg border border-white/40 shadow-sm"><MapPin size={13} className="text-heading" /> {eventData.location}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 sm:gap-3 items-center">
            <Button
              variant="secondary"
              onClick={() => {
                const url = `${window.location.origin}/cards/new?eventId=${eventData.id}&share=true`;
                navigator.clipboard.writeText(url);
                setCopied(true);
                toast.success("Registration link copied!");
                setTimeout(() => setCopied(false), 2000);
              }}
              icon={copied ? <Plus size={18} className="rotate-45 text-primary-strong" /> : <LinkIcon size={18} />}
              className={`hidden sm:flex transition-all duration-300 ${copied ? "border-primary/40 bg-primary/10" : ""}`}
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
            <Button variant="secondary" onClick={openEdit} icon={<Pencil size={16} />}>
              Edit
            </Button>
            <Button
              variant="secondary"
              onClick={handleDuplicate}
              disabled={isDuplicating}
              icon={<Copy size={16} />}
            >
              {isDuplicating ? "..." : "Duplicate"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => { setDeleteConfirm(""); setIsDeleteOpen(true); }}
              icon={<Trash2 size={16} />}
              className="text-red-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50"
            >
              Delete
            </Button>
          </div>
        </div>

        {/* Stats Section */}
        <div className="glass-panel p-5 sm:p-6 rounded-[24px] flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-sm mb-10 animate-slide-up delay-100">
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
                <span className="text-sm font-semibold text-primary-strong">Generated Cards</span>
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-heading" size={18} />
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
              <p className="text-sm text-muted">Share the registration link to invite attendees to register for this event.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3.5 animate-slide-up delay-300">
            {filteredCards.length > 0 ? (
              filteredCards.map((card) => (
                <div
                  key={card.id}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-3.5 sm:p-4.5 rounded-[20px] transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30"
                >
                  <div className="flex items-center gap-5 min-w-0">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl bg-white border border-border overflow-hidden flex-shrink-0 flex items-center justify-center text-slate-300 shadow-sm group-hover:scale-105 transition-transform duration-500">
                        {card.photo ? (
                          <img src={card.photo} alt={card.name} className="w-full h-full object-cover" />
                        ) : (
                          <User size={24} strokeWidth={1.5} className="text-primary-strong/40" />
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-white font-bold border-2 border-white">
                        {card.name.charAt(0)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-base sm:text-xl text-heading group-hover:text-primary-strong transition-colors truncate">
                          {card.name}
                        </h3>
                        {card.company && (
                          <span className="text-[10px] bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 text-primary-strong font-bold uppercase tracking-tight shrink-0">
                            {card.company}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted font-bold uppercase tracking-[0.1em]">
                        <span className="flex items-center gap-1.5">
                          <BarChart3 size={12} className="text-primary-strong/70" />
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
                        View
                      </Button>
                    </Link>
                    <Link href={`/cards/${card.id}/edit`} className="flex-shrink-0">
                      <Button variant="secondary" size="sm" icon={<Pencil size={14} />} className="rounded-xl h-10 px-4 font-bold text-xs bg-white/50 border-white/60">
                        Edit
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
        )}
      </div>

      {/* Edit Event Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => setIsEditOpen(false)}
          />
          <div className="relative w-full max-w-[460px] glass-panel bg-white/90 border border-white/60 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 pt-8 pb-4 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-heading tracking-tight">Edit Event</h2>
                <p className="text-sm text-muted">Update the event details below.</p>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-8 pt-4 flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <TextInput
                  label="Name of the Event"
                  required
                  value={editForm.name}
                  onChange={(v) => setEditForm({ ...editForm, name: v })}
                />
                <TextInput
                  label="Location"
                  required
                  value={editForm.location}
                  onChange={(v) => setEditForm({ ...editForm, location: v })}
                />
                <TextInput
                  label="Event Date"
                  required
                  type="date"
                  value={editForm.date}
                  onChange={(v) => setEditForm({ ...editForm, date: v })}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => setIsEditOpen(false)}
                  className="order-2 sm:order-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  fullWidth
                  disabled={isSavingEdit}
                  className="order-1 sm:order-2 shadow-lg shadow-primary/20"
                >
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Event Modal */}
      {isDeleteOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => !isDeleting && setIsDeleteOpen(false)}
          />
          <div className="relative w-full max-w-[460px] glass-panel bg-white/90 border border-white/60 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 pt-8 pb-4 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-red-500 tracking-tight">Delete event?</h2>
                <p className="text-sm text-muted">
                  This permanently removes the event, <span className="font-semibold text-heading">{cards.length}</span> attendee {cards.length === 1 ? "card" : "cards"}, and all uploaded photos. This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => !isDeleting && setIsDeleteOpen(false)}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 pt-4 flex flex-col gap-6">
              <TextInput
                label={`Type "${eventData.name}" to confirm`}
                value={deleteConfirm}
                onChange={setDeleteConfirm}
              />

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => setIsDeleteOpen(false)}
                  disabled={isDeleting}
                  className="order-2 sm:order-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={handleDeleteEvent}
                  disabled={isDeleting || deleteConfirm !== eventData.name}
                  className="order-1 sm:order-2 !bg-red-500 !text-white !border-red-500 shadow-lg shadow-red-500/20 hover:!bg-red-600 hover:!text-white disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete Forever"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
