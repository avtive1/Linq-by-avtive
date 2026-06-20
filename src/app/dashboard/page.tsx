"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import GradientBackground from "@/components/GradientBackground";
import { OptimizedImage } from "@/components/OptimizedImage";
import { Button, TextInput, TextArea, Skeleton, AnimatedCounter, FilePicker, TimeInput } from "@/components/ui";
import { Plus, LogOut, Calendar, MapPin, User, Search, Users, ArrowLeft, X, ChevronRight, Sparkles, Globe, Pencil, RefreshCw, AlertCircle, ShieldCheck, UserCheck, Lock, Activity, TrendingUp, Layers3, SlidersHorizontal, Settings } from "lucide-react";
import { EventData } from "@/types/card";
import { toast } from "sonner";
import { getEventStatus } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAutoRefresh, useDashboardMotion } from "@/lib/ui/useDashboardMotion";
import { CAMPAIGN_LOGO_CROP_ASPECT } from "@/lib/ui/crop-presets";
import { logger } from "@/lib/logger-client";
import { asPayloadRecord, getPayloadError, readResponsePayload } from "@/lib/http/read-response-payload";
import {
  dashboardContentInset,
  dashboardMainTransparent,
  dashboardPreviewBannerOuter,
  dashboardPreviewBannerInner,
  dashboardModalBackdrop,
} from "@/lib/ui/dashboard-shell";

import { useSearchParams } from "next/navigation";

type DashboardEventData = EventData & { attendeeCount: number };
type OrgMemberRow = {
  id: string;
  member_email: string;
  role_label: string;
  status: string;
  permissions?: string[];
};
type PendingInboxRequest = {
  id: string;
  event_name: string;
  requester_email: string;
  requested_action: string;
};
type MyAccessRequest = {
  id: string;
  event_name: string;
  requested_action: string;
  status: string;
  created_at: string;
};
type FailedNotification = {
  id: string;
  event_name: string;
  requester_email: string;
  requested_action: string;
  status: string;
  notification_error: string;
};
type OrgJoinInboxRequest = {
  id: string;
  requester_email: string;
  requested_org_name: string;
  status: string;
};
type MyOrgJoinRequest = {
  id: string;
  requested_org_name: string;
  owner_user_id?: string;
  owner_email: string;
  status: string;
  reapply_after?: string | null;
  rejection_reason?: string | null;
};

const ENABLE_DASHBOARD_BOOTSTRAP = process.env.NEXT_PUBLIC_DASHBOARD_BOOTSTRAP !== "false";

const formatJoinStatus = (status: string) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") {
    return { label: "Approved", className: "text-success bg-success/10 border-success/20" };
  }
  if (normalized === "rejected") {
    return { label: "Rejected", className: "text-red-600 bg-red-50 border-red-200" };
  }
  return { label: "Pending", className: "text-amber-700 bg-amber-50 border-amber-200" };
};

const toOrganizationDisplayName = (rawName: string) => {
  const name = String(rawName || "").trim();
  if (!name) return "Organization";
  return name.toUpperCase();
};

