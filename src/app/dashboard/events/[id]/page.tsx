"use client";
import { useState, useEffect, use, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { Button, TextInput, Skeleton, AnimatedCounter, FilePicker } from "@/components/ui";

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
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { CardData, EventData } from "@/types/card";
import { toast } from "sonner";
import { getEventStatus } from "@/lib/utils";

type AttendeeCard = CardData & { photo_path?: string };

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const searchParams = useSearchParams();
  const impersonateId = searchParams.get("impersonate");
  const isPreviewMode = !!impersonateId;
  
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

  // Renew event modal
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [renewForm, setRenewForm] = useState({ location: "", date: "", logo: "" });
  const [isRenewing, setIsRenewing] = useState(false);

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

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all required fields
    if (!renewForm.date) {
      toast.error("Please provide a new date for the event.");
      return;
    }
    if (!renewForm.location.trim()) {
      toast.error("Please provide a new location for the event.");
      return;
    }
    if (!renewForm.logo) {
      toast.error("Please upload a logo for the event.");
      return;
    }

    const newDate = new Date(renewForm.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (newDate < today) {
      toast.error("Renewal date must be today or in the future.");
      return;
    }

    setIsRenewing(true);
    try {
      let logo_url = eventData?.logo_url || "";

      // Upload new logo
      if (renewForm.logo && renewForm.logo.startsWith('data:')) {
        const res = await fetch(renewForm.logo);
        const blob = await res.blob();
        const ext = blob.type.split("/")[1] || "png";
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('event-logos')
          .upload(fileName, blob);

        if (uploadError) {
          console.error("Logo upload error:", uploadError);
          throw new Error(`Logo upload failed: ${uploadError.message}`);
        }
        const { data: { publicUrl } } = supabase.storage.from('event-logos').getPublicUrl(uploadData.path);
        logo_url = publicUrl;
      }

      // Create a duplicate/renewed event in DB instead of updating the old one
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        throw new Error("You must be logged in to renew an event.");
      }

      const insertPayload = {
        name: eventData?.name || "Renewed Event",
        location: renewForm.location.trim(),
        date: renewForm.date,
        logo_url: logo_url,
        user_id: authData.user.id
      };
      console.log("Creating renewed event copy:", insertPayload);

      const { data: createdEvent, error } = await supabase
        .from("events")
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        throw new Error(`Database insert failed: ${error.message}`);
      }

      if (!createdEvent) {
        throw new Error("Insert failed: no data returned.");
      }

      console.log("Renew copy successful:", createdEvent);

      toast.success(`Event renewed successfully! Redirecting...`);
      setIsRenewOpen(false);
      
      // Redirect to the newly created event
      if (createdEvent?.id) {
        router.push(`/dashboard/events/${createdEvent.id}`);
      }
    } catch (err: any) {
      console.error("Renewal error:", err);
      toast.error(err.message || "Failed to renew event. Please try again.");
    } finally {
      setIsRenewing(false);
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
    if (cards.length > 0) {
      toast.error("You cannot delete an event with registered attendees.");
      return;
    }
    if (deleteConfirm.trim() !== (eventData?.name || "").trim()) {
      toast.error("Event name does not match.");
      return;
    }
    setIsDeleting(true);
    try {
      // 1. Remove attendee photos from storage
      const photoPaths = cards
        .map((c) => c.photo_path)
        .filter((p): p is string => !!p);

      if (photoPaths.length > 0) {
        const { error: storageErr } = await supabase.storage.from("attendee_photos").remove(photoPaths);
        if (storageErr) console.error("Storage delete warning:", storageErr); // Non-fatal
      }

      // 2. Delete attendees first (to avoid foreign key violations if not CASCADE)
      const { data: deletedAttendees, error: attendeeErr } = await supabase
        .from("attendees")
        .delete()
        .eq("event_id", id)
        .select();
      
      if (attendeeErr) {
        console.error("Attendee delete error:", attendeeErr);
        throw new Error(`Could not delete attendees: ${attendeeErr.message}`);
      }

      // 3. Delete the event itself
      const { data: deletedEvent, error: eventErr } = await supabase
        .from("events")
        .delete()
        .eq("id", id)
        .select();
        
      if (eventErr) {
        console.error("Event delete error:", eventErr);
        throw new Error(`Could not delete event: ${eventErr.message}`);
      }

      // 4. Verification Check: Did RLS silently block it?
      if (!deletedEvent || deletedEvent.length === 0) {
        throw new Error("RLS Blocked: You do not have DELETE permission on the 'events' table in Supabase. Please add a DELETE policy.");
      }

      toast.success("Event deleted permanently.");
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Error deleting event:", err);
      toast.error(err.message || "Failed to delete event.");
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

          <Skeleton className="w-full h-32 rounded-md mb-10" />
          <Skeleton className="w-full h-14 rounded-sm mb-8" />

          <div className="flex flex-col gap-4">
            <Skeleton className="w-full h-24 rounded-sm" />
            <Skeleton className="w-full h-24 rounded-sm" />
            <Skeleton className="w-full h-24 rounded-sm" />
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
      {isPreviewMode && (
        <div className="relative z-[100] bg-danger/10 backdrop-blur-md border-b border-danger/20 px-6 py-3 flex items-center justify-between text-danger text-sm font-bold shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles size={18} />
            <span>Admin Preview Mode &mdash; Read Only</span>
          </div>
          <Link href="/admin" className="bg-danger text-white px-3 py-1 rounded-sm hover:brightness-110 transition-all text-xs">
            Exit Preview
          </Link>
        </div>
      )}
      <GradientBackground />

      <div className="relative z-10 max-w-[1240px] mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 mb-10 sm:mb-12 animate-slide-up">
          <div className="flex flex-col gap-2 sm:gap-3">
            <Link
              href="/dashboard"
            className="flex items-center gap-2 text-xs font-bold text-heading hover:text-primary-strong hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-[4px] mb-2 group -ml-1 sm:-ml-2"
            >
              <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
              Back to Dashboard
            </Link>
            <span className="text-sm font-semibold tracking-[0.04em] text-muted/70 mt-1">
              Event details
            </span>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <h1 className="text-3xl sm:text-4xl font-bold text-heading tracking-tight leading-tight">
                {eventData.name}
              </h1>
              <span className={`text-xs font-semibold tracking-[0.02em] px-3 py-1 rounded-sm border ${status.classes}`}>
                {status.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted mt-2 font-medium">
              <span className="flex items-center gap-2 bg-white/50 px-3 py-2 rounded-sm border border-white/40 shadow-sm"><Calendar size={16} className="text-heading/80" /> {eventData.date}</span>
              <span className="flex items-center gap-2 bg-white/50 px-3 py-2 rounded-sm border border-white/40 shadow-sm"><MapPin size={16} className="text-heading/80" /> {eventData.location}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {!isPreviewMode && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const url = `${window.location.origin}/cards/new?eventId=${eventData.id}&share=true`;
                    navigator.clipboard.writeText(url);
                    setCopied(true);
                    toast.success("Registration link copied!");
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  disabled={status.label === "Past"}
                  icon={copied ? <Plus size={18} className="rotate-45 text-primary-strong" /> : <LinkIcon size={18} />}
                  className={`hidden sm:flex transition-all duration-150 ${copied ? "border-primary/55 bg-primary/15 text-primary-strong" : ""} ${status.label === "Past" ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
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
                  disabled={status.label === "Past"}
                  icon={<LinkIcon size={18} />}
                  className={`flex sm:hidden px-3 ${status.label === "Past" ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
                >
                  <span className="sr-only">Share Form Link</span>
                </Button>
                {status.label === "Past" ? (
                  <Button 
                    variant="primary" 
                    onClick={() => {
                      setRenewForm({ location: eventData.location || "", date: "", logo: "" });
                      setIsRenewOpen(true);
                    }} 
                    icon={<RefreshCw size={16} />}
                    className="shadow-lg shadow-primary/20 animate-pulse-subtle"
                  >
                    Renew Event
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={openEdit} icon={<Pencil size={16} />}>
                    Edit
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={handleDuplicate}
                  disabled={isDuplicating || status.label === "Past"}
                  icon={<Copy size={16} />}
                  className={status.label === "Past" ? "opacity-50 cursor-not-allowed grayscale" : ""}
                >
                  {isDuplicating ? "..." : "Duplicate"}
                </Button>
                <div 
                  title={cards.length > 0 ? "Events with registered attendees cannot be deleted." : ""}
                  className={cards.length > 0 ? "cursor-help" : ""}
                >
                  <Button
                    variant="secondary"
                    onClick={() => { setDeleteConfirm(""); setIsDeleteOpen(true); }}
                    disabled={cards.length > 0}
                    icon={<Trash2 size={16} />}
                    className={`text-red-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 ${cards.length > 0 ? "opacity-50 grayscale cursor-not-allowed" : ""}`}
                  >
                    Delete
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats Section */}
        <div className="glass-panel p-6 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-sm mb-10 group hover:shadow-2xl hover:shadow-primary/5 transition-all duration-200 animate-slide-up delay-100">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-sm bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/30 shrink-0 group-hover:scale-105 transition-transform">
              <Users size={32} />
            </div>
            <div className="flex flex-col gap-0">
              <span className="text-sm font-semibold tracking-[0.02em] text-muted/80 leading-tight">Live Attendees</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[3.25rem] font-bold text-heading tracking-tight leading-none">
                  <AnimatedCounter value={cards.length} />
                </span>
                <span className="text-base font-semibold text-primary-strong leading-tight">Generated Cards</span>
              </div>
            </div>
          </div>
          {cards.length > 0 && (
            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={status.label === "Past"}
              icon={<Download size={18} />}
              className={`bg-white/80 hover:bg-white hover:border-primary/35 shadow-sm border-white/60 ${status.label === "Past" ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
            >
              Export CSV
            </Button>
          )}
        </div>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 animate-slide-up delay-200">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-heading z-10 pointer-events-none" size={20} strokeWidth={2.5} />
            <input
              type="text"
              placeholder="Search attendees in this event..."
              className="w-full pl-14 pr-6 py-3 bg-white/70 backdrop-blur-md border border-white/50 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white transition-all text-sm text-heading shadow-sm placeholder:text-muted/60"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Cards list */}
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 sm:py-32 bg-surface/30 border border-dashed border-border rounded-xl gap-4 px-6 animate-slide-up delay-300">
            <div className="flex flex-col gap-1">
              <p className="text-heading font-bold text-lg">No attendees yet</p>
              <p className="text-sm text-muted">Share the registration link to invite attendees to register for this event.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 animate-slide-up delay-300">
            {filteredCards.length > 0 ? (
              filteredCards.map((card) => (
                <div
                  key={card.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-panel p-2 sm:p-3 rounded-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-[4px] bg-white border border-border overflow-hidden flex-shrink-0 flex items-center justify-center text-slate-300 shadow-sm group-hover:scale-105 transition-transform duration-200">
                        {card.photo ? (
                          <img src={card.photo} alt={card.name} className="w-full h-full object-cover" />
                        ) : (
                          <User size={20} strokeWidth={1.5} className="text-primary-strong/40" />
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-xs text-white font-bold border-2 border-white leading-none">
                        {card.name.charAt(0)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-sm sm:text-base text-heading group-hover:text-primary-strong transition-colors truncate leading-snug">
                          {card.name}
                        </h3>
                        {card.company && (
                          <span className="text-xs bg-primary/10 px-2 py-1 rounded-[4px] border border-primary/20 text-primary-strong font-semibold tracking-tight shrink-0">
                            {card.company}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted font-semibold tracking-[0.02em]">
                        <span className="flex items-center gap-1">
                          <BarChart3 size={10} className="text-primary-strong/70" />
                          {card.role}
                        </span>
                        {card.email && (
                          <span className="hidden sm:inline-flex items-center gap-1 lowercase font-medium tracking-normal opacity-60">
                            • {card.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link href={`/cards/${card.id}`} className="flex-shrink-0">
                      <Button variant="secondary" size="sm" icon={<ExternalLink size={12} />} className="rounded-sm bg-white/50 border-white/60">
                        View
                      </Button>
                    </Link>
                    <Link href={`/cards/${card.id}/edit`} className="flex-shrink-0">
                      <Button variant="secondary" size="sm" icon={<Pencil size={14} />} className="rounded-sm bg-white/50 border-white/60">
                        Edit
                      </Button>
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDelete(card.id)}
                      className="w-10 h-10 p-0 rounded-[4px] text-muted hover:text-red-500 hover:bg-red-50/50 hover:border-red-200 transition-all shrink-0"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 glass-panel rounded-xl border-dashed">
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
          <div className="relative w-full max-w-[460px] glass-panel bg-white/90 border border-white/60 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 pt-8 pb-4 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-heading tracking-tight">Edit Event</h2>
                <p className="text-sm text-muted">Update the event details below.</p>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="w-10 h-10 rounded-sm border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
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
          <div className="relative w-full max-w-[460px] glass-panel bg-white/90 border border-white/60 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 pt-8 pb-4 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-red-500 tracking-tight">Delete event?</h2>
                <p className="text-sm text-muted">
                  This permanently removes the event, <span className="font-semibold text-heading">{cards.length}</span> attendee {cards.length === 1 ? "card" : "cards"}, and all uploaded photos. This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => !isDeleting && setIsDeleteOpen(false)}
                className="w-10 h-10 rounded-sm border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 shrink-0"
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
      {/* Renew Event Modal */}
      {isRenewOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => !isRenewing && setIsRenewOpen(false)}
          />
          <div className="relative w-full max-w-[460px] glass-panel bg-white/90 border border-white/60 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-8 pt-8 pb-4 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-heading tracking-tight">Renew Event</h2>
                <p className="text-sm text-muted">Update the details to reactivate this event.</p>
              </div>
              <button
                onClick={() => !isRenewing && setIsRenewOpen(false)}
                className="w-10 h-10 rounded-sm border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleRenewSubmit} className="p-8 pt-4 flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <TextInput
                  label="New Location"
                  required
                  placeholder="e.g. San Francisco, CA"
                  value={renewForm.location}
                  onChange={(v) => setRenewForm({ ...renewForm, location: v })}
                />
                <TextInput
                  label="New Event Date"
                  required
                  type="date"
                  value={renewForm.date}
                  onChange={(v) => setRenewForm({ ...renewForm, date: v })}
                />
                <FilePicker
                  label="New Event Logo"
                  required
                  value={renewForm.logo}
                  onChange={(v) => setRenewForm({ ...renewForm, logo: v })}
                  onError={(msg) => toast.error(msg)}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => setIsRenewOpen(false)}
                  disabled={isRenewing}
                  className="order-2 sm:order-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  fullWidth
                  disabled={isRenewing}
                  className="order-1 sm:order-2 shadow-lg shadow-primary/20"
                >
                  {isRenewing ? "Renewing..." : "Renew Event"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
