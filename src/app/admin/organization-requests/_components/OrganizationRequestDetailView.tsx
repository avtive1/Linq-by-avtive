"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Save,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TextArea } from "@/components/ui/text-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { OrganizationRegistrationRecord } from "@/lib/organization/registration-db";

interface OrganizationRequestDetailViewProps {
  request: OrganizationRegistrationRecord;
}

export function OrganizationRequestDetailView({ request: initialRequest }: OrganizationRequestDetailViewProps) {
  const router = useRouter();
  const [request, setRequest] = useState<OrganizationRegistrationRecord>(initialRequest);

  // Dialog States
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isRequestChangesOpen, setIsRequestChangesOpen] = useState(false);

  // Form states for modals
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [changesNotes, setChangesNotes] = useState("");
  const [changesAdminNotes, setChangesAdminNotes] = useState("");

  // Admin internal notes state
  const [adminNotesInput, setAdminNotesInput] = useState(request.admin_notes || "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      const res = await fetch(`/api/admin/organization-requests/${request.id}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: adminNotesInput }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to save notes.");

      setRequest((prev) => ({ ...prev, admin_notes: adminNotesInput }));
      toast.success("Admin notes saved successfully.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save notes.");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleApprove = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/admin/organization-requests/${request.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: approveNotes.trim() || undefined }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Approval failed.");

      setIsApproveOpen(false);
      toast.success(
        payload.data?.alreadyApproved
          ? "Request was already approved."
          : "Organization approved and activated successfully!",
      );
      router.refresh();
      // Update local state
      setRequest((prev) => ({
        ...prev,
        status: "APPROVED",
        created_organization_id: payload.data?.organizationId || prev.created_organization_id,
        reviewed_at: new Date().toISOString(),
      }));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }

    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/admin/organization-requests/${request.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejectionReason: rejectionReason.trim(),
          adminNotes: rejectNotes.trim() || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Rejection failed.");

      setIsRejectOpen(false);
      toast.success("Registration request rejected.");
      router.refresh();
      setRequest(payload.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Rejection failed.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!changesNotes.trim()) {
      toast.error("Please describe the requested changes.");
      return;
    }

    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/admin/organization-requests/${request.id}/request-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changesRequestedNotes: changesNotes.trim(),
          adminNotes: changesAdminNotes.trim() || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to request changes.");

      setIsRequestChangesOpen(false);
      toast.success("Changes requested and applicant notified.");
      router.refresh();
      setRequest(payload.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to request changes.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const getStatusBadge = (status: OrganizationRegistrationRecord["status"]) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold gap-1 px-3 py-1">
            <Clock size={13} />
            Pending Review
          </Badge>
        );
      case "UNDER_REVIEW":
        return (
          <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-800 text-xs font-semibold gap-1 px-3 py-1">
            <Clock size={13} />
            Under Review
          </Badge>
        );
      case "CHANGES_REQUESTED":
        return (
          <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-800 text-xs font-semibold gap-1 px-3 py-1">
            <AlertCircle size={13} />
            Changes Requested
          </Badge>
        );
      case "APPROVED":
        return (
          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-semibold gap-1 px-3 py-1">
            <CheckCircle2 size={13} />
            Approved
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="outline" className="border-red-300 bg-red-50 text-red-800 text-xs font-semibold gap-1 px-3 py-1">
            <XCircle size={13} />
            Rejected
          </Badge>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6 py-6 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))] lg:pl-[max(1.5rem,env(safe-area-inset-left))] lg:pr-[max(1.5rem,env(safe-area-inset-right))]">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/organization-requests"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-heading transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Organization Requests
        </Link>
        <span className="font-mono text-xs font-bold text-primary">{request.reference_number}</span>
      </div>

      {/* Header Banner */}
      <Card className="p-6 border-hairline-soft bg-white shadow-sm animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            {request.organization_logo_url ? (
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-hairline bg-surface p-1 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={request.organization_logo_url}
                  alt={request.organization_name}
                  className="h-full w-full object-contain rounded-lg"
                />
              </div>
            ) : (
              <div className="h-16 w-16 shrink-0 flex items-center justify-center rounded-xl border border-hairline bg-surface text-muted">
                <Building2 size={28} />
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-heading">
                  {request.organization_name}
                </h1>
                {getStatusBadge(request.status)}
              </div>
              <p className="text-xs text-muted flex items-center gap-2 mt-1">
                <span>Ref: <strong className="text-heading font-mono">{request.reference_number}</strong></span>
                <span>&bull;</span>
                <span>Submitted: {new Date(request.created_at).toLocaleDateString()} at {new Date(request.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {request.status !== "APPROVED" && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsApproveOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-xs"
              >
                <CheckCircle2 size={14} />
                Approve Request
              </Button>
            )}

            {request.status !== "APPROVED" && request.status !== "REJECTED" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRequestChangesOpen(true)}
                  className="border-amber-300 text-amber-800 hover:bg-amber-50 font-semibold text-xs gap-1.5"
                >
                  <AlertCircle size={14} />
                  Request Changes
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRejectOpen(true)}
                  className="border-red-300 text-red-700 hover:bg-red-50 font-semibold text-xs gap-1.5"
                >
                  <XCircle size={14} />
                  Reject
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Information Breakdown */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Contact Person Information */}
          <Card className="p-5 sm:p-6 border-hairline-soft bg-white shadow-xs">
            <div className="flex items-center gap-2 border-b border-hairline-soft pb-3 mb-4">
              <User size={18} className="text-primary" />
              <h2 className="text-base font-bold text-heading">Contact Person Information</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-0.5">Full Name</span>
                <span className="font-semibold text-heading">{request.contact_name}</span>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-0.5">Designation / Title</span>
                <span className="font-medium text-ink">{request.contact_designation}</span>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-0.5">Work Email</span>
                <a href={`mailto:${request.contact_email}`} className="font-medium text-primary hover:underline inline-flex items-center gap-1">
                  <Mail size={13} />
                  {request.contact_email}
                </a>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-0.5">Phone Number</span>
                <a href={`tel:${request.contact_phone}`} className="font-medium text-ink hover:underline inline-flex items-center gap-1">
                  <Phone size={13} />
                  {request.contact_phone}
                </a>
              </div>
              {request.contact_linkedin && (
                <div className="sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-0.5">LinkedIn Profile</span>
                  <a href={request.contact_linkedin} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs inline-flex items-center gap-1 break-all">
                    {request.contact_linkedin}
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          </Card>

          {/* Organization Information */}
          <Card className="p-5 sm:p-6 border-hairline-soft bg-white shadow-xs">
            <div className="flex items-center gap-2 border-b border-hairline-soft pb-3 mb-4">
              <Building2 size={18} className="text-primary" />
              <h2 className="text-base font-bold text-heading">Organization Profile & Branding</h2>
            </div>
            <div className="flex flex-col gap-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-0.5">Organization Name</span>
                  <span className="font-bold text-heading">{request.organization_name}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-0.5">Website</span>
                  {request.organization_website ? (
                    <a href={request.organization_website} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline inline-flex items-center gap-1">
                      <Globe size={13} />
                      {request.organization_website}
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </div>
              </div>

              {request.organization_description && (
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-0.5">Description</span>
                  <p className="text-xs sm:text-sm text-ink leading-relaxed bg-surface/50 p-3 rounded-lg border border-hairline-soft whitespace-pre-wrap">
                    {request.organization_description}
                  </p>
                </div>
              )}

              {/* Logo Preview & Inspection */}
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-1.5">Brand Logo</span>
                <div className="flex items-center gap-4 bg-surface/60 p-3 rounded-lg border border-hairline-soft">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-hairline bg-white p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={request.organization_logo_url} alt="Logo" className="h-full w-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-ink truncate">{request.organization_logo_url}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <a href={request.organization_logo_url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-hairline-strong">
                          <ExternalLink size={12} />
                          Open Full Size
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Social Channels */}
              {request.social_links && Object.values(request.social_links).some(Boolean) && (
                <div className="border-t border-hairline-soft pt-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-2">Social Channels</span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {request.social_links.linkedin && (
                      <a href={request.social_links.linkedin} target="_blank" rel="noreferrer" className="rounded bg-surface px-2.5 py-1 text-ink hover:text-primary transition-colors inline-flex items-center gap-1 border border-hairline">
                        LinkedIn <ExternalLink size={10} />
                      </a>
                    )}
                    {request.social_links.twitter && (
                      <a href={request.social_links.twitter} target="_blank" rel="noreferrer" className="rounded bg-surface px-2.5 py-1 text-ink hover:text-primary transition-colors inline-flex items-center gap-1 border border-hairline">
                        X / Twitter <ExternalLink size={10} />
                      </a>
                    )}
                    {request.social_links.facebook && (
                      <a href={request.social_links.facebook} target="_blank" rel="noreferrer" className="rounded bg-surface px-2.5 py-1 text-ink hover:text-primary transition-colors inline-flex items-center gap-1 border border-hairline">
                        Facebook <ExternalLink size={10} />
                      </a>
                    )}
                    {request.social_links.instagram && (
                      <a href={request.social_links.instagram} target="_blank" rel="noreferrer" className="rounded bg-surface px-2.5 py-1 text-ink hover:text-primary transition-colors inline-flex items-center gap-1 border border-hairline">
                        Instagram <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Organization Operational Details */}
          <Card className="p-5 sm:p-6 border-hairline-soft bg-white shadow-xs">
            <div className="flex items-center gap-2 border-b border-hairline-soft pb-3 mb-4">
              <MapPin size={18} className="text-primary" />
              <h2 className="text-base font-bold text-heading">Operations & Headquarters Location</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-0.5">Industry Sector</span>
                <span className="font-medium text-ink">{request.industry || "—"}</span>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-0.5">Organization Type</span>
                <span className="font-medium text-ink">{request.organization_type || "—"}</span>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-0.5">Company Size</span>
                <span className="font-medium text-ink">{request.company_size || "—"}</span>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-0.5">Country</span>
                <span className="font-medium text-ink">{request.country || "—"}</span>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-0.5">City</span>
                <span className="font-medium text-ink">{request.city || "—"}</span>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-0.5">Street Address</span>
                <span className="font-medium text-ink">{request.address || "—"}</span>
              </div>
              {request.phone && (
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-0.5">Org Phone</span>
                  <span className="font-medium text-ink">{request.phone}</span>
                </div>
              )}
              {request.email && (
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-0.5">General Org Email</span>
                  <span className="font-medium text-ink">{request.email}</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Actions, Notes & Audit */}
        <div className="flex flex-col gap-6">
          {/* Status Feedback Banners */}
          {request.status === "APPROVED" && (
            <Card className="p-5 border-emerald-200 bg-emerald-50 text-emerald-950 shadow-xs">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-900">Organization Approved</h3>
                  <p className="text-xs text-emerald-800 mt-1">
                    This organization is active. Admin account and branding profile have been provisioned.
                  </p>
                  <div className="mt-3">
                    <Link href="/admin">
                      <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-300 text-emerald-900 bg-white hover:bg-emerald-50">
                        View in Directory
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {request.status === "REJECTED" && (
            <Card className="p-5 border-red-200 bg-red-50 text-red-950 shadow-xs">
              <div className="flex items-start gap-3">
                <XCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-red-900">Application Rejected</h3>
                  <p className="text-xs text-red-800 mt-1 font-medium">
                    Reason: {request.rejection_reason || "No reason specified."}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {request.status === "CHANGES_REQUESTED" && (
            <Card className="p-5 border-orange-200 bg-orange-50 text-orange-950 shadow-xs">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-orange-900">Changes Requested</h3>
                  <p className="text-xs text-orange-800 mt-1 whitespace-pre-wrap">
                    {request.changes_requested_notes || "Awaiting applicant revisions."}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Internal Admin Notes */}
          <Card className="p-5 border-hairline-soft bg-white shadow-xs">
            <h3 className="text-sm font-bold text-heading mb-2">Internal Admin Notes</h3>
            <p className="text-xs text-muted mb-3">
              Visible only to Linq administrators. Use this to track verification notes or call logs.
            </p>
            <TextArea
              name="adminNotes"
              placeholder="Add internal notes about this organization..."
              value={adminNotesInput}
              onChange={(v) => setAdminNotesInput(v)}
              rows={4}
              maxLength={2000}
            />
            <div className="flex justify-end mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="gap-1.5 text-xs border-hairline-strong"
              >
                <Save size={13} />
                {isSavingNotes ? "Saving..." : "Save Notes"}
              </Button>
            </div>
          </Card>

          {/* Audit History & Metadata */}
          <Card className="p-5 border-hairline-soft bg-white shadow-xs">
            <h3 className="text-sm font-bold text-heading mb-3">Audit Timeline</h3>
            <div className="flex flex-col gap-3 text-xs">
              <div className="flex items-start justify-between border-b border-hairline-soft pb-2">
                <span className="text-muted">Submitted At</span>
                <span className="font-medium text-heading text-right">
                  {new Date(request.created_at).toLocaleString()}
                </span>
              </div>
              <div className="flex items-start justify-between border-b border-hairline-soft pb-2">
                <span className="text-muted">Current Status</span>
                <span className="font-semibold text-heading text-right">{request.status}</span>
              </div>
              {request.reviewed_at && (
                <div className="flex items-start justify-between border-b border-hairline-soft pb-2">
                  <span className="text-muted">Reviewed At</span>
                  <span className="font-medium text-heading text-right">
                    {new Date(request.reviewed_at).toLocaleString()}
                  </span>
                </div>
              )}
              {request.reviewer_email && (
                <div className="flex items-start justify-between border-b border-hairline-soft pb-2">
                  <span className="text-muted">Reviewed By</span>
                  <span className="font-medium text-heading text-right">
                    {request.reviewer_name ? `${request.reviewer_name} (${request.reviewer_email})` : request.reviewer_email}
                  </span>
                </div>
              )}
              {request.created_organization_id && (
                <div className="flex items-start justify-between">
                  <span className="text-muted">Org Record ID</span>
                  <span className="font-mono text-[11px] text-muted text-right truncate max-w-[140px]">
                    {request.created_organization_id}
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* APPROVE DIALOG */}
      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-heading text-lg font-bold">Approve Organization Registration</DialogTitle>
            <DialogDescription className="text-xs text-muted">
              Approving will create the official Organization profile for <strong className="text-heading">{request.organization_name}</strong> and provision or link the primary user account ({request.contact_email}).
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <TextArea
              label="Optional Approval Notes"
              name="approveNotes"
              placeholder="Add any internal onboarding notes..."
              value={approveNotes}
              onChange={(v) => setApproveNotes(v)}
              rows={2}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsApproveOpen(false)} disabled={isActionLoading}>
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleApprove}
              disabled={isActionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {isActionLoading ? "Approving..." : "Confirm & Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REJECT DIALOG */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-heading text-lg font-bold">Reject Registration Application</DialogTitle>
            <DialogDescription className="text-xs text-muted">
              Please specify the reason for rejection. This feedback will be sent to the applicant ({request.contact_email}).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <TextArea
              label="Rejection Reason"
              name="rejectionReason"
              required
              placeholder="e.g. Unable to verify official company credentials or tax documentation..."
              value={rejectionReason}
              onChange={(v) => setRejectionReason(v)}
              rows={3}
            />
            <TextArea
              label="Internal Notes (Optional)"
              name="rejectNotes"
              placeholder="Internal record notes..."
              value={rejectNotes}
              onChange={(v) => setRejectNotes(v)}
              rows={2}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsRejectOpen(false)} disabled={isActionLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleReject}
              disabled={isActionLoading || !rejectionReason.trim()}
              className="font-semibold"
            >
              {isActionLoading ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REQUEST CHANGES DIALOG */}
      <Dialog open={isRequestChangesOpen} onOpenChange={setIsRequestChangesOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-heading text-lg font-bold">Request Changes from Applicant</DialogTitle>
            <DialogDescription className="text-xs text-muted">
              Specify the required revisions. The applicant will receive an email with instructions and a link to update their registration.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <TextArea
              label="Requested Revisions / Feedback"
              name="changesNotes"
              required
              placeholder="e.g. Please provide a higher resolution logo with a transparent or white background..."
              value={changesNotes}
              onChange={(v) => setChangesNotes(v)}
              rows={3}
            />
            <TextArea
              label="Internal Notes (Optional)"
              name="changesAdminNotes"
              placeholder="Internal record notes..."
              value={changesAdminNotes}
              onChange={(v) => setChangesAdminNotes(v)}
              rows={2}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsRequestChangesOpen(false)} disabled={isActionLoading}>
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleRequestChanges}
              disabled={isActionLoading || !changesNotes.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {isActionLoading ? "Sending..." : "Send Change Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
