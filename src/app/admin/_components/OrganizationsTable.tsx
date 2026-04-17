"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronRight, Search, ArrowUpDown } from "lucide-react";

interface Organization {
  id: string;
  email: string | undefined;
  organizationName: string | undefined;
  created_at: string;
  eventCount: number;
  attendeeCount: number;
}

interface OrganizationsTableProps {
  initialOrganizations: Organization[];
}

type SortField = "email" | "organizationName" | "created_at" | "eventCount" | "attendeeCount";
type SortOrder = "asc" | "desc";

export default function OrganizationsTable({ initialOrganizations }: OrganizationsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const filteredAndSortedOrgs = useMemo(() => {
    let result = [...initialOrganizations];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((org) => 
        org.email?.toLowerCase().includes(q) || 
        org.organizationName?.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="ml-1 opacity-20" />;
    return <ArrowUpDown size={14} className={`ml-1 ${sortOrder === "asc" ? "rotate-180" : ""} transition-transform`} />;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Search Bar */}
      <div className="relative max-w-md ml-2">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted/60" size={18} />
        <input
          type="text"
          placeholder="Search by email or organization..."
          className="w-full pl-11 pr-4 py-2.5 bg-white/60 backdrop-blur-md border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white transition-all text-sm text-heading shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="bg-white/50 backdrop-blur-md rounded-xl border border-border/50 overflow-hidden shadow-sm">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[820px] text-left border-collapse">
            <thead>
              <tr className="bg-surface border-b border-border text-xs font-semibold tracking-[0.02em] text-muted">
                <th 
                  className="py-4 px-6 font-semibold cursor-pointer hover:text-heading transition-colors"
                  onClick={() => toggleSort("email")}
                >
                  <div className="flex items-center">
                    Email Address <SortIcon field="email" />
                  </div>
                </th>
                <th 
                  className="py-4 px-6 font-semibold cursor-pointer hover:text-heading transition-colors"
                  onClick={() => toggleSort("organizationName")}
                >
                  <div className="flex items-center">
                    Organization <SortIcon field="organizationName" />
                  </div>
                </th>
                <th 
                  className="py-4 px-6 font-semibold cursor-pointer hover:text-heading transition-colors"
                  onClick={() => toggleSort("created_at")}
                >
                  <div className="flex items-center">
                    Joined At <SortIcon field="created_at" />
                  </div>
                </th>
                <th 
                  className="py-4 px-6 font-semibold text-center cursor-pointer hover:text-heading transition-colors"
                  onClick={() => toggleSort("eventCount")}
                >
                  <div className="flex items-center justify-center">
                    Events Hosted <SortIcon field="eventCount" />
                  </div>
                </th>
                <th 
                  className="py-4 px-6 font-semibold text-center cursor-pointer hover:text-heading transition-colors"
                  onClick={() => toggleSort("attendeeCount")}
                >
                  <div className="flex items-center justify-center">
                    Total Attendees <SortIcon field="attendeeCount" />
                  </div>
                </th>
                <th className="py-4 px-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredAndSortedOrgs.map((org) => (
                <tr key={org.id} className="hover:bg-white transition-colors group cursor-default">
                  <td className="py-4 px-6 font-semibold text-heading text-sm">{org.email}</td>
                  <td className="py-4 px-6 font-semibold text-heading text-sm">{org.organizationName || <span className="text-muted/60 font-medium">—</span>}</td>
                  <td className="py-4 px-6 text-muted text-sm">{new Date(org.created_at).toLocaleDateString()}</td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center justify-center bg-info/10 text-info font-semibold px-3 py-1 rounded-sm text-sm">
                      {org.eventCount}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center justify-center bg-heading/10 text-heading font-semibold px-3 py-1 rounded-sm text-sm">
                      {org.attendeeCount}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <Link href={`/admin/organizations/${org.id}`}>
                      <button className="flex items-center gap-1 text-xs font-semibold text-primary-strong hover:text-primary-strong bg-primary/10 hover:bg-primary/15 border border-primary/30 px-4 py-2 rounded-sm transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ml-auto">
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
