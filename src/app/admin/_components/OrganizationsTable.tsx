"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronRight, Search, ArrowUpDown } from "lucide-react";

interface Organization {
  id: string;
  email: string | undefined;
  username: string | undefined;
  organizationName: string | undefined;
  created_at: string;
  eventCount: number;
  attendeeCount: number;
}

interface OrganizationsTableProps {
  initialOrganizations: Organization[];
}

type SortField = "username" | "organizationName" | "created_at" | "eventCount" | "attendeeCount";
type SortOrder = "asc" | "desc";

function renderSortIcon(field: SortField, activeField: SortField, activeOrder: SortOrder) {
  if (activeField !== field) return <ArrowUpDown size={14} className="ml-1 opacity-20" />;
  return <ArrowUpDown size={14} className={`ml-1 ${activeOrder === "asc" ? "rotate-180" : ""} transition-transform`} />;
}

export default function OrganizationsTable({ initialOrganizations }: OrganizationsTableProps) {
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
        <div className="relative max-w-xl flex-1 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted/40 group-focus-within:text-primary transition-colors" size={20} />
          <input
            type="text"
            placeholder="Search by username, email or organization..."
            className="h-14 w-full rounded-xl border border-border/40 bg-white/80 py-0 pl-14 pr-6 text-base font-medium leading-[1.6] text-heading shadow-sm transition-all placeholder:text-muted/30 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-white/70 px-3 py-2 text-xs text-muted">
          Showing <span className="font-semibold text-heading">{filteredAndSortedOrgs.length}</span> of{" "}
          <span className="font-semibold text-heading">{initialOrganizations.length}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/40 bg-white/60 shadow-md">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-surface text-[12px] font-black uppercase tracking-[0.08em] text-muted">
                <th
                  className="cursor-pointer py-3.5 px-5 font-medium transition-colors hover:text-heading"
                  onClick={() => toggleSort("username")}
                >
                  <div className="flex items-center">
                    Username {renderSortIcon("username", sortField, sortOrder)}
                  </div>
                </th>
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
                <tr key={org.id} className="group cursor-default hover:bg-white/85">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-[12px] font-black uppercase text-primary-strong shadow-inner group-hover:scale-110 transition-transform duration-300">
                        {(org.username || org.email || "u").slice(0, 2)}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-semibold text-heading group-hover:text-primary-strong transition-colors">@{org.username || "unknown"}</span>
                        <span className="truncate text-[12px] text-muted opacity-70">{org.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-sm text-heading font-medium">
                    {org.organizationName || <span className="font-normal text-muted/60">—</span>}
                  </td>
                  <td className="py-3.5 px-5 text-sm text-muted font-medium">{new Date(org.created_at).toLocaleDateString()}</td>
                  <td className="py-3.5 px-5 text-center">
                    <span className="inline-flex items-center justify-center rounded-md bg-info/10 px-3 py-1 text-[12px] font-bold leading-tight text-info border border-info/20">
                      {org.eventCount}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-center">
                    <span className="inline-flex items-center justify-center rounded-md bg-heading/10 px-3 py-1 text-[12px] font-bold leading-tight text-heading border border-heading/20">
                      {org.attendeeCount}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <Link href={`/admin/organizations/${org.id}`}>
                      <button className="ml-auto inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-[12px] font-black leading-tight text-primary-strong transition-all duration-300 hover:bg-primary/20 hover:-translate-y-0.5 active:scale-[0.95] uppercase tracking-wider">
                        Deep Dive <ChevronRight size={14} />
                      </button>
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
      </div>
    </div>
  );
}