function DashboardContent() {
  const EVENT_NAME_MAX_CHARS = 18;
  const CAMPAIGN_DESCRIPTION_MAX_CHARS = 220;
  const router = useRouter();
  const searchParams = useSearchParams();
  const impersonateId = searchParams.get("impersonate");
  const onboardingIntent = searchParams.get("onboarding");
  
  const [events, setEvents] = useState<DashboardEventData[]>([]);
  const [userName, setUserName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isEventFilterOpen, setIsEventFilterOpen] = useState(false);
  const [eventStatusFilter, setEventStatusFilter] = useState<"all" | "upcoming" | "ongoing" | "past">("all");
  const [eventLocationFilter, setEventLocationFilter] = useState<"all" | "onsite" | "webinar">("all");
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [bootstrapError, setBootstrapError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [organizationDraft, setOrganizationDraft] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isOrgTeamMember, setIsOrgTeamMember] = useState(false);
  const [isOrgOwner, setIsOrgOwner] = useState(false);
  const [orgRoleLabel, setOrgRoleLabel] = useState("");
  const [orgOwnerUserId, setOrgOwnerUserId] = useState("");
  const [grantedPermissions, setGrantedPermissions] = useState<string[]>([]);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamInviteEmail, setTeamInviteEmail] = useState("");
  const [teamInviteRoleLabel, setTeamInviteRoleLabel] = useState("");
  const [teamMembers, setTeamMembers] = useState<OrgMemberRow[]>([]);
  const [orgMemberCount, setOrgMemberCount] = useState(0);
  const [isSubmittingTeamInvite, setIsSubmittingTeamInvite] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [teamPermissionDraft, setTeamPermissionDraft] = useState<string[]>([]);
  const [inboxRequests, setInboxRequests] = useState<PendingInboxRequest[]>([]);
  const [myAccessRequests, setMyAccessRequests] = useState<MyAccessRequest[]>([]);
  const [failedNotifications, setFailedNotifications] = useState<FailedNotification[]>([]);
  const [retryingNotificationId, setRetryingNotificationId] = useState("");
  const [orgJoinInbox, setOrgJoinInbox] = useState<OrgJoinInboxRequest[]>([]);
  const [myOrgJoinRequests, setMyOrgJoinRequests] = useState<MyOrgJoinRequest[]>([]);
  const [joinGateStatus, setJoinGateStatus] = useState<"pending" | "awaiting_owner" | null>(null);
  // REVERT_FIX_MARKER_V1
  const [joinGateOrgName, setJoinGateOrgName] = useState("");
  const [teamModalView, setTeamModalView] = useState<"list" | "add" | "edit">("list");
  const [isOwnerOnboardingModalOpen, setIsOwnerOnboardingModalOpen] = useState(false);
  const [isSavingOwnerOnboarding, setIsSavingOwnerOnboarding] = useState(false);
  const [isOwnerProfileSetupModalOpen, setIsOwnerProfileSetupModalOpen] = useState(false);
  const [ownerProfileUsernameDraft, setOwnerProfileUsernameDraft] = useState("");
  const [ownerProfilePhotoDraft, setOwnerProfilePhotoDraft] = useState("");
  const [ownerProfileSetupError, setOwnerProfileSetupError] = useState("");
  const [eventForm, setEventForm] = useState({
    name: "",
    description: "",
    location: "",
    location_type: "onsite" as "onsite" | "webinar",
    date: "",
    time: "",
    logo: "",
  });
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalAttendees: 0,
  });
  const [topRoles, setTopRoles] = useState<Array<{ role: string; count: number }>>([]);
  const [userEmail, setUserEmail] = useState("");
  const [currentPasswordDraft, setCurrentPasswordDraft] = useState("");
  const [newPasswordDraft, setNewPasswordDraft] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [organizationLogoDraft, setOrganizationLogoDraft] = useState("");

  const [isRequestPermissionModalOpen, setIsRequestPermissionModalOpen] = useState(false);
  const [permissionRequestReason, setPermissionRequestReason] = useState("");
  const [isSubmittingPermissionRequest, setIsSubmittingPermissionRequest] = useState(false);
  const { data: session } = useSession();
  const userId = session?.user?.id || "";
  const { presets, fadeUp, staggerItem, hoverLift, hoverIconNudge } = useDashboardMotion();
  const { refreshTick } = useAutoRefresh(Boolean(userId));

  useEffect(() => {
    let isMounted = true;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const hydrateSecondaryPanels = async (params: {
      isOrgTeamMember: boolean;
      isOrgOwner: boolean;
      profileOrganizationName: string;
      effectiveName: string;
      onboardingIntentValue: string | null;
    }) => {
      const { isOrgTeamMember, isOrgOwner, profileOrganizationName, effectiveName, onboardingIntentValue } = params;
      if (!isMounted) return;

      if (isOrgTeamMember) {
        try {
          const mineRes = await fetch("/api/access-requests/mine");
          const minePayload = await mineRes.json().catch(() => null);
          if (!isMounted) return;
          if (mineRes.ok && Array.isArray(minePayload?.data)) {
            setMyAccessRequests(minePayload.data);
          }
        } catch {}
        return;
      }

      if (isOrgOwner) {
        try {
          const onboardingRes = await fetch("/api/onboarding/organization-owner", { cache: "no-store" });
          const onboardingPayload = onboardingRes.ok ? await readResponsePayload(onboardingRes) : null;
          if (!isMounted) return;
          const onboardingData = asPayloadRecord(onboardingPayload);
          const shouldShowOnboarding = Boolean(onboardingData?.shouldShowOnboarding);
          const teamStepCompleted = Boolean(onboardingData?.teamStepCompleted);
          const needsProfileSetup = Boolean(onboardingData?.needsProfileSetup);
          const shouldForceOwnerOnboarding = onboardingIntentValue === "owner" && !teamStepCompleted;
          if (needsProfileSetup) {
            // Prevent draft reset while user is typing in modal.
            if (!isOwnerProfileSetupModalOpen) {
              setOwnerProfileUsernameDraft(effectiveName || "");
              setOwnerProfilePhotoDraft("");
              setOwnerProfileSetupError("");
            }
          }
          setIsOwnerProfileSetupModalOpen(needsProfileSetup);
          setIsOwnerOnboardingModalOpen(!needsProfileSetup && (shouldShowOnboarding || shouldForceOwnerOnboarding));
        } catch {}
      }

      const [inboxRes, orgJoinInboxRes, failedRes] = await Promise.all([
        fetch("/api/access-requests/inbox").catch(() => null),
        fetch("/api/organization-join-requests/inbox").catch(() => null),
        fetch("/api/access-requests/failed-notifications").catch(() => null),
      ]);
      if (!isMounted) return;
      try {
        if (inboxRes?.ok) {
          const inboxPayload = await readResponsePayload(inboxRes);
          if (!isMounted) return;
          if (Array.isArray(inboxPayload?.data)) setInboxRequests(inboxPayload.data);
        }
      } catch {}
      try {
        if (orgJoinInboxRes?.ok) {
          const orgJoinInboxPayload = await readResponsePayload(orgJoinInboxRes);
          if (!isMounted) return;
          if (Array.isArray(orgJoinInboxPayload?.data)) setOrgJoinInbox(orgJoinInboxPayload.data);
        }
      } catch {}
      try {
        if (failedRes?.ok) {
          const failedPayload = await readResponsePayload(failedRes);
          if (!isMounted) return;
          if (Array.isArray(failedPayload?.data)) setFailedNotifications(failedPayload.data);
        }
      } catch {}

      if (!isOrgOwner && profileOrganizationName) {
        try {
          const myJoinRes = await fetch("/api/organization-join-requests/mine").catch(() => null);
          if (!isMounted || !myJoinRes?.ok) return;
          const myJoinPayload = await readResponsePayload(myJoinRes);
          if (!isMounted) return;
          if (Array.isArray(myJoinPayload?.data)) {
            setMyOrgJoinRequests(myJoinPayload.data);
          }
        } catch {}
      }
    };

    const resolveAuthedUserIdWithRetry = async () => {
      const sessionUserId = String(session?.user?.id || "").trim();
      if (sessionUserId) return sessionUserId;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          const authRes = await fetch("/api/auth/me", { cache: "no-store" });
          const authPayload = await readResponsePayload(authRes);
          const resolvedUserId =
            authPayload &&
            typeof authPayload === "object" &&
            "data" in authPayload &&
            authPayload.data &&
            typeof authPayload.data === "object" &&
            "userId" in authPayload.data &&
            typeof authPayload.data.userId === "string"
              ? authPayload.data.userId
              : "";
          if (resolvedUserId) return resolvedUserId;
        } catch {}
        await wait(200);
      }
      return "";
    };

    const loadBootstrapSnapshot = async () => {
      try {
        const res = await fetch("/api/dashboard/bootstrap", { cache: "no-store" });
        if (!res.ok) return null;
        const payload = await res.json().catch(() => null);
        if (!payload || typeof payload !== "object" || !("data" in payload)) return null;
        return payload.data as {
          userId?: string;
          isAdmin?: boolean;
          profile?: { username?: string; organizationName?: string } | null;
          member?: { org_owner_user_id?: string; role_label?: string; permissions?: string[] } | null;
          ownerSignals?: { hasOwnedEvents?: boolean; hasOwnedMembers?: boolean; ownerByRegistry?: boolean } | null;
          ownerOnboarding?: {
            shouldShowOnboarding?: boolean;
            teamStepCompleted?: boolean;
            needsProfileSetup?: boolean;
          } | null;
          myAccessRequests?: unknown[];
          myJoinRequests?: Array<{ status?: string }>;
          inboxRequests?: unknown[];
          orgJoinInbox?: unknown[];
          failedNotifications?: unknown[];
        };
      } catch {
        return null;
      }
    };

    const checkUser = async () => {
      try {
        setBootstrapError("");
        const userId = await resolveAuthedUserIdWithRetry();
        if (!isMounted) return;
        
        if (!userId) {
          router.replace("/login");
          return;
        }

        const bootstrapData = ENABLE_DASHBOARD_BOOTSTRAP ? await loadBootstrapSnapshot() : null;
        if (bootstrapData && String(bootstrapData.userId || "").trim()) {
          const isActuallyAdmin = Boolean(bootstrapData.isAdmin);
          if (isActuallyAdmin) setIsAdmin(true);

          let effectiveId = userId;
          let effectiveName = "";
          let userisOrgTeamMemberLocal = false;
          let userIsOrgOwnerLocal = false;
          let gateStatus: "pending" | "awaiting_owner" | null = null;
          const profileRow = bootstrapData.profile || null;

          if (profileRow?.username?.trim()) {
            effectiveName = profileRow.username.trim();
          }
          if (profileRow?.organizationName?.trim()) {
            setOrganizationName(profileRow.organizationName.trim());
          }

          const memberData = bootstrapData.member || null;
          if (typeof memberData?.org_owner_user_id === "string" && memberData.org_owner_user_id) {
            effectiveId = memberData.org_owner_user_id;
            setIsOrgTeamMember(true);
            userisOrgTeamMemberLocal = true;
            setIsOrgOwner(false);
            setOrgRoleLabel(String(memberData.role_label || ""));
            setOrgOwnerUserId(String(memberData.org_owner_user_id || ""));
            setGrantedPermissions(Array.isArray(memberData.permissions) ? (memberData.permissions as string[]) : []);
            if (Array.isArray(bootstrapData.myAccessRequests)) {
              setMyAccessRequests(bootstrapData.myAccessRequests as MyAccessRequest[]);
            }
          } else {
            setIsOrgTeamMember(false);
            setOrgRoleLabel("");
            const ownerSignals = bootstrapData.ownerSignals;
            const userIsOrgOwner = Boolean(
              ownerSignals?.hasOwnedEvents || ownerSignals?.hasOwnedMembers || ownerSignals?.ownerByRegistry,
            );
            setIsOrgOwner(userIsOrgOwner);
            userIsOrgOwnerLocal = userIsOrgOwner;
            if (!userIsOrgOwner) {
              setIsOwnerProfileSetupModalOpen(false);
              setIsOwnerOnboardingModalOpen(false);
            } else {
              const ownerOnboarding = bootstrapData.ownerOnboarding;
              const teamStepCompleted = Boolean(ownerOnboarding?.teamStepCompleted);
              const needsProfileSetup = Boolean(ownerOnboarding?.needsProfileSetup);
              const shouldShowOnboarding = Boolean(ownerOnboarding?.shouldShowOnboarding);
              const shouldForceOwnerOnboarding = onboardingIntent === "owner" && !teamStepCompleted;
              if (needsProfileSetup && !isOwnerProfileSetupModalOpen) {
                setOwnerProfileUsernameDraft(effectiveName || "");
                setOwnerProfilePhotoDraft("");
                setOwnerProfileSetupError("");
              }
              setIsOwnerProfileSetupModalOpen(needsProfileSetup);
              setIsOwnerOnboardingModalOpen(!needsProfileSetup && (shouldShowOnboarding || shouldForceOwnerOnboarding));
            }

            if (profileRow?.organizationName?.trim() && !userIsOrgOwner) {
              try {
                const joinRes = await fetch("/api/organization-join-requests", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ organizationName: profileRow.organizationName.trim() }),
                });
                if (joinRes.ok) {
                  const joinPayload = await readResponsePayload(joinRes);
                  const joinData = asPayloadRecord(joinPayload);
                  const status = String(joinData?.status || "").toLowerCase();
                  if (status === "created" || status === "pending_exists" || status === "reapply_later") {
                    gateStatus = "pending";
                  } else if (status === "no_owner_found") {
                    gateStatus = "awaiting_owner";
                  }
                }
              } catch {}
            }

            if (Array.isArray(bootstrapData.myJoinRequests)) {
              setMyOrgJoinRequests(bootstrapData.myJoinRequests as MyOrgJoinRequest[]);
              if (
                bootstrapData.myJoinRequests.some(
                  (req) => String(req?.status || "").toLowerCase() === "pending",
                )
              ) {
                gateStatus = "pending";
              }
            }
            setJoinGateStatus(gateStatus);
            setJoinGateOrgName(profileRow?.organizationName?.trim() || "");
          }

          if (Array.isArray(bootstrapData.inboxRequests)) {
            setInboxRequests(bootstrapData.inboxRequests as PendingInboxRequest[]);
          }
          if (Array.isArray(bootstrapData.orgJoinInbox)) {
            setOrgJoinInbox(bootstrapData.orgJoinInbox as OrgJoinInboxRequest[]);
          }
          if (Array.isArray(bootstrapData.failedNotifications)) {
            setFailedNotifications(bootstrapData.failedNotifications as FailedNotification[]);
          }

          if (impersonateId && isActuallyAdmin) {
            effectiveId = impersonateId;
            setIsPreviewMode(true);
            effectiveName = "Organization View";
          }

          setUserName(effectiveName);
          if (
            !isActuallyAdmin &&
            !userisOrgTeamMemberLocal &&
            !userIsOrgOwnerLocal &&
            (gateStatus === "pending" || gateStatus === "awaiting_owner")
          ) {
            setIsCheckingAuth(false);
            return;
          }
          fetchData(effectiveId, () => isMounted);
          setIsCheckingAuth(false);
          void hydrateSecondaryPanels({
            isOrgTeamMember: userisOrgTeamMemberLocal,
            isOrgOwner: userIsOrgOwnerLocal,
            profileOrganizationName: profileRow?.organizationName?.trim() || "",
            effectiveName,
            onboardingIntentValue: onboardingIntent,
          });
          return;
        }
        
        // Check for admin using server-owned config only.
        let isActuallyAdmin = false;
        try {
          const adminRes = await fetch("/api/auth/admin-state", { cache: "no-store" });
          const adminPayload = await adminRes.json().catch(() => ({}));
          isActuallyAdmin = Boolean(
            adminRes.ok &&
              adminPayload &&
              typeof adminPayload === "object" &&
              "data" in adminPayload &&
              adminPayload.data &&
              typeof adminPayload.data === "object" &&
              "isAdmin" in adminPayload.data &&
              Boolean(adminPayload.data.isAdmin),
          );
        } catch {
          isActuallyAdmin = false;
        }
        
        if (isActuallyAdmin) {
          setIsAdmin(true);
        }

        // Logic for Effective User ID
        let effectiveId = userId;
        let effectiveName = "";
        let userisOrgTeamMemberLocal = false;
        let userIsOrgOwnerLocal = false;
        let gateStatus: "pending" | "awaiting_owner" | null = null;

        let profileRow: { username?: string; organizationName?: string } | null = null;
        const [profileRes, memberRes] = await Promise.all([
          fetch("/api/profile/username").catch(() => null),
          fetch("/api/organization-members/me").catch(() => null),
        ]);
        try {
          if (profileRes?.ok) {
            const profilePayload = await readResponsePayload(profileRes);
            profileRow =
              profilePayload &&
              typeof profilePayload === "object" &&
              "data" in profilePayload &&
              profilePayload.data &&
              typeof profilePayload.data === "object"
                ? (profilePayload.data as { username?: string; organizationName?: string })
                : null;
          }
        } catch {}
        if (profileRow?.username?.trim()) {
          effectiveName = profileRow.username.trim();
        }
        if (profileRow?.organizationName?.trim()) {
          setOrganizationName(profileRow.organizationName.trim());
        }

        if (memberRes?.ok) {
          const memberPayload = await readResponsePayload(memberRes);
          const memberData =
            memberPayload &&
            typeof memberPayload === "object" &&
            "data" in memberPayload &&
            memberPayload.data &&
            typeof memberPayload.data === "object"
              ? (memberPayload.data as Record<string, unknown>)
              : null;
          if (typeof memberData?.org_owner_user_id === "string" && memberData.org_owner_user_id) {
            effectiveId = memberData.org_owner_user_id;
            setIsOrgTeamMember(true);
            userisOrgTeamMemberLocal = true;
            setIsOrgOwner(false);
            userIsOrgOwnerLocal = false;
            setOrgRoleLabel(String(memberData.role_label || ""));
            setOrgOwnerUserId(String(memberData.org_owner_user_id || ""));
            setGrantedPermissions(Array.isArray(memberData.permissions) ? (memberData.permissions as string[]) : []);
          } else {
            setIsOrgTeamMember(false);
            setOrgRoleLabel("");
            const [ownedEventsRes, ownedMembersRes, ownerStateRes] = await Promise.all([
              fetch(`/api/events?ownerId=${encodeURIComponent(userId)}`),
              fetch("/api/organization-members"),
              fetch("/api/organization-owner/me"),
            ]);
            const ownedEventsPayload = ownedEventsRes.ok ? await readResponsePayload(ownedEventsRes) : null;
            const ownedMembersPayload = ownedMembersRes.ok ? await readResponsePayload(ownedMembersRes) : null;
            const ownedEvents = Array.isArray(ownedEventsPayload?.data) ? ownedEventsPayload.data : [];
            const ownedMembers = Array.isArray(ownedMembersPayload?.data) ? ownedMembersPayload.data : [];
            let ownerByRegistry = false;
            if (ownerStateRes.ok) {
              const ownerStatePayload = await readResponsePayload(ownerStateRes);
              ownerByRegistry = Boolean(asPayloadRecord(ownerStatePayload)?.isOwner);
            }
            const userIsOrgOwner =
              ownedEvents.length > 0 || ownedMembers.length > 0 || ownerByRegistry;
            setIsOrgOwner(userIsOrgOwner);
            userIsOrgOwnerLocal = userIsOrgOwner;
            if (!userIsOrgOwner) {
              setIsOwnerProfileSetupModalOpen(false);
              setIsOwnerOnboardingModalOpen(false);
            }
            if (profileRow?.organizationName?.trim() && !userIsOrgOwner) {
              try {
                const joinRes = await fetch("/api/organization-join-requests", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ organizationName: profileRow.organizationName.trim() }),
                });
                if (joinRes.ok) {
                  const joinPayload = await readResponsePayload(joinRes);
                  const joinData = asPayloadRecord(joinPayload);
                  const status = String(joinData?.status || "").toLowerCase();
                  if (status === "created" || status === "pending_exists" || status === "reapply_later") {
                    gateStatus = "pending";
                  } else if (status === "no_owner_found") {
                    gateStatus = "awaiting_owner";
                  }
                }
              } catch {}
            }
            const myJoinRes = await fetch("/api/organization-join-requests/mine").catch(() => null);
            try {
              if (myJoinRes?.ok) {
                const myJoinPayload = await readResponsePayload(myJoinRes);
                if (Array.isArray(myJoinPayload?.data)) {
                  setMyOrgJoinRequests(myJoinPayload.data);
                  if (
                    myJoinPayload.data.some(
                      (req: { status?: string }) => String(req.status || "").toLowerCase() === "pending",
                    )
                  ) {
                    gateStatus = "pending";
                  }
                }
              }
            } catch {}
            setJoinGateStatus(gateStatus);
            setJoinGateOrgName(profileRow?.organizationName?.trim() || "");
          }
        }

        if (impersonateId && isActuallyAdmin) {
          effectiveId = impersonateId;
          setIsPreviewMode(true);
          effectiveName = "Organization View"; 
        }
        
        setUserName(effectiveName);
        if (!isActuallyAdmin && !userisOrgTeamMemberLocal && !userIsOrgOwnerLocal && (gateStatus === "pending" || gateStatus === "awaiting_owner")) {
          setIsCheckingAuth(false);
          return;
        }
        fetchData(effectiveId, () => isMounted);
        setIsCheckingAuth(false);
        void hydrateSecondaryPanels({
          isOrgTeamMember: userisOrgTeamMemberLocal,
          isOrgOwner: userIsOrgOwnerLocal,
          profileOrganizationName: profileRow?.organizationName?.trim() || "",
          effectiveName,
          onboardingIntentValue: onboardingIntent,
        });
      } catch (bootstrapErr) {
        logger.error({ err: bootstrapErr }, "Dashboard bootstrap error");
        if (!isMounted) return;
        setBootstrapError("Failed to initialize dashboard. Please refresh.");
        setIsCheckingAuth(false);
        setEvents([]);
        setStats({ totalEvents: 0, totalAttendees: 0 });
        setTopRoles([]);
      }
    };
    checkUser();
    return () => { isMounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap on auth/URL gate; fetchData intentionally omitted to avoid loops
  }, [router, impersonateId, onboardingIntent, session, userId, refreshTick]);

  const fetchData = async (userId: string, getIsMounted?: () => boolean) => {
    try {
      // 1. Fetch all events owned by this user
      const eventsRes = await fetch(`/api/events?ownerId=${encodeURIComponent(userId)}`);
      const eventsPayload = await readResponsePayload(eventsRes);
      if (!eventsRes.ok) {
        const message = getPayloadError(eventsPayload, "Failed to load events.");
        // Keep preview/dashboard stable instead of crashing the whole data load on one auth edge case.
        setEvents([]);
        setStats({ totalEvents: 0, totalAttendees: 0 });
        setTopRoles([]);
        toast.error(message);
        return;
      }
      const mappedEvents: DashboardEventData[] = Array.isArray((eventsPayload as { data?: unknown })?.data)
        ? ((eventsPayload as { data: DashboardEventData[] }).data)
        : [];
      
      if (getIsMounted && !getIsMounted()) return;

      setEvents(mappedEvents);
      
      setStats({
        totalEvents: mappedEvents.length,
        totalAttendees: mappedEvents.reduce((sum, evt) => sum + (evt.attendeeCount || 0), 0),
      });

      if (mappedEvents.length === 0) {
        setTopRoles([]);
        return;
      }

      const attendeesByEvent = await Promise.all(
        mappedEvents.map(async (evt) => {
          try {
            const attendeesRes = await fetch(
              `/api/events/${evt.id}/attendees${
                impersonateId ? `?impersonate=${encodeURIComponent(impersonateId)}` : ""
              }`,
            );
            if (!attendeesRes.ok) return [];
            const attendeesPayload = await readResponsePayload(attendeesRes);
            return Array.isArray(attendeesPayload?.data) ? attendeesPayload.data : [];
          } catch {
            return [];
          }
        }),
      );

      if (getIsMounted && !getIsMounted()) return;

      const roleCounts = new Map<string, number>();
      for (const attendees of attendeesByEvent) {
        for (const attendee of attendees as Array<Record<string, unknown>>) {
          const role = String(attendee?.role || "").trim();
          if (!role) continue;
          roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
        }
      }
      const rankedRoles = Array.from(roleCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([role, count]) => ({ role, count }));
      setTopRoles(rankedRoles);

    } catch (err: unknown) {
      logger.error({ err }, "Error fetching dashboard data");
      setTopRoles([]);
      toast.error("Could not load data. Please refresh and try again.");
    }
  };

  const markOwnerOnboardingCompleted = async () => {
    setIsSavingOwnerOnboarding(true);
    try {
      const res = await fetch("/api/onboarding/organization-owner", { method: "PATCH" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(getPayloadError(payload, "Could not update onboarding state."));
        return false;
      }
      return true;
    } catch {
      toast.error("Could not update onboarding state.");
      return false;
    } finally {
      setIsSavingOwnerOnboarding(false);
    }
  };

  const saveMandatoryOwnerProfileSetup = async () => {
    const cleaned = ownerProfileUsernameDraft.trim().toLowerCase();
    if (!cleaned) {
      setOwnerProfileSetupError("Username is required.");
      return false;
    }
    if (cleaned.length < 3 || !/^[a-zA-Z0-9_.]+$/.test(cleaned)) {
      setOwnerProfileSetupError("Use at least 3 characters: letters, numbers, underscore, or dot.");
      return false;
    }
    setIsSavingUsername(true);
    setOwnerProfileSetupError("");
    try {
      let profilePhotoUrl = ownerProfilePhotoDraft.trim();
      if (profilePhotoUrl.startsWith("data:")) {
        const uploadRes = await fetch("/api/media/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl: profilePhotoUrl, folder: "organization-logos" }),
        });
        const uploadPayload = await readResponsePayload(uploadRes);
        const uploadData = asPayloadRecord(uploadPayload);
        if (!uploadRes.ok || !uploadData?.url) {
          setOwnerProfileSetupError(getPayloadError(uploadPayload, "Profile image upload failed."));
          return false;
        }
        profilePhotoUrl = String(uploadData.url);
      }
      const res = await fetch("/api/profile/username", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleaned,
          organizationName: organizationName || organizationDraft || "Organization",
          ...(profilePhotoUrl
            ? { profilePhotoUrl: profilePhotoUrl, organizationLogoUrl: profilePhotoUrl }
            : {}),
          completeOwnerMandatorySetup: true,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setOwnerProfileSetupError(getPayloadError(payload, "Could not save profile setup. Image size limit should be less than 1MB."));
        return false;
      }
      setUserName(cleaned);
      setIsOwnerProfileSetupModalOpen(false);
      return true;
    } catch {
      setOwnerProfileSetupError("Could not save profile setup. Image size limit should be less than 1MB.");
      return false;
    } finally {
      setIsSavingUsername(false);
    }
  };

  const openTeamAccessModal = async (defaultView: "list" | "add" | "edit" = "list") => {
    if (isOrgTeamMember) {
      toast.error("Access management is restricted to organization owners.");
      return;
    }
    setIsTeamModalOpen(true);
    setTeamModalView(defaultView);
    setTeamError("");
    await loadteamMembers();
  };

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return events.filter(evt => {
      const statusLabel = getEventStatus(evt.date).label.toLowerCase();
      const normalizedStatus = statusLabel === "today" ? "ongoing" : statusLabel;
      const statusMatch = eventStatusFilter === "all" || normalizedStatus === eventStatusFilter;

      const locationLabel = (evt.location || "").trim().toLowerCase() === "webinar" ? "webinar" : "onsite";
      const locationMatch = eventLocationFilter === "all" || locationLabel === eventLocationFilter;

      if (!statusMatch || !locationMatch) return false;
      if (!query) return true;

      const name = (evt.name || "").toLowerCase();
      const location = (evt.location || "").toLowerCase();
      const date = (evt.date || "").toLowerCase();
      // Concatenate for a broader search matches
      const searchBlob = `${name} ${location} ${date}`;
      return searchBlob.includes(query);
    });
  }, [searchQuery, events, eventStatusFilter, eventLocationFilter]);

  const hasPendingOrgJoin = useMemo(
    () => !isOrgOwner && myOrgJoinRequests.some((req) => String(req.status || "").toLowerCase() === "pending"),
    [isOrgOwner, myOrgJoinRequests],
  );
  const hasCreateCampaignPermission = grantedPermissions.includes("create_event");
  const isTeamMemberMode = !isPreviewMode && isOrgTeamMember;
  const isOrgAdminMode = !isPreviewMode && !isOrgTeamMember && isOrgOwner;
  const minCampaignDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().slice(0, 10);
  }, []);
  const orgDisplayName = toOrganizationDisplayName(organizationName);
  const ownerStatusMetrics = useMemo(() => {
    const counts = { upcoming: 0, ongoing: 0, past: 0 };
    for (const evt of events) {
      const status = getEventStatus(evt.date).label.toLowerCase();
      if (status === "upcoming") counts.upcoming += 1;
      else if (status === "today" || status === "ongoing") counts.ongoing += 1;
      else counts.past += 1;
    }
    const max = Math.max(counts.upcoming, counts.ongoing, counts.past, 1);
    return { ...counts, max };
  }, [events]);
  const ownerTopCampaigns = useMemo(() => {
    return [...events]
      .sort((a, b) => (b.attendeeCount || 0) - (a.attendeeCount || 0))
      .slice(0, 3);
  }, [events]);
  const ownerAvgAttendees = useMemo(() => {
    if (stats.totalEvents <= 0) return 0;
    return Math.round(stats.totalAttendees / stats.totalEvents);
  }, [stats.totalAttendees, stats.totalEvents]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut({ redirect: false });
      // Hard redirect to clear next.js client cache immediately and feel responsive
      window.location.href = "/login";
    } catch (err) {
      logger.error({ err }, "Logout error");
      setIsLoggingOut(false);
    }
  };

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPreviewMode) {
      toast.error("Admin org preview is read-only.");
      return;
    }
    if (hasPendingOrgJoin) {
      toast.error("Your organization join request is pending approval. Campaign creation is locked.");
      return;
    }
    if (isOrgTeamMember && !hasCreateCampaignPermission) {
      toast.error("Campaign creation access is not active. Request create_event permission from your organization admin.");
      setIsEventModalOpen(false);
      setIsRequestPermissionModalOpen(true);
      return;
    }
    if (!eventForm.name || (!eventForm.location && eventForm.location_type === "onsite") || !eventForm.date || !eventForm.time) {
      toast.error("Please fill all required fields.");
      return;
    }
    if (eventForm.name.trim().length > EVENT_NAME_MAX_CHARS) {
      toast.error(`Campaign name can be up to ${EVENT_NAME_MAX_CHARS} characters.`);
      return;
    }
    if (eventForm.date < minCampaignDate) {
      toast.error("Campaign date must be today or in the future.");
      return;
    }

    setIsSubmittingEvent(true);
    try {
      if (!userId) throw new Error("No user found");
      
      let logoUrl = "";
      if (eventForm.logo) {
        try {
          const uploadRes = await fetch("/api/media/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataUrl: eventForm.logo, folder: `events/${userId}` }),
          });
          const uploadPayload = await readResponsePayload(uploadRes);
          const uploadData = asPayloadRecord(uploadPayload);
          if (!uploadRes.ok || !uploadData?.url) throw new Error(getPayloadError(uploadPayload, "Logo upload failed."));
          logoUrl = String(uploadData.url);
        } catch (uploadErr) {
          logger.error({ err: uploadErr }, "Logo upload failed");
          toast.error("Logo upload failed, but creating event anyway...");
        }
      }
      
      const data = {
        name: eventForm.name,
        description: eventForm.description,
        location: eventForm.location_type === "webinar" ? "Webinar" : eventForm.location,
        location_type: eventForm.location_type,
        date: eventForm.date,
        time: eventForm.time,
        ownerId: impersonateId || (isOrgTeamMember ? (orgOwnerUserId || userId) : userId),
        logo_url: logoUrl,
      };

      const createRes = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const createPayload = await readResponsePayload(createRes);
      if (!createRes.ok) throw new Error(getPayloadError(createPayload, "Failed to create event."));

      toast.success(`Event "${eventForm.name}" created successfully!`);
      router.refresh();
      setIsEventModalOpen(false);
      setEventForm({ name: "", description: "", location: "", location_type: "onsite", date: "", time: "", logo: "" });
      fetchData(impersonateId || (isOrgTeamMember ? (orgOwnerUserId || userId) : userId));
    } catch (err: unknown) {
      logger.error({ err }, "Dashboard operation failed");
      toast.error("Failed to create event. Please try again.");
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = usernameDraft.trim().toLowerCase();
    if (!cleaned) {
      setUsernameError("Username is required.");
      return;
    }
      const orgCleaned = organizationDraft.trim();
    if (!orgCleaned) {
        setUsernameError("Organization name is required.");
        return;
      }
    if (isOrgTeamMember && orgCleaned !== organizationName.trim()) {
      setUsernameError("Only organization admin can change organization name.");
      return;
    }
    if (cleaned.length < 3) {
      setUsernameError("Username must be at least 3 characters.");
      return;
    }
    if (!/^[a-zA-Z0-9_.]+$/.test(cleaned)) {
      setUsernameError("Use letters, numbers, underscore, or dot only.");
      return;
    }

    setIsSavingUsername(true);
    setUsernameError("");
    try {
      let logoUrl = "";
      if (organizationLogoDraft && isOrgOwner) {
        try {
          const uploadRes = await fetch("/api/media/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataUrl: organizationLogoDraft, folder: `organizations/${userId}` }),
          });
          const uploadPayload = await readResponsePayload(uploadRes);
          const uploadData = asPayloadRecord(uploadPayload);
          if (uploadRes.ok && uploadData?.url) {
            logoUrl = String(uploadData.url);
          }
        } catch (uploadErr) {
          logger.error({ err: uploadErr }, "Logo upload failed");
        }
      }

      const res = await fetch("/api/profile/username", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: cleaned, 
          organizationName: orgCleaned,
          ...(logoUrl ? { organizationLogoUrl: logoUrl } : {})
        }),
      });
      const payload = await readResponsePayload(res);
      if (!res.ok) {
        setUsernameError(getPayloadError(payload, "Could not update username."));
        return;
      }
      const profileData = asPayloadRecord(payload);
      setUserName(String(profileData?.username || ""));
      setOrganizationName(String(profileData?.organizationName || ""));
      setIsUsernameModalOpen(false);
      toast.success("Profile updated.");
    } catch (err) {
      logger.error({ err }, "Username update failed");
      setUsernameError("Could not update username.");
    } finally {
      setIsSavingUsername(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPasswordDraft || !newPasswordDraft) {
      setPasswordError("Both password fields are required.");
      return;
    }
    setIsSavingPassword(true);
    setPasswordError("");
    try {
      const res = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPasswordDraft, newPassword: newPasswordDraft }),
      });
      const payload = await readResponsePayload(res);
      if (!res.ok) {
        setPasswordError(getPayloadError(payload, "Could not update password."));
        return;
      }
      toast.success("Password updated successfully.");
      setCurrentPasswordDraft("");
      setNewPasswordDraft("");
    } catch {
      setPasswordError("Could not update password.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const loadteamMembers = async () => {
    try {
      const res = await fetch("/api/organization-members");
      const payload = await readResponsePayload(res);
      if (!res.ok) {
        setTeamError(getPayloadError(payload, "Could not load team."));
        return;
      }
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      setTeamMembers(rows);
      setOrgMemberCount(rows.length);
    } catch {
      setTeamError("Could not load team.");
    }
  };

  useEffect(() => {
    if (!isOrgAdminMode) {
      setOrgMemberCount(0);
      return;
    }
    let isMounted = true;
    const loadOrgMemberCount = async () => {
      try {
        const res = await fetch("/api/organization-members", { cache: "no-store" });
        const payload = await res.json().catch(() => null);
        if (!isMounted) return;
        if (!res.ok) return;
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        setOrgMemberCount(rows.length);
      } catch {
        if (!isMounted) return;
      }
    };
    void loadOrgMemberCount();
    return () => {
      isMounted = false;
    };
  }, [isOrgAdminMode, refreshTick]);

  const openTeamMemberEdit = async (member: OrgMemberRow) => {
    setTeamError("");
    try {
      const res = await fetch("/api/organization-members", { cache: "no-store" });
      if (res.ok) {
        const payload = await readResponsePayload(res);
        const latestRows: OrgMemberRow[] = Array.isArray(payload?.data) ? payload.data : [];
        if (latestRows.length > 0) {
          setTeamMembers(latestRows);
        }
        const latestMember =
          latestRows.find((row) => row.id === member.id) ||
          latestRows.find((row) => String(row.member_email || "").toLowerCase() === member.member_email.toLowerCase());
        const source = latestMember || member;
        setTeamInviteEmail(source.member_email);
        setTeamInviteRoleLabel(source.role_label);
        setTeamPermissionDraft(source.permissions || []);
      } else {
        setTeamInviteEmail(member.member_email);
        setTeamInviteRoleLabel(member.role_label);
        setTeamPermissionDraft(member.permissions || []);
      }
    } catch {
      setTeamInviteEmail(member.member_email);
      setTeamInviteRoleLabel(member.role_label);
      setTeamPermissionDraft(member.permissions || []);
    } finally {
      setTeamModalView("edit");
    }
  };

  const handleAddOrgMemberRow = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamError("");
    if (!teamInviteEmail.trim() || !teamInviteRoleLabel.trim()) {
      setTeamError("Email and role label are required.");
      return;
    }
    setIsSubmittingTeamInvite(true);
    try {
      const res = await fetch("/api/organization-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: teamInviteEmail.trim().toLowerCase(),
          roleLabel: teamInviteRoleLabel.trim(),
          permissions: teamPermissionDraft,
        }),
      });
      const payload = await readResponsePayload(res);
      if (!res.ok) {
        setTeamError(getPayloadError(payload, "Could not add team member."));
        return;
      }
      toast.success("Team member access updated.");
      await loadteamMembers();
      setTeamModalView("list");
      setTeamInviteEmail("");
      setTeamInviteRoleLabel("");
      setTeamPermissionDraft([]);
    } catch {
      setTeamError("Could not add team member.");
    } finally {
      setIsSubmittingTeamInvite(false);
    }
  };

  const reviewInboxRequest = async (id: string, decision: "approve" | "reject") => {
    try {
      const res = await fetch(`/api/access-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const payload = await readResponsePayload(res);
      if (!res.ok) {
        toast.error(getPayloadError(payload, "Could not review request."));
        return;
      }
      setInboxRequests((prev) => prev.filter((r) => r.id !== id));
      toast.success(decision === "approve" ? "Access granted." : "Access rejected.");
    } catch {
      toast.error("Could not review request.");
    }
  };

  const retryNotification = async (requestId: string, status: string) => {
    const target = status === "pending" ? "owner" : "requester";
    setRetryingNotificationId(requestId);
    try {
      const res = await fetch("/api/access-requests/retry-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, target }),
      });
      const payload = await readResponsePayload(res);
      if (!res.ok) {
        toast.error(getPayloadError(payload, "Retry failed."));
        return;
      }
      setFailedNotifications((prev) => prev.filter((row) => row.id !== requestId));
      toast.success("Notification retried successfully.");
    } catch {
      toast.error("Retry failed.");
    } finally {
      setRetryingNotificationId("");
    }
  };

  const reviewOrgJoinRequest = async (id: string, decision: "approve" | "reject") => {
    try {
      const requestRow = orgJoinInbox.find((r) => r.id === id);
      const res = await fetch(`/api/organization-join-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const payload = await readResponsePayload(res);
      if (!res.ok) {
        toast.error(getPayloadError(payload, "Could not review organization join request."));
        return;
      }
      setOrgJoinInbox((prev) => prev.filter((r) => r.id !== id));
      toast.success(
        decision === "approve"
          ? `${requestRow?.requester_email || "Member"} approved. They can now access your organization workspace.`
          : `${requestRow?.requester_email || "Member"} rejected. They can reapply after cooldown.`,
      );
    } catch {
      toast.error("Could not review organization join request.");
    }
  };

  const handleRequestPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissionRequestReason.trim()) {
      toast.error("Please provide a reason for the request.");
      return;
    }

    setIsSubmittingPermissionRequest(true);
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: orgOwnerUserId,
          requestedAction: "create_event",
          note: permissionRequestReason.trim(),
        }),
      });

      const payload = await readResponsePayload(res);
      if (!res.ok) {
        toast.error(getPayloadError(payload, "Failed to submit request."));
        return;
      }

      toast.success("Access request sent to organization owner.");
      setIsRequestPermissionModalOpen(false);
      setPermissionRequestReason("");
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsSubmittingPermissionRequest(false);
    }
  };

  const isJoinBlocked =
    !isCheckingAuth &&
    !isPreviewMode &&
    !isOrgTeamMember &&
    !isOrgOwner &&
    (joinGateStatus === "pending" || joinGateStatus === "awaiting_owner");

  if (isJoinBlocked) {
    return (
      <main className={dashboardMainTransparent}>
        <GradientBackground />
        <div className={dashboardContentInset}>
          <div className="mx-auto max-w-[760px] glass-panel rounded-md p-6 sm:p-10 lg:p-12 flex flex-col gap-6 text-center">
            <h1
              className="text-2xl sm:text-3xl font-semibold text-heading tracking-tight leading-[1.1]"
              style={{ fontWeight: 700, WebkitTextStroke: "0px currentColor", textShadow: "none" }}
            >
              {joinGateStatus === "pending" ? "Organization access pending approval" : "Organization setup pending"}
            </h1>
            <p className="text-base text-muted leading-[1.6]">
              {joinGateStatus === "pending"
                ? `Your request to join ${joinGateOrgName ? `"${joinGateOrgName}"` : "this organization"} is awaiting founder approval. Dashboard access will unlock after approval.`
                : `No founder is assigned yet for ${joinGateOrgName ? `"${joinGateOrgName}"` : "this organization"}. Ask your admin to assign the founder email, then try again.`}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="secondary" onClick={handleLogout}>
                Log out
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={dashboardMainTransparent}>
      {isPreviewMode && (
        <div className={dashboardPreviewBannerOuter}>
          <div className={dashboardPreviewBannerInner}>
            <div className="flex min-w-0 flex-1 items-start gap-2 sm:items-center">
              <Sparkles size={18} className="shrink-0 text-primary" />
              <span className="min-w-0 leading-snug">
                Super Admin Inspection Mode &mdash; Organization View (Read Only)
              </span>
            </div>
            <Link
              href="/admin"
              className="no-link-underline shrink-0 self-start cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-1 text-[13px] font-medium text-white hover:no-link-underline hover:bg-white/20 sm:self-auto"
            >
              Exit Preview
            </Link>
          </div>
        </div>
      )}
      <GradientBackground />

      <div className={dashboardContentInset}>
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
        {bootstrapError ? (
          <div className="mb-6 rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {bootstrapError}
          </div>
        ) : null}
        {/* Header row */}
        <motion.div
          className="mb-10 flex min-w-0 flex-col gap-4 sm:mb-12 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6"
          viewport={presets.viewport}
          {...fadeUp(0.02)}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:gap-2">
            {isPreviewMode ? (
              <Link
                href={impersonateId ? `/admin/organizations/${impersonateId}` : "/admin"}
                className="flex items-center gap-2.5 text-base font-semibold text-heading hover:text-ink hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-inline mb-1 group -ml-1 sm:-ml-2 py-1 cursor-pointer"
              >
                <motion.span {...hoverIconNudge(-2)} className="inline-flex">
                  <ArrowLeft size={16} className="transition-transform" />
                </motion.span>
                Back
              </Link>
            ) : null}
            <span className="text-sm font-normal tracking-[0.01em] leading-tight text-muted/70">
              Dashboard
            </span>
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-heading tracking-tight leading-[1.1]"
              style={{ fontWeight: 700, WebkitTextStroke: "0px currentColor", textShadow: "none" }}
            >
              {isPreviewMode
                ? "Organization Preview"
                : isOrgTeamMember
                  ? "Team Workspace"
                  : isOrgOwner
                    ? orgDisplayName
                    : "Workspace"}
            </h1>
            {userName && (
              <div className="text-lg font-normal text-muted flex items-center gap-2 mt-1 leading-[1.6]">
                <User size={18} className="text-primary-strong/70" />
                <span>{userName}</span>
                {!isPreviewMode && (isOrgOwner || isOrgTeamMember) && (
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border ${
                      isOrgOwner
                        ? "bg-primary/10 text-primary-strong border-primary/25"
                        : "bg-surface text-heading/80 border-border/70"
                    }`}
                  >
                    {isOrgOwner ? <ShieldCheck size={12} /> : <UserCheck size={12} />}
                    {isOrgOwner ? "Admin" : "Team Member"}
                  </span>
                )}
              </div>
            )}
            {isPreviewMode && (
              <p className="text-sm font-normal text-danger/85 mt-1 leading-[1.6]">Read-only admin perspective. Editing and creation are disabled.</p>
            )}
            {!isPreviewMode && isOrgTeamMember && (
              <p className="text-sm font-normal text-heading/70 mt-1 leading-[1.6]">
                You are operating in team mode. Role: {orgRoleLabel || "Member"}.
              </p>
            )}
            {!isPreviewMode && !isOrgTeamMember && isOrgOwner && (
              <p className="text-sm font-normal text-primary-strong/85 mt-1 leading-[1.6]">
                You can review team join requests and manage access.
              </p>
            )}
            {!isPreviewMode && !isOrgTeamMember && hasPendingOrgJoin && (
              <p className="text-sm font-normal text-amber-700 mt-1 leading-[1.6]">
                Organization join is pending approval. Owner-level actions are disabled until approved.
              </p>
            )}
          </div>

          <div className="flex min-w-0 w-full flex-col items-stretch gap-3 max-lg:basis-full lg:w-auto lg:basis-auto lg:flex-row lg:flex-nowrap lg:items-center lg:justify-end">
            {isAdmin && (
              <div className="w-full shrink-0 lg:w-auto lg:max-w-fit">
                <Button
                  href="/admin"
                  variant="secondary"
                  className="bg-red-500/10 border-red-500/30 text-red-600 hover:bg-red-500/20 hover:border-red-500/45 font-medium"
                  icon={<Sparkles size={18} />}
                >
                  Admin Panel
                </Button>
              </div>
            )}
            {!isPreviewMode && !hasPendingOrgJoin && (
              <div className="w-full shrink-0 lg:w-auto lg:max-w-fit">
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (isOrgTeamMember && !hasCreateCampaignPermission) {
                      setIsRequestPermissionModalOpen(true);
                      return;
                    }
                    setIsEventModalOpen(true);
                  }}
                  className="h-11 w-full justify-center whitespace-nowrap lg:w-auto lg:min-w-[168px] bg-surface border-hairline-strong text-ink hover:bg-white"
                  title={isOrgTeamMember && !hasCreateCampaignPermission ? "You need Campaign Creation access. Request it from your organization admin." : ""}
                  icon={isOrgTeamMember && !hasCreateCampaignPermission ? <AlertCircle size={18} className="animate-pulse" /> : <Calendar size={18} />}
                >
                  <span>New Campaign</span>
                </Button>
              </div>
            )}
            {!isPreviewMode && !hasPendingOrgJoin && !isOrgTeamMember && (
              <div className="w-full shrink-0 lg:w-auto lg:max-w-fit">
                <Button
                  variant="secondary"
                  onClick={() => {
                    void openTeamAccessModal("list");
                  }}
                  className="h-11 w-full justify-center whitespace-nowrap lg:w-auto lg:min-w-[168px] border-hairline-strong text-ink hover:bg-surface"
                  icon={<Users size={18} />}
                >
                  Team Access
                </Button>
              </div>
            )}
            {!isPreviewMode && (
              <div className="w-full shrink-0 lg:w-auto lg:max-w-fit">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setUsernameDraft(userName);
                    setOrganizationDraft(organizationName);
                    setUserEmail(session?.user?.email || "");
                    setCurrentPasswordDraft("");
                    setNewPasswordDraft("");
                    setPasswordError("");
                    setUsernameError("");
                    setOrganizationLogoDraft("");
                    setIsUsernameModalOpen(true);
                  }}
                  className="h-11 w-full justify-center whitespace-nowrap lg:w-auto border-hairline-strong text-ink hover:bg-surface"
                  icon={<Settings size={18} />}
                >
                  <span>Settings</span>
                </Button>
              </div>
            )}
            <div className="w-full shrink-0 lg:w-auto lg:max-w-fit">
              <Button
                variant="secondary"
                fullWidth
                onClick={handleLogout}
                disabled={isLoggingOut}
                icon={isLoggingOut ? undefined : <LogOut size={18} />}
                className="h-11 justify-center whitespace-nowrap lg:w-auto border-hairline-strong text-ink hover:bg-surface"
              >
                <span>{isLoggingOut ? "..." : "Logout"}</span>
              </Button>
            </div>
          </div>
        </motion.div>
        {isOrgAdminMode && (
          <motion.div
            className="mb-8 rounded-md border border-hairline-soft bg-surface px-4 py-6 min-w-0 lg:px-6"
            viewport={presets.viewport}
            {...fadeUp(0.04)}
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary-strong">
                    <ShieldCheck size={20} />
                  </span>
                  <div className="flex flex-col">
                    <p className="text-xl font-bold uppercase tracking-wide text-primary-strong leading-none mb-1">
                      {orgDisplayName} Admin Console
                    </p>
                    <p className="text-sm text-muted">Operate campaigns, team access, and approvals from one command layer.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-heading/75">
                  <Activity size={14} className="text-primary-strong" />
                  Analytics
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
                {[
                  { label: "Total Campaigns", value: stats.totalEvents },
                  { label: "Total Leads", value: stats.totalAttendees },
                  { label: "Organization Members", value: orgMemberCount },
                  { label: "Avg / Campaign", value: ownerAvgAttendees },
                  { label: "Highest Campaign Reach", value: ownerTopCampaigns[0]?.attendeeCount || 0 },
                ].map((kpi, kpiIdx) => (
                  <motion.div
                    key={kpi.label}
                    className="rounded-md border border-primary/20 bg-white/90 px-4 py-3 motion-token-enter motion-token-hover"
                    viewport={presets.viewport}
                    {...staggerItem(kpiIdx, 0.05, 0.22, 12, 0.28)}
                    {...hoverLift(-3, 1.008)}
                  >
                    <p className="text-xs uppercase tracking-wide text-muted">{kpi.label}</p>
                    <p className="mt-1 text-3xl font-semibold leading-tight text-heading">
                      <AnimatedCounter value={kpi.value} />
                    </p>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Campaign Status — 3-tile visual */}
                <motion.div
                  className="rounded-md border border-primary/20 bg-white/85 px-4 py-4 motion-token-enter motion-token-hover"
                  viewport={presets.viewport}
                  {...fadeUp(0.08)}
                  {...hoverLift(-2, 1.005)}
                >
                  <p className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-heading/75">
                    <Layers3 size={14} className="text-primary-strong" />
                    Campaign Status
                  </p>
                  <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
                    {[
                      { label: "Upcoming", value: ownerStatusMetrics.upcoming, bg: "bg-primary/10", border: "border-primary/20", dot: "bg-primary", text: "text-primary-strong" },
                      { label: "Ongoing",  value: ownerStatusMetrics.ongoing,  bg: "bg-info/10",    border: "border-info/20",    dot: "bg-info",    text: "text-info" },
                      { label: "Past",     value: ownerStatusMetrics.past,     bg: "bg-heading/8",  border: "border-heading/15", dot: "bg-heading/40", text: "text-heading/55" },
                    ].map((item, idx) => (
                      <motion.div
                        key={item.label}
                        className={`flex flex-col items-center gap-2 rounded-md border py-4 px-2 ${item.bg} ${item.border}`}
                        viewport={presets.viewport}
                        {...staggerItem(idx, 0.04, 0.18, 8, 0.24)}
                      >
                        <span className="text-2xl font-semibold text-heading tracking-[-0.02em] leading-none">
                          {item.value}
                        </span>
                        <span className={`text-[11px] font-semibold uppercase tracking-wider ${item.text} text-center leading-tight`}>
                          {item.label}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* Top Campaigns — ranked list */}
                <motion.div
                  className="rounded-md border border-primary/20 bg-white/85 px-4 py-4 motion-token-enter motion-token-hover"
                  viewport={presets.viewport}
                  {...fadeUp(0.1)}
                  {...hoverLift(-2, 1.005)}
                >
                  <p className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-heading/75">
                    <TrendingUp size={14} className="text-primary-strong" />
                    Top Campaigns
                  </p>
                  <div className="flex flex-col">
                    {ownerTopCampaigns.length === 0 ? (
                      <p className="text-sm text-muted">No campaigns yet.</p>
                    ) : (
                      ownerTopCampaigns.map((evt, topIdx) => (
                        <motion.div
                          key={evt.id}
                          className="flex items-center gap-3 py-2.5 border-b border-border/25 last:border-0 last:pb-0 first:pt-0"
                          viewport={presets.viewport}
                          {...staggerItem(topIdx, 0.04, 0.2, 8, 0.24)}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-[11px] font-bold text-primary-strong">
                            {topIdx + 1}
                          </span>
                          <span className="flex-1 truncate text-sm font-medium text-heading leading-tight">
                            {evt.name}
                          </span>
                          <span className="shrink-0 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary-strong leading-tight">
                            {evt.attendeeCount || 0}
                          </span>
                        </motion.div>
                      ))
                    )}
                  </div>
                </motion.div>

                {/* Top Roles — ranked list */}
                <motion.div
                  className="rounded-md border border-primary/20 bg-white/85 px-4 py-4 motion-token-enter motion-token-hover"
                  viewport={presets.viewport}
                  {...fadeUp(0.12)}
                  {...hoverLift(-2, 1.005)}
                >
                  <p className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-heading/75">
                    <Users size={14} className="text-primary-strong" />
                    Top 5 Roles
                  </p>
                  <div className="flex flex-col">
                    {topRoles.length === 0 ? (
                      <p className="text-sm text-muted">No roles data yet.</p>
                    ) : (
                      topRoles.map((entry, roleIdx) => (
                        <motion.div
                          key={`${entry.role}-${roleIdx}`}
                          className="flex items-center gap-3 py-2.5 border-b border-border/25 last:border-0 last:pb-0 first:pt-0"
                          viewport={presets.viewport}
                          {...staggerItem(roleIdx, 0.04, 0.2, 8, 0.24)}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-[11px] font-bold text-primary-strong">
                            {roleIdx + 1}
                          </span>
                          <span className="flex-1 truncate text-sm font-medium text-heading leading-tight">
                            {entry.role}
                          </span>
                          <span className="shrink-0 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary-strong leading-tight">
                            {entry.count}
                          </span>
                        </motion.div>
                      ))
                    )}
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
        {isTeamMemberMode && (
          <motion.div
            className="mb-8 rounded-md border border-primary/25 bg-surface border border-hairline-soft px-5 py-4 shadow-sm motion-token-enter motion-token-hover"
            viewport={presets.viewport}
            {...fadeUp(0.05)}
            {...hoverLift(-2, 1.004)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md border border-primary/25 bg-primary/12 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-strong">
                Team Dashboard
              </span>
              <span className="inline-flex items-center rounded-md border border-border/70 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-heading/80">
                Role: {orgRoleLabel || "Member"}
              </span>
              <span
                className={`inline-flex items-center rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  hasCreateCampaignPermission
                    ? "border-primary/25 bg-primary/10 text-primary-strong"
                    : "border-amber-300/70 bg-amber-50 text-amber-700"
                }`}
              >
                {hasCreateCampaignPermission ? "Can create campaigns" : "Campaign creation restricted"}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted">
              This workspace prioritizes assigned campaigns and permission visibility for day-to-day execution.
            </p>
          </motion.div>
        )}
        {!isPreviewMode ? null : (
          <div className="motion-token-enter relative mb-10 overflow-hidden rounded-2xl border border-hairline-soft bg-white p-7 shadow-md">
            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface text-heading shadow-inner">
                <ShieldCheck size={32} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col">
                <p className="text-lg font-semibold uppercase tracking-wide text-primary-strong leading-none mb-1.5">Administrative Intelligence</p>
                <p className="text-[17.5px] text-muted">Real-time organizational footprint & visibility snapshot.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
               {/* Attendee Metric */}
               <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-white p-6 shadow-sm">
                  <div className="flex w-full items-center gap-5">
                     <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary-strong shadow-inner">
                        <Users size={28} />
                     </div>
                     <div className="flex flex-col gap-1">
                        <span className="text-4xl font-semibold text-heading tracking-tight leading-none group-hover:text-ink transition-colors">
                           <AnimatedCounter value={stats.totalAttendees} />
                        </span>
                        <span className="text-xs font-semibold text-muted uppercase tracking-wide">Total Leads</span>
                     </div>
                  </div>
               </div>

               {/* Campaign Metric */}
               <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-white p-6 shadow-sm">
                  <div className="flex w-full items-center gap-5">
                     <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-surface text-heading shadow-inner">
                        <Layers3 size={28} />
                     </div>
                     <div className="flex flex-col gap-1">
                        <span className="text-4xl font-semibold text-heading tracking-tight leading-none group-hover:text-heading/80 transition-colors">
                           <AnimatedCounter value={stats.totalEvents} />
                        </span>
                        <span className="text-xs font-semibold text-muted uppercase tracking-wide">Total Campaigns</span>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* Search Bar + Filters */}
        <motion.div className="flex min-w-0 flex-col sm:flex-row gap-4 mb-8 delay-200" viewport={presets.viewport} {...fadeUp(0.1)}>
          <div
            className={`flex min-h-12 w-full min-w-0 flex-1 items-center gap-3 rounded-md border px-5 shadow-sm transition-all focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/40 sm:h-14 sm:min-h-14 sm:gap-4 sm:px-7 ${
              isPreviewMode
                ? "border-heading/20 bg-white/90 focus-within:bg-white"
                : isTeamMemberMode || isOrgAdminMode
                  ? "border-primary/20 bg-white/92 focus-within:bg-white"
                  : "border-border/60 bg-white/80 backdrop-blur-md focus-within:bg-white"
            }`}
          >
            <Search className="pointer-events-none shrink-0 text-heading" size={22} strokeWidth={2.5} aria-hidden />
            <input
              id="dashboard-campaign-search"
              name="campaignSearch"
              type="text"
              placeholder={isTeamMemberMode ? "Search assigned campaigns..." : "Search campaigns..."}
              className="min-w-0 flex-1 border-0 bg-transparent py-[0.65rem] pr-0 text-[17px] leading-[1.6] text-heading shadow-none outline-none ring-0 placeholder:text-muted/55 placeholder:opacity-90 focus-visible:ring-0 sm:h-full sm:min-h-0 sm:py-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="relative w-full min-w-0 self-stretch sm:w-auto sm:self-auto">
            <button
              type="button"
              onClick={() => setIsEventFilterOpen((prev) => !prev)}
              className={`h-12 min-h-12 w-full rounded-md border px-6 shadow-sm inline-flex items-center justify-center gap-2.5 text-base font-semibold transition-all duration-150 sm:inline-flex sm:h-14 sm:min-h-14 sm:w-auto ${
                isEventFilterOpen
                  ? "bg-primary/10 border-primary/30 text-primary-strong"
                  : "bg-white/92 border-primary/20 text-heading hover:bg-white hover:border-primary/30"
              }`}
            >
              <SlidersHorizontal size={18} />
              Filter
            </button>
            {isEventFilterOpen && (
              <div className="absolute left-1/2 z-30 mt-2 w-[min(calc(100vw-2rem),280px)] -translate-x-1/2 rounded-md border border-border/70 bg-white/95 p-4 shadow-xl sm:left-auto sm:right-0 sm:translate-x-0 sm:w-[280px]">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Campaign status</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: "all", label: "All" },
                        { id: "upcoming", label: "Upcoming" },
                        { id: "ongoing", label: "Ongoing" },
                        { id: "past", label: "Past" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setEventStatusFilter(opt.id as "all" | "upcoming" | "ongoing" | "past")}
                          className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${
                            eventStatusFilter === opt.id
                              ? "bg-primary/10 border-primary/30 text-primary-strong"
                              : "bg-white border-border/70 text-heading hover:border-primary/30"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Campaign mode</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: "all", label: "All" },
                        { id: "onsite", label: "Onsite" },
                        { id: "webinar", label: "Webinar" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setEventLocationFilter(opt.id as "all" | "onsite" | "webinar")}
                          className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${
                            eventLocationFilter === opt.id
                              ? "bg-primary/10 border-primary/30 text-primary-strong"
                              : "bg-white border-border/70 text-heading hover:border-primary/30"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEventStatusFilter("all");
                        setEventLocationFilter("all");
                      }}
                      className="cursor-pointer text-xs font-medium text-muted hover:text-heading underline-offset-4 hover:underline"
                    >
                      Reset filters
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {isOrgTeamMember && (
          <motion.div
            className="p-4 rounded-md mb-6 border border-primary/25 bg-surface border border-hairline-soft shadow-sm motion-token-enter motion-token-hover"
            viewport={presets.viewport}
            {...fadeUp(0.07)}
            {...hoverLift(-2, 1.004)}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm font-medium text-heading inline-flex items-center gap-2">
                <Lock size={14} className="text-primary-strong" />
                Your Access
              </p>
              <span
                className={`text-xs px-2 py-1 rounded-md border ${
                  hasCreateCampaignPermission
                    ? "text-primary-strong bg-primary/10 border-primary/25"
                    : "text-amber-700 bg-amber-50 border-amber-200"
                }`}
              >
                {hasCreateCampaignPermission ? "Can create campaigns" : "Campaign creation locked"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {grantedPermissions.length > 0 ? (
                grantedPermissions.map((perm) => (
                  <span key={perm} className="text-[11px] uppercase tracking-wide px-2 py-1 rounded-md border border-primary/20 bg-white text-primary-strong">
                    {perm.replaceAll("_", " ")}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted">No active permissions yet. Request access from your organization admin.</span>
              )}
            </div>
          </motion.div>
        )}

        {isOrgTeamMember && myAccessRequests.length > 0 && (
          <motion.div
            className="p-4 rounded-md mb-6 border border-border/60 bg-white/92 shadow-sm motion-token-enter"
            viewport={presets.viewport}
            {...fadeUp(0.09)}
          >
            <p className="text-sm font-medium text-heading mb-2">My Pending Access Workflow</p>
            <div className="flex flex-col gap-2">
              {myAccessRequests.slice(0, 4).map((req) => (
                <div key={req.id} className="flex items-center justify-between text-[13px] leading-tight bg-white border border-primary/15 rounded-md px-3 py-2">
                  <span className="text-heading">{req.event_name} • {req.requested_action}</span>
                  <span className={`font-medium ${
                    req.status === "approved" ? "text-success" : req.status === "rejected" ? "text-red-500" : "text-amber-600"
                  }`}>
                    {req.status}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {!isOrgTeamMember && !isOrgOwner && myOrgJoinRequests.length > 0 && (
          <div className="glass-panel p-4 rounded-md mb-6">
            <p className="text-sm font-medium text-heading mb-2">My Organization Join Requests</p>
            <div className="flex flex-col gap-2">
              {myOrgJoinRequests.slice(0, 4).map((req) => (
                <div key={req.id} className="flex items-center justify-between gap-3 text-[13px] leading-tight bg-white/60 border border-border/50 rounded-md px-3 py-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-heading truncate">
                      Organization: {req.requested_org_name} • Reviewer: {req.owner_email}
                    </span>
                    {String(req.status || "").toLowerCase() === "rejected" && req.reapply_after && (
                      <span className="text-muted text-[0.8125rem] mt-1">
                        Reapply after: {new Date(req.reapply_after).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <span className={`font-medium shrink-0 border px-2 py-1 rounded-md ${formatJoinStatus(req.status).className}`}>
                    {formatJoinStatus(req.status).label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isOrgTeamMember && isOrgOwner && (orgJoinInbox.length > 0 || inboxRequests.length > 0 || failedNotifications.length > 0) && (
          <div className="glass-panel p-4 rounded-md mb-6 border border-primary/20 bg-primary/5">
            <p className="text-sm font-medium text-heading inline-flex items-center gap-2">
              <ShieldCheck size={14} className="text-primary-strong" />
              Admin Workspace
            </p>
            <p className="text-xs text-muted mt-1">
              Review organization join requests, access approvals, and notification health.
            </p>
          </div>
        )}

        {!isOrgTeamMember && isOrgOwner && orgJoinInbox.length > 0 && (
          <div className="glass-panel p-4 rounded-md mb-6">
            <p className="text-sm font-medium text-heading mb-2">Organization Join Inbox</p>
            <div className="flex flex-col gap-2">
              {orgJoinInbox.slice(0, 4).map((req) => (
                <div key={req.id} className="flex items-center justify-between gap-3 text-[13px] leading-tight bg-white/60 border border-border/50 rounded-md px-3 py-2">
                  <span className="text-heading truncate">
                    Requester: {req.requester_email} • Wants to join: {req.requested_org_name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className="px-2 py-1 rounded-md bg-primary text-primary-foreground text-[13px] leading-tight font-medium tracking-[0.01em]"
                      onClick={() => reviewOrgJoinRequest(req.id, "approve")}
                    >
                      Approve
                    </button>
                    <button
                      className="px-2 py-1 rounded-md border border-border text-[13px] leading-tight font-normal tracking-[0.01em]"
                      onClick={() => reviewOrgJoinRequest(req.id, "reject")}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isOrgTeamMember && isOrgOwner && inboxRequests.length > 0 && (
          <div className="glass-panel p-4 rounded-md mb-6">
            <p className="text-sm font-medium text-heading mb-2">Pending Access Inbox</p>
            <div className="flex flex-col gap-2">
              {inboxRequests.slice(0, 4).map((req) => (
                <div key={req.id} className="flex items-center justify-between gap-3 text-[13px] leading-tight bg-white/60 border border-border/50 rounded-md px-3 py-2">
                  <span className="text-heading truncate">{req.requester_email} • {req.event_name} • {req.requested_action}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className="px-2 py-1 rounded-md bg-primary text-primary-foreground text-[13px] leading-tight font-medium tracking-[0.01em]"
                      onClick={() => reviewInboxRequest(req.id, "approve")}
                    >
                      Approve
                    </button>
                    <button
                      className="px-2 py-1 rounded-md border border-border text-[13px] leading-tight font-normal tracking-[0.01em]"
                      onClick={() => reviewInboxRequest(req.id, "reject")}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isOrgTeamMember && failedNotifications.length > 0 && (
          <div className="glass-panel p-4 rounded-md mb-6">
            <p className="text-sm font-medium text-heading mb-2">Failed Notifications</p>
            <div className="flex flex-col gap-2">
              {failedNotifications.slice(0, 6).map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 text-[13px] leading-tight bg-white/60 border border-border/50 rounded-md px-3 py-2">
                  <span className="text-heading truncate">
                    {row.event_name} • {row.requester_email} • {row.requested_action}
                  </span>
                  <button
                    className="px-2 py-1 rounded-md border border-border text-[13px] leading-tight font-normal inline-flex items-center gap-1 shrink-0"
                    onClick={() => retryNotification(row.id, row.status)}
                    disabled={retryingNotificationId === row.id}
                  >
                    <RefreshCw size={12} className={retryingNotificationId === row.id ? "animate-spin" : ""} />
                    {retryingNotificationId === row.id ? "Retrying" : "Retry"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event Cards List */}
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 sm:py-32 bg-surface/30 border border-dashed border-border rounded-xl gap-4 px-6">
            <div className="flex flex-col gap-1">
              <p className="text-heading font-medium">No campaigns yet</p>
              <p className="text-sm text-muted">Create your first campaign to start inviting attendees.</p>
            </div>
          </div>
        ) : (
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 delay-300">
            {filteredEvents.length > 0 ? (
              filteredEvents.map((evt, idx) => {
                const status = getEventStatus(evt.date);
                return (
                <motion.div
                  key={evt.id}
                  className={`group motion-token-enter motion-token-hover flex flex-col justify-between p-6 rounded-md  ${
                    isPreviewMode
                      ? "bg-white/90 border border-heading/20 shadow-md hover:shadow-lg hover:border-heading/40"
                      : isTeamMemberMode || isOrgAdminMode
                        ? "bg-white/95 border border-primary/20 shadow-md hover:shadow-lg hover:border-primary/40"
                      : "glass-panel hover:shadow-2xl hover:shadow-black/10 hover:border-primary/40"
                  } ${status.label === "Past" ? "opacity-75 grayscale-[0.3]" : ""}`}
                  viewport={presets.viewport}
                  {...staggerItem(idx, 0.05, 0.28, 16, 0.3)}
                  {...hoverLift(-6, 1.01)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      {evt.logo_url && (
                        <div className="w-20 h-20 rounded-md bg-white border border-border/40 shadow-md overflow-hidden group-hover:scale-105 transition-transform duration-200 shrink-0">
                          <OptimizedImage
                            src={evt.logo_url}
                            alt={evt.name}
                            width={80}
                            height={80}
                            className="w-full h-full object-cover block"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 ml-auto">
                      <span className={`text-[13px] font-medium tracking-[0.01em] leading-tight px-3 py-1 rounded-md border ${status.classes}`}>
                        {status.label}
                      </span>
                      <div className="flex items-center text-[13px] font-medium leading-tight text-primary-strong bg-primary/10 px-3 py-1 rounded-md">
                        {evt.attendeeCount} Attendee{evt.attendeeCount !== 1 && 's'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col grow">
                    <h3 className="font-semibold text-2xl tracking-[-0.03em] text-heading group-hover:text-ink transition-colors line-clamp-2 leading-[1.15] mb-2">
                      {evt.name}
                    </h3>
                    
                    <div className="flex flex-col gap-1.5 mb-1">
                      <div className="flex items-center gap-3 text-muted font-normal px-1">
                        <Calendar size={18} className="text-muted/60 shrink-0" />
                        <span className="text-sm leading-[1.6] tracking-[0em]">{evt.date}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted font-normal px-1 min-w-0">
                        {(evt.location || "").trim().toLowerCase() === "webinar" ? (
                          <Globe size={18} className="text-muted/60 shrink-0" />
                        ) : (
                          <MapPin size={18} className="text-muted/60 shrink-0" />
                        )}
                        <span className="min-w-0 max-w-full truncate text-sm leading-[1.6] tracking-[0em]">{evt.location}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Link href={`/dashboard/events/${evt.id}${isPreviewMode && impersonateId ? `?impersonate=${encodeURIComponent(impersonateId)}` : ""}`} className="mt-auto pt-3 border-t border-border/60 flex items-center justify-between text-sm font-medium text-heading hover:text-ink hover:bg-white/20 rounded-inline transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 cursor-pointer group-hover:text-ink">
                    View Campaign
                    <motion.span {...hoverIconNudge(3)} className="inline-flex">
                      <ChevronRight size={20} className="transition-transform duration-200" />
                    </motion.span>
                  </Link>
                </motion.div>
                );
              })
            ) : (
              <div className="col-span-full text-center py-12 glass-panel rounded-xl border-dashed">
                <p className="text-muted text-sm">No campaigns match your search/filter criteria.</p>
              </div>
            )}
          </div>
        )}
      </>
    )}
  </div>

      {/* Event Creation Modal */}
      {isEventModalOpen && !isPreviewMode && (
        <div className={dashboardModalBackdrop}>
          <div 
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in" 
          />
          <div className="relative w-full max-w-[480px] max-h-[92dvh] min-h-0 flex flex-col glass-panel bg-white border border-border/70 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-8 pt-6 pb-3 flex items-center justify-between border-b border-border/50 shrink-0">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-heading tracking-[-0.02em] leading-tight">Create New Campaign</h2>
                <p className="text-[13px] text-muted">Add details for your upcoming campaign.</p>
              </div>
              <button onClick={() => setIsEventModalOpen(false)} className="text-muted hover:text-heading p-1"><X size={20}/></button>
            </div>

            {/* Modal Body + Footer */}
            <form onSubmit={handleEventSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-8 pt-5 custom-scrollbar">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <TextInput
                    label="Name of the Campaign"
                    required
                    placeholder="e.g. TechConf 2026"
                    value={eventForm.name}
                    maxLength={EVENT_NAME_MAX_CHARS}
                    onChange={(v) => setEventForm({ ...eventForm, name: v })}
                  />
                  <div className="flex justify-end">
                    <span className={`text-[11px] font-medium ${eventForm.name.length >= EVENT_NAME_MAX_CHARS ? "text-amber-600" : "text-muted"}`}>
                      {eventForm.name.length}/{EVENT_NAME_MAX_CHARS} chars
                    </span>
                  </div>
                </div>

                <TextArea
                  label="Campaign Description"
                  placeholder="Describe your campaign (e.g. goals, audience)..."
                  value={eventForm.description}
                  maxLength={CAMPAIGN_DESCRIPTION_MAX_CHARS}
                  onChange={(v: string) => setEventForm({ ...eventForm, description: v })}
                />
                
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center gap-1">
                     <label className="text-[14px] font-normal text-heading leading-tight tracking-[0.01em]">Location Type</label>
                  </div>
                  <div className="flex gap-4 mb-1">
                     <label className="flex items-center gap-2 cursor-pointer text-sm text-heading">
                        <input type="radio" id="dashboard-event-location-onsite" name="locationType" value="onsite" checked={eventForm.location_type === "onsite"} onChange={() => setEventForm({ ...eventForm, location_type: "onsite" })} className="accent-primary h-4 w-4 cursor-pointer" />
                        Onsite
                     </label>
                     <label className="flex items-center gap-2 cursor-pointer text-sm text-heading">
                        <input type="radio" id="dashboard-event-location-webinar" name="locationType" value="webinar" checked={eventForm.location_type === "webinar"} onChange={() => setEventForm({ ...eventForm, location_type: "webinar", location: "" })} className="accent-primary h-4 w-4 cursor-pointer" />
                        Webinar
                     </label>
                  </div>
                </div>

                {eventForm.location_type === "webinar" ? (
                   <div className="flex flex-col gap-2 w-full group opacity-75">
                     <label className="text-[14px] font-normal text-heading leading-tight tracking-[0.01em]">Location <span className="text-primary-strong">*</span></label>
                     <div className="flex h-11 items-center bg-surface border border-border/60 rounded-md shadow-sm px-4 overflow-hidden cursor-not-allowed">
                        <Globe size={18} className="text-muted mr-2" />
                        <input id="dashboard-event-webinar-readonly" name="locationWebinarLabel" type="text" value="Webinar" disabled className="h-full flex-1 py-0 text-[16px] leading-[1.6] text-muted bg-transparent outline-none cursor-not-allowed" />
                     </div>
                   </div>
                ) : (
                  <TextInput
                    label="Location"
                    required
                    placeholder="e.g. San Francisco, CA"
                    value={eventForm.location}
                    onChange={(v) => setEventForm({ ...eventForm, location: v })}
                  />
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextInput
                  label="Campaign Date"
                    required
                    type="date"
                    min={minCampaignDate}
                    value={eventForm.date}
                    onChange={(v) => setEventForm({ ...eventForm, date: v })}
                  />
                  <TimeInput
                    label="Campaign Time"
                    required
                    value={eventForm.time}
                    onChange={(v) => setEventForm({ ...eventForm, time: v })}
                  />
                </div>
<FilePicker
  label="Campaign Logo"
  value={eventForm.logo}
  onChange={(v) => setEventForm({ ...eventForm, logo: v })}
  onError={(msg) => toast.error(msg)}
  freeFormCrop={false}
  cropAspect={CAMPAIGN_LOGO_CROP_ASPECT}
  cropTitle="Crop campaign logo"
  cropSubtitle="Adjust the logo within the fixed frame used on cards."
  cropApplyLabel="Apply logo"
/>

<p className="mt-1 text-xs text-red-500">
  Logo size must be less than 1 MB, otherwise the logo will not be updated.
</p>
              </div>
              </div>

              {/* Modal Footer */}
              <div className="shrink-0 border-t border-hairline-soft bg-white p-6 form-actions">
                <Button 
                  variant="secondary" 
                  fullWidth 
                  onClick={() => setIsEventModalOpen(false)}
                  className="order-2 sm:order-1 h-11"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  fullWidth 
                  disabled={isSubmittingEvent || (isOrgTeamMember && !hasCreateCampaignPermission)}
                  className="order-1 sm:order-2 h-11"
                >
                  {isSubmittingEvent ? "Creating..." : "Create Campaign"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isUsernameModalOpen && !isPreviewMode && (
        <div className={dashboardModalBackdrop}>
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => !isSavingUsername && setIsUsernameModalOpen(false)}
          />
          <div className="relative w-full max-w-[480px] max-h-[92dvh] flex flex-col glass-panel bg-white/90 border border-border/70 rounded-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 pt-8 pb-4 flex items-center justify-between shrink-0">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">Account Settings</h2>
                <p className="text-sm text-muted">Manage your profile, organization, and security preferences.</p>
              </div>
              <button
                onClick={() => {
                  if (!isSavingUsername && !isSavingPassword) setIsUsernameModalOpen(false);
                }}
                className="w-11 h-11 rounded-md border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all duration-150"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-8 pt-4 flex flex-col gap-8">
              <form onSubmit={handleSaveUsername} className="flex flex-col gap-4">
                <h3 className="font-semibold text-heading text-lg leading-none mb-1">Profile & Organization</h3>
                <TextInput
                  label="Email"
                  value={userEmail}
                  onChange={() => {}}
                  disabled
                  readOnly
                />
                <TextInput
                  label="Username"
                  required
                  placeholder="choose_a_username"
                  value={usernameDraft}
                  onChange={(v) => {
                    setUsernameDraft(v);
                    if (usernameError) setUsernameError("");
                  }}
                />
                <p className="text-[13px] text-muted -mt-1">Allowed: letters, numbers, underscore, dot. Can be changed once every 24 days.</p>
                <TextInput
                  label="Organization Name"
                  required
                  placeholder="Your organization"
                  value={organizationDraft}
                  maxLength={120}
                  onChange={(v) => {
                    setOrganizationDraft(v);
                    if (usernameError) setUsernameError("");
                  }}
                  disabled={isOrgTeamMember || hasPendingOrgJoin}
                  readOnly={isOrgTeamMember || hasPendingOrgJoin}
                />
                <p className="text-[13px] text-muted -mt-1">
                  {isOrgTeamMember || hasPendingOrgJoin
                    ? "Organization name is read-only for team members."
                    : "Organization name can be changed once every 90 days."}
                </p>
                {isOrgOwner && (
                  <FilePicker
                    label="Organization Logo"
                    value={organizationLogoDraft}
                    onChange={(v) => setOrganizationLogoDraft(v)}
                    onError={(msg) => toast.error(msg)}
                    cropTitle="Crop organization logo"
                    cropSubtitle="Drag the corners or edges to adjust the crop."
                    cropApplyLabel="Apply logo"
                  />
                )}
                {usernameError && <p className="text-sm font-normal leading-[1.6] text-red-500">{usernameError}</p>}
                <div className="pt-2">
                  <Button
                    type="submit"
                    fullWidth
                    disabled={isSavingUsername}
                    className="shadow-md shadow-black/5"
                  >
                    {isSavingUsername ? "Saving Profile..." : "Save Profile Settings"}
                  </Button>
                </div>
              </form>
              
              <hr className="border-border/40" />
              
              <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
                <h3 className="font-semibold text-heading text-lg leading-none mb-1">Security</h3>
                <TextInput
                  type="password"
                  label="Current Password"
                  value={currentPasswordDraft}
                  onChange={setCurrentPasswordDraft}
                />
                <TextInput
                  type="password"
                  label="New Password"
                  value={newPasswordDraft}
                  onChange={setNewPasswordDraft}
                />
                {passwordError && <p className="text-sm font-normal leading-[1.6] text-red-500">{passwordError}</p>}
                <div className="pt-2">
                  <Button
                    type="submit"
                    fullWidth
                    variant="secondary"
                    disabled={isSavingPassword || !currentPasswordDraft || !newPasswordDraft}
                  >
                    {isSavingPassword ? "Updating Password..." : "Update Password"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isOwnerProfileSetupModalOpen && !isPreviewMode && isOrgOwner && (
        <div className={dashboardModalBackdrop}>
          <div className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in" />
          <div className="relative w-full max-w-[560px] max-h-[92dvh] flex flex-col glass-panel bg-white/95 border border-border/70 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-10 pt-10 pb-7 border-b border-border/10 shrink-0">
              <h2 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">
                Complete your profile
              </h2>
              <p className="mt-2 text-sm text-muted leading-[1.6]">
                Username is required. Organization logo is optional and can be added anytime from Account Settings.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-10 py-8 flex flex-col gap-4">
              <TextInput
                label="Username"
                required
                placeholder="choose_a_username"
                value={ownerProfileUsernameDraft}
                onChange={setOwnerProfileUsernameDraft}
                error={ownerProfileSetupError.toLowerCase().includes("username") ? ownerProfileSetupError : ""}
              />
              <FilePicker
                label="Organization Logo"
                value={ownerProfilePhotoDraft}
                onChange={(val) => {
                  setOwnerProfilePhotoDraft(val);
                  if (ownerProfileSetupError.toLowerCase().includes("logo") || ownerProfileSetupError.toLowerCase().includes("profile")) setOwnerProfileSetupError("");
                }}
                onError={(msg) => setOwnerProfileSetupError(msg)}
                error={ownerProfileSetupError.toLowerCase().includes("logo") || ownerProfileSetupError.toLowerCase().includes("profile") ? ownerProfileSetupError : ""}
                cropTitle="Crop organization logo"
                cropSubtitle="Drag the corners or edges to adjust the crop."
                cropApplyLabel="Apply logo"
              />
              {ownerProfileSetupError &&
                !ownerProfileSetupError.toLowerCase().includes("username") &&
                !ownerProfileSetupError.toLowerCase().includes("profile") ? (
                <p className="text-sm text-red-500">{ownerProfileSetupError}</p>
              ) : null}
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={isSavingUsername}
                onClick={async () => {
                  const ok = await saveMandatoryOwnerProfileSetup();
                  if (!ok) return;
                  const onboardingRes = await fetch("/api/onboarding/organization-owner", { cache: "no-store" });
                  const onboardingPayload = onboardingRes.ok ? await readResponsePayload(onboardingRes) : null;
                  setIsOwnerOnboardingModalOpen(Boolean(asPayloadRecord(onboardingPayload)?.shouldShowOnboarding));
                }}
              >
                {isSavingUsername ? "Saving..." : "Continue"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isOwnerOnboardingModalOpen && !isPreviewMode && isOrgOwner && (
        <div className={dashboardModalBackdrop}>
          <div className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in" />
          <div className="relative w-full max-w-[560px] glass-panel bg-white/95 border border-border/70 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-10 pt-10 pb-7 border-b border-border/10">
              <h2 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">
                Invite your team
              </h2>
              <p className="mt-2 text-sm text-muted leading-[1.6]">
                Your organization profile is ready. Add teammates now, or skip and manage access later from Team Access.
              </p>
            </div>
            <div className="px-10 py-8 flex flex-col gap-3">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={isSavingOwnerOnboarding}
                onClick={async () => {
                  const ok = await markOwnerOnboardingCompleted();
                  if (!ok) return;
                  setIsOwnerOnboardingModalOpen(false);
                  router.replace("/dashboard");
                  void openTeamAccessModal("add");
                }}
                icon={<Users size={18} />}
              >
                Add Team Members
              </Button>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                disabled={isSavingOwnerOnboarding}
                onClick={async () => {
                  const ok = await markOwnerOnboardingCompleted();
                  if (!ok) return;
                  setIsOwnerOnboardingModalOpen(false);
                  router.replace("/dashboard");
                  toast.success("You can add team members anytime from Team Access.");
                }}
              >
                Skip for Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {isTeamModalOpen && !isPreviewMode && (
        <div className={dashboardModalBackdrop}>
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => !isSubmittingTeamInvite && setIsTeamModalOpen(false)}
          />
          <div className="relative w-full max-w-[660px] max-h-[92dvh] flex flex-col glass-panel bg-white/95 border border-border/70 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex shrink-0 flex-col gap-6 border-b border-border/10 px-5 pb-6 pt-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:pb-8 sm:pt-10 lg:px-12 lg:pb-8 lg:pt-12">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">
                  {teamModalView === "list" && "Organization Team"}
                  {teamModalView === "add" && "Invite Member"}
                  {teamModalView === "edit" && "Manage Access"}
                </h2>
                <p className="text-sm text-muted">
                  {teamModalView === "list" && "Manage your organization team members and their roles."}
                  {teamModalView === "add" && "Step 1: Enter member information."}
                  {teamModalView === "edit" && (teamInviteEmail ? `Step 2: Set permissions for ${teamInviteEmail}` : "Manage permissions")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTeamModalOpen(false)}
                className="w-11 h-11 rounded-md border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all duration-150"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
              {teamModalView === "list" && (
                <div className="flex flex-col gap-8">
                  {!isOrgTeamMember && (
                    <Button 
                      variant="primary" 
                      size="md"
                      onClick={() => {
                        setTeamInviteEmail("");
                        setTeamInviteRoleLabel("");
                        setTeamPermissionDraft([]);
                        setTeamModalView("add");
                      }}
                      icon={<Plus size={18} />}
                      fullWidth
                    >
                      Invite New Member
                    </Button>
                  )}

                  <div className="flex flex-col gap-4 max-h-[520px] overflow-y-auto pr-2">
                    {teamMembers.length === 0 ? (
                      <div className="py-12 text-center flex flex-col items-center gap-3 bg-surface/30 rounded-xl border border-dashed border-border/50">
                        <Users size={32} className="text-muted/40" />
                        <p className="text-sm text-muted">No members added yet.</p>
                      </div>
                    ) : (
                      teamMembers.map((m) => (
                        <div 
                          key={m.id} 
                          className="group w-full flex items-center justify-between px-4 py-4 bg-white/60 border border-border/60 rounded-xl hover:border-primary/30 hover:bg-white hover:shadow-sm transition-all duration-200"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm border border-primary/20 shrink-0">
                              {m.member_email.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col gap-2 min-w-0">
                              <span className="text-base font-semibold text-heading truncate leading-[1.4]">{m.member_email}</span>
                              <span className="text-[15px] leading-tight text-muted font-semibold bg-surface/55 w-fit px-3.5 py-1.5 rounded-md border border-border/35">
                                {m.role_label}
                              </span>
                            </div>
                          </div>
                          
                          {!isOrgTeamMember && (
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<Pencil size={14} />}
                              onClick={() => {
                                void openTeamMemberEdit(m);
                              }}
                              className="transition-all shadow-sm border-primary/20 text-primary-strong"
                            >
                              Edit Access
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {teamModalView === "add" && (
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!teamInviteEmail || !teamInviteRoleLabel) {
                      setTeamError("Please fill in both email and role.");
                      return;
                    }
                    setTeamError("");
                    setTeamModalView("edit"); // Move to permission selection
                  }} 
                  className="flex flex-col gap-8"
                >
                  <div className="flex flex-col gap-6">
                    <div className="bg-primary/5 p-6 rounded-xl border border-primary/10 mb-2">
                      <p className="text-[13px] text-primary-strong font-medium">Step 1: Member Details</p>
                      <p className="text-[11px] text-muted leading-relaxed">Enter the details of the person you want to invite. You will configure their permissions in the next step.</p>
                    </div>
                    <TextInput
                      label="Member Email"
                      required
                      type="email"
                      placeholder="colleague@company.com"
                      value={teamInviteEmail}
                      onChange={setTeamInviteEmail}
                    />
                    <TextInput
                      label="Role Label"
                      required
                      placeholder="e.g. Media Manager, Lead Designer"
                      value={teamInviteRoleLabel}
                      onChange={setTeamInviteRoleLabel}
                    />
                  </div>
                  
                  {teamError && <p className="text-sm text-red-500 bg-red-50 p-3 rounded-md border border-red-100">{teamError}</p>}
                  
                  <div className="form-actions pt-2">
                    <Button 
                      type="button" 
                      variant="secondary" 
                      fullWidth 
                      className="order-2 h-11 sm:order-1"
                      onClick={() => {
                        setTeamModalView("list");
                        setIsTeamModalOpen(false);
                      }}
                    >
                      Back
                    </Button>
                    <Button 
                      type="submit" 
                      fullWidth 
                      className="order-1 h-11 sm:order-2"
                    >
                      Next: Set Permissions
                    </Button>
                  </div>
                </form>
              )}

              {teamModalView === "edit" && (
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddOrgMemberRow(e);
                  }} 
                  className="flex flex-col gap-8"
                >
                  <div className="flex flex-col gap-6">
                    <TextInput
                      label="Role Label"
                      required
                      placeholder="e.g. Director"
                      value={teamInviteRoleLabel}
                      onChange={setTeamInviteRoleLabel}
                    />
                    
                    <div className="flex flex-col gap-3">
                      <label className="text-[13px] font-semibold text-heading uppercase tracking-wider opacity-60">Permissions</label>
                      <div className="grid gap-3">
                        {[
                          { id: "create_event", label: "Create Campaigns", desc: "Allow creating new events and campaigns" },
                          { id: "manage_event", label: "Manage Events", desc: "Full access to edit and manage existing events" },
                          { id: "edit_cards", label: "Edit Cards", desc: "Can edit attendee card details" },
                          { id: "delete_cards", label: "Delete Cards", desc: "Can remove attendee cards" },
                        ].map((perm) => (
                          <label 
                            key={perm.id} 
                            className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer hover:bg-surface/50 ${
                              teamPermissionDraft.includes(perm.id) 
                              ? "bg-primary/5 border-primary/30" 
                              : "bg-white/30 border-border/30"
                            }`}
                          >
                            <div className="pt-1">
                              <input
                                id={`team-permission-${perm.id}`}
                                name={`teamPermission_${perm.id}`}
                                type="checkbox"
                                className="w-4 h-4 rounded-md accent-primary"
                                checked={teamPermissionDraft.includes(perm.id)}
                                onChange={(e) =>
                                  setTeamPermissionDraft((prev) =>
                                    e.target.checked ? Array.from(new Set([...prev, perm.id])) : prev.filter((p) => p !== perm.id),
                                  )
                                }
                              />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-heading leading-none mb-1">{perm.label}</span>
                              <span className="text-[11px] text-muted leading-tight">{perm.desc}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {teamError && <p className="text-sm text-red-500 bg-red-50 p-3 rounded-md border border-red-100">{teamError}</p>}

                  <div className="form-actions pt-2">
                    <Button 
                      type="button" 
                      variant="secondary" 
                      fullWidth 
                      className="order-2 h-11 sm:order-1"
                      onClick={() => setTeamModalView("list")}
                    >
                      Back
                    </Button>
                    <Button 
                      type="submit" 
                      fullWidth 
                      disabled={isSubmittingTeamInvite}
                      className="order-1 h-11 sm:order-2"
                    >
                      {isSubmittingTeamInvite ? "Saving..." : "Update Permissions"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Request Permission Modal */}
      {isRequestPermissionModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center overflow-y-auto bg-black/40 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur-sm animate-in fade-in duration-200 sm:p-6">
          <div className="bg-white/95 border border-border/40 w-full max-w-[500px] max-h-[92dvh] flex flex-col rounded-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-border/10 flex items-center justify-between bg-primary/2 shrink-0">
              <div className="flex items-center gap-2">
                <AlertCircle className="text-danger" size={20} />
                <h2 className="text-xl font-semibold text-heading tracking-tight">Request Creation Access</h2>
              </div>
              <button onClick={() => setIsRequestPermissionModalOpen(false)} className="text-muted hover:text-heading transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <p className="text-sm text-muted mb-6 leading-[1.6]">
                You currently don&apos;t have permission to create campaigns. To get access, please send a request to your organization admin with a short reason.
              </p>
              
              <form onSubmit={handleRequestPermission}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-heading mb-2">Reason for access</label>
                  <textarea
                    className="w-full min-h-[120px] bg-white border border-border/40 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-muted/40"
                    placeholder="E.g., I need to create a campaign for the upcoming tech conference..."
                    value={permissionRequestReason}
                    onChange={(e) => setPermissionRequestReason(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-actions">
                  <Button type="button" variant="secondary" fullWidth className="order-2 h-11 sm:order-1" onClick={() => setIsRequestPermissionModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" fullWidth disabled={isSubmittingPermissionRequest} className="order-1 h-11 sm:order-2">
                    {isSubmittingPermissionRequest ? "Sending..." : "Send Request"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <main className={dashboardMainTransparent}>
        <GradientBackground />
        <div className={dashboardContentInset}>
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
        </div>
      </main>
    }>
      <DashboardContent />
    </Suspense>
  );
}
