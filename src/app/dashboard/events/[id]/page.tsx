"use client";
import { useState, useEffect, use, useMemo, useCallback, Suspense, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import GradientBackground from "@/components/GradientBackground";
import { Button, TextInput, TextArea, Skeleton, AnimatedCounter, FilePicker, Select, TimeInput } from "@/components/ui";

import {
  Users,
  Calendar,
  MapPin,
  Search,
  Trash2,
  Download,
  ArrowLeft,
  User,
  ExternalLink,
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
  Undo2,
  Redo2,
  ShieldCheck,
  Lock,
  FileText,
} from "lucide-react";

import { CardData, EventData } from "@/types/card";
import { toast } from "sonner";
import { getEventStatus } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAutoRefresh, useDashboardMotion } from "@/lib/ui/useDashboardMotion";
import { EventSponsorsForm } from "@/components/EventSponsorsForm";
import { parseEventSponsors, resolveSponsorRowsToEntries, type SponsorFormRow } from "@/lib/sponsors";
import { isValidUuid } from "@/lib/validation/uuid";
import { CAMPAIGN_LOGO_CROP_ASPECT } from "@/lib/ui/crop-presets";
import { CardPreview } from "@/components/CardPreview";
import { CustomColorPicker } from "@/components/CustomColorPicker";
import {
  type RegistrationFieldDefinition,
  type RegistrationFormConfig,
  getDefaultRegistrationFormConfig,
  getEnabledFieldsForRole,
  normalizeRegistrationFormConfig,
} from "@/lib/registration-form";

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
const CORE_PREVIEW_FIELD_IDS = new Set(["name", "role", "company", "email", "linkedin", "photo"]);
const BRAND_THEME_COLORS = [
  { name: "purple", start: "#41295a", end: "#2f0743" },
  { name: "red", start: "#c94b4b", end: "#4b134f" },
  { name: "pink", start: "#EE0979", end: "#FF6A00" },
  { name: "blue", start: "#D3CCE3", end: "#E9E4F0" },
];
const BRAND_PRESET_THEME_NAMES = new Set(BRAND_THEME_COLORS.map((c) => c.name));

const BRAND_THEME_BACKDROPS: Record<string, { start: string; end: string }> = {
  purple: { start: "#eef0ff", end: "#f7f3ff" },
  red: { start: "#fff1f1", end: "#fdf2ff" },
  pink: { start: "#fff3f8", end: "#fff8f0" },
  blue: { start: "#f1f5ff", end: "#f6f8ff" },
};

/** Branding modal previews: badge height matches scaled social (628×scale) for visual consistency */
const BRANDING_MODAL_SOCIAL_SCALE = 0.58;
const BRANDING_MODAL_SOCIAL_HEIGHT = 628 * BRANDING_MODAL_SOCIAL_SCALE;
const BRANDING_MODAL_BADGE_SCALE = BRANDING_MODAL_SOCIAL_HEIGHT / 1024;
const BRANDING_MODAL_SOCIAL_COLLAPSE_MARGIN = -628 * (1 - BRANDING_MODAL_SOCIAL_SCALE);

type CardBrandingDraft = {
  card_color: string;
  card_font: string;
  horizontal_text_color: string;
  vertical_text_color: string;
};

function cloneCardBrandingDraft(d: CardBrandingDraft): CardBrandingDraft {
  return { ...d };
}

function cardBrandingDraftsEqual(a: CardBrandingDraft, b: CardBrandingDraft) {
  return (
    a.card_color === b.card_color &&
    a.card_font === b.card_font &&
    a.horizontal_text_color === b.horizontal_text_color &&
    a.vertical_text_color === b.vertical_text_color
  );
}

async function readResponsePayload(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json().catch(() => null);
  }
  const text = await res.text().catch(() => "");
  return text ? { error: text } : null;
}

