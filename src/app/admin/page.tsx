import { listAdminUsers } from "@/lib/admin";
import { queryNeon } from "@/lib/neon-db";
import {
  Users,
  BarChart3,
  Building2,
  ChevronRight,
  Activity,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import OrganizationsTable from "./_components/OrganizationsTable";
import { Button } from "@/components/ui";

export const revalidate = 0; // Ensures this page is always fresh when loaded by admin

type OrganizationRow = {
  id: string;
  email: string | undefined;
  username: string | undefined;
  organizationName: string | undefined;
  created_at: string;
  eventCount: number;
  attendeeCount: number;
  eventIds: Set<string>;
};

export default async function AdminDashboardPage() {
  // 1. Fetch All Organizations (Users)
  const userData = await listAdminUsers();
  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);
  const rawUsers = (userData?.data || []).filter((u) => {
    const email = u.email?.toLowerCase().trim();
    return !email || !adminEmails.includes(email);
  });

  // 2. Fetch All Events
  const rawEvents = await queryNeon<{
    id: string;
    user_id: string;
    name: string;
    created_at: string;
    date: string;
    location: string;
  }>(
    `SELECT id, user_id, name, created_at, date, location
     FROM public.events
     ORDER BY created_at DESC`,
  );

  // 3. Fetch All Attendees
  const rawAttendees = await queryNeon<{ id: string; event_id: string; created_at: string }>(
    `SELECT id, event_id, created_at FROM public.attendees`,
  );

  // 4. Fetch All Profiles (for usernames)
  const profiles = await queryNeon<{
    id: string;
    username: string | null;
    organization_name: string | null;
  }>(`SELECT id, username, organization_name FROM public.profiles`);
  const profileLookup = new Map();
  (profiles || []).forEach(p => profileLookup.set(p.id, p));

  // Aggregate Data
  const totalOrgs = rawUsers.length;
  const totalEvents = rawEvents.length;
  const totalAttendees = rawAttendees.length;
  const avgEventsPerOrg = totalOrgs > 0 ? (totalEvents / totalOrgs).toFixed(1) : "0.0";
  const avgAttendeesPerEvent = totalEvents > 0 ? (totalAttendees / totalEvents).toFixed(1) : "0.0";
  const mostRecentEventAt = rawEvents[0]?.created_at || null;

  // Map Users for quick lookup
  const userLookup = new Map();
  rawUsers.forEach(u => userLookup.set(u.id, u.email));

  // Build the Organization Grid Data
  const orgMap = new Map();
  rawUsers.forEach(user => {
    const profile = profileLookup.get(user.id);
    orgMap.set(user.id, {
      id: user.id,
      email: user.email,
      username: profile?.username || user.email?.split("@")[0],
      organizationName: profile?.organization_name || user.user_metadata?.organization_name,
      created_at: user.created_at,
      eventCount: 0,
      attendeeCount: 0,
      eventIds: new Set(),
    });
  });

  // Assign events
  rawEvents.forEach(evt => {
    if (orgMap.has(evt.user_id)) {
      const org = orgMap.get(evt.user_id);
      org.eventCount += 1;
      org.eventIds.add(evt.id);
    }
  });

  // Assign attendees
  rawAttendees.forEach(att => {
    for (const org of orgMap.values()) {
      if (org.eventIds.has(att.event_id)) {
        org.attendeeCount += 1;
        break;
      }
    }
  });

  const organizations: OrganizationRow[] = Array.from(orgMap.values()) as OrganizationRow[];

  // Recent Activity Feed
  const recentEvents = rawEvents.slice(0, 7).map(evt => {
    const user = rawUsers.find(u => u.id === evt.user_id);
    const profile = profileLookup.get(evt.user_id);
    
    const orgEmail = user?.email || "Unknown Organization";
    const orgName = profile?.organization_name || user?.user_metadata?.organization_name;
    const username = profile?.username;

    return {
      ...evt,
      orgEmail,
      orgName,
      username
    };
  });

  return (
    <div className="flex flex-col gap-6 px-2 py-6 sm:px-4 sm:py-6 lg:px-6">
      <div className="relative animate-slide-up overflow-hidden rounded-xl border border-primary/20 bg-linear-to-br from-white/90 via-white/80 to-primary/10 p-5 shadow-lg ring-1 ring-primary/10 ring-inset sm:p-6">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
        <div className="absolute -left-8 -bottom-10 h-32 w-32 rounded-full bg-info/10 blur-2xl" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold tracking-[0.04em] text-primary-strong">
              <ShieldCheck size={14} />
              Super Admin Command Center
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] text-heading" style={{ fontWeight: 700 }}>Platform Overview</h1>
            <p className="max-w-2xl text-sm font-normal leading-[1.6] text-muted">
              A centralized operational view for governance, organization growth, and recent activity across the platform.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="card-primary px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Avg events/org</p>
              <p className="mt-1.5 text-3xl font-semibold tracking-[-0.03em] text-heading">{avgEventsPerOrg}</p>
            </div>
            <div className="card-primary px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Avg attendees/event</p>
              <p className="mt-1.5 text-3xl font-semibold tracking-[-0.03em] text-heading">{avgAttendeesPerEvent}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card-primary group flex items-center gap-5 p-6 animate-slide-up">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
          <div className="relative z-10 w-14 h-14 rounded-md bg-primary/12 border border-primary/25 flex items-center justify-center text-primary-strong shrink-0 group-hover:scale-105 transition-transform">
            <Building2 size={28} strokeWidth={2} />
          </div>
          <div className="relative z-10 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Total Organizations</span>
            <span className="text-5xl font-medium text-heading tracking-[-0.01em] leading-[1.02]">{totalOrgs}</span>
          </div>
        </div>

        <div className="card-primary group flex items-center gap-5 p-6 animate-slide-up delay-75">
          <div className="absolute top-0 right-0 w-32 h-32 bg-info/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
          <div className="relative z-10 w-14 h-14 rounded-md bg-primary/12 border border-primary/25 flex items-center justify-center text-primary-strong shrink-0 group-hover:scale-105 transition-transform">
            <BarChart3 size={28} strokeWidth={2} />
          </div>
          <div className="relative z-10 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Total Campaigns</span>
            <span className="text-5xl font-medium text-heading tracking-[-0.01em] leading-[1.02]">{totalEvents}</span>
          </div>
        </div>

        <div className="card-primary group flex items-center gap-5 p-6 animate-slide-up delay-150">
          <div className="absolute top-0 right-0 w-32 h-32 bg-heading/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
          <div className="relative z-10 w-14 h-14 rounded-md bg-primary/12 border border-primary/25 flex items-center justify-center text-primary-strong shrink-0 group-hover:scale-105 transition-transform">
            <Users size={28} strokeWidth={2} />
          </div>
          <div className="relative z-10 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Total Attendees</span>
            <span className="text-5xl font-medium text-heading tracking-[-0.01em] leading-[1.02]">{totalAttendees}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 animate-slide-up delay-300">
        <div className="lg:col-span-2 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.03em] leading-[1.15] text-heading">
              <UserRound size={22} className="text-primary-strong" />
              Organizations Directory
            </h2>
            <Link href="/admin/organizations/new">
              <Button size="sm">Create Organization</Button>
            </Link>
          </div>
          <OrganizationsTable initialOrganizations={organizations} />
        </div>

        <div className="lg:col-span-1 flex flex-col gap-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.03em] leading-[1.15] text-heading">
              <Activity size={22} className="text-primary-strong" />
              Recent Activity
            </h2>
            <span className="text-xs text-muted">
              {mostRecentEventAt ? `Updated ${new Date(mostRecentEventAt).toLocaleDateString()}` : "No updates yet"}
            </span>
          </div>

          <div className="card-primary p-4">
            <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary-strong">
              <Sparkles size={12} />
              Live Feed
            </div>
            <div className="flex flex-col gap-3">
              {recentEvents.map(evt => (
                <div key={evt.id} className="card-secondary group p-3">
                  <div className="flex items-start justify-between">
                    <span className="rounded border border-border/40 bg-surface px-1.5 py-0.5 text-[11px] font-medium text-muted">
                      New Campaign
                    </span>
                    <span className="text-xs font-normal text-muted">
                      {new Date(evt.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="mt-2 truncate text-sm font-semibold text-heading group-hover:text-primary-strong">
                    {evt.name}
                  </h3>
                  <p className="mt-1 truncate text-xs font-normal text-muted">
                    {evt.orgName ? `${evt.orgName} (@${evt.username || "unknown"})` : evt.orgEmail}
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-border/30 pt-2">
                    <span className="truncate text-xs font-normal text-muted">{evt.location}</span>
                    <Link
                      href={`/admin/organizations/${evt.user_id}`}
                      className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold leading-tight text-primary-strong transition-all duration-200 hover:bg-primary/20 hover:-translate-y-0.5 active:scale-[0.95]"
                    >
                      Open Org <ChevronRight size={10} />
                    </Link>
                  </div>
                </div>
              ))}
              {recentEvents.length === 0 && (
                <p className="rounded-md border border-dashed border-border bg-surface/40 py-8 text-center text-sm text-muted">
                  No recent activity detected.
                </p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
