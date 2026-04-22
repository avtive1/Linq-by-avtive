"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { Button, TextInput, Skeleton, AnimatedCounter, FilePicker } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { Plus, LogOut, Calendar, MapPin, User, Search, Users, BarChart3, ArrowLeft, X, ChevronRight, Sparkles, Globe, Pencil, RefreshCw, AlertCircle, ShieldCheck, UserCheck, Lock } from "lucide-react";
import { EventData } from "@/types/card";
import { toast } from "sonner";
import { getEventStatus } from "@/lib/utils";

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

const formatJoinStatus = (status: string) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") {
    return { label: "Approved", className: "text-green-600 bg-green-50 border-green-200" };
  }
  if (normalized === "rejected") {
    return { label: "Rejected", className: "text-red-600 bg-red-50 border-red-200" };
  }
  return { label: "Pending", className: "text-amber-700 bg-amber-50 border-amber-200" };
};

function DashboardContent() {
  const EVENT_NAME_MAX_CHARS = 18;
  const router = useRouter();
  const searchParams = useSearchParams();
  const impersonateId = searchParams.get("impersonate");
  
  const [events, setEvents] = useState<DashboardEventData[]>([]);
  const [userName, setUserName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
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
  const [selectedMemberToEdit, setSelectedMemberToEdit] = useState<OrgMemberRow | null>(null);
  const [eventForm, setEventForm] = useState({
    name: "",
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

  const [isRequestPermissionModalOpen, setIsRequestPermissionModalOpen] = useState(false);
  const [permissionRequestReason, setPermissionRequestReason] = useState("");
  const [isSubmittingPermissionRequest, setIsSubmittingPermissionRequest] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;
      
      if (!session) {
        router.replace("/login");
        return;
      }
      
      // Check for admin - for client side UI toggle
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAIL || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const role = session.user.user_metadata?.role;
      const isAdminByRole = typeof role === "string" && role.toLowerCase() === "admin";
      const isActuallyAdmin = Boolean(
        isAdminByRole || (session.user.email && adminEmails.includes(session.user.email.toLowerCase())),
      );
      
      if (isActuallyAdmin) {
        setIsAdmin(true);
      }

      // Logic for Effective User ID
      let effectiveId = session.user.id;
      let effectiveName = session.user.email?.split("@")[0] || "";
      let userisOrgTeamMemberLocal = false;
      let userIsOrgOwnerLocal = false;
      let gateStatus: "pending" | "awaiting_owner" | null = null;

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("username, organization_name")
        .eq("id", session.user.id)
        .single();
      if (profileRow?.username?.trim()) {
        effectiveName = profileRow.username.trim();
      }
      if (profileRow?.organization_name?.trim()) {
        setOrganizationName(profileRow.organization_name.trim());
      }

      const memberRes = await fetch("/api/organization-members/me");
      if (memberRes.ok) {
        const memberPayload = await memberRes.json();
        if (memberPayload?.data?.org_owner_user_id) {
          effectiveId = memberPayload.data.org_owner_user_id;
          setIsOrgTeamMember(true);
          userisOrgTeamMemberLocal = true;
          setIsOrgOwner(false);
          userIsOrgOwnerLocal = false;
          setOrgRoleLabel(String(memberPayload.data.role_label || ""));
          setOrgOwnerUserId(String(memberPayload.data.org_owner_user_id || ""));
          setGrantedPermissions(memberPayload.data.permissions || []);
          try {
            const mineRes = await fetch("/api/access-requests/mine");
            const minePayload = await mineRes.json();
            if (mineRes.ok && Array.isArray(minePayload?.data)) {
              setMyAccessRequests(minePayload.data);
            }
          } catch {}
        } else {
          setIsOrgTeamMember(false);
          setOrgRoleLabel("");
          const [{ data: ownedEvents }, { data: ownedMembers }, ownerStateRes] = await Promise.all([
            supabase.from("events").select("id").eq("user_id", session.user.id).limit(1),
            supabase.from("organization_members").select("id").eq("org_owner_user_id", session.user.id).limit(1),
            fetch("/api/organization-owner/me"),
          ]);
          let ownerByRegistry = false;
          if (ownerStateRes.ok) {
            const ownerStatePayload = await ownerStateRes.json();
            ownerByRegistry = Boolean(ownerStatePayload?.data?.isOwner);
          }
          const userIsOrgOwner =
            (ownedEvents || []).length > 0 ||
            (ownedMembers || []).length > 0 ||
            ownerByRegistry;
          setIsOrgOwner(userIsOrgOwner);
          userIsOrgOwnerLocal = userIsOrgOwner;
          if (profileRow?.organization_name?.trim() && !userIsOrgOwner) {
            try {
              const joinRes = await fetch("/api/organization-join-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ organizationName: profileRow.organization_name.trim() }),
              });
              if (joinRes.ok) {
                const joinPayload = await joinRes.json();
                const status = String(joinPayload?.data?.status || "").toLowerCase();
                if (status === "created" || status === "pending_exists" || status === "reapply_later") {
                  gateStatus = "pending";
                } else if (status === "no_owner_found") {
                  gateStatus = "awaiting_owner";
                }
              }
            } catch {}
          }
          try {
            const myJoinRes = await fetch("/api/organization-join-requests/mine");
            const myJoinPayload = await myJoinRes.json();
            if (myJoinRes.ok && Array.isArray(myJoinPayload?.data)) {
              setMyOrgJoinRequests(myJoinPayload.data);
              if (
                myJoinPayload.data.some(
                  (req: { status?: string }) => String(req.status || "").toLowerCase() === "pending",
                )
              ) {
                gateStatus = "pending";
              }
            }
          } catch {}
          try {
            const inboxRes = await fetch("/api/access-requests/inbox");
            const inboxPayload = await inboxRes.json();
            if (inboxRes.ok && Array.isArray(inboxPayload?.data)) {
              setInboxRequests(inboxPayload.data);
            }
          } catch {}
          try {
            const orgJoinInboxRes = await fetch("/api/organization-join-requests/inbox");
            const orgJoinInboxPayload = await orgJoinInboxRes.json();
            if (orgJoinInboxRes.ok && Array.isArray(orgJoinInboxPayload?.data)) {
              setOrgJoinInbox(orgJoinInboxPayload.data);
            }
          } catch {}
          try {
            const failedRes = await fetch("/api/access-requests/failed-notifications");
            const failedPayload = await failedRes.json();
            if (failedRes.ok && Array.isArray(failedPayload?.data)) {
              setFailedNotifications(failedPayload.data);
            }
          } catch {}
          setJoinGateStatus(gateStatus);
          setJoinGateOrgName(profileRow?.organization_name?.trim() || "");
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
    };
    checkUser();
    return () => { isMounted = false; };
  }, [router, impersonateId]);

  const fetchData = async (userId: string, getIsMounted?: () => boolean) => {
    try {
      // 1. Fetch all events owned by this user
      const { data: eventRecords, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (eventError) throw eventError;
      const validEventRecords = eventRecords || [];

      // 2. Fetch all attendees for THESE specific events (including public registrations)
      const eventIds = validEventRecords.map(e => e.id);
      let attendeeRecords: any[] = [];
      
      if (eventIds.length > 0) {
        const { data: attendeeData, error: attendeeError } = await supabase
          .from("attendees")
          .select("*")
          .in('event_id', eventIds);
        
        if (attendeeError) throw attendeeError;
        attendeeRecords = attendeeData || [];
      }
      
      const eventCounts = new Map<string, number>();
      attendeeRecords.forEach(a => {
        if (a.event_id) {
          eventCounts.set(a.event_id, (eventCounts.get(a.event_id) || 0) + 1);
        }
      });

      const mappedEvents: DashboardEventData[] = validEventRecords.map(r => ({
        id: r.id,
        name: r.name,
        location: r.location,
        date: r.date,
        logo_url: r.logo_url,
        attendeeCount: eventCounts.get(r.id) || 0,
      }));
      
      if (getIsMounted && !getIsMounted()) return;

      setEvents(mappedEvents);
      
      setStats({
        totalEvents: mappedEvents.length,
        totalAttendees: attendeeRecords.length,
      });

    } catch (err: any) {
      console.error("Error fetching dashboard data:", err);
      toast.error("Could not load data. Please refresh and try again.");
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

  const hasPendingOrgJoin = useMemo(
    () => !isOrgOwner && myOrgJoinRequests.some((req) => String(req.status || "").toLowerCase() === "pending"),
    [isOrgOwner, myOrgJoinRequests],
  );
  const hasCreateCampaignPermission = grantedPermissions.includes("create_event");

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      // Hard redirect to clear next.js client cache immediately and feel responsive
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout error", err);
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
    if (!eventForm.name || (!eventForm.location && eventForm.location_type === "onsite") || !eventForm.date || !eventForm.time) {
      toast.error("Please fill all required fields.");
      return;
    }
    if (eventForm.name.trim().length > EVENT_NAME_MAX_CHARS) {
      toast.error(`Campaign name can be up to ${EVENT_NAME_MAX_CHARS} characters.`);
      return;
    }

    setIsSubmittingEvent(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");
      
      let logoUrl = "";
      if (eventForm.logo) {
        try {
          // Convert base64 to Blob
          const base64Data = eventForm.logo.split(",")[1];
          const blob = await fetch(`data:image/png;base64,${base64Data}`).then(res => res.blob());
          const fileName = `${user.id}/${Date.now()}.png`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("event-logos")
            .upload(fileName, blob, { contentType: 'image/png' });
            
          if (uploadError) throw uploadError;
          
          const { data: { publicUrl } } = supabase.storage
            .from("event-logos")
            .getPublicUrl(uploadData.path);
            
          logoUrl = publicUrl;
        } catch (uploadErr) {
          console.error("Logo upload failed:", uploadErr);
          toast.error("Logo upload failed, but creating event anyway...");
        }
      }
      
      const data = {
        name: eventForm.name,
        location: eventForm.location_type === "webinar" ? "Webinar" : eventForm.location,
        location_type: eventForm.location_type,
        date: eventForm.date,
        time: eventForm.time,
        user_id: impersonateId || (isOrgTeamMember ? (orgOwnerUserId || user.id) : user.id),
        logo_url: logoUrl
      };
      
      const { data: inserted, error } = await supabase.from("events").insert(data).select("id").single();
      if (error) throw error;

      toast.success(`Event "${eventForm.name}" created successfully!`);
      router.refresh();
      setIsEventModalOpen(false);
      setEventForm({ name: "", location: "", location_type: "onsite", date: "", time: "", logo: "" });
      fetchData(impersonateId || (isOrgTeamMember ? (orgOwnerUserId || user.id) : user.id));
    } catch (err: any) {
      console.error(err);
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
      const res = await fetch("/api/profile/username", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleaned, organizationName: orgCleaned }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setUsernameError(payload?.error || "Could not update username.");
        return;
      }
      setUserName(payload.data.username);
      setOrganizationName(payload.data.organizationName);
      setIsUsernameModalOpen(false);
      toast.success("Profile updated.");
    } catch (err) {
      console.error("Username update failed:", err);
      setUsernameError("Could not update username.");
    } finally {
      setIsSavingUsername(false);
    }
  };

  const loadteamMembers = async () => {
    try {
      const res = await fetch("/api/organization-members");
      const payload = await res.json();
      if (!res.ok) {
        setTeamError(payload?.error || "Could not load team.");
        return;
      }
      setTeamMembers(payload.data || []);
    } catch {
      setTeamError("Could not load team.");
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
      const payload = await res.json();
      if (!res.ok) {
        setTeamError(payload?.error || "Could not add team member.");
        return;
      }
      setTeamInviteEmail("");
      setTeamInviteRoleLabel("");
      setTeamPermissionDraft([]);
      toast.success("Team member access updated.");
      await loadteamMembers();
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
      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload?.error || "Could not review request.");
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
      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload?.error || "Retry failed.");
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
      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload?.error || "Could not review organization join request.");
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

      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload?.error || "Failed to submit request.");
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
      <main className="relative min-h-screen w-full bg-transparent">
        <GradientBackground />
        <div className="relative z-10 max-w-[1240px] mx-auto px-6 sm:px-12 lg:px-16 py-12 sm:py-16 md:py-20">
          <div className="mx-auto max-w-[760px] glass-panel rounded-md p-8 sm:p-12 flex flex-col gap-6 text-center">
            <h1 className="text-3xl sm:text-4xl font-semibold text-heading tracking-[-0.03em] leading-[1.1]">
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
              <Link href="/" className="inline-flex">
                <Button variant="secondary">Back to Home</Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen w-full bg-transparent">
      {isPreviewMode && (
        <div className="relative z-100 bg-danger/10 backdrop-blur-md border-b border-danger/20 px-6 py-3 flex items-center justify-between text-danger text-sm font-medium shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles size={18} />
            <span>Admin Organization Preview &mdash; Read Only</span>
          </div>
          <Link href="/admin" className="bg-danger text-white px-3 py-1 rounded-md hover:brightness-110 transition-all text-[13px] leading-[1.25] font-normal">
            Exit Preview
          </Link>
        </div>
      )}
      <GradientBackground />

      <div className="relative z-10 max-w-[1240px] mx-auto px-6 sm:px-12 lg:px-16 py-12 sm:py-16 md:py-20">
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
              href={isPreviewMode ? "/admin" : "/"} 
              className="flex items-center gap-2 text-sm font-medium text-heading hover:text-primary-strong hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-inline mb-1 group -ml-1 sm:-ml-2"
            >
              <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
              {isPreviewMode ? "Back to Admin" : "Back to Home"}
            </Link>
            <span className="text-sm font-normal tracking-[0.01em] leading-[1.25] text-muted/70">
              AVTIVE
            </span>
            <h1 className="text-3xl sm:text-4xl font-semibold text-heading tracking-[-0.03em] leading-[1.1]">
              {isPreviewMode ? "Organization Preview" : isOrgTeamMember ? "Organization Workspace" : isOrgOwner ? "Organization Dashboard" : "Dashboard"}
            </h1>
            {userName && (
              <div className="text-lg font-normal text-muted flex items-center gap-2 mt-1 leading-[1.6]">
                <User size={18} className="text-primary-strong/70" />
                <span>{userName}</span>
                {!isPreviewMode && (isOrgOwner || isOrgTeamMember) && (
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${
                      isOrgOwner
                        ? "bg-primary/10 text-primary-strong border-primary/25"
                        : "bg-surface text-heading/80 border-border/70"
                    }`}
                  >
                    {isOrgOwner ? <ShieldCheck size={12} /> : <UserCheck size={12} />}
                    {isOrgOwner ? "Organization Admin" : "Team Member"}
                  </span>
                )}
                {!isPreviewMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setUsernameDraft(userName);
                      setOrganizationDraft(organizationName);
                      setUsernameError("");
                      setIsUsernameModalOpen(true);
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-muted hover:text-heading hover:bg-white/60 transition-all"
                    aria-label="Edit username"
                    title="Edit username"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )}
            {isPreviewMode && (
              <p className="text-sm font-normal text-danger/85 mt-1 leading-[1.6]">Read-only admin perspective. Editing and creation are disabled.</p>
            )}
            {!isPreviewMode && isOrgTeamMember && (
              <p className="text-sm font-normal text-heading/70 mt-1 leading-[1.6]">
                Team role: {orgRoleLabel || "Member"} (organization-level access)
              </p>
            )}
            {!isPreviewMode && !isOrgTeamMember && isOrgOwner && (
              <p className="text-sm font-normal text-primary-strong/85 mt-1 leading-[1.6]">
                Organization owner mode: you can review team join requests and manage access.
              </p>
            )}
            {!isPreviewMode && !isOrgTeamMember && hasPendingOrgJoin && (
              <p className="text-sm font-normal text-amber-700 mt-1 leading-[1.6]">
                Organization join is pending approval. Owner-level actions are disabled until approved.
              </p>
            )}
          </div>

          <div className="flex gap-3 items-center">
            {isAdmin && (
               <Link href="/admin">
                <Button
                  variant="secondary"
                  className="bg-red-500/10 border-red-500/30 text-red-600 hover:bg-red-500/20 hover:border-red-500/45 font-medium"
                  icon={<Sparkles size={18} />}
                >
                  Admin Panel
                </Button>
               </Link>
            )}
            {!isPreviewMode && !hasPendingOrgJoin && (
              <Button
                variant="secondary"
                onClick={() => {
                  if (isOrgTeamMember && !hasCreateCampaignPermission) {
                    setIsRequestPermissionModalOpen(true);
                    return;
                  }
                  setIsEventModalOpen(true);
                }}
                className={`min-w-[168px] whitespace-nowrap justify-center bg-primary/10 border-primary/30 text-primary-strong hover:bg-primary/20 hover:border-primary/45 ${
                  isOrgTeamMember && !hasCreateCampaignPermission
                    ? "cursor-help shadow-inner bg-danger/5 border-danger/20 text-danger hover:bg-danger/10 hover:border-danger/30"
                    : "shadow-sm hover:shadow-md"
                }`}
                title={isOrgTeamMember && !hasCreateCampaignPermission ? "You need Campaign Creation access. Request it from your organization admin." : ""}
                icon={isOrgTeamMember && !hasCreateCampaignPermission ? <AlertCircle size={18} className="animate-pulse" /> : <Calendar size={18} />}
              >
                <span>New Campaign</span>
              </Button>
            )}
            {!isPreviewMode && !hasPendingOrgJoin && (
              <Button
                variant="secondary"
                onClick={async () => {
                  if (isOrgTeamMember) {
                    toast.error("Access management is restricted to organization owners.");
                    return;
                  }
                  setIsTeamModalOpen(true);
                  setTeamModalView("list");
                  setTeamError("");
                  await loadteamMembers();
                }}
                className={`min-w-[168px] whitespace-nowrap justify-center border-primary/20 text-heading hover:text-primary-strong hover:border-primary/45 hover:bg-primary/10 ${
                  isOrgTeamMember ? "opacity-50" : "shadow-sm hover:shadow-md"
                }`}
                icon={<Users size={18} />}
              >
                Team Access
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={handleLogout}
              disabled={isLoggingOut}
              icon={isLoggingOut ? undefined : <LogOut size={18} />}
            >
              <span className="hidden sm:inline">{isLoggingOut ? "..." : "Logout"}</span>
            </Button>
          </div>
        </div>
        
        {/* Bento Grid Statistics Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-12 delay-100">
          {/* Main Stat - Large Tile */}
          <div className="glass-panel p-6 rounded-md md:col-span-2 flex items-center gap-6 group hover:bg-white transition-all duration-200 hover:shadow-2xl hover:shadow-primary/5">
            <div className="w-16 h-16 rounded-md bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/30 shrink-0 group-hover:scale-105 transition-transform">
              <Users size={32} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="ui-eyebrow">Live Presence</span>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-semibold text-heading tracking-[-0.03em] leading-[1.02]">
                  <AnimatedCounter value={stats.totalAttendees} />
                </span>
                <span className="text-lg font-medium text-primary-strong">Attendees</span>
              </div>
            </div>
          </div>
          
          {/* Secondary Stat - Active Events */}
          <div className="glass-panel p-6 rounded-md md:col-span-2 flex items-center gap-6 group hover:bg-white transition-all duration-200 hover:shadow-2xl hover:shadow-primary/5">
            <div className="w-14 h-14 rounded-md bg-primary/15 flex items-center justify-center text-primary-strong shrink-0 transition-transform hover:bg-primary/25 group-hover:scale-105">
              <BarChart3 size={28} />
            </div>
            <div className="flex flex-col">
              <span className="ui-eyebrow mb-1">Activity Tracking</span>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-semibold text-heading tracking-[-0.03em] leading-[1.02]">
                  <AnimatedCounter value={stats.totalEvents} />
                </span>
                <span className="text-lg font-medium text-primary-strong">Total Campaigns</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8 delay-200">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-heading z-10 pointer-events-none" size={20} strokeWidth={2.5} />
            <input
              type="text"
              placeholder="Search campaigns..."
              className="w-full h-10 pl-16 pr-3 py-0 bg-white/80 backdrop-blur-md border border-white/60 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white transition-all text-sm leading-[1.6] text-heading shadow-sm placeholder:text-muted/55"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isOrgTeamMember && (
          <div className="glass-panel p-4 rounded-md mb-6 border border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm font-medium text-heading inline-flex items-center gap-2">
                <Lock size={14} className="text-primary-strong" />
                Your Access
              </p>
              <span
                className={`text-xs px-2 py-1 rounded-full border ${
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
          </div>
        )}

        {isOrgTeamMember && myAccessRequests.length > 0 && (
          <div className="glass-panel p-4 rounded-md mb-6">
            <p className="text-sm font-medium text-heading mb-2">My Access Requests</p>
            <div className="flex flex-col gap-2">
              {myAccessRequests.slice(0, 4).map((req) => (
                <div key={req.id} className="flex items-center justify-between text-[13px] leading-[1.25] bg-white/60 border border-border/50 rounded-md px-3 py-2">
                  <span className="text-heading">{req.event_name} • {req.requested_action}</span>
                  <span className={`font-medium ${
                    req.status === "approved" ? "text-green-600" : req.status === "rejected" ? "text-red-500" : "text-amber-600"
                  }`}>
                    {req.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isOrgTeamMember && !isOrgOwner && myOrgJoinRequests.length > 0 && (
          <div className="glass-panel p-4 rounded-md mb-6">
            <p className="text-sm font-medium text-heading mb-2">My Organization Join Requests</p>
            <div className="flex flex-col gap-2">
              {myOrgJoinRequests.slice(0, 4).map((req) => (
                <div key={req.id} className="flex items-center justify-between gap-3 text-[13px] leading-[1.25] bg-white/60 border border-border/50 rounded-md px-3 py-2">
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
                  <span className={`font-medium shrink-0 border px-2 py-1 rounded-full ${formatJoinStatus(req.status).className}`}>
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
                <div key={req.id} className="flex items-center justify-between gap-3 text-[13px] leading-[1.25] bg-white/60 border border-border/50 rounded-md px-3 py-2">
                  <span className="text-heading truncate">
                    Requester: {req.requester_email} • Wants to join: {req.requested_org_name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className="px-2 py-1 rounded-md bg-primary text-white text-[13px] leading-[1.25] font-medium tracking-[0.01em]"
                      onClick={() => reviewOrgJoinRequest(req.id, "approve")}
                    >
                      Approve
                    </button>
                    <button
                      className="px-2 py-1 rounded-md border border-border text-[13px] leading-[1.25] font-normal tracking-[0.01em]"
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

        {!isOrgTeamMember && inboxRequests.length > 0 && (
          <div className="glass-panel p-4 rounded-md mb-6">
            <p className="text-sm font-medium text-heading mb-2">Pending Access Inbox</p>
            <div className="flex flex-col gap-2">
              {inboxRequests.slice(0, 4).map((req) => (
                <div key={req.id} className="flex items-center justify-between gap-3 text-[13px] leading-[1.25] bg-white/60 border border-border/50 rounded-md px-3 py-2">
                  <span className="text-heading truncate">{req.requester_email} • {req.event_name} • {req.requested_action}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className="px-2 py-1 rounded-md bg-primary text-white text-[13px] leading-[1.25] font-medium tracking-[0.01em]"
                      onClick={() => reviewInboxRequest(req.id, "approve")}
                    >
                      Approve
                    </button>
                    <button
                      className="px-2 py-1 rounded-md border border-border text-[13px] leading-[1.25] font-normal tracking-[0.01em]"
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
                <div key={row.id} className="flex items-center justify-between gap-3 text-[13px] leading-[1.25] bg-white/60 border border-border/50 rounded-md px-3 py-2">
                  <span className="text-heading truncate">
                    {row.event_name} • {row.requester_email} • {row.requested_action}
                  </span>
                  <button
                    className="px-2 py-1 rounded-md border border-border text-[13px] leading-[1.25] font-normal inline-flex items-center gap-1 shrink-0"
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
          <div className="grid gap-4 sm:grid-cols-2 delay-300">
            {filteredEvents.length > 0 ? (
              filteredEvents.map((evt) => {
                const status = getEventStatus(evt.date);
                return (
                <div key={evt.id} className={`group flex flex-col justify-between glass-panel p-6 rounded-md transition-all duration-200 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/15 hover:border-primary/40 ${status.label === 'Past' ? 'opacity-75 grayscale-[0.3]' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      {evt.logo_url && (
                        <div className="w-20 h-20 rounded-md bg-white border border-border/40 shadow-md overflow-hidden group-hover:scale-105 transition-transform duration-200 shrink-0">
                          <img src={evt.logo_url} alt={evt.name} className="w-full h-full object-cover block" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 ml-auto">
                      <span className={`text-[13px] font-medium tracking-[0.01em] leading-[1.25] px-3 py-1 rounded-md border ${status.classes}`}>
                        {status.label}
                      </span>
                      <div className="flex items-center text-[13px] font-medium leading-[1.25] text-primary-strong bg-primary/10 px-3 py-1 rounded-md">
                        {evt.attendeeCount} Attendee{evt.attendeeCount !== 1 && 's'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col grow">
                    <h3 className="font-semibold text-2xl tracking-[-0.03em] text-heading group-hover:text-primary-strong transition-colors line-clamp-2 leading-[1.15] mb-2">
                      {evt.name}
                    </h3>
                    
                    <div className="flex flex-col gap-2 mb-6">
                      <div className="flex items-center gap-3 text-heading font-normal bg-white/40 w-fit px-3 py-2 rounded-md border border-white/60 shadow-sm">
                        <Calendar size={18} className="text-primary-strong" />
                        <span className="text-sm leading-[1.6] tracking-[0em]">{evt.date}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted font-normal px-1">
                        {(evt.location || "").trim().toLowerCase() === "webinar" ? (
                          <Globe size={18} className="text-muted/60" />
                        ) : (
                          <MapPin size={18} className="text-muted/60" />
                        )}
                        <span className="text-sm leading-[1.6] tracking-[0em] truncate max-w-[200px]">{evt.location}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Link href={`/dashboard/events/${evt.id}${isPreviewMode && impersonateId ? `?impersonate=${encodeURIComponent(impersonateId)}` : ""}`} className="mt-auto pt-4 border-t border-border/60 flex items-center justify-between text-sm font-medium text-heading hover:text-primary-strong hover:bg-white/20 rounded-inline transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 cursor-pointer group-hover:text-primary-strong">
                    View Campaign
                    <ChevronRight size={20} className="group-hover:translate-x-1.5 transition-transform" />
                  </Link>
                </div>
                );
              })
            ) : (
              <div className="col-span-full text-center py-12 glass-panel rounded-xl border-dashed">
                <p className="text-muted text-sm">No events found matching your search.</p>
              </div>
            )}
          </div>
        )}
          </>
        )}
      </div>

      {/* Event Creation Modal */}
      {isEventModalOpen && !isPreviewMode && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 sm:p-8">
          <div 
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in" 
            onClick={() => {
              setIsEventModalOpen(false);
            }}
          />
          <div className="relative w-full max-w-[460px] glass-panel bg-white/90 border border-white/60 rounded-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-8 pt-8 pb-4 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">Create New Campaign</h2>
                <p className="text-sm text-muted">Add details for the upcoming conference.</p>
              </div>
              <button 
                onClick={() => {
                  setIsEventModalOpen(false);
                }}
                className="w-10 h-10 rounded-md border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleEventSubmit} className="p-8 pt-4 flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <TextInput
                  label="Name of the Campaign"
                  required
                  placeholder="e.g. TechConf 2026"
                  value={eventForm.name}
                  maxLength={EVENT_NAME_MAX_CHARS}
                  onChange={(v) => setEventForm({ ...eventForm, name: v })}
                />
                <p
                  className={`-mt-2 text-sm leading-[1.6] font-normal ${
                    eventForm.name.length >= EVENT_NAME_MAX_CHARS ? "text-amber-600" : "text-muted"
                  }`}
                >
                  {eventForm.name.length}/{EVENT_NAME_MAX_CHARS} characters
                  {eventForm.name.length >= EVENT_NAME_MAX_CHARS ? " (maximum reached)" : " max"}
                </p>
                
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center gap-1">
                     <label className="text-[13px] font-normal text-heading leading-[1.25] tracking-[0.01em]">Location Type</label>
                  </div>
                  <div className="flex gap-4 mb-1">
                     <label className="flex items-center gap-2 cursor-pointer text-sm text-heading">
                        <input type="radio" name="locationType" value="onsite" checked={eventForm.location_type === "onsite"} onChange={() => setEventForm({ ...eventForm, location_type: "onsite" })} className="accent-primary" />
                        Onsite
                     </label>
                     <label className="flex items-center gap-2 cursor-pointer text-sm text-heading">
                        <input type="radio" name="locationType" value="webinar" checked={eventForm.location_type === "webinar"} onChange={() => setEventForm({ ...eventForm, location_type: "webinar", location: "" })} className="accent-primary" />
                        Webinar
                     </label>
                  </div>
                </div>

                {eventForm.location_type === "webinar" ? (
                   <div className="flex flex-col gap-2 w-full group opacity-75">
                     <label className="text-[13px] font-normal text-heading leading-[1.25] tracking-[0.01em]">Location <span className="text-primary-strong">*</span></label>
                     <div className="flex h-10 items-center bg-surface border border-border/60 rounded-md shadow-sm px-3 overflow-hidden cursor-not-allowed">
                        <Globe size={18} className="text-muted mr-2" />
                        <input type="text" value="Webinar" disabled className="h-full flex-1 py-0 text-sm leading-[1.6] text-muted bg-transparent outline-none cursor-not-allowed" />
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

                <div className="grid grid-cols-2 gap-4">
                  <TextInput
                  label="Campaign Date"
                    required
                    type="date"
                    value={eventForm.date}
                    onChange={(v) => setEventForm({ ...eventForm, date: v })}
                  />
                  <TextInput
                  label="Campaign Time"
                    required
                    type="time"
                    value={eventForm.time}
                    onChange={(v) => setEventForm({ ...eventForm, time: v })}
                  />
                </div>
                <FilePicker
                  label="Campaign Logo"
                  value={eventForm.logo}
                  onChange={(v) => setEventForm({ ...eventForm, logo: v })}
                  onError={(msg) => toast.error(msg)}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button 
                  variant="secondary" 
                  fullWidth 
                  onClick={() => {
                    setIsEventModalOpen(false);
                  }}
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
                  {isSubmittingEvent ? "Creating..." : "Create Campaign"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isUsernameModalOpen && !isPreviewMode && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 sm:p-8">
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => !isSavingUsername && setIsUsernameModalOpen(false)}
          />
          <div className="relative w-full max-w-[420px] glass-panel bg-white/90 border border-white/60 rounded-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 pt-8 pb-4 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">Edit Profile</h2>
                <p className="text-sm text-muted">This updates your profile everywhere in the app.</p>
              </div>
              <button
                onClick={() => !isSavingUsername && setIsUsernameModalOpen(false)}
                className="w-10 h-10 rounded-md border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all duration-150"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveUsername} className="p-8 pt-4 flex flex-col gap-4">
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
              <p className="text-xs text-muted -mt-1">Allowed: letters, numbers, underscore, dot.</p>
              <p className="text-xs text-muted -mt-1">Username can be changed once every 24 days.</p>
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
              <p className="text-xs text-muted -mt-1">
                {isOrgTeamMember || hasPendingOrgJoin
                  ? "Organization name is read-only for team members. Ask your organization admin to update it."
                  : "Organization name can be changed once every 90 days."}
              </p>
              {usernameError && <p className="text-sm font-normal leading-[1.6] text-red-500">{usernameError}</p>}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => setIsUsernameModalOpen(false)}
                  disabled={isSavingUsername}
                  className="order-2 sm:order-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  fullWidth
                  disabled={isSavingUsername}
                  className="order-1 sm:order-2 shadow-lg shadow-primary/20"
                >
                  {isSavingUsername ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isTeamModalOpen && !isPreviewMode && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 sm:p-8">
          <div
            className="absolute inset-0 bg-heading/40 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => !isSubmittingTeamInvite && setIsTeamModalOpen(false)}
          />
          <div className="relative w-full max-w-[720px] glass-panel bg-white/95 border border-white/60 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-12 pt-12 pb-8 flex items-center justify-between border-b border-border/10">
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
                onClick={() => {
                  if (teamModalView !== "list") {
                    setTeamModalView("list");
                  } else {
                    setIsTeamModalOpen(false);
                  }
                }}
                className="w-10 h-10 rounded-md border border-border flex items-center justify-center text-muted hover:text-heading hover:bg-surface transition-all duration-150"
              >
                {teamModalView === "list" ? <X size={20} /> : <ArrowLeft size={20} />}
              </button>
            </div>

            <div className="px-12 py-10">
              {teamModalView === "list" && (
                <div className="flex flex-col gap-8">
                  {!isOrgTeamMember && (
                    <Button 
                      variant="primary" 
                      size="sm"
                      onClick={() => {
                        setTeamInviteEmail("");
                        setTeamInviteRoleLabel("");
                        setTeamPermissionDraft([]);
                        setTeamModalView("add");
                      }}
                      icon={<Plus size={18} />}
                      fullWidth
                      className="text-[14px]"
                    >
                      Invite New Member
                    </Button>
                  )}

                  <div className="flex flex-col gap-6 max-h-[520px] overflow-y-auto pr-2">
                    {teamMembers.length === 0 ? (
                      <div className="py-12 text-center flex flex-col items-center gap-3 bg-surface/30 rounded-xl border border-dashed border-border/50">
                        <Users size={32} className="text-muted/40" />
                        <p className="text-sm text-muted">No members added yet.</p>
                      </div>
                    ) : (
                      teamMembers.map((m) => (
                        <div 
                          key={m.id} 
                          className="group flex items-center justify-between p-6 bg-white/50 border border-white/60 rounded-xl hover:border-primary/30 hover:bg-white hover:shadow-sm transition-all duration-200"
                        >
                          <div className="flex items-center gap-6 min-w-0">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm border border-primary/20 shrink-0">
                              {m.member_email.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col gap-2 min-w-0">
                              <span className="text-sm font-semibold text-heading truncate">{m.member_email}</span>
                              <span className="text-xs text-muted font-medium bg-surface/50 w-fit px-3 py-1 rounded-md border border-border/30">{m.role_label}</span>
                            </div>
                          </div>
                          
                          {!isOrgTeamMember && (
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<Pencil size={14} />}
                              onClick={() => {
                                setTeamInviteEmail(m.member_email);
                                setTeamInviteRoleLabel(m.role_label);
                                setTeamPermissionDraft(m.permissions || []);
                                setTeamError("");
                                setTeamModalView("edit");
                              }}
                              className="transition-all shadow-sm border-primary/20 text-primary-strong text-[14px]"
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
                  
                  <div className="flex gap-3 pt-2">
                    <Button 
                      type="button" 
                      variant="secondary" 
                      fullWidth 
                      onClick={() => setTeamModalView("list")}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      fullWidth 
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

                  <div className="flex gap-3 pt-2">
                    <Button 
                      type="button" 
                      variant="secondary" 
                      fullWidth 
                      onClick={() => setTeamModalView("list")}
                    >
                      Back
                    </Button>
                    <Button 
                      type="submit" 
                      fullWidth 
                      disabled={isSubmittingTeamInvite}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white/95 border border-border/40 w-full max-w-[500px] rounded-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-border/10 flex items-center justify-between bg-primary/[0.02]">
              <div className="flex items-center gap-2">
                <AlertCircle className="text-danger" size={20} />
                <h2 className="text-xl font-semibold text-heading tracking-tight">Request Creation Access</h2>
              </div>
              <button onClick={() => setIsRequestPermissionModalOpen(false)} className="text-muted hover:text-heading transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-muted mb-6 leading-[1.6]">
                You currently don't have permission to create campaigns. To get access, please send a request to your organization admin with a short reason.
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
                
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" fullWidth onClick={() => setIsRequestPermissionModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" fullWidth disabled={isSubmittingPermissionRequest}>
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
      <main className="relative min-h-screen w-full bg-transparent">
        <GradientBackground />
        <div className="relative z-10 max-w-[1240px] mx-auto px-6 sm:px-12 lg:px-16 py-12 sm:py-16 md:py-20">
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
