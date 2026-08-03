"use client";

import { useState, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Search, ArrowUpDown } from "lucide-react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Organization {
  id: string;
  email: string | undefined;
  username: string | undefined;
  organizationName: string | undefined;
  organizationLogoUrl: string | undefined;
  created_at: string;
  eventCount: number;
  attendeeCount: number;
}

interface OrganizationsTableProps {
  initialOrganizations: Organization[];
  toolbarAction?: ReactNode;
}

type SortField = "username" | "organizationName" | "created_at" | "eventCount" | "attendeeCount";
type SortOrder = "asc" | "desc";

function renderSortIcon(field: SortField, activeField: SortField, activeOrder: SortOrder) {
  if (activeField !== field) return <ArrowUpDown size={14} className="ml-1 opacity-20" />;
  return <ArrowUpDown size={14} className={`ml-1 ${activeOrder === "asc" ? "rotate-180" : ""} transition-transform`} />;
}

export default function OrganizationsTable({ initialOrganizations, toolbarAction }: OrganizationsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("username");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const filteredAndSortedOrgs = useMemo(() => {
    let result = [...initialOrganizations];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((org) => 
        org.username?.toLowerCase().includes(q) || 
        org.email?.toLowerCase().includes(q) || 
        org.organizationName?.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
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

    return result;
  }, [initialOrganizations, searchQuery, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative min-w-0 max-w-xl flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-steel/60 group-focus-within:text-ink transition-colors sm:left-5 z-10" size={20} />
          <Input
            id="admin-organizations-search"
            name="adminOrganizationsSearch"
            type="text"
            placeholder="Search by username, email or organization..."
            className="h-11 w-full bg-white pl-12 sm:pl-14 text-base text-ink"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:shrink-0">
          {toolbarAction}
          <Badge variant="outline" className="h-11 px-3 gap-1.5 text-xs font-medium bg-surface text-steel whitespace-nowrap">
            Showing <span className="font-semibold text-ink">{filteredAndSortedOrgs.length}</span> of{" "}
            <span className="font-semibold text-ink">{initialOrganizations.length}</span>
          </Badge>
        </div>
      </div>

      <Card className="min-w-0 overflow-hidden bg-white/60 shadow-md p-0 border-border/40">
        <div className="w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-surface text-xs font-semibold uppercase tracking-wide text-muted">
                <th
                  className="cursor-pointer py-3.5 px-5 font-medium transition-colors hover:text-heading"
                  onClick={() => toggleSort("organizationName")}
                >
                  <div className="flex items-center">
                    Organization {renderSortIcon("organizationName", sortField, sortOrder)}
                  </div>
                </th>
                <th
                  className="cursor-pointer py-3.5 px-5 font-medium transition-colors hover:text-heading"
                  onClick={() => toggleSort("created_at")}
                >
                  <div className="flex items-center">
                    Joined {renderSortIcon("created_at", sortField, sortOrder)}
                  </div>
                </th>
                <th
                  className="cursor-pointer py-3.5 px-5 text-center font-medium transition-colors hover:text-heading"
                  onClick={() => toggleSort("eventCount")}
                >
                  <div className="flex items-center justify-center">
                    Campaigns {renderSortIcon("eventCount", sortField, sortOrder)}
                  </div>
                </th>
                <th
                  className="cursor-pointer py-3.5 px-5 text-center font-medium transition-colors hover:text-heading"
                  onClick={() => toggleSort("attendeeCount")}
                >
                  <div className="flex items-center justify-center">
                    Attendees {renderSortIcon("attendeeCount", sortField, sortOrder)}
                  </div>
                </th>
                <th className="py-3.5 px-5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredAndSortedOrgs.map((org) => (
                <tr key={org.id} className="group cursor-default hover:bg-white/85 transition-colors">
                  <td className="py-5 px-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-white text-sm font-semibold uppercase text-primary-strong shadow-sm">
                        {org.organizationLogoUrl && org.organizationLogoUrl.trim() !== "" ? (
                          <Image
                            src={org.organizationLogoUrl}
                            alt={org.organizationName || "Logo"}
                            width={128}
                            height={128}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          (org.organizationName || org.username || "o").slice(0, 2)
                        )}
                      </div>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm font-semibold text-heading group-hover:text-ink transition-colors">
                          {org.organizationName || `@${org.username}`}
                        </span>
                        <div className="flex items-center gap-1.5 ui-meta truncate">
                          <span className="opacity-70">@{org.username}</span>
                          <span className="h-1 w-1 rounded-full bg-border" />
                          <span className="opacity-70">{org.email}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-5 px-6 text-sm text-muted font-normal">{org.created_at ? new Date(org.created_at).toLocaleDateString() : "—"}</td>
                  <td className="py-5 px-6 text-center">
                    <Badge variant="outline" className="bg-info/10 px-3 py-1.5 text-sm font-semibold leading-tight text-info border-info/20">
                      {org.eventCount}
                    </Badge>
                  </td>
                  <td className="py-5 px-6 text-center">
                    <Badge variant="outline" className="bg-heading/10 px-3 py-1.5 text-sm font-semibold leading-tight text-heading border-heading/20">
                      {org.attendeeCount}
                    </Badge>
                  </td>
                  <td className="py-5 px-6 text-right">
                    <Link
                      href={`/admin/organizations/${org.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-10 px-4 gap-1.5 text-xs font-semibold bg-white text-ink hover:bg-surface")}
                    >
                      Deep Dive <ChevronRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredAndSortedOrgs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted">No organizations found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
