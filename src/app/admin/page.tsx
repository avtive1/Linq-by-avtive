import { getAdminClient } from "@/lib/admin";
import { Users, BarChart3, Building2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AnimatedCounter } from "@/components/ui";

export const revalidate = 0; // Ensures this page is always fresh when loaded by admin

export default async function AdminDashboardPage() {
  const adminClient = getAdminClient();

  // 1. Fetch All Organizations (Users)
  const { data: userData, error: userError } = await adminClient.auth.admin.listUsers();
  const rawUsers = userData?.users || [];

  // 2. Fetch All Events
  const { data: events, error: eventError } = await adminClient.from("events").select("id, user_id");
  const rawEvents = events || [];

  // 3. Fetch All Attendees
  const { data: attendees, error: attendeeError } = await adminClient.from("attendees").select("id, event_id");
  const rawAttendees = attendees || [];

  // Aggregate Data
  const totalOrgs = rawUsers.length;
  const totalEvents = rawEvents.length;
  const totalAttendees = rawAttendees.length;

  // Build the Organization Grid Data
  const orgMap = new Map();
  rawUsers.forEach(user => {
    orgMap.set(user.id, {
      id: user.id,
      email: user.email,
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
    // Find which org owns the event
    for (const org of orgMap.values()) {
      if (org.eventIds.has(att.event_id)) {
        org.attendeeCount += 1;
        break;
      }
    }
  });

  const organizations = Array.from(orgMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex flex-col gap-2 mb-10">
        <h1 className="text-4xl font-bold text-heading tracking-tight">Platform Overview</h1>
        <p className="text-muted">Global statistics across all registered organizations.</p>
      </div>

      {/* Global Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="glass-panel p-6 rounded-[12px] flex items-center gap-6 group hover:bg-white transition-all shadow-sm">
          <div className="w-16 h-16 rounded-[10px] bg-primary/20 flex items-center justify-center text-primary-strong shrink-0">
            <Building2 size={28} />
          </div>
          <div className="flex flex-col">
            <span className="text-[12px] font-bold text-muted uppercase tracking-[0.2em] mb-1">Total Orgs</span>
            <span className="text-5xl font-bold text-heading tracking-tight">{totalOrgs}</span>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-[12px] flex items-center gap-6 group hover:bg-white transition-all shadow-sm">
          <div className="w-16 h-16 rounded-[10px] bg-teal-500/20 flex items-center justify-center text-teal-600 shrink-0">
            <BarChart3 size={28} />
          </div>
          <div className="flex flex-col">
            <span className="text-[12px] font-bold text-muted uppercase tracking-[0.2em] mb-1">Total Events</span>
            <span className="text-5xl font-bold text-heading tracking-tight">{totalEvents}</span>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-[12px] flex items-center gap-6 group hover:bg-white transition-all shadow-sm">
          <div className="w-16 h-16 rounded-[10px] bg-indigo-500/20 flex items-center justify-center text-indigo-600 shrink-0">
            <Users size={28} />
          </div>
          <div className="flex flex-col">
            <span className="text-[12px] font-bold text-muted uppercase tracking-[0.2em] mb-1">Total Attendees</span>
            <span className="text-5xl font-bold text-heading tracking-tight">{totalAttendees}</span>
          </div>
        </div>
      </div>

      {/* Organizations Directory */}
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold text-heading tracking-tight pl-2">Registered Organizations</h2>
        
        <div className="bg-white/50 backdrop-blur-md rounded-2xl border border-border/50 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface border-b border-border text-[11px] font-black uppercase tracking-[0.1em] text-muted">
                <th className="py-4 px-6 font-semibold">Email / Organization</th>
                <th className="py-4 px-6 font-semibold">Joined At</th>
                <th className="py-4 px-6 font-semibold text-center">Events Hosted</th>
                <th className="py-4 px-6 font-semibold text-center">Total Attendees</th>
                <th className="py-4 px-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {organizations.map((org) => (
                <tr key={org.id} className="hover:bg-white transition-colors group cursor-default">
                  <td className="py-4 px-6 font-bold text-heading text-[15px]">{org.email}</td>
                  <td className="py-4 px-6 text-muted text-sm">{new Date(org.created_at).toLocaleDateString()}</td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center justify-center bg-teal-500/10 text-teal-700 font-bold px-3 py-1 rounded-full text-sm">
                      {org.eventCount}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center justify-center bg-indigo-500/10 text-indigo-700 font-bold px-3 py-1 rounded-full text-sm">
                      {org.attendeeCount}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <Link href={`/admin/organizations/${org.id}`}>
                      <button className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-strong bg-primary/5 hover:bg-primary/10 px-4 py-2 rounded-lg transition-colors ml-auto">
                        Deep Dive <ChevronRight size={14} />
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
              {organizations.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted">No organizations found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