function getPayloadError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function EventContent({ params }: { params: Promise<{ id: string }> }) {
  const EVENT_NAME_MAX_CHARS = 18;
  const CAMPAIGN_DESCRIPTION_MAX_CHARS = 220;
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
  const [editForm, setEditForm] = useState({ name: "", description: "", location: "", location_type: "onsite", date: "", time: "", logo: "" });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isEditingCampaignDescription, setIsEditingCampaignDescription] = useState(false);
  const [campaignDescriptionDraft, setCampaignDescriptionDraft] = useState("");
  const [isSavingCampaignDescription, setIsSavingCampaignDescription] = useState(false);

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
  const [isRegistrationFormOpen, setIsRegistrationFormOpen] = useState(false);
  const [isBrandingOpen, setIsBrandingOpen] = useState(false);
  const [formBuilderRole, setFormBuilderRole] = useState<"guest" | "visitor">("visitor");
  const [registrationFormDraft, setRegistrationFormDraft] = useState<RegistrationFormConfig>(
    getDefaultRegistrationFormConfig(),
  );
  const [isSavingRegistrationForm, setIsSavingRegistrationForm] = useState(false);
  const [brandingDraft, setBrandingDraft] = useState<CardBrandingDraft>({
    card_color: "purple",
    card_font: "inter",
    horizontal_text_color: "",
    vertical_text_color: "",
  });
  const [brandingUndoStack, setBrandingUndoStack] = useState<CardBrandingDraft[]>([]);
  const [brandingRedoStack, setBrandingRedoStack] = useState<CardBrandingDraft[]>([]);
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  const editBrandingDraft = useCallback((recipe: (prev: CardBrandingDraft) => CardBrandingDraft) => {
    setBrandingDraft((prev) => {
      const next = recipe(prev);
      if (cardBrandingDraftsEqual(prev, next)) return prev;
      const snapshot = cloneCardBrandingDraft(prev);
      setBrandingUndoStack((s) => [...s, snapshot]);
      setBrandingRedoStack([]);
      return next;
    });
  }, []);

  const undoBrandingEdit = useCallback(() => {
    if (brandingUndoStack.length === 0) return;
    const past = [...brandingUndoStack];
    const restored = past.pop()!;
    setBrandingRedoStack((redo) => [cloneCardBrandingDraft(brandingDraft), ...redo]);
    setBrandingUndoStack(past);
    setBrandingDraft(restored);
  }, [brandingDraft, brandingUndoStack]);

  const redoBrandingEdit = useCallback(() => {
    if (brandingRedoStack.length === 0) return;
    const redoList = [...brandingRedoStack];
    const replay = redoList.shift()!;
    setBrandingUndoStack((u) => [...u, cloneCardBrandingDraft(brandingDraft)]);
    setBrandingRedoStack(redoList);
    setBrandingDraft(replay);
  }, [brandingDraft, brandingRedoStack]);
  const [showBrandCustomColorPicker, setShowBrandCustomColorPicker] = useState(false);
  const [draftBrandCustomColor, setDraftBrandCustomColor] = useState("#2563EB");
  const [brandCustomColorAnchorRect, setBrandCustomColorAnchorRect] = useState<DOMRect | null>(null);
  const [showBrandTextColorPicker, setShowBrandTextColorPicker] = useState(false);
  const [draftBrandTextColor, setDraftBrandTextColor] = useState("#FFFFFF");
  const [brandTextColorAnchorRect, setBrandTextColorAnchorRect] = useState<DOMRect | null>(null);
  const [activeBrandTextTarget, setActiveBrandTextTarget] = useState<"horizontal" | "vertical">("horizontal");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<"text" | "number" | "url">("text");
  const [editingCustomFieldId, setEditingCustomFieldId] = useState<string | null>(null);
  const [isAccessRequestOpen, setIsAccessRequestOpen] = useState(false);
  const [accessRequestAction, setAccessRequestAction] = useState("manage_event");
  const [accessRequestNote, setAccessRequestNote] = useState("");
  const [isSubmittingAccessRequest, setIsSubmittingAccessRequest] = useState(false);
  const [pendingAccessRequests, setPendingAccessRequests] = useState<PendingAccessRequest[]>([]);
  const [isAccessInboxOpen, setIsAccessInboxOpen] = useState(false);
  const [isAccessControlOpen, setIsAccessControlOpen] = useState(false);
  const [activeGrants, setActiveGrants] = useState<ActiveGrant[]>([]);
  const [isLoadingGrants, setIsLoadingGrants] = useState(false);
  const [revokingGrantId, setRevokingGrantId] = useState<string | null>(null);
  const [grantedPermissions, setGrantedPermissions] = useState<string[]>([]);
  const [isOrgAdminReviewer, setIsOrgAdminReviewer] = useState(false);
  const [organizationBranding, setOrganizationBranding] = useState({
    name: "",
    logoUrl: "",
  });
  const { data: session, status: sessionStatus } = useSession();
  const userId = session?.user?.id || "";
  const { presets, fadeUp, staggerItem, hoverLift, hoverIconNudge } = useDashboardMotion();
  const { refreshTick } = useAutoRefresh(Boolean(userId));
  /** When only `refreshTick` changes (focus / interval), refetch without full-page skeleton so modals and file pickers are not unmounted mid-interaction. */
  const eventPageLoadKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (sessionStatus === "loading") return;

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
        if (eventRes.status === 404) {
          if (!silentPoll) {
            toast.error("This campaign no longer exists.");
          }
          router.replace(isPreviewMode ? "/admin" : "/dashboard");
          return;
        }
        if (!eventRes.ok) throw new Error(eventPayload?.error || "Failed to load event.");
        const eventRecord = eventPayload.data;
        if (!isMounted) return;

        try {
          const brandingRes = await fetch(`/api/events/${id}/branding`);
          const brandingPayload = await brandingRes.json().catch(() => null);
          if (brandingRes.ok && brandingPayload?.data && isMounted) {
            setOrganizationBranding({
              name: String(brandingPayload.data.organizationName || ""),
              logoUrl: String(brandingPayload.data.organizationLogoUrl || ""),
            });
          }
        } catch {
          // Keep fallback branding values when branding endpoint fails.
        }

        setEventData({
          id: eventRecord.id,
          name: eventRecord.name,
          description: eventRecord.description || "",
          location: eventRecord.location,
          location_type: eventRecord.location_type || "onsite",
          date: eventRecord.date,
          time: eventRecord.time || "",
          user: eventRecord.user_id,
          logo_url: eventRecord.logo_url || "",
          sponsors: parseEventSponsors(eventRecord.sponsors),
          registration_form_config: normalizeRegistrationFormConfig(eventRecord.registration_form_config),
          card_color: String(eventRecord.card_color || "purple"),
          card_font: String(eventRecord.card_font || "inter"),
          horizontal_text_color: String(eventRecord.horizontal_text_color || ""),
          vertical_text_color: String(eventRecord.vertical_text_color || ""),
          is_branding_finalized: Boolean(eventRecord.is_branding_finalized),
        });
        if (!isBrandingOpen) {
          setBrandingDraft({
            card_color: String(eventRecord.card_color || "purple"),
            card_font: String(eventRecord.card_font || "inter"),
            horizontal_text_color: String(eventRecord.horizontal_text_color || ""),
            vertical_text_color: String(eventRecord.vertical_text_color || ""),
          });
        }

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
            role: String(secure.role || "Lead"),
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
  }, [id, router, impersonateId, isPreviewMode, userId, refreshTick, sessionStatus, isBrandingOpen]);

  const status = useMemo(() => getEventStatus(eventData?.date), [eventData?.date]);
  const minCampaignDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().slice(0, 10);
  }, []);
  const isEventOwner = Boolean(eventData?.user && currentUserId && eventData.user === currentUserId);
  const canReviewAccessRequests = isEventOwner;
  const canManageEvent = isEventOwner || grantedPermissions.includes("manage_event");
  const canDeleteEvent = canManageEvent || grantedPermissions.includes("delete_event");
  const canEditCards = canManageEvent || grantedPermissions.includes("edit_cards");
  const canDeleteCards = canManageEvent || grantedPermissions.includes("delete_cards");
  const canExport = canManageEvent;
  const isTeamMemberEventMode = !isPreviewMode && !isEventOwner && isOrgAdminReviewer;
  const isOrgAdminEventMode = !isPreviewMode && isEventOwner;
  const effectiveRegistrationConfig = normalizeRegistrationFormConfig(
    eventData?.registration_form_config || getDefaultRegistrationFormConfig(),
  );
  const previewGuestFields = getEnabledFieldsForRole(effectiveRegistrationConfig, "guest");
  const previewVisitorFields = getEnabledFieldsForRole(effectiveRegistrationConfig, "visitor");
  const isBrandingFinalized = Boolean(eventData?.is_branding_finalized);
  const brandingPreviewData = useMemo(
    () => ({
      eventName: eventData?.name || "New Event",
      sessionDate: eventData?.date || "",
      sessionTime: eventData?.time || "",
      location: eventData?.location || "",
      cardRole: "visitor" as const,
      name: "Attendee Name",
      role: "Role/Title",
      company: "Organization",
      color: brandingDraft.card_color || "purple",
      fontFamily: brandingDraft.card_font || "inter",
      horizontalTextColor: brandingDraft.horizontal_text_color || "",
      verticalTextColor: brandingDraft.vertical_text_color || "",
      sponsors: eventData?.sponsors || [],
      organizationName: organizationBranding.name || "Organization",
      organizationLogoUrl: organizationBranding.logoUrl || eventData?.logo_url || "",
      linkedin: "",
    }),
    [eventData, brandingDraft, organizationBranding],
  );
  const isBrandCustomThemeSelected = !BRAND_PRESET_THEME_NAMES.has(brandingDraft.card_color || "");
  const isBrandCustomPickerActive = showBrandCustomColorPicker || isBrandCustomThemeSelected;

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
  const ownerGuestCount = cards.filter((card) => String(card.track || "").toLowerCase() === "guest").length;
  const ownerVisitorCount = cards.filter((card) => String(card.track || "").toLowerCase() === "visitor").length;
  const ownerTopRoles = useMemo(() => {
    const roleMap = new Map<string, number>();
    for (const card of cards) {
      const role = String(card.role || "Lead").trim() || "Lead";
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
    cancelCampaignDescriptionEdit();
    setEditForm({
      name: eventData.name || "",
      description: eventData.description || "",
      location: eventData.location_type === "webinar" ? "" : (eventData.location || ""),
      location_type: eventData.location_type || "onsite",
      date: eventData.date || "",
      time: eventData.time || "",
      logo: eventData.logo_url || "",
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
    if (editForm.date < minCampaignDate) {
      toast.error("Campaign date must be today or in the future.");
      return;
    }

    setIsSavingEdit(true);
    try {
      let logo_url = eventData?.logo_url || "";
      if (editForm.logo && editForm.logo.startsWith("data:")) {
        if (!userId) {
          throw new Error("You must be logged in to update campaign logo.");
        }
        const uploadRes = await fetch("/api/media/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataUrl: editForm.logo,
            folder: `events/${userId}`,
          }),
        });
        const uploadPayload = await readResponsePayload(uploadRes);
        const uploadedUrl =
          uploadPayload && typeof uploadPayload === "object" && "data" in uploadPayload
            ? (uploadPayload as { data?: { url?: unknown } }).data?.url
            : undefined;
        if (!uploadRes.ok || !uploadedUrl) {
          throw new Error(getPayloadError(uploadPayload, "Campaign logo upload failed."));
        }
        logo_url = String(uploadedUrl);
      } else if (typeof editForm.logo === "string" && editForm.logo.trim()) {
        logo_url = editForm.logo.trim();
      }

      const updateRes = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description,
          location: editForm.location_type === "webinar" ? "Webinar" : editForm.location,
          location_type: editForm.location_type,
          date: editForm.date,
          time: editForm.time,
          logo_url,
        }),
      });
      const updatePayload = await readResponsePayload(updateRes);
      if (!updateRes.ok) throw new Error(getPayloadError(updatePayload, "Failed to update event."));

      setEventData((prev) => prev ? {
        ...prev,
        name: editForm.name,
        description: editForm.description,
        location: editForm.location_type === "webinar" ? "Webinar" : editForm.location,
        location_type: editForm.location_type,
        date: editForm.date,
        time: editForm.time,
        logo_url,
      } : prev);
      toast.success("Campaign updated.");
      cancelCampaignDescriptionEdit();
      router.refresh();
      setIsEditOpen(false);
    } catch (err) {
      console.error("Error updating event:", err);
      toast.error("Failed to update campaign.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const cancelCampaignDescriptionEdit = () => {
    if (isSavingCampaignDescription) return;
    setIsEditingCampaignDescription(false);
    setCampaignDescriptionDraft("");
  };

  const saveCampaignDescription = async () => {
    if (!eventData || isPreviewMode || !canManageEvent || isSavingCampaignDescription) return;
    const next = campaignDescriptionDraft.trim();
    if (next.length > CAMPAIGN_DESCRIPTION_MAX_CHARS) {
      toast.error(`Description can be up to ${CAMPAIGN_DESCRIPTION_MAX_CHARS} characters.`);
      return;
    }
    setIsSavingCampaignDescription(true);
    try {
      const updateRes = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: next }),
      });
      const updatePayload = await readResponsePayload(updateRes);
      if (!updateRes.ok) throw new Error(getPayloadError(updatePayload, "Failed to update description."));
      setEventData((prev) => (prev ? { ...prev, description: next } : prev));
      setIsEditingCampaignDescription(false);
      setCampaignDescriptionDraft("");
      toast.success("Campaign description updated.");
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update description.");
    } finally {
      setIsSavingCampaignDescription(false);
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
        const uploadPayload = await readResponsePayload(uploadRes);
        const uploadedUrl =
          uploadPayload && typeof uploadPayload === "object" && "data" in uploadPayload
            ? (uploadPayload as { data?: { url?: unknown } }).data?.url
            : undefined;
        if (!uploadRes.ok || !uploadedUrl) {
          throw new Error(getPayloadError(uploadPayload, "Logo upload failed."));
        }
        logo_url = String(uploadedUrl);
      }

      // Create a duplicate/renewed event in DB instead of updating the old one
      const insertPayload = {
        name: eventData?.name || "Renewed Event",
        description: eventData?.description || "",
        location: renewForm.location.trim(),
        location_type: eventData?.location_type || "onsite",
        date: renewForm.date,
        time: eventData?.time || "",
        logo_url: logo_url,
        user_id: userId,
        sponsors: eventData?.sponsors?.length ? eventData.sponsors : [],
        registration_form_config:
          eventData?.registration_form_config || getDefaultRegistrationFormConfig(),
        card_color: eventData?.card_color || "purple",
        card_font: eventData?.card_font || "inter",
        horizontal_text_color: eventData?.horizontal_text_color || "",
        vertical_text_color: eventData?.vertical_text_color || "",
        is_branding_finalized: Boolean(eventData?.is_branding_finalized),
      };
      const createRes = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...insertPayload,
          ownerId: userId,
        }),
      });
      const createPayload = await readResponsePayload(createRes);
      if (!createRes.ok) {
        throw new Error(getPayloadError(createPayload, "Database insert failed."));
      }
      const createdEventId =
        createPayload && typeof createPayload === "object" && "data" in createPayload
          ? (createPayload as { data?: { id?: unknown } }).data?.id
          : undefined;
      if (!createdEventId) {
        throw new Error("Insert failed: no data returned.");
      }

      toast.success(`Event renewed successfully! Redirecting...`);
      setIsRenewOpen(false);
      
      // Redirect to the newly created event
      router.refresh();
      router.push(`/dashboard/events/${String(createdEventId)}`);
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
          description: eventData.description || "",
          location: eventData.location,
          location_type: eventData.location_type || "onsite",
          date: eventData.date,
          time: eventData.time || "",
          logo_url: eventData.logo_url || "",
          sponsors: eventData.sponsors?.length ? eventData.sponsors : [],
          registration_form_config:
            eventData.registration_form_config || getDefaultRegistrationFormConfig(),
          card_color: eventData.card_color || "purple",
          card_font: eventData.card_font || "inter",
          horizontal_text_color: eventData.horizontal_text_color || "",
          vertical_text_color: eventData.vertical_text_color || "",
          is_branding_finalized: Boolean(eventData.is_branding_finalized),
          ownerId: userId,
        }),
      });
      const duplicatePayload = await readResponsePayload(duplicateRes);
      if (!duplicateRes.ok) throw new Error(getPayloadError(duplicatePayload, "Failed to duplicate event."));
      const createdId =
        duplicatePayload && typeof duplicatePayload === "object" && "data" in duplicatePayload
          ? (duplicatePayload as { data?: { id?: unknown } }).data?.id
          : undefined;

      toast.success("Event duplicated.");
      if (createdId) {
        router.refresh();
        router.push(`/dashboard/events/${String(createdId)}`);
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
      toast.error("You cannot delete an event with registered leads.");
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
      const deletePayload = await readResponsePayload(deleteRes);
      if (!deleteRes.ok) {
        throw new Error(getPayloadError(deletePayload, "Could not delete event."));
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
      const savePayload = await readResponsePayload(saveRes);
      if (!saveRes.ok) throw new Error(getPayloadError(savePayload, "Failed to save sponsors."));
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

  const openRegistrationFormModal = (role: "guest" | "visitor") => {
    setFormBuilderRole(role);
    setEditingCustomFieldId(null);
    setNewFieldLabel("");
    setNewFieldType("text");
    setRegistrationFormDraft(
      normalizeRegistrationFormConfig(
        eventData?.registration_form_config || getDefaultRegistrationFormConfig(),
      ),
    );
    setIsRegistrationFormOpen(true);
  };

  const updateDraftFields = (
    role: "guest" | "visitor",
    updater: (fields: RegistrationFieldDefinition[]) => RegistrationFieldDefinition[],
  ) => {
    setRegistrationFormDraft((prev) => ({ ...prev, [role]: updater(prev[role]) }));
  };

  const saveRegistrationFormConfig = async () => {
    if (!eventData || isPreviewMode) return;
    setIsSavingRegistrationForm(true);
    try {
      const normalized = normalizeRegistrationFormConfig(registrationFormDraft);
      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_form_config: normalized }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(payload?.error || "Could not save registration form.");
        return;
      }
      setEventData((prev) => (prev ? { ...prev, registration_form_config: normalized } : prev));
      toast.success("Registration form settings saved.");
      setIsRegistrationFormOpen(false);
      router.refresh();
    } catch {
      toast.error("Could not save registration form.");
    } finally {
      setIsSavingRegistrationForm(false);
    }
  };

  const saveBrandingConfig = async () => {
    if (!eventData || isPreviewMode) return;
    setIsSavingBranding(true);
    try {
      const payload = {
        card_color: brandingDraft.card_color || "purple",
        card_font: brandingDraft.card_font || "inter",
        horizontal_text_color: brandingDraft.horizontal_text_color.trim(),
        vertical_text_color: brandingDraft.vertical_text_color.trim(),
        is_branding_finalized: true,
      };
      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error || "Could not save card branding.");
        return;
      }
      setEventData((prev) => (prev ? { ...prev, ...payload, is_branding_finalized: true } : prev));
      toast.success("Card branding saved.");
      setIsBrandingOpen(false);
      router.refresh();
    } catch (err) {
      console.error("Branding save error:", err);
      toast.error("Could not save card branding.");
    } finally {
      setIsSavingBranding(false);
    }
  };

  const addCustomFieldToDraft = () => {
    const label = newFieldLabel.trim();
    if (!label) {
      toast.error("Field label is required.");
      return;
    }
    if (editingCustomFieldId) {
      updateDraftFields(formBuilderRole, (fields) =>
        fields.map((field) =>
          field.id === editingCustomFieldId
            ? {
                ...field,
                label,
                inputType: newFieldType,
                placeholder: label,
              }
            : field,
        ),
      );
      setEditingCustomFieldId(null);
      setNewFieldLabel("");
      setNewFieldType("text");
      return;
    }
    const idBase = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
    const fieldId = `${idBase}_${Date.now().toString().slice(-5)}`;
    updateDraftFields(formBuilderRole, (fields) => [
      ...fields,
      {
        id: fieldId,
        label,
        inputType: newFieldType,
        required: false,
        enabled: true,
        placeholder: label,
      },
    ]);
    setNewFieldLabel("");
    setNewFieldType("text");
  };
  const startEditCustomField = (field: RegistrationFieldDefinition) => {
    setEditingCustomFieldId(field.id);
    setNewFieldLabel(field.label);
    if (field.inputType === "number" || field.inputType === "url" || field.inputType === "text") {
      setNewFieldType(field.inputType);
    } else {
      setNewFieldType("text");
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
    link.download = `${eventData?.name || 'event'}-leads-export.csv`;
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
    setRevokingGrantId(grantId);
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
    } finally {
      setRevokingGrantId((current) => (current === grantId ? null : current));
    }
  };

  const openShareActions = (url: string, role: "guest" | "visitor") => {
    const message = `We are hosting ${eventData?.name || "our event"}. Register here: ${url}`;
    setShareDraftUrl(url);
    setShareDraftMessage(message);
    setShareDraftRole(role);
    setIsShareActionsOpen(true);
  };

  const renderCampaignDescriptionSection = (): ReactNode => {
    if (!eventData || isPreviewMode) return null;
    const trimmed = String(eventData.description || "").trim();
    const canEditInline = canManageEvent;
    const showComposer = Boolean(canEditInline && isEditingCampaignDescription);

    return (
      <div className="rounded-md border border-primary/20 bg-white/90 px-4 py-3.5 shadow-sm">
        <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-heading/75">
          <FileText size={13} className="text-primary-strong shrink-0" />
          About this campaign
        </p>
        {showComposer ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={campaignDescriptionDraft}
              onChange={(e) => setCampaignDescriptionDraft(e.target.value)}
              maxLength={CAMPAIGN_DESCRIPTION_MAX_CHARS}
              rows={4}
              className="w-full min-h-[100px] resize-y rounded-md border border-border/70 bg-white px-3 py-2 text-sm leading-relaxed text-heading outline-none focus:ring-2 focus:ring-primary/35"
              placeholder="Add a campaign description..."
              aria-label="Campaign description"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-muted">
                {campaignDescriptionDraft.length}/{CAMPAIGN_DESCRIPTION_MAX_CHARS}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelCampaignDescriptionEdit}
                  disabled={isSavingCampaignDescription}
                  className="inline-flex items-center rounded-md border border-border px-2.5 py-1 text-[12px] font-medium text-muted transition-all duration-150 hover:text-heading hover:bg-surface-strong/80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveCampaignDescription()}
                  disabled={isSavingCampaignDescription}
                  className="inline-flex items-center rounded-md bg-primary px-2.5 py-1 text-[12px] font-medium text-primary-foreground transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingCampaignDescription ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <p className="m-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-heading/85">
              {trimmed ? eventData.description : "No campaign description added yet."}
            </p>
            {canEditInline && (
              <button
                type="button"
                onClick={() => {
                  setCampaignDescriptionDraft(String(eventData.description || ""));
                  setIsEditingCampaignDescription(true);
                }}
                className="inline-flex shrink-0 items-center justify-center rounded-md border border-border/70 bg-white p-1.75 text-muted transition-all duration-200 hover:border-primary/40 hover:bg-primary/10 hover:text-primary-strong hover:shadow-sm hover:scale-[1.04] active:scale-100 disabled:opacity-60"
                aria-label="Edit campaign description"
                title="Edit campaign description"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    );
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
        <Button variant="secondary" icon={<ArrowLeft size={16} />} href="/dashboard" className="relative z-10">
          Back to Dashboard
        </Button>
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
        <motion.div className="relative z-30 mb-7 sm:mb-9" viewport={presets.viewport} {...fadeUp(0.02)}>
          <button
            type="button"
            onClick={() => {
              router.refresh();
              if (isPreviewMode) {
                const target = eventData?.user ? `/dashboard?impersonate=${encodeURIComponent(eventData.user)}` : "/admin";
                router.push(target);
                return;
              }
              router.push("/dashboard");
            }}
            className="flex items-center gap-2.5 text-base font-semibold text-heading hover:text-primary-strong hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-inline mb-1.5 group -ml-1 sm:-ml-2 bg-transparent border-none cursor-pointer py-1"
          >
            <motion.span {...hoverIconNudge(-2)} className="inline-flex">
              <ArrowLeft size={16} className="transition-transform" />
            </motion.span>
            {isPreviewMode ? "Back to Organization View" : "Back to Dashboard"}
          </button>
          <span className="block text-sm font-normal tracking-[0.01em] leading-tight text-muted/70 mb-4">
            Campaign details
          </span>

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 lg:gap-10">
          <div className="min-w-0 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
              <h1
                className="text-4xl sm:text-5xl lg:text-6xl font-bold text-heading tracking-tight leading-[1.1]"
                style={{ fontWeight: 700 }}
              >
                {eventData.name}
              </h1>
              <span className={`inline-flex shrink-0 text-[13px] font-medium tracking-[0.01em] leading-tight px-3 py-1 rounded-md border ${status.classes}`}>
                {status.label}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-1 mt-2 text-sm text-muted font-medium">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar size={16} className="text-muted/70 shrink-0" />
                <span className="tabular-nums">{eventData.date}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                {(eventData.location_type === "webinar" || (eventData.location || "").trim().toLowerCase() === "webinar") ? (
                  <Globe size={16} className="text-muted/70 shrink-0" />
                ) : (
                  <MapPin size={16} className="text-muted/70 shrink-0" />
                )}
                <span className="min-w-0 truncate">{eventData.location}</span>
              </div>
            </div>
            {isTeamMemberEventMode && (
              <p className="mt-2 text-sm text-heading/75">
                Team execution mode: you can work inside granted permissions for this campaign.
              </p>
            )}
          </div>

          <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-2 lg:ml-auto lg:max-w-[min(100%,44rem)] lg:justify-end relative z-20 shrink-0">
            {!isPreviewMode && (
              <>
                <div className="relative" ref={shareRef}>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!isBrandingFinalized) {
                        toast.error("Please save card branding before sharing registration links.");
                        return;
                      }
                      setIsShareOpen(!isShareOpen);
                    }}
                    disabled={status.label === "Past" || !isBrandingFinalized}
                    icon={<LinkIcon size={18} />}
                    className={`hidden sm:flex transition-all duration-150 ${isShareOpen ? "border-primary/55 bg-primary/15 text-primary-strong" : ""} ${status.label === "Past" || !isBrandingFinalized ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
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
                          const url = `${window.location.origin}/r/${eventData.short_id || eventData.id}?r=v`;
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
                  onClick={() => {
                    if (!isBrandingFinalized) {
                      toast.error("Please save card branding before sharing registration links.");
                      return;
                    }
                    setIsShareOpen(!isShareOpen);
                  }}
                  disabled={status.label === "Past" || !isBrandingFinalized}
                  icon={<LinkIcon size={18} />}
                  className={`flex sm:hidden px-4 ${status.label === "Past" || !isBrandingFinalized ? "opacity-50 cursor-not-allowed grayscale" : ""}`}
                >
                  <span className="sr-only">Share Form Link</span>
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (!canManageEvent) return;
                    setBrandingDraft({
                      card_color: String(eventData?.card_color || "purple"),
                      card_font: String(eventData?.card_font || "inter"),
                      horizontal_text_color: String(eventData?.horizontal_text_color || ""),
                      vertical_text_color: String(eventData?.vertical_text_color || ""),
                    });
                    setBrandingUndoStack([]);
                    setBrandingRedoStack([]);
                    setIsBrandingOpen(true);
                  }}
                  disabled={!canManageEvent}
                  icon={<Layers3 size={16} />}
                  className={!canManageEvent ? "opacity-50 cursor-not-allowed grayscale" : ""}
                >
                  Card Branding
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
                    className={
                      !canManageEvent
                        ? "opacity-50 cursor-not-allowed grayscale"
                        : "transition-shadow duration-200 hover:shadow-md hover:border-primary/50 hover:bg-primary/9"
                    }
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
                  title={cards.length > 0 ? "Events with registered leads cannot be deleted." : ""}
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
          </div>
        </motion.div>
        {!isPreviewMode && !isBrandingFinalized && (
          <div className="mb-6 rounded-md border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Please save card branding first, then you can use <span className="font-semibold">Share Link</span> for Guest/Visitor registrations.
          </div>
        )}

        {isPreviewMode && (
          <div className="motion-token-enter mb-8 p-5 rounded-xl border border-primary/20 bg-linear-to-br from-white/95 to-info/5 shadow-xl backdrop-blur-xl relative overflow-hidden ring-1 ring-white/20">
            {/* Background decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-info/5 rounded-full -ml-12 -mb-12 blur-xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.8)]" />
                    <span className="text-[11px] font-medium uppercase tracking-wide text-primary-strong">Security Oversight Active</span>
                  </div>
                  <h2 className="ui-section-heading">Platform Audit Layer</h2>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-sm border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-primary-strong">
                    <ShieldCheck size={11} /> Super Admin
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-sm border border-amber-300/40 bg-amber-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-700">
                    <Activity size={11} /> View Only
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-sm border border-danger/20 bg-danger/5 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-danger">
                    <Lock size={11} /> Immutable Mode
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-md bg-white/60 border border-white/60 text-sm font-normal text-muted/90 leading-relaxed shadow-sm">
                This campaign is currently locked for <span className="text-heading font-semibold">Administrative Inspection</span>. You have high-level visibility over all engagement metrics and lead data, but record modification and deletion are restricted to maintain audit integrity.
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
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-primary/25 bg-primary/12 text-primary-strong">
                    <Activity size={20} />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-2xl sm:text-[30px] font-bold tracking-[-0.02em] text-primary-strong leading-tight">
                      Campaign Management Console
                    </span>
                  </div>
                </div>
              </div>

              {renderCampaignDescriptionSection()}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <motion.div
                  className="rounded-sm border border-primary/20 bg-white/85 px-4 py-3 motion-token-enter motion-token-hover"
                  viewport={presets.viewport}
                  {...fadeUp(0.06)}
                  {...hoverLift(-2, 1.005)}
                >
                  <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-heading/75">
                    <Layers3 size={13} className="text-primary-strong" />
                    Leads Composition
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { label: "Guests",   value: ownerGuestCount,           bg: "bg-primary/10", border: "border-primary/20", text: "text-primary-strong" },
                      { label: "Visitors", value: ownerVisitorCount,         bg: "bg-info/10",    border: "border-info/20",    text: "text-info" },
                    ].map((item, idx) => (
                      <motion.div
                        key={item.label}
                        className={`flex flex-col items-center justify-center gap-1 rounded-md border py-3 px-2 ${item.bg} ${item.border}`}
                        viewport={presets.viewport}
                        {...staggerItem(idx, 0.04, 0.18, 8, 0.24)}
                      >
                        <span className="text-2xl font-semibold text-heading tracking-[-0.02em] leading-none">
                          {item.value}
                        </span>
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${item.text} text-center leading-tight mt-1`}>
                          {item.label}
                        </span>
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
                      <p className="text-sm text-muted">No lead roles yet.</p>
                    ) : (
                      ownerTopRoles.slice(0, 3).map((entry, roleIdx) => (
                        <motion.div
                          key={entry.role}
                          className="flex items-center justify-between rounded-md border border-border/60 bg-white/60 p-2.5 transition-colors hover:bg-white"
                          viewport={presets.viewport}
                          {...staggerItem(roleIdx, 0.04, 0.2, 8, 0.24)}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary-strong">
                              {roleIdx + 1}
                            </span>
                            <span className="truncate text-sm font-medium text-heading">
                              {entry.role}
                            </span>
                          </div>
                          <div className="rounded-full bg-heading/5 px-2.5 py-0.5 text-xs font-semibold text-heading/80">
                            {entry.count}
                          </div>
                        </motion.div>
                      ))
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

        {!isOrgAdminEventMode && !isPreviewMode && (
          <motion.div className="mb-8" viewport={presets.viewport} {...fadeUp(0.06)}>
            {renderCampaignDescriptionSection()}
          </motion.div>
        )}

        {!isPreviewMode && (
          <motion.div
            className="mb-8 rounded-md border border-primary/20 bg-white/90 px-6 py-6 shadow-sm"
            viewport={presets.viewport}
            {...fadeUp(0.08)}
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-heading tracking-[-0.02em]">Registration Form Preview</h3>
                  <p className="text-sm text-muted mt-1">
                    Click preview form to open preview & edit controls.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border border-border/60 bg-white p-4.5">
                  <p className="text-[22px] font-semibold text-heading leading-tight">Guest Form</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mb-3 h-10! px-4 text-[15px]"
                    disabled={!canManageEvent}
                    onClick={() => openRegistrationFormModal("guest")}
                    >
                    Preview Form
                  </Button>
                  {!canManageEvent && (
                    <p className="text-[11px] text-muted -mt-2 mb-2">You need campaign manage access to edit fields.</p>
                  )}
                  <p className="mt-2 text-sm text-muted">{previewGuestFields.length} fields configured</p>
                </div>
                <div className="rounded-md border border-border/60 bg-white p-4.5">
                  <p className="text-[22px] font-semibold text-heading leading-tight">Visitor Form</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mb-3 h-10! px-4 text-[15px]"
                    disabled={!canManageEvent}
                    onClick={() => openRegistrationFormModal("visitor")}
                  >
                    Preview Form
                  </Button>
                  {!canManageEvent && (
                    <p className="text-[11px] text-muted -mt-2 mb-2">You need campaign manage access to edit fields.</p>
                  )}
                  <p className="mt-2 text-sm text-muted">{previewVisitorFields.length} fields configured</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats Section */}
        {!isOrgAdminEventMode && !isPreviewMode && (
          <motion.div
            className={`relative overflow-hidden p-6 rounded-2xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-8 group transition-all duration-500 animate-slide-up ${
              isTeamMemberEventMode
                ? "bg-linear-to-br from-white to-primary/5 border border-primary/20 shadow-sm"
                : "bg-linear-to-br from-heading to-[#1e293b] border border-white/10 shadow-md"
            }`}
            viewport={presets.viewport}
            {...fadeUp(0.06)}
          >
            {/* Animated Background Decorative Elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-primary/20 transition-all duration-700 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-info/5 rounded-full -ml-24 -mb-24 blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
              <div className={`w-14 h-14 flex items-center justify-center shrink-0 rounded-md shadow-sm transition-all duration-500 group-hover:scale-105 ${
                isTeamMemberEventMode
                  ? "bg-primary text-white shadow-primary/20" 
                  : "bg-white/10 text-primary backdrop-blur-md shadow-black/10"
              }`}>
                <Users size={28} />
              </div>
              
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className={`ui-meta ${
                    isTeamMemberEventMode ? "text-primary-strong" : "text-primary/80"
                  }`}>Live Engagement</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-5xl font-medium tracking-[-0.01em] leading-[1.02] ${
                    isTeamMemberEventMode ? "text-heading" : "text-white"
                  }`}>
                    <AnimatedCounter value={cards.length} />
                  </span>
                  <span className={`text-lg font-black uppercase tracking-wide ${
                    isTeamMemberEventMode ? "text-primary-strong" : "text-white/40"
                  }`}>Leads</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 flex flex-wrap justify-center md:justify-end items-center gap-4">
              {cards.length > 0 && (
                <Button
                  variant={isTeamMemberEventMode ? "secondary" : "primary"}
                  onClick={handleExport}
                  disabled={status.label === "Past" || !canExport}
                  icon={<Download size={20} />}
                  className={`h-12 px-6 rounded-md font-semibold text-xs shadow-sm transition-all duration-300 ${
                    isTeamMemberEventMode
                      ? "bg-white border-primary/20 hover:border-primary/40 hover:bg-primary/5 text-primary-strong" 
                      : "bg-primary hover:bg-primary-strong text-white border-none shadow-primary/30"
                  } ${status.label === "Past" || !canExport ? "opacity-50 grayscale" : "hover:-translate-y-1 active:scale-95"}`}
                >
                  Export Registry
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {/* Search Bar */}
        <motion.div className="flex flex-col sm:flex-row gap-3 mb-4 delay-200" viewport={presets.viewport} {...fadeUp(0.1)}>
          <div className="relative flex-1 group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-muted/30 group-focus-within:text-primary transition-colors z-10 pointer-events-none" size={20} strokeWidth={2.5} />
            <input
              type="text"
              placeholder="Search leads in this campaign..."
              className={`w-full h-14 pl-16 pr-8 py-0 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all text-base font-medium leading-[1.6] text-heading shadow-md placeholder:text-muted/30 ${
                isPreviewMode
                  ? "bg-white/90 border border-primary/20 focus:bg-white"
                  : "bg-white/70 backdrop-blur-md border border-white/40 focus:bg-white"
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
              <p className="text-heading font-medium text-lg">No leads yet</p>
              <p className="text-sm text-muted">Share the registration link to invite leads to register for this campaign.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 animate-slide-up delay-300">
            {filteredCards.length > 0 ? (
              filteredCards.map((card, idx) => (
                <motion.div
                  key={card.id}
                className={`group motion-token-enter motion-token-hover flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-md hover:-translate-y-0.5 ${
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
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/20 overflow-hidden ring-offset-2 ring-primary/10 group-hover:ring-2 transition-all duration-500 transform group-hover:scale-105">
                        {card.photo ? (
                          <Image
                            src={card.photo}
                            alt={card.name}
                            width={56}
                            height={56}
                            sizes="56px"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User size={24} strokeWidth={1.5} className="text-primary-strong/40" />
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[11px] text-primary-foreground font-semibold border-2 border-white leading-[1.02] shadow-sm">
                        {card.name.charAt(0)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-base text-heading group-hover:text-primary-strong transition-colors truncate leading-tight">
                          {card.name}
                        </h3>
                        {(card.track === "guest" && card.guestCategory) && (
                          <span className="text-[14px] bg-primary/10 px-3 py-1 rounded-inline border border-primary/20 text-primary-strong font-semibold tracking-[0em] leading-[1.2] shrink-0">
                            {card.guestCategory}
                          </span>
                        )}
                        {card.company && (
                          <span className="text-[14px] bg-primary/10 px-3 py-1 rounded-inline border border-primary/20 text-primary-strong font-semibold tracking-[0em] leading-[1.2] shrink-0">
                            {card.company}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 ui-meta mt-0.5">
                        <span className="flex items-center">{card.role}</span>
                        {card.email && (
                          <span className="hidden sm:inline-flex items-center gap-1 opacity-70">
                            • {card.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      href={`/cards/${card.id}${isPreviewMode && impersonateId ? `?impersonate=${encodeURIComponent(impersonateId)}` : ""}`}
                      variant="secondary"
                      icon={
                        <motion.span {...hoverIconNudge(2)} className="inline-flex">
                          <ExternalLink size={14} />
                        </motion.span>
                      }
                      className="shrink-0 rounded-md bg-white/60 border-white/60 transition-all duration-200 group-hover:border-primary/30 group-hover:text-primary-strong"
                    >
                      View
                    </Button>
                    {!isPreviewMode &&
                      (canEditCards ? (
                        <Button
                          href={`/cards/${card.id}/edit`}
                          variant="secondary"
                          size="sm"
                          icon={<Pencil size={14} />}
                          className="shrink-0 rounded-sm bg-white/50 border-white/60"
                        >
                          Edit
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Pencil size={14} />}
                          className="rounded-sm bg-white/50 border-white/60 opacity-50 cursor-not-allowed grayscale"
                          disabled
                          title="Request access to edit lead cards."
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
                        title={!canDeleteCards ? "Request access to delete lead cards." : "Delete lead card"}
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
                <option value="delete_event">Delete event (only when leads = 0)</option>
                <option value="edit_cards">Edit lead cards</option>
                <option value="delete_cards">Delete lead cards</option>
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
                <p className="text-sm text-muted">Revoke member permissions synced to this organization.</p>
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
                Object.values(
                  activeGrants.reduce((acc, grant) => {
                    if (!acc[grant.grantee_email]) acc[grant.grantee_email] = { email: grant.grantee_email, grants: [] };
                    acc[grant.grantee_email].grants.push(grant);
                    return acc;
                  }, {} as Record<string, { email: string; grants: typeof activeGrants }>)
                ).map((group) => (
                  <div key={group.email} className="rounded-md border border-border/50 bg-white/80 p-4 flex flex-col gap-3">
                    <p className="text-sm font-semibold text-heading truncate">{group.email}</p>
                    <div className="flex flex-col gap-2">
                      {group.grants.map(grant => (
                        <div key={grant.id} className="flex items-center justify-between gap-2 p-2 rounded-sm bg-surface/50 border border-border/30">
                          <p className="text-xs text-muted font-medium">Permission: <span className="text-heading">{grant.permission}</span></p>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => revokeGrant(grant.id)}
                            disabled={revokingGrantId === grant.id}
                            className="h-7 text-xs px-3 disabled:opacity-60"
                          >
                            {revokingGrantId === grant.id ? "Revoking..." : "Revoke"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isBrandingOpen && (
        <div className="fixed inset-0 z-100">
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => !isSavingBranding && setIsBrandingOpen(false)}
          />
          <div
            className="relative h-full w-full overflow-hidden animate-in fade-in duration-200"
            style={{
              background: `linear-gradient(160deg, ${
                BRAND_THEME_BACKDROPS[brandingDraft.card_color || "purple"]?.start || "#eef0ff"
              } 0%, ${BRAND_THEME_BACKDROPS[brandingDraft.card_color || "purple"]?.end || "#f7f3ff"} 100%)`,
            }}
          >
            <div className="mx-auto flex h-full w-full max-w-[1540px] flex-col px-6 py-6 sm:px-8">
              <div className="flex items-start justify-between rounded-t-xl border border-border/40 bg-white/90 px-8 pb-4 pt-7 backdrop-blur-sm">
                <div>
                  <h2 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">Card Branding</h2>
                  <p className="text-sm text-muted mt-1.5">Finalize branding first, then share guest/visitor links.</p>
                </div>
                <button
                  onClick={() => !isSavingBranding && setIsBrandingOpen(false)}
                  className="w-10 h-10 rounded-md border border-border/70 flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all duration-150"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto border-x border-border/40 bg-white/70 px-8 py-6">
                <div className="flex w-full flex-col gap-12 lg:gap-16">
                  <div className="w-full flex flex-col xl:flex-row gap-8 xl:gap-12 items-center xl:items-start justify-center">
                    <div className="flex w-full max-w-[740px] flex-col items-center gap-3 xl:w-auto xl:items-start">
                      <h4 className="text-[13px] font-medium tracking-[0.01em] leading-tight text-muted/60 xl:self-center">
                        Social post layout
                      </h4>
                      <div className="w-full overflow-hidden">
                        <div
                          style={{
                            width: "1200px",
                            height: "628px",
                            transform: `scale(${BRANDING_MODAL_SOCIAL_SCALE})`,
                            transformOrigin: "top left",
                            marginBottom: `${BRANDING_MODAL_SOCIAL_COLLAPSE_MARGIN}px`,
                          }}
                        >
                          <CardPreview data={brandingPreviewData} preview />
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-3 xl:items-start">
                      <h4 className="text-[13px] font-medium tracking-[0.01em] leading-tight text-muted/60 xl:self-center">
                        Event badge layout
                      </h4>
                      {/** Match social preview visual height; no nested card chrome */}
                      <div
                        className="relative shrink-0 overflow-hidden"
                        style={{
                          width: 576 * BRANDING_MODAL_BADGE_SCALE,
                          height: BRANDING_MODAL_SOCIAL_HEIGHT,
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "576px",
                            height: "1024px",
                            transform: `scale(${BRANDING_MODAL_BADGE_SCALE})`,
                            transformOrigin: "top left",
                          }}
                        >
                          <CardPreview data={brandingPreviewData} preview isVertical verticalSide={2} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full grid grid-cols-1 gap-y-8 sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-12 lg:gap-x-10 lg:gap-y-0 xl:gap-x-12">
                    <div className="relative flex flex-col gap-2 lg:col-span-4">
                      <span className="text-[13px] font-normal tracking-[0.01em] leading-tight text-muted/65">
                        Theme color
                      </span>
                      <div className="flex h-11 items-center gap-2">
                        {BRAND_THEME_COLORS.map((c) => (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => {
                              setShowBrandCustomColorPicker(false);
                              editBrandingDraft((prev) => ({ ...prev, card_color: c.name }));
                            }}
                            className={`w-8 h-8 rounded-full border transition-all ${
                              brandingDraft.card_color === c.name
                                ? "ring-2 ring-primary ring-offset-2 scale-110 border-transparent"
                                : "border-white/40 hover:scale-105"
                            }`}
                            style={{ background: `linear-gradient(135deg, ${c.start}, ${c.end})` }}
                            aria-label={`Set ${c.name} theme`}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={(e) => {
                            setShowBrandTextColorPicker(false);
                            setBrandCustomColorAnchorRect(e.currentTarget.getBoundingClientRect());
                            setDraftBrandCustomColor(isBrandCustomThemeSelected ? brandingDraft.card_color : "#2563EB");
                            setShowBrandCustomColorPicker(true);
                          }}
                          className={`w-8 h-8 rounded-full transition-all duration-150 relative overflow-hidden flex items-center justify-center p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-95 ${
                            isBrandCustomPickerActive
                              ? "ring-2 ring-primary ring-offset-2 scale-110 shadow-md"
                              : "hover:scale-110 border border-white/40"
                          }`}
                          style={{
                            background:
                              "conic-gradient(from 0deg, #ff4d4f, #ffa940, #fadb14, #73d13d, #36cfc9, #4096ff, #9254de, #f759ab, #ff4d4f)",
                          }}
                          aria-label="Choose custom theme color"
                          title="Choose custom theme color"
                        >
                          <span
                            className="absolute inset-[3px] rounded-full shadow-[inset_0_1px_2px_rgba(255,255,255,0.35),inset_0_-1px_2px_rgba(0,0,0,0.18)]"
                            style={{ background: isBrandCustomThemeSelected ? brandingDraft.card_color : "#ffffff" }}
                          />
                          <span
                            className="relative z-10 text-[14px] font-bold leading-none"
                            style={{ color: isBrandCustomThemeSelected ? "#ffffff" : "#2563EB" }}
                          >
                            +
                          </span>
                        </button>
                      </div>
                      {showBrandCustomColorPicker && (
                        <CustomColorPicker
                          value={draftBrandCustomColor}
                          anchorRect={brandCustomColorAnchorRect}
                          onChange={(next) => setDraftBrandCustomColor(next)}
                          onCancel={() => setShowBrandCustomColorPicker(false)}
                          onConfirm={() => {
                            editBrandingDraft((prev) => ({ ...prev, card_color: draftBrandCustomColor }));
                            setShowBrandCustomColorPicker(false);
                          }}
                        />
                      )}
                    </div>

                    <div className="relative flex flex-col gap-2 lg:col-span-4">
                      <span className="text-[13px] font-normal tracking-[0.01em] leading-tight text-muted/65">
                        Text color
                      </span>
                      <div className="flex h-11 w-fit items-center rounded-md border border-border/60 bg-white/85 p-1 shadow-sm">
                        <button
                          type="button"
                          onClick={(e) => {
                            setActiveBrandTextTarget("horizontal");
                            setShowBrandCustomColorPicker(false);
                            setBrandTextColorAnchorRect(e.currentTarget.getBoundingClientRect());
                            setDraftBrandTextColor(brandingDraft.horizontal_text_color || "#FFFFFF");
                            setShowBrandTextColorPicker(true);
                          }}
                          className={`h-9 px-3 text-[12px] font-semibold rounded-sm transition-all ${
                            activeBrandTextTarget === "horizontal"
                              ? "bg-primary/12 text-primary-strong ring-1 ring-primary/30 shadow-sm"
                              : "text-heading/75 hover:bg-slate-100/80"
                          }`}
                        >
                          T1 - Horizontal
                        </button>
                        <div className="mx-1 h-5 w-px bg-border/70" />
                        <button
                          type="button"
                          onClick={(e) => {
                            setActiveBrandTextTarget("vertical");
                            setShowBrandCustomColorPicker(false);
                            setBrandTextColorAnchorRect(e.currentTarget.getBoundingClientRect());
                            setDraftBrandTextColor(brandingDraft.vertical_text_color || "#000000");
                            setShowBrandTextColorPicker(true);
                          }}
                          className={`h-9 px-3 text-[12px] font-semibold rounded-sm transition-all ${
                            activeBrandTextTarget === "vertical"
                              ? "bg-primary/12 text-primary-strong ring-1 ring-primary/30 shadow-sm"
                              : "text-heading/75 hover:bg-slate-100/80"
                          }`}
                        >
                          T2 - Vertical
                        </button>
                      </div>
                      {showBrandTextColorPicker && (
                        <CustomColorPicker
                          value={draftBrandTextColor}
                          anchorRect={brandTextColorAnchorRect}
                          onChange={(next) => setDraftBrandTextColor(next)}
                          onCancel={() => setShowBrandTextColorPicker(false)}
                          onConfirm={() => {
                            if (activeBrandTextTarget === "horizontal") {
                              editBrandingDraft((prev) => ({ ...prev, horizontal_text_color: draftBrandTextColor }));
                            } else {
                              editBrandingDraft((prev) => ({ ...prev, vertical_text_color: draftBrandTextColor }));
                            }
                            setShowBrandTextColorPicker(false);
                          }}
                        />
                      )}
                    </div>

                    <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-4">
                      <span className="text-[13px] font-normal tracking-[0.01em] leading-tight text-muted/65">
                        Typography
                      </span>
                      <Select
                        value={brandingDraft.card_font}
                        onChange={(val) => editBrandingDraft((prev) => ({ ...prev, card_font: val }))}
                        options={[
                          { label: "Inter (Default)", value: "inter" },
                          { label: "Poppins", value: "poppins" },
                          { label: "Google Sans", value: "outfit" },
                          { label: "Times New Roman", value: "times" },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-t-0 border-border/40 rounded-b-xl bg-white/95 px-8 py-4">
                <div className="grid w-full grid-cols-1 items-center gap-3 min-[560px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                  <div className="flex justify-center min-[560px]:justify-start">
                    <Button
                      className="h-11 w-full min-[560px]:w-auto shrink-0 px-6 sm:min-w-[132px]"
                      disabled={isSavingBranding}
                      onClick={saveBrandingConfig}
                    >
                      {isSavingBranding ? "Saving..." : "Save Branding"}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-11 shrink-0 px-5"
                      disabled={isSavingBranding || brandingUndoStack.length === 0}
                      onClick={undoBrandingEdit}
                      title="Undo the last theme, text color, or typography change"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Undo2 size={16} className="shrink-0 opacity-90" aria-hidden />
                        Undo
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-11 shrink-0 px-5"
                      disabled={isSavingBranding || brandingRedoStack.length === 0}
                      onClick={redoBrandingEdit}
                      title="Redo a change you undid"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Redo2 size={16} className="shrink-0 opacity-90" aria-hidden />
                        Redo
                      </span>
                    </Button>
                  </div>
                  <div className="flex justify-center min-[560px]:justify-end">
                    <Button
                      variant="secondary"
                      className="h-11 w-full min-[560px]:w-auto shrink-0 px-6 sm:min-w-[112px]"
                      disabled={isSavingBranding}
                      onClick={() => setIsBrandingOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isRegistrationFormOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 sm:p-8">
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => !isSavingRegistrationForm && setIsRegistrationFormOpen(false)}
          />
          <div className="relative w-full max-w-[780px] glass-panel bg-white/95 border border-border/70 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 pt-7 pb-4 flex items-start justify-between border-b border-border/40 bg-white/70">
              <div>
                <h2 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">
                  {formBuilderRole === "guest" ? "Guest Form Preview" : "Visitor Form Preview"}
                </h2>
                <p className="text-sm text-muted mt-1.5">
                  Review the live form and manage custom fields in one place.
                </p>
              </div>
              <button
                onClick={() => setIsRegistrationFormOpen(false)}
                className="w-10 h-10 rounded-md border border-border/70 flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all duration-150"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-8 py-6 flex flex-col gap-4 max-h-[68vh] overflow-y-auto bg-white/40">
              <div className="grid gap-3">
                {getEnabledFieldsForRole(registrationFormDraft, formBuilderRole).map((field) => {
                  const isCustomField = !CORE_PREVIEW_FIELD_IDS.has(field.id);
                  if (!isCustomField) {
                    return (
                      <TextInput
                        key={`builder-preview-${formBuilderRole}-${field.id}`}
                        label={field.label}
                        required={field.required}
                        type={field.id === "email" ? "email" : field.inputType}
                        placeholder={field.placeholder || field.label}
                        value=""
                        disabled
                      />
                    );
                  }
                  return (
                    <div key={`builder-preview-${formBuilderRole}-${field.id}`} className="rounded-md">
                      <TextInput
                        label={field.label}
                        required={field.required}
                        type={field.inputType}
                        placeholder={field.placeholder || field.label}
                        value=""
                        disabled
                      />
                      <div className="mt-2.5 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            updateDraftFields(formBuilderRole, (fields) =>
                              fields.map((f) => (f.id === field.id ? { ...f, required: !f.required } : f)),
                            )
                          }
                          className="inline-flex items-center gap-2 px-0 py-0 text-sm font-semibold text-heading transition-colors"
                          aria-pressed={field.required}
                          aria-label={`${field.required ? "Set optional" : "Set required"} for ${field.label}`}
                        >
                          <span
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              field.required ? "bg-[#4FAE62]" : "bg-slate-300"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                field.required ? "translate-x-4" : "translate-x-0.5"
                              }`}
                            />
                          </span>
                          <span className="min-w-[92px] text-[18px] leading-none text-[#2F4C97] -ml-2">
                            {field.required ? "Required" : "Optional"}
                          </span>
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEditCustomField(field)}
                            className="px-3 py-1.5 text-xs rounded-[4px] border border-primary/30 text-primary-strong bg-primary/10 font-semibold hover:bg-primary/15 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (editingCustomFieldId === field.id) {
                                setEditingCustomFieldId(null);
                                setNewFieldLabel("");
                                setNewFieldType("text");
                              }
                              updateDraftFields(formBuilderRole, (fields) =>
                                fields.filter((f) => f.id !== field.id),
                              );
                            }}
                            className="px-3 py-1.5 text-xs rounded-[4px] border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2">
                <p className="text-sm font-semibold text-heading mb-3">
                  {editingCustomFieldId ? "Edit Custom Field" : "Add Custom Field"}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextInput
                    label="Field Label"
                    placeholder="e.g. Website"
                    value={newFieldLabel}
                    onChange={setNewFieldLabel}
                  />
                  <Select
                    label="Input Type"
                    value={newFieldType}
                    onChange={(value) => setNewFieldType(value as "text" | "number" | "url")}
                    options={[
                      { value: "text", label: "Text" },
                      { value: "number", label: "Number" },
                      { value: "url", label: "URL" },
                    ]}
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <div className="flex items-center gap-2">
                    {editingCustomFieldId && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingCustomFieldId(null);
                          setNewFieldLabel("");
                          setNewFieldType("text");
                        }}
                      >
                        Cancel Edit
                      </Button>
                    )}
                    <Button variant="secondary" size="sm" onClick={addCustomFieldToDraft}>
                      {editingCustomFieldId ? "Save Edit" : "Add Field"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-8 py-4 border-t border-border/40 flex gap-3 bg-white/80">
              <Button
                variant="secondary"
                fullWidth
                className="h-11"
                disabled={isSavingRegistrationForm}
                onClick={() => setIsRegistrationFormOpen(false)}
              >
                Cancel
              </Button>
              <Button fullWidth className="h-11" disabled={isSavingRegistrationForm} onClick={saveRegistrationFormConfig}>
                {isSavingRegistrationForm ? "Saving..." : "Save Form"}
              </Button>
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
          <div className="relative w-full max-w-[560px] glass-panel bg-white/95 border border-border/70 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 pt-8 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">Guest Category</h3>
                <p className="text-base text-muted mt-1">Type category like Judge, Speaker, Chief Guest, Evaluator.</p>
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
              className="px-8 pb-8 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const value = guestCategoryInput.trim();
                if (!value) {
                  setGuestCategoryError("Please enter a guest category.");
                  return;
                }
                const url = `${window.location.origin}/r/${eventData.short_id || eventData.id}?r=g&c=${encodeURIComponent(value)}`;
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
              <div className="flex gap-3 pt-2">
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
          <div className="relative w-full max-w-[640px] glass-panel bg-white/95 border border-border/70 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 pt-8 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">Share Registration</h3>
                <p className="text-base text-muted mt-1">
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
            <div className="px-8 pb-8 flex flex-col gap-4">
              {shareDraftRole === "visitor" && (
                <div className="rounded-md border border-border/60 bg-surface/40 px-4 py-3">
                  <p className="text-sm font-medium tracking-[0.01em] leading-tight text-muted mb-1.5">Default LinkedIn caption</p>
                  <p className="text-sm text-heading wrap-break-word">{shareDraftMessage}</p>
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
        <div className="fixed inset-0 z-100 flex items-start justify-center overflow-y-auto p-4 pt-6 sm:p-8">
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => !isSavingSponsors && setIsSponsorsOpen(false)}
          />
          <div className="relative my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-[520px] flex-col overflow-hidden rounded-xl border border-border/70 bg-white/95 shadow-2xl animate-in zoom-in-95 duration-200 glass-panel sm:max-h-[calc(100dvh-4rem)]">
            <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-6 py-5">
              <div className="flex flex-col gap-1 pr-4">
                <h2 className="text-xl font-semibold tracking-[-0.03em] leading-[1.15] text-heading">Event sponsors</h2>
                <p className="text-sm text-muted">
                  Up to five logos with names. They appear on every lead card for this campaign.
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
            <form onSubmit={handleSaveSponsors} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <EventSponsorsForm
                  rows={sponsorRows}
                  onChange={setSponsorRows}
                  onFileError={(msg) => toast.error(msg)}
                  disabled={isSavingSponsors || isPreviewMode}
                />
              </div>
              <div className="flex shrink-0 flex-col gap-3 border-t border-border/50 bg-white/80 px-6 py-4 sm:flex-row">
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

      {/* Edit Campaign Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 sm:p-8">
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => setIsEditOpen(false)}
          />
          <div className="relative w-full max-w-[480px] max-h-[92dvh] flex flex-col glass-panel bg-white border border-border/70 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-8 pt-6 pb-3 flex items-center justify-between border-b border-border/50 shrink-0">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-heading tracking-[-0.02em] leading-tight">Edit Campaign</h2>
                <p className="text-[13px] text-muted">Update the campaign details below.</p>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="shrink-0 w-9 h-9 rounded-md border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all duration-150"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-8 pt-5 custom-scrollbar">
              <div className="flex flex-col gap-5 pb-20">
                <div className="flex flex-col gap-1.5">
                  <TextInput
                    label="Name of the Campaign"
                    required
                    value={editForm.name}
                    maxLength={EVENT_NAME_MAX_CHARS}
                    onChange={(v) => setEditForm({ ...editForm, name: v })}
                  />
                  <div className="flex justify-end">
                    <span className={`text-[11px] font-medium ${editForm.name.length >= EVENT_NAME_MAX_CHARS ? "text-amber-600" : "text-muted"}`}>
                      {editForm.name.length}/{EVENT_NAME_MAX_CHARS} chars
                    </span>
                  </div>
                </div>

                <TextArea
                  label="Campaign Description"
                  placeholder="Describe your campaign (e.g. goals, audience)..."
                  value={editForm.description}
                  maxLength={CAMPAIGN_DESCRIPTION_MAX_CHARS}
                  onChange={(v: string) => setEditForm({ ...editForm, description: v })}
                />
                
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center gap-1">
                     <label className="text-[14px] font-normal tracking-[0.01em] leading-tight text-heading">Location Type</label>
                  </div>
                  <div className="flex gap-4 mb-1">
                     <label className="flex items-center gap-2 cursor-pointer text-sm text-heading">
                        <input type="radio" name="locationType" value="onsite" checked={editForm.location_type === "onsite"} onChange={() => setEditForm({ ...editForm, location_type: "onsite" })} className="accent-primary h-4 w-4 cursor-pointer" />
                        Onsite
                     </label>
                     <label className="flex items-center gap-2 cursor-pointer text-sm text-heading">
                        <input type="radio" name="locationType" value="webinar" checked={editForm.location_type === "webinar"} onChange={() => setEditForm({ ...editForm, location_type: "webinar", location: "" })} className="accent-primary h-4 w-4 cursor-pointer" />
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
                    min={minCampaignDate}
                    value={editForm.date}
                    onChange={(v) => setEditForm({ ...editForm, date: v })}
                  />
                  <TimeInput
                    label="Event Time"
                    required
                    value={editForm.time}
                    onChange={(v) => setEditForm({ ...editForm, time: v })}
                  />
                </div>

                <FilePicker
                  label="Campaign Logo"
                  value={editForm.logo}
                  onChange={(v) => setEditForm({ ...editForm, logo: v })}
                  onError={(msg) => toast.error(msg)}
                  freeFormCrop={false}
                  cropAspect={CAMPAIGN_LOGO_CROP_ASPECT}
                  cropTitle="Crop campaign logo"
                  cropSubtitle="Adjust the logo within the fixed frame used on cards."
                  cropApplyLabel="Apply logo"
                />
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-border/50 p-6 flex flex-col sm:flex-row gap-3 mt-auto shrink-0">
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
                  This permanently removes the event, <span className="font-medium text-heading">{cards.length}</span> lead {cards.length === 1 ? "card" : "cards"}, and all uploaded photos. This cannot be undone.
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
                  min={minCampaignDate}
                  value={renewForm.date}
                  onChange={(v) => setRenewForm({ ...renewForm, date: v })}
                />
                <FilePicker
                  label="New Event Logo"
                  value={renewForm.logo}
                  onChange={(v) => setRenewForm({ ...renewForm, logo: v })}
                  onError={(msg) => toast.error(msg)}
                  freeFormCrop={false}
                  cropAspect={CAMPAIGN_LOGO_CROP_ASPECT}
                  cropTitle="Crop event logo"
                  cropSubtitle="Adjust the logo within the fixed frame used on cards."
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
