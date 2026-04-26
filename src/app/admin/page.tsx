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
  organizationLogoUrl: string | undefined;
  created_at: string;
  eventCount: number;
  attendeeCount: number;
  eventIds: Set<string>;
};

async function ensureOrganizationsSchema() {
  await queryNeon(`ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS organization_logo_url text`);
}

export default async function AdminDashboardPage() {
  await ensureOrganizationsSchema();
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
    logo_url: string | null;
  }>(
    `SELECT id, user_id, name, created_at, date, location, logo_url
     FROM public.events
     ORDER BY created_at DESC`,
  );

  // 3. Fetch All Attendees
  const rawAttendees = await queryNeon<{ id: string; event_id: string; created_at: string }>(
    `SELECT id, event_id, created_at FROM public.attendees`,
  );

  // 4. Fetch All Profiles (for usernames and branding)
  const profiles = await queryNeon<{
    id: string;
    username: string | null;
    organization_name: string | null;
    organization_logo_url: string | null;
  }>(`SELECT id, username, organization_name, organization_logo_url FROM public.profiles`);
  const profileLookup = new Map();
  (profiles || []).forEach(p => profileLookup.set(p.id, p));

  // 5. Fetch Official Organizations Data (for master logos)
  const officialOrgs = await queryNeon<{
    organization_name_key: string;
    organization_logo_url: string | null;
  }>(`SELECT organization_name_key, organization_logo_url FROM public.organizations`);
  const orgLogoLookup = new Map();
  (officialOrgs || []).forEach(o => {
    if (o.organization_logo_url) orgLogoLookup.set(o.organization_name_key, o.organization_logo_url);
  });

  // Aggregate Data
  const totalOrgs = rawUsers.length;
  const totalEvents = rawEvents.length;
  const totalAttendees = rawAttendees.length;
  const avgEventsPerOrg = totalOrgs > 0 ? (totalEvents / totalOrgs).toFixed(1) : "0.0";
  const avgAttendeesPerEvent = totalEvents > 0 ? (totalAttendees / totalEvents).toFixed(1) : "0.0";
  const mostRecentEventAt = rawEvents[0]?.created_at || null;

  // Build the Organization Grid Data - Grouping by Organization Name
  const orgMap = new Map();
  rawUsers.forEach(user => {
    const profile = profileLookup.get(user.id);
    const orgName = profile?.organization_name || user.user_metadata?.organization_name || "";
    const orgNameKey = (profile?.organization_name_key) || (orgName.toLowerCase().trim().replace(/[^a-z0-9]/g, ""));
    const effectiveName = orgName.trim() || `@${profile?.username || user.email?.split("@")[0] || "unknown"}`;
    
    const latestEventWithLogo = rawEvents.find(e => e.user_id === user.id && e.logo_url);
    
    // PRIORITY: 1. Master Organization Table -> 2. Profile Logo -> 3. Campaign Logo
    const masterOrgLogo = orgLogoLookup.get(orgNameKey);
    const logoUrl = (masterOrgLogo?.trim()) || (profile?.organization_logo_url?.trim()) || (latestEventWithLogo?.logo_url?.trim()) || (user.user_metadata?.organization_logo_url?.trim());

    if (!orgMap.has(effectiveName)) {
      orgMap.set(effectiveName, {
        id: user.id, // Use the primary user's ID for drill-down
        email: user.email,
        username: profile?.username || user.email?.split("@")[0],
        organizationName: orgName.trim() ? orgName : undefined,
        organizationLogoUrl: logoUrl,
        created_at: user.created_at,
        eventCount: 0,
        attendeeCount: 0,
        eventIds: new Set(),
      });
    }

    const org = orgMap.get(effectiveName);
    
    // Aggregate counts from all users in this "organization"
    const userEvents = rawEvents.filter(e => e.user_id === user.id);
    org.eventCount += userEvents.length;
    userEvents.forEach(e => org.eventIds.add(e.id));
    
    // Update logo/username if this user has more campaigns (likely the primary owner) or has a real profile logo
    const hasProfileLogo = profile?.organization_logo_url?.trim() || masterOrgLogo;
    if (hasProfileLogo || (userEvents.length > 0 && userEvents.length >= (org.eventCount - userEvents.length))) {
       org.id = user.id;
       org.username = profile?.username || user.email?.split("@")[0];
       org.email = user.email;
       if (logoUrl) org.organizationLogoUrl = logoUrl;
    }
  });

  // Second pass: count attendees for the aggregated event sets
  rawAttendees.forEach(att => {
    for (const org of orgMap.values()) {
      if (org.eventIds.has(att.event_id)) {
        org.attendeeCount += 1;
        break;
      }
    }
  });

  const organizations: OrganizationRow[] = Array.from(orgMap.values()) as OrganizationRow[];

  // Recent Activity Feed - showing Organizations instead of Campaigns
  const recentOrgs = rawUsers.slice(0, 7).map(user => {
    const profile = profileLookup.get(user.id);
    return {
      id: user.id,
      email: user.email,
      username: profile?.username || user.email?.split("@")[0],
      organizationName: profile?.organization_name || user.user_metadata?.organization_name,
      created_at: user.created_at,
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
              <Button
                variant="secondary"
                size="md"
                className="h-10 min-w-[176px] rounded-lg justify-center border-primary/25 bg-white text-sm font-semibold text-primary-strong shadow-sm transition-all hover:bg-primary/8 hover:border-primary/45 hover:shadow-md"
              >
                Create Organization
              </Button>
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
              {recentOrgs.map(org => (
                <div key={org.id} className="card-secondary group p-3">
                  <div className="flex items-start justify-between">
                    <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary-strong">
                      New Organization
                    </span>
                    <span className="text-xs font-normal text-muted">
                      {org.created_at ? new Date(org.created_at).toLocaleDateString() : "—"}
                    </span>
                  </div>
                  <h3 className="mt-2 truncate text-sm font-semibold text-heading group-hover:text-primary-strong">
                    {org.organizationName || "Unnamed Organization"}
                  </h3>
                  <p className="mt-1 truncate text-xs font-normal text-muted">
                    {`@${org.username}`}
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-border/30 pt-2">
                    <span className="truncate text-xs font-normal text-muted">{org.email}</span>
                    <Link
                      href={`/admin/organizations/${org.id}`}
                      className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold leading-tight text-primary-strong transition-all duration-200 hover:bg-primary/20 hover:-translate-y-0.5 active:scale-[0.95]"
                    >
                      Open Org <ChevronRight size={10} />
                    </Link>
                  </div>
                </div>
              ))}
              {recentOrgs.length === 0 && (
                <p className="rounded-md border border-dashed border-border bg-surface/40 py-8 text-center text-sm text-muted">
                  No recent organizations detected.
                </p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
