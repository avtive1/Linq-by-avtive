"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, Clock, CheckCircle2, XCircle, AlertCircle, ArrowRight, Building2, User, Calendar, Sparkles } from "lucide-react";
import GradientBackground from "@/components/GradientBackground";
import { TextInput } from "@/components/ui/text-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type StatusData = {
  id: string;
  referenceNumber: string;
  status: "PENDING" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "REJECTED";
  contactName: string;
  contactEmail: string;
  organizationName: string;
  organizationWebsite?: string;
  organizationLogoUrl?: string;
  rejectionReason?: string;
  changesRequestedNotes?: string;
  createdAt: string;
  updatedAt: string;
};

function StatusTrackerForm() {
  const searchParams = useSearchParams();
  const initialRef = searchParams.get("ref")?.trim() || "";

  const [refInput, setRefInput] = useState(initialRef);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<StatusData | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!refInput.trim()) {
      toast.error("Please enter a reference number.");
      return;
    }

    setIsLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/organization-registration?ref=${encodeURIComponent(refInput.trim())}`);
      const payload = await res.json();
      if (!res.ok || !payload?.data) {
        setResult(null);
        toast.error(payload?.error || "Registration request not found.");
        return;
      }
      setResult(payload.data);
    } catch {
      setResult(null);
      toast.error("Failed to fetch registration status.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!initialRef) return;
    let isCancelled = false;
    setIsLoading(true);

    fetch(`/api/organization-registration?ref=${encodeURIComponent(initialRef.trim())}`)
      .then((res) => res.json())
      .then((payload) => {
        if (isCancelled) return;
        if (payload?.data) {
          setResult(payload.data);
        } else {
          toast.error(payload?.error || "Registration request not found.");
        }
      })
      .catch(() => {
        if (!isCancelled) toast.error("Failed to fetch registration status.");
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
          setSearched(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [initialRef]);

  const getStatusBadge = (status: StatusData["status"]) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold gap-1.5 px-3 py-1">
            <Clock size={13} />
            Pending Review
          </Badge>
        );
      case "UNDER_REVIEW":
        return (
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold gap-1.5 px-3 py-1">
            <Clock size={13} />
            Under Review
          </Badge>
        );
      case "CHANGES_REQUESTED":
        return (
          <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-800 text-xs font-semibold gap-1.5 px-3 py-1">
            <AlertCircle size={13} />
            Action Required (Changes Requested)
          </Badge>
        );
      case "APPROVED":
        return (
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold gap-1.5 px-3 py-1">
            <CheckCircle2 size={13} />
            Approved
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-xs font-semibold gap-1.5 px-3 py-1">
            <XCircle size={13} />
            Application Rejected
          </Badge>
        );
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-6">
      <div className="text-center">
        <Badge variant="outline" className="gap-1.5 border-primary/20 bg-primary/10 text-primary font-semibold px-3 py-1 text-xs mb-2">
          <Search size={13} />
          Registration Lookup
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-heading">
          Track Registration Status
        </h1>
        <p className="text-xs sm:text-sm text-muted mt-1">
          Enter your reference number (e.g. ORG-20260902-XXXX) to check your organization approval status.
        </p>
      </div>

      {/* Search Bar Card */}
      <Card className="p-4 sm:p-5 border-hairline-soft bg-white shadow-sm">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <TextInput
              name="referenceNumber"
              placeholder="e.g. ORG-20260902-ABCD"
              value={refInput}
              onChange={(v) => setRefInput(v)}
              className="w-full"
            />
          </div>
          <Button
            type="submit"
            disabled={isLoading || !refInput.trim()}
            className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold px-6 shrink-0 h-11"
          >
            {isLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Search size={16} className="mr-2" />
                Check Status
              </>
            )}
          </Button>
        </form>
      </Card>

      {/* Results View */}
      {result && (
        <Card className="p-6 border-hairline-soft bg-white shadow-md animate-slide-up">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-hairline-soft pb-4 mb-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Reference Number</span>
              <p className="font-mono text-base sm:text-lg font-bold text-primary mt-0.5">
                {result.referenceNumber}
              </p>
            </div>
            <div>{getStatusBadge(result.status)}</div>
          </div>

          <div className="flex items-start gap-4 mb-5">
            {result.organizationLogoUrl ? (
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-hairline bg-surface p-1 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.organizationLogoUrl}
                  alt={result.organizationName}
                  className="h-full w-full object-contain rounded-md"
                />
              </div>
            ) : (
              <div className="h-14 w-14 shrink-0 flex items-center justify-center rounded-lg border border-hairline bg-surface text-muted">
                <Building2 size={24} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-heading truncate">{result.organizationName}</h3>
              <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                <User size={13} />
                Contact: <span className="font-medium text-ink">{result.contactName}</span> ({result.contactEmail})
              </p>
              <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                <Calendar size={13} />
                Submitted: {new Date(result.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Status Specific Action Cards */}
          {result.status === "CHANGES_REQUESTED" && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-orange-950 mb-5">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={18} className="text-orange-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-orange-900">Changes Requested by Reviewer</h4>
                  <p className="text-xs text-orange-800 mt-1 leading-relaxed whitespace-pre-wrap">
                    {result.changesRequestedNotes || "Please review and update your organization details."}
                  </p>
                  <div className="mt-3">
                    <Link href={`/organization/register?ref=${encodeURIComponent(result.referenceNumber)}`}>
                      <Button size="sm" className="bg-orange-700 hover:bg-orange-800 text-white font-semibold text-xs gap-1.5">
                        <Sparkles size={14} />
                        Update & Resubmit Registration
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {result.status === "APPROVED" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 mb-5">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-emerald-900">Your Organization Is Active!</h4>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    Your organization has been approved. You can now sign in to your dashboard to manage events and digital badges.
                  </p>
                  <div className="mt-3">
                    <Link href="/login">
                      <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs gap-1.5">
                        Go to Login
                        <ArrowRight size={14} />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {result.status === "REJECTED" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-950 mb-5">
              <div className="flex items-start gap-2.5">
                <XCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-red-900">Application Decision</h4>
                  <p className="text-xs text-red-800 mt-1 leading-relaxed">
                    {result.rejectionReason || "We are unable to approve your application at this time."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {result.status === "PENDING" && (
            <div className="rounded-lg border border-hairline-soft bg-surface/60 p-4 text-ink mb-5">
              <div className="flex items-start gap-2.5">
                <Clock size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-heading">Under Review</h4>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Your application is in queue for administrative verification. You will receive an email update once processed.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="text-center pt-2 border-t border-hairline-soft">
            <Link href="/organization/register" className="text-xs text-primary font-medium hover:underline">
              Submit a new organization registration &rarr;
            </Link>
          </div>
        </Card>
      )}

      {searched && !result && !isLoading && (
        <Card className="p-8 border-hairline-soft bg-white text-center shadow-xs">
          <p className="text-sm font-semibold text-heading">No Registration Request Found</p>
          <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
            Please double check the reference number or submit a new registration request.
          </p>
          <div className="mt-4">
            <Link href="/organization/register">
              <Button size="sm" variant="outline" className="text-xs font-medium">
                Register Organization
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function OrganizationStatusPage() {
  return (
    <div className="relative min-h-screen bg-transparent select-text">
      <GradientBackground />

      <header className="relative z-50 border-b border-hairline-soft bg-white/80 backdrop-blur-xl shadow-xs">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/linq-logo.png"
              alt="Linq logo"
              width={100}
              height={28}
              className="h-7 w-auto object-contain"
              priority
            />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/organization/register">
              <Button variant="default" size="sm" className="text-xs font-semibold bg-primary text-primary-foreground">
                Register Organization
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-4 py-8 sm:py-12">
        <Suspense fallback={<div className="py-24 text-center text-muted">Loading tracker...</div>}>
          <StatusTrackerForm />
        </Suspense>
      </main>
    </div>
  );
}
