"use client";
import { useState, useEffect, use, useMemo, Suspense, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import GradientBackground from "@/components/GradientBackground";
import { Button, TextInput, Skeleton, AnimatedCounter, FilePicker } from "@/components/ui";

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
  Globe,
  Handshake,
  Activity,
  TrendingUp,
  Layers3,
  ShieldCheck,
  Lock,
} from "lucide-react";

import { CardData, EventData } from "@/types/card";
import { toast } from "sonner";
import { getEventStatus } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAutoRefresh, useDashboardMotion } from "@/lib/ui/useDashboardMotion";
import { EventSponsorsForm } from "@/components/EventSponsorsForm";
import { parseEventSponsors, resolveSponsorRowsToEntries, type SponsorFormRow } from "@/lib/sponsors";
import { isValidUuid } from "@/lib/validation/uuid";

type AttendeeCard = CardData & { photo_path?: string };
type PendingAccessRequest = {
  id: string;
  requester_user_id: string;
  requested_action: string;
  note?: string | null;
  requester_email: string;
  created_at: string;
};
type ActiveGrant = {
  id: string;
  grantee_email: string;
  permission: string;
  created_at: string;
};

function EventContent({ params }: { params: Promise<{ id: string }> }) {
  const EVENT_NAME_MAX_CHARS = 18;
  const router = useRouter();
  const { id } = use(params);

  const searchParams = useSearchParams();
  const impersonateId = searchParams.get("impersonate");
  const isPreviewMode = !!impersonateId;
  
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [cards, setCards] = useState<AttendeeCard[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isGuestCategoryOpen, setIsGuestCategoryOpen] = useState(false);
  const [guestCategoryInput, setGuestCategoryInput] = useState("");
  const [guestCategoryError, setGuestCategoryError] = useState("");
  const [isShareActionsOpen, setIsShareActionsOpen] = useState(false);
  const [shareDraftUrl, setShareDraftUrl] = useState("");
  const [shareDraftMessage, setShareDraftMessage] = useState("");
  const [shareDraftRole, setShareDraftRole] = useState<"guest" | "visitor">("visitor");
  const shareRef = useRef<HTMLDivElement>(null);

  // Close share menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setIsShareOpen(false);
      }
    };
    if (isShareOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isShareOpen]);

  // Edit event modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", location: "", location_type: "onsite", date: "", time: "" });
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

  const [isSponsorsOpen, setIsSponsorsOpen] = useState(false);
  const [sponsorRows, setSponsorRows] = useState<SponsorFormRow[]>([]);
  const [isSavingSponsors, setIsSavingSponsors] = useState(false);
  const [isAccessRequestOpen, setIsAccessRequestOpen] = useState(false);
  const [accessRequestAction, setAccessRequestAction] = useState("manage_event");
  const [accessRequestNote, setAccessRequestNote] = useState("");
  const [isSubmittingAccessRequest, setIsSubmittingAccessRequest] = useState(false);
  const [pendingAccessRequests, setPendingAccessRequests] = useState<PendingAccessRequest[]>([]);
  const [isAccessInboxOpen, setIsAccessInboxOpen] = useState(false);
  const [isAccessControlOpen, setIsAccessControlOpen] = useState(false);
  const [activeGrants, setActiveGrants] = useState<ActiveGrant[]>([]);
  const [isLoadingGrants, setIsLoadingGrants] = useState(false);
  const [grantedPermissions, setGrantedPermissions] = useState<string[]>([]);
  const [isOrgAdminReviewer, setIsOrgAdminReviewer] = useState(false);
  const { data: session } = useSession();
  const userId = session?.user?.id || "";
  const { presets, fadeUp, staggerItem, hoverLift, hoverIconNudge } = useDashboardMotion();
  const { refreshTick } = useAutoRefresh(Boolean(userId));
  /** When only `refreshTick` changes (focus / interval), refetch without full-page skeleton so modals and file pickers are not unmounted mid-interaction. */
  const eventPageLoadKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadKey = `${id}|${userId}|${String(impersonateId ?? "")}|${isPreviewMode}`;
    const loadKeyChanged = eventPageLoadKeyRef.current !== loadKey;
    const silentPoll = !loadKeyChanged && refreshTick > 0;
    if (loadKeyChanged) {
      eventPageLoadKeyRef.current = loadKey;
    }

    const checkUser = async () => {
      if (!isMounted) return;
      if (!userId) {
        router.replace("/login");
        return;
      }
      setCurrentUserId(userId);
      fetchEventData(userId);
    };

    const fetchEventData = async (viewerId: string) => {
      if (!id || id === "id" || !isValidUuid(id)) {
        if (isMounted) {
          setEventData(null);
          setCards([]);
          setIsLoading(false);
        }
        return;
      }

      if (!silentPoll) {
        setIsLoading(true);
      }
      try {
        const eventRes = await fetch(
          `/api/events/${id}${isPreviewMode && impersonateId ? `?impersonate=${encodeURIComponent(impersonateId)}` : ""}`,
        );
        const eventPayload = await eventRes.json();
        if (!eventRes.ok) throw new Error(eventPayload?.error || "Failed to load event.");
        const eventRecord = eventPayload.data;
        if (!isMounted) return;

        setEventData({
          id: eventRecord.id,
          name: eventRecord.name,
          location: eventRecord.location,
          location_type: eventRecord.location_type || "onsite",
          date: eventRecord.date,
          time: eventRecord.time || "",
          user: eventRecord.user_id,
          logo_url: eventRecord.logo_url || "",
          sponsors: parseEventSponsors(eventRecord.sponsors),
        });

        const [memberResult, attendeeRes] = await Promise.all([
          fetch("/api/organization-members/me")
            .then(async (res) => {
              const payload = await res.json().catch(() => null);
              const ownerId = res.ok ? String(payload?.data?.org_owner_user_id || "") : "";
              return Boolean(ownerId && ownerId === String(eventRecord.user_id || ""));
            })
            .catch(() => false),
          fetch(
            `/api/events/${id}/attendees${isPreviewMode && impersonateId ? `?impersonate=${encodeURIComponent(impersonateId)}` : ""}`,
          ),
        ]);
        setIsOrgAdminReviewer(memberResult);

        let attendeeRecords: Array<Record<string, unknown>> = [];
        if (!attendeeRes.ok) {
          const errPayload = await attendeeRes.json().catch(() => null);
          const errMsg = typeof errPayload?.error === "string" ? errPayload.error : attendeeRes.statusText;
          if (attendeeRes.status === 403) {
            // Team members without card-read grants can still access event shell.
            attendeeRecords = [];
          } else {
            throw new Error(errMsg || "Failed to fetch decrypted attendees");
          }
        } else {
          const attendeePayload = await attendeeRes.json();
          attendeeRecords = attendeePayload.data || [];
        }
        if (!isMounted) return;

        const mappedCards = (attendeeRecords || []).map((secure: Record<string, unknown>) => {
          return {
            id: String(secure.id || ""),
            name: String(secure.name || ""),
            role: String(secure.role || "Attendee"),
            company: String(secure.company || ""),
            email: String(secure.card_email || ""),
            eventName: String(secure.event_name || ""),
            sessionDate: String(secure.session_date || ""),
            location: String(secure.location || ""),
            track: String(secure.track || ""),
            guestCategory: String(secure.guest_category || ""),
            year: String(secure.year || ""),
            linkedin: String(secure.linkedin || ""),
            event_id: String(secure.event_id || ""),
            photo: typeof secure.photo_url === "string" && secure.photo_url ? secure.photo_url : undefined,
            photo_path: typeof secure.photo_url === "string" ? secure.photo_url : undefined,
          };
        });

        setCards(mappedCards);

        setGrantedPermissions(Array.isArray(eventPayload?.data?.permissions) ? eventPayload.data.permissions : []);

        if (eventRecord.user_id === viewerId || memberResult) {
          try {
            const reqRes = await fetch(`/api/access-requests?eventId=${id}`);
            const reqPayload = await reqRes.json();
            if (reqRes.ok && reqPayload?.data?.requests) {
              setPendingAccessRequests(reqPayload.data.requests);
            }
          } catch (err) {
            console.error("Could not load access requests:", err);
          }
        } else {
          setPendingAccessRequests([]);
        }

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Event Fetch Error:", message);
        if (!silentPoll) {
          toast.error("Failed to load event data.");
        }
      } finally {
        if (isMounted && !silentPoll) {
          setIsLoading(false);
        }
      }
    };

    checkUser();
    return () => { isMounted = false; };
  }, [id, router, impersonateId, isPreviewMode, userId, refreshTick]);

  const status = useMemo(() => getEventStatus(eventData?.date), [eventData?.date]);
  const isEventOwner = Boolean(eventData?.user && currentUserId && eventData.user === currentUserId);
  const canReviewAccessRequests = isEventOwner || isOrgAdminReviewer;
  const canManageEvent = isEventOwner || grantedPermissions.includes("manage_event");
  const canDeleteEvent = canManageEvent || grantedPermissions.includes("delete_event");
  const canEditCards = canManageEvent || grantedPermissions.includes("edit_cards");
  const canDeleteCards = canManageEvent || grantedPermissions.includes("delete_cards");
  const canExport = canManageEvent;
  const isTeamMemberEventMode = !isPreviewMode && !isEventOwner && isOrgAdminReviewer;
  const isOrgAdminEventMode = !isPreviewMode && isEventOwner;

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
  const previewCardsMax = Math.max(cards.length, filteredCards.length, 1);
  const previewVisiblePct = Math.max(8, Math.round((filteredCards.length / previewCardsMax) * 100));
  const previewTotalPct = Math.max(8, Math.round((cards.length / previewCardsMax) * 100));
  const attendeeMax = Math.max(cards.length, 1);
  const ownerGuestCount = cards.filter((card) => String(card.track || "").toLowerCase() === "guest").length;
  const ownerVisitorCount = cards.filter((card) => String(card.track || "").toLowerCase() === "visitor").length;
  const ownerProfileCompleteCount = cards.filter((card) => Boolean(card.email && card.company)).length;
  const ownerTopRoles = useMemo(() => {
    const roleMap = new Map<string, number>();
    for (const card of cards) {
      const role = String(card.role || "Attendee").trim() || "Attendee";
      roleMap.set(role, (roleMap.get(role) || 0) + 1);
    }
    return Array.from(roleMap.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [cards]);

  const handleDelete = async (cardId: string) => {
    if (!confirm("Are you sure you want to delete this attendee card?")) return;

    try {
      // Delete the photo from storage too if there is one
      const card = cards.find(c => c.id === cardId);
      const photoPath = card?.photo_path;
      if (photoPath) {
        await fetch("/api/media/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: photoPath }),
        });
      }

      const deleteRes = await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
      const deletePayload = await deleteRes.json();
      if (!deleteRes.ok) throw new Error(deletePayload?.error || "Failed to delete card.");

      setCards(prev => prev.filter(c => c.id !== cardId));
      toast.success("Card deleted successfully.");
      router.refresh();
    } catch (err) {
      console.error("Error deleting card:", err);
      toast.error("Failed to delete card.");
    }
  };

  const openEdit = () => {
    if (!eventData) return;
    setEditForm({
      name: eventData.name || "",
      location: eventData.location_type === "webinar" ? "" : (eventData.location || ""),
      location_type: eventData.location_type || "onsite",
      date: eventData.date || "",
      time: eventData.time || "",
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name || (!editForm.location && editForm.location_type === "onsite") || !editForm.date || !editForm.time) {
      toast.error("Please fill all required fields.");
      return;
    }
    if (editForm.name.trim().length > EVENT_NAME_MAX_CHARS) {
      toast.error(`Campaign name can be up to ${EVENT_NAME_MAX_CHARS} characters.`);
      return;
    }

    setIsSavingEdit(true);
    try {
      const updateRes = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          location: editForm.location_type === "webinar" ? "Webinar" : editForm.location,
          location_type: editForm.location_type,
          date: editForm.date,
          time: editForm.time,
        }),
      });
      const updatePayload = await updateRes.json();
      if (!updateRes.ok) throw new Error(updatePayload?.error || "Failed to update event.");

      setEventData((prev) => prev ? {
        ...prev,
        name: editForm.name,
        location: editForm.location_type === "webinar" ? "Webinar" : editForm.location,
        location_type: editForm.location_type,
        date: editForm.date,
        time: editForm.time,
      } : prev);
      toast.success("Event updated.");
      router.refresh();
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
      if (!userId) {
        throw new Error("You must be logged in to renew an event.");
      }
      let logo_url = eventData?.logo_url || "";

      // Upload new logo
      if (renewForm.logo && renewForm.logo.startsWith('data:')) {
        const uploadRes = await fetch("/api/media/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataUrl: renewForm.logo,
            folder: `events/${userId}`,
          }),
        });
        const uploadPayload = await uploadRes.json();
        if (!uploadRes.ok || !uploadPayload?.data?.url) {
          throw new Error(uploadPayload?.error || "Logo upload failed.");
        }
        logo_url = String(uploadPayload.data.url);
      }

      // Create a duplicate/renewed event in DB instead of updating the old one
      const insertPayload = {
        name: eventData?.name || "Renewed Event",
        location: renewForm.location.trim(),
        location_type: eventData?.location_type || "onsite",
        date: renewForm.date,
        time: eventData?.time || "",
        logo_url: logo_url,
        user_id: userId,
        sponsors: eventData?.sponsors?.length ? eventData.sponsors : [],
      };
      const createRes = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...insertPayload,
          ownerId: userId,
        }),
      });
      const createPayload = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createPayload?.error || "Database insert failed.");
      }

      const createdEvent = createPayload?.data;
      if (!createdEvent?.id) {
        throw new Error("Insert failed: no data returned.");
      }

      toast.success(`Event renewed successfully! Redirecting...`);
      setIsRenewOpen(false);
      
      // Redirect to the newly created event
      if (createdEvent?.id) {
        router.refresh();
        router.push(`/dashboard/events/${createdEvent.id}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to renew event. Please try again.";
      console.error("Renewal error:", err);
      toast.error(message);
    } finally {
      setIsRenewing(false);
    }
  };

  const handleDuplicate = async () => {
    if (!eventData) return;
    setIsDuplicating(true);
    try {
      if (!userId) {
        toast.error("You need to be signed in to duplicate.");
        return;
      }
      const duplicateRes = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${eventData.name} (Copy)`,
          location: eventData.location,
          location_type: eventData.location_type || "onsite",
          date: eventData.date,
          time: eventData.time || "",
          logo_url: eventData.logo_url || "",
          sponsors: eventData.sponsors?.length ? eventData.sponsors : [],
          ownerId: userId,
        }),
      });
      const duplicatePayload = await duplicateRes.json();
      if (!duplicateRes.ok) throw new Error(duplicatePayload?.error || "Failed to duplicate event.");
      const created = duplicatePayload?.data;

      toast.success("Event duplicated.");
      if (created?.id) {
        router.refresh();
        router.push(`/dashboard/events/${created?.id}`);
      }
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
        await Promise.all(
          photoPaths.map((url) =>
            fetch("/api/media/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url }),
            }),
          ),
        );
      }

      const deleteRes = await fetch(`/api/events/${id}`, { method: "DELETE" });
      const deletePayload = await deleteRes.json();
      if (!deleteRes.ok) {
        throw new Error(deletePayload?.error || "Could not delete event.");
      }

      toast.success("Event deleted permanently.");
      router.refresh();
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete event.";
      console.error("Error deleting event:", err);
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const openSponsorsModal = () => {
    const rows = eventData?.sponsors?.map((s) => ({ name: s.name, logo: s.logo_url })) ?? [];
    setSponsorRows(rows);
    setIsSponsorsOpen(true);
  };

  const handleSaveSponsors = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventData || isPreviewMode) return;
    setIsSavingSponsors(true);
    try {
      if (!userId) throw new Error("Not signed in");
      const resolved = await resolveSponsorRowsToEntries(userId, id, sponsorRows);
      const saveRes = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sponsors: resolved }),
      });
      const savePayload = await saveRes.json();
      if (!saveRes.ok) throw new Error(savePayload?.error || "Failed to save sponsors.");
      setEventData((prev) => (prev ? { ...prev, sponsors: resolved } : prev));
      toast.success("Sponsors saved.");
      setIsSponsorsOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Could not save sponsors. Check your connection and try again.");
    } finally {
      setIsSavingSponsors(false);
    }
  };

  const handleExport = () => {
    if (filteredCards.length === 0) return;

    const headers = ["Name", "Role", "Company", "Email", "Event", "Date", "Location", "Track", "Guest Category", "LinkedIn"];
    const rows = filteredCards.map(c => [
      c.name,
      c.role,
      c.company,
      c.email,
      c.eventName,
      c.sessionDate || c.year,
      c.location,
      c.track || "",
      c.guestCategory || "",
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

  const submitAccessRequest = async (requestedAction: string, note?: string) => {
    if (!eventData?.id) return;
    const trimmedNote = String(note || "").trim();
    if (!trimmedNote) {
      toast.error("Please provide a short reason for this access request.");
      return;
    }
    setIsSubmittingAccessRequest(true);
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: eventData.id,
          requestedAction,
          note: trimmedNote,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload?.error || "Could not create access request.");
        return;
      }
      toast.success("Access request sent to organization admin.");
      setIsAccessRequestOpen(false);
      setAccessRequestNote("");
      setAccessRequestAction("manage_event");
    } catch (err) {
      console.error("Access request error:", err);
      toast.error("Could not create access request.");
    } finally {
      setIsSubmittingAccessRequest(false);
    }
  };

  const reviewAccessRequest = async (requestId: string, decision: "approve" | "reject") => {
    try {
      const res = await fetch(`/api/access-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload?.error || "Could not review request.");
        return;
      }
      setPendingAccessRequests((prev) => prev.filter((r) => r.id !== requestId));
      toast.success(decision === "approve" ? "Access granted." : "Access request rejected.");
    } catch (err) {
      console.error("Review access request error:", err);
      toast.error("Could not review request.");
    }
  };

  const loadActiveGrants = async () => {
    if (!eventData?.id) return;
    setIsLoadingGrants(true);
    try {
      const res = await fetch(`/api/access-grants?eventId=${eventData.id}`);
      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload?.error || "Could not load active grants.");
        return;
      }
      setActiveGrants(payload?.data || []);
    } catch (err) {
      console.error("Load grants error:", err);
      toast.error("Could not load active grants.");
    } finally {
      setIsLoadingGrants(false);
    }
  };

  const revokeGrant = async (grantId: string) => {
    try {
      const res = await fetch(`/api/access-grants/${grantId}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload?.error || "Could not revoke grant.");
        return;
      }
      setActiveGrants((prev) => prev.filter((g) => g.id !== grantId));
      toast.success("Access revoked.");
    } catch (err) {
      console.error("Revoke grant error:", err);
      toast.error("Could not revoke grant.");
    }
  };

  const openShareActions = (url: string, role: "guest" | "visitor") => {
    const message = `We are hosting ${eventData?.name || "our event"}. Register here: ${url}`;
    setShareDraftUrl(url);
    setShareDraftMessage(message);
    setShareDraftRole(role);
    setIsShareActionsOpen(true);
  };

  if (isLoading) {
    return (
      <main className="relative min-h-screen w-full bg-transparent flex flex-col items-center">
        <GradientBackground />
        <div className="relative z-10 w-full max-w-[1480px] px-2 sm:px-4 lg:px-6 py-12 sm:py-16 md:py-20">
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
        <div className="relative z-10 text-xl font-semibold tracking-[-0.03em] leading-[1.15] text-heading">Campaign not found</div>
        <Link href="/dashboard" className="relative z-10">
          <Button variant="secondary" icon={<ArrowLeft size={16} />}>Back to Dashboard</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen w-full bg-transparent">
      {isPreviewMode && (
        <div className="relative z-100 border-b border-white/20 bg-linear-to-r from-heading via-[#2B4F95] to-heading px-6 py-3 shadow-sm">
          <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between text-sm font-medium text-white">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              <span>Super Admin Inspection Mode &mdash; Event View</span>
            </div>
            <Link
              href="/admin"
              className="flex items-center gap-2 rounded-sm border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-white/20 hover:border-white/40 active:scale-95"
            >
              <ArrowLeft size={14} />
              Exit Preview
            </Link>
          </div>
        </div>
      )}
      <GradientBackground />

      <div className="relative z-10 max-w-[1480px] mx-auto px-2 sm:px-4 lg:px-6 py-12 sm:py-16 md:py-20">
        {/* Header row */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 mb-10 sm:mb-12 relative z-30"
          viewport={presets.viewport}
          {...fadeUp(0.02)}
        >
          <div className="flex flex-col gap-2 sm:gap-3">
            <button
              onClick={() => {
                router.refresh();
                router.push(isPreviewMode ? "/admin" : "/dashboard");
              }}
            className="flex items-center gap-2 text-sm font-medium text-heading hover:text-primary-strong hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-inline mb-2 group -ml-1 sm:-ml-2 bg-transparent border-none cursor-pointer"
            >
              <motion.span {...hoverIconNudge(-2)} className="inline-flex">
                <ArrowLeft size={12} className="transition-transform" />
              </motion.span>
              {isPreviewMode ? "Back to Admin" : "Back to Dashboard"}
            </button>
            <span className="text-sm font-normal tracking-[0.01em] leading-tight text-muted/70 mt-1">
              Campaign details
            </span>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <h1 className="text-3xl sm:text-4xl font-black text-heading tracking-[0em] leading-[1.1]">
                {eventData.name}
              </h1>
              <span className={`text-[13px] font-medium tracking-[0.01em] leading-tight px-3 py-1 rounded-md border ${status.classes}`}>
                {status.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted mt-2 font-medium">
              <span className="flex items-center gap-2 bg-white/50 px-3 py-2 rounded-sm border border-white/40 shadow-sm"><Calendar size={16} className="text-heading/80" /> {eventData.date}</span>
              <span className="flex items-center gap-2 bg-white/50 px-3 py-2 rounded-sm border border-white/40 shadow-sm">
                {(eventData.location_type === "webinar" || (eventData.location || "").trim().toLowerCase() === "webinar") ? (
                  <Globe size={16} className="text-heading/80" />
                ) : (
                  <MapPin size={16} className="text-heading/80" />
                )}{" "}
                {eventData.location}
              </span>
            </div>
            {isTeamMemberEventMode && (
              <p className="mt-2 text-sm text-heading/75">
                Team execution mode: you can work inside granted permissions for this campaign.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3 items-center relative z-20">
            {!isPreviewMode && (
              <>
                <div className="relative" ref={shareRef}>
                  <Button
                    variant="secondary"
                    onClick={() => setIsShareOpen(!isShareOpen)}
                    disabled={status.label === "Past"}
                    icon={<LinkIcon size={18} />}
                    className={`hidden sm:flex transition-all duration-150 ${isShareOpen ? "border-primary/55 bg-primary/15 text-primary-strong" : ""} ${status.label === "Past" ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
                  >
                    Share Link
                  </Button>

                  {isShareOpen && (
                    <div className="absolute top-full right-0 mt-3 w-56 bg-white border border-border shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] rounded-xl py-1 z-9999 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="px-4 py-2 mb-1 border-b border-border/40">
                        <span className="text-[13px] font-medium text-muted/50 uppercase tracking-[0.01em] leading-tight">Share Options</span>
                      </div>
                      
                      <button
                        onClick={() => {
                          setIsShareOpen(false);
                          setGuestCategoryInput("");
                          setGuestCategoryError("");
                          setIsGuestCategoryOpen(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-surface transition-all group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary-strong group-hover:scale-110 transition-transform">
                          <User size={16} />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm text-heading leading-tight">Guest</span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/cards/new?eventId=${eventData.id}&share=true&role=visitor`;
                          setIsShareOpen(false);
                          openShareActions(url, "visitor");
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-surface transition-all group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-surface-strong/10 bg-slate-100 flex items-center justify-center text-slate-500 group-hover:scale-110 transition-transform">
                          <User size={16} />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm text-heading leading-tight">Visitor</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                <Button
                  variant="secondary"
                  onClick={() => setIsShareOpen(!isShareOpen)}
                  disabled={status.label === "Past"}
                  icon={<LinkIcon size={18} />}
                  className={`flex sm:hidden px-4 ${status.label === "Past" ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
                >
                  <span className="sr-only">Share Form Link</span>
                </Button>
                {status.label === "Past" ? (
                  <Button 
                    variant="primary" 
                    onClick={() => {
                      if (!canManageEvent) {
                        setAccessRequestAction("manage_event");
                        setIsAccessRequestOpen(true);
                        return;
                      }
                      setRenewForm({ location: eventData.location || "", date: "", logo: "" });
                      setIsRenewOpen(true);
                    }} 
                    disabled={!canManageEvent}
                    icon={<RefreshCw size={16} />}
                    className={`shadow-lg shadow-primary/20 animate-pulse-subtle ${!canManageEvent ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
                  >
                    Renew Event
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => (canManageEvent ? openEdit() : undefined)}
                    disabled={!canManageEvent}
                    icon={<Pencil size={16} />}
                    className={!canManageEvent ? "opacity-50 cursor-not-allowed grayscale" : ""}
                  >
                    Edit
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => (canManageEvent ? openSponsorsModal() : undefined)}
                  disabled={!canManageEvent}
                  icon={<Handshake size={16} />}
                  className={`hidden md:flex ${!canManageEvent ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
                >
                  Sponsors
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => (canManageEvent ? openSponsorsModal() : undefined)}
                  disabled={!canManageEvent}
                  icon={<Handshake size={16} />}
                  className={`flex md:hidden px-4 ${!canManageEvent ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
                  aria-label="Sponsors"
                >
                  <span className="sr-only">Sponsors</span>
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => (canManageEvent ? handleDuplicate() : undefined)}
                  disabled={isDuplicating || status.label === "Past" || !canManageEvent}
                  icon={<Copy size={16} />}
                  className={status.label === "Past" || !canManageEvent ? "opacity-50 cursor-not-allowed grayscale" : ""}
                >
                  {isDuplicating ? "..." : "Duplicate"}
                </Button>
                <div 
                  title={cards.length > 0 ? "Events with registered attendees cannot be deleted." : ""}
                  className={cards.length > 0 ? "cursor-help" : ""}
                >
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!canDeleteEvent) return;
                      setDeleteConfirm("");
                      setIsDeleteOpen(true);
                    }}
                    disabled={cards.length > 0 || !canDeleteEvent}
                    icon={<Trash2 size={16} />}
                    className={`text-red-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 ${cards.length > 0 || !canDeleteEvent ? "opacity-50 grayscale cursor-not-allowed" : ""}`}
                  >
                    Delete
                  </Button>
                </div>
                {!canManageEvent && !canDeleteEvent && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setAccessRequestAction("delete_event");
                      setIsAccessRequestOpen(true);
                    }}
                  >
                    Take Access
                  </Button>
                )}
                {canReviewAccessRequests && pendingAccessRequests.length > 0 && (
                  <Button variant="secondary" onClick={() => setIsAccessInboxOpen(true)}>
                    Requests ({pendingAccessRequests.length})
                  </Button>
                )}
                {isEventOwner && (
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      setIsAccessControlOpen(true);
                      await loadActiveGrants();
                    }}
                  >
                    Access Control
                  </Button>
                )}
              </>
            )}
          </div>
        </motion.div>

        {isPreviewMode && (
          <div className="motion-token-enter mb-10 p-6 rounded-xl border border-primary/20 bg-linear-to-br from-white/95 to-info/5 shadow-2xl backdrop-blur-xl relative overflow-hidden ring-1 ring-white/20">
            {/* Background decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-info/5 rounded-full -ml-12 -mb-12 blur-xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.8)]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-strong leading-none">Security Oversight Active</span>
                  </div>
                  <h2 className="text-2xl font-black text-heading tracking-tight leading-none">Platform Audit Layer</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-sm border border-primary/25 bg-primary/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-primary-strong shadow-sm">
                    <ShieldCheck size={12} /> Super Admin
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-sm border border-amber-300/40 bg-amber-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-amber-700 shadow-sm">
                    <Activity size={12} /> View Only
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-sm border border-danger/20 bg-danger/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-danger shadow-sm">
                    <Lock size={12} /> Immutable Mode
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-white/60 border border-white/60 text-[13px] font-medium text-muted/90 leading-relaxed shadow-sm">
                This campaign is currently locked for <span className="text-heading font-black underline underline-offset-4 decoration-primary/30">Administrative Inspection</span>. You have high-level visibility over all engagement metrics and attendee data, but record modification and deletion are restricted to maintain audit integrity.
              </div>


            </div>
          </div>
        )}
        {isOrgAdminEventMode && (
          <motion.div
            className="mb-8 rounded-sm border border-primary/25 bg-linear-to-r from-primary/10 via-white to-info/10 px-5 py-4 shadow-sm motion-token-enter motion-token-hover"
            viewport={presets.viewport}
            {...fadeUp(0.04)}
            {...hoverLift(-2, 1.004)}
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-primary/25 bg-primary/12 text-primary-strong">
                    <Activity size={15} />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-heading/80">
                    Organization Admin Event Console
                  </span>
                </div>
                <span className="text-xs text-muted">Live attendee and composition insight</span>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <motion.div
                  className="rounded-sm border border-primary/20 bg-white/85 px-4 py-3 motion-token-enter motion-token-hover"
                  viewport={presets.viewport}
                  {...fadeUp(0.06)}
                  {...hoverLift(-2, 1.005)}
                >
                  <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-heading/75">
                    <Layers3 size={13} className="text-primary-strong" />
                    Attendee Composition
                  </p>
                  <div className="space-y-2">
                    {[
                      { label: "Guests", value: ownerGuestCount, color: "bg-primary" },
                      { label: "Visitors", value: ownerVisitorCount, color: "bg-info" },
                      { label: "Complete Profiles", value: ownerProfileCompleteCount, color: "bg-heading/45" },
                    ].map((row, rowIdx) => (
                      <motion.div
                        key={row.label}
                        viewport={presets.viewport}
                        {...staggerItem(rowIdx, 0.05, 0.18, 10, 0.26)}
                      >
                        <div className="mb-1 flex items-center justify-between text-xs text-muted">
                          <span>{row.label}</span>
                          <span className="font-semibold text-heading">{row.value}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-heading/10">
                          <div
                            className={`h-full rounded-full ${row.color}`}
                            style={{ width: `${Math.max(8, Math.round((row.value / attendeeMax) * 100))}%` }}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  className="rounded-sm border border-primary/20 bg-white/85 px-4 py-3 motion-token-enter motion-token-hover"
                  viewport={presets.viewport}
                  {...fadeUp(0.08)}
                  {...hoverLift(-2, 1.005)}
                >
                  <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-heading/75">
                    <TrendingUp size={13} className="text-primary-strong" />
                    Top Roles
                  </p>
                  <div className="space-y-2">
                    {ownerTopRoles.length === 0 ? (
                      <p className="text-sm text-muted">No attendee roles yet.</p>
                    ) : (
                      ownerTopRoles.map((entry, roleIdx) => {
                        const maxRole = Math.max(ownerTopRoles[0]?.count || 1, 1);
                        const widthPct = Math.max(8, Math.round((entry.count / maxRole) * 100));
                        return (
                          <motion.div
                            key={entry.role}
                            className="rounded-sm border border-primary/15 bg-white/75 px-3 py-2"
                            viewport={presets.viewport}
                            {...staggerItem(roleIdx, 0.04, 0.2, 8, 0.24)}
                          >
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="truncate text-heading">{entry.role}</span>
                              <span className="font-semibold text-heading">{entry.count}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-heading/10">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${widthPct}%` }} />
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
        {isTeamMemberEventMode && (
          <motion.div
            className="mb-8 rounded-sm border border-primary/25 bg-linear-to-r from-primary/8 via-white to-info/8 px-5 py-4 shadow-sm motion-token-enter motion-token-hover"
            viewport={presets.viewport}
            {...fadeUp(0.05)}
            {...hoverLift(-2, 1.004)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/12 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-strong">
                Team Member View
              </span>
              <span className="inline-flex items-center rounded-full border border-border/70 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-heading/80">
                Campaign Access
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  canManageEvent
                    ? "border-primary/25 bg-primary/10 text-primary-strong"
                    : "border-amber-300/70 bg-amber-50 text-amber-700"
                }`}
              >
                {canManageEvent ? "Manage enabled" : "Restricted mode"}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted">
              Card operations and campaign actions are shown based on your granted permissions.
            </p>
          </motion.div>
        )}

        {/* Stats Section */}
        <motion.div
          className={`p-6 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-sm mb-10 group transition-all duration-200 animate-slide-up delay-100 motion-token-enter motion-token-hover ${
            isPreviewMode
              ? "bg-white/85 border border-heading/20 shadow-md hover:shadow-lg"
              : isTeamMemberEventMode || isOrgAdminEventMode
                ? "bg-white/95 border border-primary/20 shadow-md hover:shadow-lg hover:border-primary/35"
              : "glass-panel hover:shadow-2xl hover:shadow-primary/5"
          }`}
          viewport={presets.viewport}
          {...fadeUp(0.06)}
          {...(isTeamMemberEventMode || isOrgAdminEventMode ? hoverLift(-3, 1.008) : {})}
        >
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-sm bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/30 shrink-0 group-hover:scale-105 transition-transform">
              <Users size={32} />
            </div>
            <div className="flex flex-col gap-0">
              <span className="text-sm font-normal tracking-[0.01em] text-muted/80 leading-tight">Live Attendees</span>
              <div className="flex items-baseline gap-2">
                <span className="text-[3.25rem] font-semibold text-heading tracking-[-0.03em] leading-[1.02]">
                  <AnimatedCounter value={cards.length} />
                </span>
                <span className="text-base font-medium text-primary-strong leading-tight">Attendees</span>
              </div>
            </div>
          </div>
          {cards.length > 0 && (
            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={status.label === "Past" || !canExport}
              icon={<Download size={18} />}
              className={`bg-white/80 hover:bg-white hover:border-primary/35 shadow-sm border-white/60 ${
                status.label === "Past" || !canExport ? "opacity-50 cursor-not-allowed grayscale" : ""
              }`}
            >
              Export CSV
            </Button>
          )}
        </motion.div>

        {/* Search Bar */}
        <motion.div className="flex flex-col sm:flex-row gap-3 mb-6 delay-200" viewport={presets.viewport} {...fadeUp(0.1)}>
          <div className="relative flex-1">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-heading z-10 pointer-events-none" size={20} strokeWidth={2.5} />
            <input
              type="text"
              placeholder="Search attendees in this campaign..."
              className={`w-full h-12 pl-20 pr-8 py-0 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all text-base leading-[1.6] text-heading shadow-sm placeholder:text-muted/60 ${
                isPreviewMode
                  ? "bg-white/90 border border-heading/20 focus:bg-white"
                  : isTeamMemberEventMode
                    ? "bg-white/92 border border-primary/20 focus:bg-white"
                  : isOrgAdminEventMode
                    ? "bg-white/92 border border-primary/20 focus:bg-white"
                  : "bg-white/70 backdrop-blur-md border border-white/50 focus:bg-white"
              }`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </motion.div>

        {/* Cards list */}
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 sm:py-32 bg-surface/30 border border-dashed border-border rounded-xl gap-4 px-6 animate-slide-up delay-300">
            <div className="flex flex-col gap-1">
              <p className="text-heading font-medium text-lg">No attendees yet</p>
              <p className="text-sm text-muted">Share the registration link to invite attendees to register for this campaign.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 animate-slide-up delay-300">
            {filteredCards.length > 0 ? (
              filteredCards.map((card, idx) => (
                <motion.div
                  key={card.id}
                className={`group motion-token-enter motion-token-hover flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 sm:p-3 rounded-sm hover:-translate-y-0.5 ${
                  isPreviewMode
                    ? "bg-white/90 border border-heading/15 shadow-md hover:shadow-lg hover:border-heading/30"
                    : isTeamMemberEventMode || isOrgAdminEventMode
                      ? "bg-white/95 border border-primary/20 shadow-md hover:shadow-lg hover:border-primary/35"
                    : "glass-panel hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30"
                }`}
                viewport={presets.viewport}
                {...staggerItem(idx, 0.04, 0.24, 14, 0.28)}
                {...hoverLift(-2, 1.004)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-inline bg-white border border-border overflow-hidden shrink-0 flex items-center justify-center text-slate-300 shadow-sm group-hover:scale-105 transition-transform duration-200">
                        {card.photo ? (
                          <Image
                            src={card.photo}
                            alt={card.name}
                            width={48}
                            height={48}
                            sizes="48px"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User size={20} strokeWidth={1.5} className="text-primary-strong/40" />
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[13px] text-primary-foreground font-medium border-2 border-white leading-[1.02]">
                        {card.name.charAt(0)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-sm sm:text-base text-heading group-hover:text-primary-strong transition-colors truncate leading-tight">
                          {card.name}
                        </h3>
                        {(card.track === "guest" && card.guestCategory) && (
                          <span className="text-[12px] bg-primary/10 px-2.5 py-0.5 rounded-inline border border-primary/20 text-primary-strong font-medium tracking-[0em] leading-[1.2] shrink-0">
                            {card.guestCategory}
                          </span>
                        )}
                        {card.company && (
                          <span className="text-[12px] bg-primary/10 px-2.5 py-0.5 rounded-inline border border-primary/20 text-primary-strong font-medium tracking-[0em] leading-[1.2] shrink-0">
                            {card.company}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[13px] leading-tight text-muted font-normal tracking-[0.01em]">
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
                    <Link href={`/cards/${card.id}`} className="shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={
                          <motion.span {...hoverIconNudge(2)} className="inline-flex">
                            <ExternalLink size={12} />
                          </motion.span>
                        }
                        className="rounded-sm bg-white/50 border-white/60 transition-all duration-200 group-hover:border-primary/30 group-hover:text-primary-strong"
                      >
                        View
                      </Button>
                    </Link>
                    {!isPreviewMode &&
                      (canEditCards ? (
                        <Link href={`/cards/${card.id}/edit`} className="shrink-0">
                          <Button variant="secondary" size="sm" icon={<Pencil size={14} />} className="rounded-sm bg-white/50 border-white/60">
                            Edit
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Pencil size={14} />}
                          className="rounded-sm bg-white/50 border-white/60 opacity-50 cursor-not-allowed grayscale"
                          disabled
                          title="Request access to edit attendee cards."
                        >
                          Edit
                        </Button>
                      ))}
                    {!isPreviewMode && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          if (!canDeleteCards) return;
                          handleDelete(card.id);
                        }}
                        disabled={!canDeleteCards}
                        title={!canDeleteCards ? "Request access to delete attendee cards." : "Delete attendee card"}
                        className={`w-10 h-10 p-0 rounded-inline transition-all shrink-0 ${
                          canDeleteCards
                            ? "text-muted hover:text-red-500 hover:bg-red-50/50 hover:border-red-200"
                            : "text-muted/50 opacity-50 cursor-not-allowed grayscale"
                        }`}
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}

                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-16 glass-panel rounded-xl border-dashed">
                <p className="text-muted font-medium">No results found for &ldquo;{searchQuery}&rdquo;</p>
              </div>
            )}
          </div>
        )}
      </div>

      {isAccessRequestOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 sm:p-8">
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => !isSubmittingAccessRequest && setIsAccessRequestOpen(false)}
          />
          <div className="relative w-full max-w-[440px] glass-panel bg-white/95 border border-border/70 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 pt-6 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">Take Access</h3>
                <p className="text-sm text-muted">Request approval from organization admin to perform restricted actions.</p>
              </div>
              <button
                type="button"
                onClick={() => !isSubmittingAccessRequest && setIsAccessRequestOpen(false)}
                className="w-9 h-9 rounded-sm border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all"
              >
                <X size={18} />
              </button>
            </div>
            <form
              className="px-6 pb-6 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                submitAccessRequest(accessRequestAction, accessRequestNote);
              }}
            >
              <label className="text-[13px] font-normal tracking-[0.01em] leading-tight text-heading">Requested action</label>
              <select
                value={accessRequestAction}
                onChange={(e) => setAccessRequestAction(e.target.value)}
                className="w-full rounded-md border border-border/60 bg-white px-3 py-2 text-sm text-heading outline-none focus:border-primary/70"
              >
                <option value="manage_event">Manage event settings</option>
                <option value="delete_event">Delete event (only when attendees = 0)</option>
                <option value="edit_cards">Edit attendee cards</option>
                <option value="delete_cards">Delete attendee cards</option>
              </select>
              <TextInput
                label="Reason"
                required
                placeholder="Explain what you need and why (1–2 sentences)."
                value={accessRequestNote}
                onChange={setAccessRequestNote}
              />
              <p className="text-xs text-muted -mt-1">
                Your organization admin will review this request and can approve or reject it.
              </p>
              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={() => setIsAccessRequestOpen(false)}
                  disabled={isSubmittingAccessRequest}
                >
                  Cancel
                </Button>
                <Button type="submit" fullWidth disabled={isSubmittingAccessRequest}>
                  {isSubmittingAccessRequest ? "Sending..." : "Request Access"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAccessInboxOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 sm:p-8">
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => setIsAccessInboxOpen(false)}
          />
          <div className="relative w-full max-w-[620px] glass-panel bg-white/95 border border-border/70 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 pt-6 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">Pending Access Requests</h3>
                <p className="text-sm text-muted">Approve or reject member access for this campaign.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAccessInboxOpen(false)}
                className="w-9 h-9 rounded-sm border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 pb-6 max-h-[62vh] overflow-y-auto flex flex-col gap-3">
              {pendingAccessRequests.length === 0 ? (
                <p className="text-sm text-muted py-6 text-center">No pending requests.</p>
              ) : (
                pendingAccessRequests.map((req) => (
                  <div key={req.id} className="rounded-md border border-border/50 bg-white/80 p-3">
                    <p className="text-sm font-medium text-heading">{req.requester_email}</p>
                    <p className="text-xs text-muted mt-1">Action: {req.requested_action}</p>
                    {req.note ? <p className="text-xs text-muted mt-1">Reason: {req.note}</p> : null}
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={() => reviewAccessRequest(req.id, "approve")}>
                        Approve
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => reviewAccessRequest(req.id, "reject")}>
                        Reject
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isAccessControlOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 sm:p-8">
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => setIsAccessControlOpen(false)}
          />
          <div className="relative w-full max-w-[620px] glass-panel bg-white/95 border border-border/70 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 pt-6 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">Active Access Grants</h3>
                <p className="text-sm text-muted">Revoke member permissions for this campaign.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAccessControlOpen(false)}
                className="w-9 h-9 rounded-sm border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 pb-6 max-h-[62vh] overflow-y-auto flex flex-col gap-3">
              {isLoadingGrants ? (
                <p className="text-sm text-muted py-6 text-center">Loading grants...</p>
              ) : activeGrants.length === 0 ? (
                <p className="text-sm text-muted py-6 text-center">No active grants.</p>
              ) : (
                activeGrants.map((grant) => (
                  <div key={grant.id} className="rounded-md border border-border/50 bg-white/80 p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-heading truncate">{grant.grantee_email}</p>
                      <p className="text-xs text-muted mt-1">Permission: {grant.permission}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => revokeGrant(grant.id)}>
                      Revoke
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sponsors modal */}
      {isGuestCategoryOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 sm:p-8">
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => setIsGuestCategoryOpen(false)}
          />
          <div className="relative w-full max-w-[430px] glass-panel bg-white/95 border border-border/70 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 pt-6 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">Guest Category</h3>
                <p className="text-sm text-muted">Type category like Judge, Speaker, Chief Guest, Evaluator.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsGuestCategoryOpen(false)}
                className="w-9 h-9 rounded-sm border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all"
              >
                <X size={18} />
              </button>
            </div>
            <form
              className="px-6 pb-6 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const value = guestCategoryInput.trim();
                if (!value) {
                  setGuestCategoryError("Please enter a guest category.");
                  return;
                }
                const url = `${window.location.origin}/cards/new?eventId=${eventData.id}&share=true&role=guest&guestCategory=${encodeURIComponent(value)}`;
                setIsGuestCategoryOpen(false);
                openShareActions(url, "guest");
              }}
            >
              <TextInput
                label="Guest Category"
                required
                placeholder="e.g. Judge"
                value={guestCategoryInput}
                maxLength={40}
                onChange={(v) => {
                  setGuestCategoryInput(v);
                  if (guestCategoryError) setGuestCategoryError("");
                }}
              />
              {guestCategoryError && <p className="text-sm font-normal leading-[1.6] text-red-500">{guestCategoryError}</p>}
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="secondary" fullWidth onClick={() => setIsGuestCategoryOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" fullWidth>
                  Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isShareActionsOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 sm:p-8">
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => setIsShareActionsOpen(false)}
          />
          <div className="relative w-full max-w-[430px] glass-panel bg-white/95 border border-border/70 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 pt-6 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">Share Registration</h3>
                <p className="text-sm text-muted">
                  {shareDraftRole === "guest"
                    ? "Use this guest link directly."
                    : "Use the link directly or share on LinkedIn."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsShareActionsOpen(false)}
                className="w-9 h-9 rounded-sm border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 pb-6 flex flex-col gap-3">
              {shareDraftRole === "visitor" && (
                <div className="rounded-md border border-border/60 bg-surface/40 px-3 py-2">
                  <p className="text-[13px] font-normal tracking-[0.01em] leading-tight text-muted mb-1">Default LinkedIn caption</p>
                  <p className="text-xs text-heading wrap-break-word">{shareDraftMessage}</p>
                </div>
              )}
              <div className={`grid gap-3 ${shareDraftRole === "visitor" ? "grid-cols-2" : "grid-cols-1"}`}>
                <Button
                  variant="secondary"
                  icon={<LinkIcon size={16} />}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareDraftUrl);
                      toast.success("Registration link copied.");
                    } catch {
                      toast.error("Could not copy link.");
                    }
                  }}
                >
                  Copy Link
                </Button>
                {shareDraftRole === "visitor" && (
                  <Button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(shareDraftMessage);
                        toast.success("Caption copied. Paste it on LinkedIn post.");
                      } catch {
                        toast.error("Could not copy caption, but opening LinkedIn.");
                      }
                      const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareDraftUrl)}`;
                      window.open(linkedInUrl, "_blank", "noopener,noreferrer");
                    }}
                  >
                    LinkedIn
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sponsors modal */}
      {isSponsorsOpen && eventData && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 sm:p-8">
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => !isSavingSponsors && setIsSponsorsOpen(false)}
          />
          <div className="relative max-h-[90vh] w-full max-w-[520px] overflow-hidden rounded-xl border border-border/70 bg-white/95 shadow-2xl animate-in zoom-in-95 duration-200 glass-panel">
            <div className="flex items-center justify-between border-b border-border/50 px-6 py-5">
              <div className="flex flex-col gap-1 pr-4">
                <h2 className="text-xl font-semibold tracking-[-0.03em] leading-[1.15] text-heading">Event sponsors</h2>
                <p className="text-sm text-muted">
                  Up to five logos with names. They appear on every attendee card for this campaign.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isSavingSponsors && setIsSponsorsOpen(false)}
                className="shrink-0 rounded-sm border border-border p-2 text-muted transition-colors hover:bg-surface hover:text-heading"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveSponsors} className="flex max-h-[calc(90vh-88px)] flex-col">
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <EventSponsorsForm
                  rows={sponsorRows}
                  onChange={setSponsorRows}
                  onFileError={(msg) => toast.error(msg)}
                  disabled={isSavingSponsors || isPreviewMode}
                />
              </div>
              <div className="flex flex-col gap-3 border-t border-border/50 bg-white/80 px-6 py-4 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  className="order-2 sm:order-1"
                  disabled={isSavingSponsors}
                  onClick={() => setIsSponsorsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  fullWidth
                  className="order-1 sm:order-2 shadow-lg shadow-primary/20"
                  disabled={isSavingSponsors || isPreviewMode}
                >
                  {isSavingSponsors ? "Saving..." : "Save sponsors"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 sm:p-8">
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => setIsEditOpen(false)}
          />
          <div className="relative w-full max-w-[460px] glass-panel bg-white/90 border border-border/70 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 pt-8 pb-4 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">Edit Event</h2>
                <p className="text-sm text-muted">Update the event details below.</p>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="w-11 h-11 rounded-sm border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
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
                  maxLength={EVENT_NAME_MAX_CHARS}
                  onChange={(v) => setEditForm({ ...editForm, name: v })}
                />
                <p
                  className={`-mt-2 text-[13px] font-normal leading-[1.6] ${
                    editForm.name.length >= EVENT_NAME_MAX_CHARS ? "text-amber-600" : "text-muted"
                  }`}
                >
                  {editForm.name.length}/{EVENT_NAME_MAX_CHARS} characters
                  {editForm.name.length >= EVENT_NAME_MAX_CHARS ? " (maximum reached)" : " max"}
                </p>
                
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center gap-1">
                     <label className="text-[14px] font-normal tracking-[0.01em] leading-tight text-heading">Location Type</label>
                  </div>
                  <div className="flex gap-4 mb-1">
                     <label className="flex items-center gap-2 cursor-pointer text-sm text-heading">
                        <input type="radio" name="locationType" value="onsite" checked={editForm.location_type === "onsite"} onChange={() => setEditForm({ ...editForm, location_type: "onsite" })} className="accent-primary" />
                        Onsite
                     </label>
                     <label className="flex items-center gap-2 cursor-pointer text-sm text-heading">
                        <input type="radio" name="locationType" value="webinar" checked={editForm.location_type === "webinar"} onChange={() => setEditForm({ ...editForm, location_type: "webinar", location: "" })} className="accent-primary" />
                        Webinar
                     </label>
                  </div>
                </div>

                {editForm.location_type === "webinar" ? (
                   <div className="flex flex-col gap-2 w-full group opacity-75">
                     <label className="text-[14px] font-normal tracking-[0.01em] leading-tight text-heading">Location <span className="text-primary-strong">*</span></label>
                     <div className="flex h-11 items-center bg-surface border border-border/60 rounded-md shadow-sm px-4 overflow-hidden cursor-not-allowed">
                        <Globe size={18} className="text-muted mr-2" />
                        <input type="text" value="Webinar" disabled className="h-full flex-1 py-0 text-[16px] leading-[1.6] text-muted bg-transparent outline-none cursor-not-allowed" />
                     </div>
                   </div>
                ) : (
                  <TextInput
                    label="Location"
                    required
                    value={editForm.location}
                    onChange={(v) => setEditForm({ ...editForm, location: v })}
                  />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <TextInput
                    label="Event Date"
                    required
                    type="date"
                    value={editForm.date}
                    onChange={(v) => setEditForm({ ...editForm, date: v })}
                  />
                  <TextInput
                    label="Event Time"
                    required
                    type="time"
                    value={editForm.time}
                    onChange={(v) => setEditForm({ ...editForm, time: v })}
                  />
                </div>
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
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 sm:p-8">
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => !isDeleting && setIsDeleteOpen(false)}
          />
          <div className="relative w-full max-w-[460px] glass-panel bg-white/90 border border-border/70 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 pt-8 pb-4 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold text-red-500 tracking-[-0.03em] leading-[1.15]">Delete event?</h2>
                <p className="text-sm text-muted">
                  This permanently removes the event, <span className="font-medium text-heading">{cards.length}</span> attendee {cards.length === 1 ? "card" : "cards"}, and all uploaded photos. This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => !isDeleting && setIsDeleteOpen(false)}
                className="w-11 h-11 rounded-sm border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 shrink-0"
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
                  className="order-1 sm:order-2 bg-red-500! text-white! border-red-500! shadow-lg shadow-red-500/20 hover:bg-red-600! hover:text-white! disabled:opacity-50"
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
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 sm:p-8">
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => !isRenewing && setIsRenewOpen(false)}
          />
          <div className="relative w-full max-w-[460px] glass-panel bg-white/90 border border-border/70 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-8 pt-8 pb-4 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">Renew Event</h2>
                <p className="text-sm text-muted">Update the details to reactivate this campaign.</p>
              </div>
              <button
                onClick={() => !isRenewing && setIsRenewOpen(false)}
                className="w-11 h-11 rounded-sm border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
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
                  cropTitle="Crop event logo"
                  cropSubtitle="Drag the corners or edges to adjust the crop."
                  cropApplyLabel="Apply logo"
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

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={
      <main className="relative min-h-screen w-full bg-transparent flex flex-col items-center">
        <GradientBackground />
        <div className="relative z-10 w-full max-w-[1480px] px-2 sm:px-4 lg:px-6 py-12 sm:py-16 md:py-20">
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
    }>
      <EventContent params={params} />
    </Suspense>
  );
}
