import { getAdminClient } from "@/lib/admin";
import { Users, BarChart3, Building2, ChevronRight, Activity, TrendingUp } from "lucide-react";
import Link from "next/link";
import OrganizationsTable from "./_components/OrganizationsTable";

export const revalidate = 0; // Ensures this page is always fresh when loaded by admin

export default async function AdminDashboardPage() {
  const adminClient = getAdminClient();

  // 1. Fetch All Organizations (Users)
  const { data: userData, error: userError } = await adminClient.auth.admin.listUsers();
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const rawUsers = (userData?.users || []).filter(u => u.email?.toLowerCase().trim() !== adminEmail);

  // 2. Fetch All Events
  const { data: events, error: eventError } = await adminClient
    .from("events")
    .select("id, user_id, name, created_at, date, location")
    .order("created_at", { ascending: false });
  const rawEvents = events || [];

  // 3. Fetch All Attendees
  const { data: attendees, error: attendeeError } = await adminClient.from("attendees").select("id, event_id, created_at");
  const rawAttendees = attendees || [];

  // 4. Fetch All Profiles (for usernames)
  const { data: profiles, error: profileError } = await adminClient.from("profiles").select("*");
  const profileLookup = new Map();
  (profiles || []).forEach(p => profileLookup.set(p.id, p));

  // Growth Stats (Last 7 Days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const newOrgsLastWeek = rawUsers.filter(u => new Date(u.created_at) > sevenDaysAgo).length;
  const newEventsLastWeek = rawEvents.filter(e => new Date(e.created_at) > sevenDaysAgo).length;
  const newAttendeesLastWeek = rawAttendees.filter(a => new Date(a.created_at) > sevenDaysAgo).length;

  // Aggregate Data
  const totalOrgs = rawUsers.length;
  const totalEvents = rawEvents.length;
  const totalAttendees = rawAttendees.length;

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

  const organizations = Array.from(orgMap.values()) as any[];

  // Recent Activity Feed
  const recentEvents = rawEvents.slice(0, 5).map(evt => {
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
    <div className="px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold text-heading tracking-tight">Platform Overview</h1>
        <p className="text-muted">Real-time global insights and management hub.</p>
      </div>

      {/* Global Metrics Row with Growth Badges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-lg flex items-center gap-6 group hover:bg-white transition-all shadow-sm relative overflow-hidden">
          <div className="w-16 h-16 rounded-sm bg-primary/20 flex items-center justify-center text-primary-strong shrink-0">
            <Building2 size={28} />
          </div>
          <div className="flex flex-col">
            <span className="ui-eyebrow mb-1">Total Orgs</span>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-heading tracking-tight leading-none">{totalOrgs}</span>
              {newOrgsLastWeek > 0 && (
                <span className="flex items-center gap-0.5 text-xs font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-sm">
                  <TrendingUp size={12} /> +{newOrgsLastWeek}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-lg flex items-center gap-6 group hover:bg-white transition-all shadow-sm">
          <div className="w-16 h-16 rounded-sm bg-info/15 flex items-center justify-center text-info shrink-0">
            <BarChart3 size={28} />
          </div>
          <div className="flex flex-col">
            <span className="ui-eyebrow mb-1">Total Events</span>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-heading tracking-tight leading-none">{totalEvents}</span>
              {newEventsLastWeek > 0 && (
                <span className="flex items-center gap-0.5 text-xs font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-sm">
                  <TrendingUp size={12} /> +{newEventsLastWeek}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-lg flex items-center gap-6 group hover:bg-white transition-all shadow-sm">
          <div className="w-16 h-16 rounded-sm bg-heading/15 flex items-center justify-center text-heading shrink-0">
            <Users size={28} />
          </div>
          <div className="flex flex-col">
            <span className="ui-eyebrow mb-1">Total Attendees</span>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-heading tracking-tight leading-none">{totalAttendees}</span>
              {newAttendeesLastWeek > 0 && (
                <span className="flex items-center gap-0.5 text-xs font-bold text-primary-strong bg-primary/10 px-1.5 py-0.5 rounded-sm">
                  <TrendingUp size={12} /> +{newAttendeesLastWeek}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content: Organizations Table */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <h2 className="text-2xl font-bold text-heading tracking-tight pl-2 flex items-center gap-2">
            Organizations Directory
          </h2>
          <OrganizationsTable initialOrganizations={organizations} />
        </div>

        {/* Sidebar: Recent Activity */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <h2 className="text-2xl font-bold text-heading tracking-tight pl-2 flex items-center gap-2">
             <Activity size={24} className="text-primary-strong" /> Recent Activity
          </h2>
          
          <div className="flex flex-col gap-4">
            {recentEvents.map(evt => (
              <div key={evt.id} className="glass-panel p-4 rounded-lg flex flex-col gap-2 hover:bg-white transition-all group">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-muted/60 bg-surface px-2 py-0.5 rounded-sm border border-border/40">
                    New Event
                  </span>
                  <span className="text-[10px] font-bold text-muted/50">
                    {new Date(evt.created_at).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-bold text-heading group-hover:text-primary-strong transition-colors truncate">
                  {evt.name}
                </h3>
                <p className="text-xs text-muted font-medium flex items-center gap-1.5 truncate">
                  <Building2 size={12} className="shrink-0" /> 
                  {evt.orgName ? `${evt.orgName} (@${evt.username || 'unknown'})` : evt.orgEmail}
                </p>
                <div className="mt-2 pt-2 border-t border-border/30 flex justify-between items-center text-[11px] font-bold">
                  <span className="text-muted/60">{evt.location}</span>
                  <Link href={`/admin/organizations/${evt.user_id}`} className="text-primary-strong hover:underline flex items-center gap-0.5">
                    View Org <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
            {recentEvents.length === 0 && (
              <p className="text-muted text-center py-8 bg-surface/30 border border-dashed border-border rounded-xl text-sm">No recent activity detected.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
