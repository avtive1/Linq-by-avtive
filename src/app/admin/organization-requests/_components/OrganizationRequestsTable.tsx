"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  ArrowUpDown,
  ChevronRight,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OrganizationRegistrationRecord } from "@/lib/organization/registration-db";

interface OrganizationRequestsTableProps {
  initialRequests: OrganizationRegistrationRecord[];
  initialCounts: {
    all: number;
    pending: number;
    under_review: number;
    changes_requested: number;
    approved: number;
    rejected: number;
  };
}

type FilterStatus = "ALL" | "PENDING" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "REJECTED";
type SortField = "created_at" | "organization_name" | "contact_name" | "status";
type SortOrder = "asc" | "desc";

export function OrganizationRequestsTable({
  initialRequests,
  initialCounts,
}: OrganizationRequestsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterStatus>("ALL");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [hasCopiedLink, setHasCopiedLink] = useState(false);

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/organization/register`;
    navigator.clipboard.writeText(url).then(() => {
      setHasCopiedLink(true);
      setTimeout(() => setHasCopiedLink(false), 2500);
    });
  };

  const filteredAndSorted = useMemo(() => {
    let list = [...initialRequests];

    if (activeTab !== "ALL") {
      list = list.filter((r) => r.status === activeTab);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.organization_name?.toLowerCase().includes(q) ||
          r.contact_name?.toLowerCase().includes(q) ||
          r.contact_email?.toLowerCase().includes(q) ||
          r.reference_number?.toLowerCase().includes(q),
      );
    }

    list.sort((a, b) => {
      let valA: string | number = a[sortField] ?? "";
      let valB: string | number = b[sortField] ?? "";

      if (sortField === "created_at") {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [initialRequests, activeTab, searchQuery, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const renderStatusBadge = (status: OrganizationRegistrationRecord["status"]) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold gap-1 px-2.5 py-0.5">
            <Clock size={12} />
            Pending
          </Badge>
        );
      case "UNDER_REVIEW":
        return (
          <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-800 text-xs font-semibold gap-1 px-2.5 py-0.5">
            <Clock size={12} />
            Under Review
          </Badge>
        );
      case "CHANGES_REQUESTED":
        return (
          <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-800 text-xs font-semibold gap-1 px-2.5 py-0.5">
            <AlertCircle size={12} />
            Changes Requested
          </Badge>
        );
      case "APPROVED":
        return (
          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-semibold gap-1 px-2.5 py-0.5">
            <CheckCircle2 size={12} />
            Approved
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="outline" className="border-red-300 bg-red-50 text-red-800 text-xs font-semibold gap-1 px-2.5 py-0.5">
            <XCircle size={12} />
            Rejected
          </Badge>
        );
    }
  };

  const tabs: { key: FilterStatus; label: string; count: number }[] = [
    { key: "ALL", label: "All Requests", count: initialCounts.all },
    { key: "PENDING", label: "Pending", count: initialCounts.pending },
    { key: "UNDER_REVIEW", label: "Under Review", count: initialCounts.under_review },
    { key: "CHANGES_REQUESTED", label: "Changes Requested", count: initialCounts.changes_requested },
    { key: "APPROVED", label: "Approved", count: initialCounts.approved },
    { key: "REJECTED", label: "Rejected", count: initialCounts.rejected },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all whitespace-nowrap",
              activeTab === tab.key
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-white text-muted border border-hairline-soft hover:text-heading hover:bg-surface",
            )}
          >
            <span>{tab.label}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                activeTab === tab.key
                  ? "bg-white/20 text-white"
                  : "bg-surface text-muted border border-hairline-soft",
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search Input & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative w-full max-w-lg">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <Input
            placeholder="Search by organization, contact name, email, or reference #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-white border-hairline-soft text-sm"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="h-10 text-xs font-semibold gap-1.5 border-hairline-strong bg-white hover:bg-surface text-heading shadow-2xs"
          >
            {hasCopiedLink ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            <span>{hasCopiedLink ? "Link Copied!" : "Copy Registration Link"}</span>
          </Button>
          <Link href="/organization/register" target="_blank" rel="noreferrer">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 text-xs font-semibold gap-1.5 border-hairline-strong bg-white hover:bg-surface text-heading shadow-2xs"
              title="Open public registration form in new tab"
            >
              <ExternalLink size={14} />
              <span>Open Form</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Table Card */}
      <Card className="overflow-hidden border-hairline-soft bg-white shadow-xs">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface/60 border-b border-hairline-soft text-xs font-semibold text-muted uppercase tracking-wider">
              <tr>
                <th scope="col" className="py-3 px-4">
                  Reference #
                </th>
                <th
                  scope="col"
                  className="py-3 px-4 cursor-pointer hover:text-heading transition-colors"
                  onClick={() => toggleSort("organization_name")}
                >
                  <div className="flex items-center gap-1">
                    <span>Organization</span>
                    <ArrowUpDown size={12} className="opacity-50" />
                  </div>
                </th>
                <th
                  scope="col"
                  className="py-3 px-4 cursor-pointer hover:text-heading transition-colors"
                  onClick={() => toggleSort("contact_name")}
                >
                  <div className="flex items-center gap-1">
                    <span>Contact Person</span>
                    <ArrowUpDown size={12} className="opacity-50" />
                  </div>
                </th>
                <th
                  scope="col"
                  className="py-3 px-4 cursor-pointer hover:text-heading transition-colors"
                  onClick={() => toggleSort("created_at")}
                >
                  <div className="flex items-center gap-1">
                    <span>Submitted</span>
                    <ArrowUpDown size={12} className="opacity-50" />
                  </div>
                </th>
                <th
                  scope="col"
                  className="py-3 px-4 cursor-pointer hover:text-heading transition-colors"
                  onClick={() => toggleSort("status")}
                >
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    <ArrowUpDown size={12} className="opacity-50" />
                  </div>
                </th>
                <th scope="col" className="py-3 px-4 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline-soft">
              {filteredAndSorted.map((req) => (
                <tr key={req.id} className="hover:bg-surface/40 transition-colors group">
                  <td className="py-3.5 px-4 font-mono font-semibold text-xs text-primary">
                    <Link href={`/admin/organization-requests/${req.id}`} className="hover:underline">
                      {req.reference_number}
                    </Link>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      {req.organization_logo_url ? (
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-hairline bg-surface p-0.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={req.organization_logo_url}
                            alt={req.organization_name}
                            className="h-full w-full object-contain rounded-xs"
                          />
                        </div>
                      ) : (
                        <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-md border border-hairline bg-surface text-muted">
                          <Building2 size={16} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <Link
                          href={`/admin/organization-requests/${req.id}`}
                          className="font-semibold text-heading hover:text-primary transition-colors block truncate max-w-[200px]"
                        >
                          {req.organization_name}
                        </Link>
                        {req.industry && (
                          <span className="text-xs text-muted block truncate max-w-[200px]">
                            {req.industry}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="text-xs">
                      <p className="font-semibold text-heading">{req.contact_name}</p>
                      <p className="text-muted">{req.contact_designation}</p>
                      <p className="text-muted text-[11px] truncate max-w-[180px]">{req.contact_email}</p>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-muted whitespace-nowrap">
                    {new Date(req.created_at).toLocaleDateString()}
                    <span className="block text-[11px] text-muted/70">
                      {new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">{renderStatusBadge(req.status)}</td>
                  <td className="py-3.5 px-4 text-right">
                    <Link href={`/admin/organization-requests/${req.id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs border-hairline-strong hover:bg-primary hover:text-primary-foreground transition-all"
                      >
                        <Eye size={13} />
                        Review
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="md:hidden divide-y divide-hairline-soft">
          {filteredAndSorted.map((req) => (
            <div key={req.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-primary">{req.reference_number}</span>
                {renderStatusBadge(req.status)}
              </div>

              <div className="flex items-start gap-3">
                {req.organization_logo_url ? (
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-hairline bg-surface p-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={req.organization_logo_url}
                      alt={req.organization_name}
                      className="h-full w-full object-contain rounded-xs"
                    />
                  </div>
                ) : (
                  <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md border border-hairline bg-surface text-muted">
                    <Building2 size={18} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-heading truncate">{req.organization_name}</h4>
                  <p className="text-xs text-muted mt-0.5">
                    {req.contact_name} &bull; {req.contact_designation}
                  </p>
                  <p className="text-xs text-muted truncate">{req.contact_email}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-hairline-soft text-xs text-muted">
                <span>Submitted: {new Date(req.created_at).toLocaleDateString()}</span>
                <Link href={`/admin/organization-requests/${req.id}`}>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    Review <ChevronRight size={12} />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {filteredAndSorted.length === 0 && (
          <div className="py-16 text-center text-muted">
            <Building2 size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-semibold text-heading">No organization requests found</p>
            <p className="text-xs text-muted mt-1">
              {searchQuery ? "Try refining your search query." : "No requests match the selected filter tab."}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
