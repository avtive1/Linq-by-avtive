import { getAdminUserById } from "@/lib/admin";
import { queryNeon } from "@/lib/neon-db";
import { Users, Calendar, ArrowLeft, Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { getEventStatus } from "@/lib/utils";
import { isValidUuid } from "@/lib/validation/uuid";

export const revalidate = 0;

export default async function OrganizationDrillDownPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!isValidUuid(params.id)) {
    return (
      <div className="flex flex-col items-center justify-center p-20">
        <h2 className="text-2xl font-semibold tracking-[-0.03em] leading-[1.15] text-heading">Invalid Organization Id</h2>
        <Link href="/admin">
          <button className="mt-4 px-6 py-2 bg-primary text-primary-foreground border border-primary rounded-md text-sm leading-[1.25] font-medium tracking-[0.01em] transition-all duration-150 hover:brightness-95 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">Back to Dashboard</button>
        </Link>
      </div>
    );
  }
  const user = await getAdminUserById(params.id).catch(() => null);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-20">
        <h2 className="text-2xl font-semibold tracking-[-0.03em] leading-[1.15] text-heading">Organization Not Found</h2>
        <Link href="/admin">
          <button className="mt-4 px-6 py-2 bg-primary text-primary-foreground border border-primary rounded-md text-sm leading-[1.25] font-medium tracking-[0.01em] transition-all duration-150 hover:brightness-95 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">Back to Dashboard</button>
        </Link>
      </div>
    );
  }

  // 1.5 Fetch Profile Details (for username and organization name)
  const [profile] = await queryNeon<{
    id: string;
    username: string | null;
    organization_name: string | null;
  }>(
    `SELECT id, username, organization_name
     FROM public.profiles
     WHERE id = $1
     LIMIT 1`,
    [user.id],
  );

  // 2. Fetch Events for this User
  const events = await queryNeon<{
    id: string;
    user_id: string;
    name: string;
    date: string;
    location: string;
    created_at: string;
  }>(
    `SELECT id, user_id, name, date, location, created_at
     FROM public.events
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [user.id],
  );
  const eventIds = events.map(e => e.id);

  // 3. Fetch Attendees for these Events
  let attendees: Array<{ id: string; event_id: string }> = [];
  if (eventIds.length > 0) {
    attendees = await queryNeon<{ id: string; event_id: string }>(
      `SELECT id, event_id
       FROM public.attendees
       WHERE event_id = ANY($1::uuid[])`,
      [eventIds],
    );
  }

  // Count Attendees per Event
  const attendeeCountsByEvent = new Map();
  attendees.forEach(a => {
    attendeeCountsByEvent.set(a.event_id, (attendeeCountsByEvent.get(a.event_id) || 0) + 1);
  });

  const totalEvents = events.length;
  const totalAttendees = attendees.length;
  const avgAttendeesPerEvent = totalEvents > 0 ? (totalAttendees / totalEvents).toFixed(1) : "0.0";
  const maxAttendeesOnEvent = events.reduce(
    (max, evt) => Math.max(max, Number(attendeeCountsByEvent.get(evt.id) || 0)),
    0,
  );
  const chartRows = events.slice(0, 6).map((evt) => ({
    id: evt.id,
    name: evt.name,
    attendees: Number(attendeeCountsByEvent.get(evt.id) || 0),
    date: evt.date,
  }));
  const chartMax = Math.max(...chartRows.map((r) => r.attendees), 1);

  return (
    <div className="px-2 sm:px-4 lg:px-6 py-12 sm:py-16">
      <Link href="/admin" className="flex items-center gap-2 text-sm font-medium text-muted hover:text-primary hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-md w-fit mb-6">
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>

      <div className="flex flex-col gap-2 mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-semibold text-heading tracking-[-0.03em] leading-[1.1] flex items-center gap-3">
              {profile?.organization_name || "Organization Details"}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
              <span className="text-[12px] leading-[1.2] text-primary-strong bg-primary/10 px-2.5 py-0.5 rounded-sm">
                @{profile?.username || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "unknown"}
              </span>
              <p className="text-muted flex items-center gap-2">
                <Mail size={16} /> {user?.emailAddresses?.[0]?.emailAddress || "unknown"}
              </p>
            </div>
          </div>
          <Link 
            href={`/dashboard?impersonate=${user.id}`}
            className="flex items-center justify-center gap-2 bg-primary-strong/10 text-primary-strong border border-primary/30 px-5 py-2 rounded-md text-sm leading-[1.25] font-medium tracking-[0.01em] hover:bg-primary/20 transition-all active:scale-[0.97]"
          >
            <Sparkles size={18} />
            View as Organization
          </Link>
        </div>
      </div>

      {/* Organization Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="glass-panel p-6 rounded-lg flex items-center gap-6 group hover:bg-white transition-all shadow-sm">
          <div className="w-16 h-16 rounded-sm bg-info/15 flex items-center justify-center text-info shrink-0">
            <Calendar size={28} />
          </div>
          <div className="flex flex-col">
            <span className="ui-eyebrow mb-1">Events Hosted</span>
            <span className="text-5xl font-semibold text-heading tracking-[-0.03em] leading-[1.02]">{totalEvents}</span>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-lg flex items-center gap-6 group hover:bg-white transition-all shadow-sm">
          <div className="w-16 h-16 rounded-sm bg-heading/15 flex items-center justify-center text-heading shrink-0">
            <Users size={28} />
          </div>
          <div className="flex flex-col">
            <span className="ui-eyebrow mb-1">Total Attendees</span>
            <span className="text-5xl font-semibold text-heading tracking-[-0.03em] leading-[1.02]">{totalAttendees}</span>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-lg flex items-center gap-6 group hover:bg-white transition-all shadow-sm">
          <div className="w-16 h-16 rounded-sm bg-primary/15 flex items-center justify-center text-primary-strong shrink-0">
            <Users size={28} />
          </div>
          <div className="flex flex-col">
            <span className="ui-eyebrow mb-1">Avg Attendees / Event</span>
            <span className="text-5xl font-semibold text-heading tracking-[-0.03em] leading-[1.02]">{avgAttendeesPerEvent}</span>
            <span className="text-xs text-muted mt-1">Peak on one event: {maxAttendeesOnEvent}</span>
          </div>
        </div>
      </div>

      {/* Lightweight performance chart without dependencies */}
      <div className="glass-panel p-6 rounded-lg mb-12">
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">
            Event Performance Snapshot
          </h2>
          <span className="text-xs px-3 py-1 rounded-full border border-border/60 bg-white text-muted">
            Last {chartRows.length} events
          </span>
        </div>

        {chartRows.length === 0 ? (
          <p className="text-sm text-muted">No events available yet for chart insights.</p>
        ) : (
          <div className="space-y-3">
            {chartRows.map((row) => {
              const width = Math.max(8, Math.round((row.attendees / chartMax) * 100));
              return (
                <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_70px] items-center gap-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="truncate text-heading font-medium">{row.name}</span>
                      <span className="text-muted text-xs ml-3">{row.date}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-heading/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-primary to-primary-strong motion-token-hover"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right text-sm font-semibold text-heading">{row.attendees}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Events Table */}
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15] pl-2">Hosted Events</h2>
        
        <div className="bg-white/50 backdrop-blur-md rounded-xl border border-border/50 overflow-hidden shadow-sm">
          <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[900px] text-left border-collapse">
            <thead>
              <tr className="bg-surface border-b border-border text-[13px] font-normal tracking-[0.01em] leading-[1.25] text-muted">
                <th className="py-4 px-6 font-medium">Event Name</th>
                <th className="py-4 px-6 font-medium">Date</th>
                <th className="py-4 px-6 font-medium">Location</th>
                <th className="py-4 px-6 font-medium">Status</th>
                <th className="py-4 px-6 font-medium text-center">Attendees</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {events.map((evt) => {
                const status = getEventStatus(evt.date);
                const aCount = attendeeCountsByEvent.get(evt.id) || 0;
                
                return (
                  <tr key={evt.id} className={`hover:bg-white transition-colors cursor-default ${status.label === 'Past' ? 'opacity-70' : ''}`}>
                    <td className="py-4 px-6 font-normal text-heading text-sm">{evt.name}</td>
                    <td className="py-4 px-6 text-muted text-sm">{evt.date}</td>
                    <td className="py-4 px-6 text-muted text-sm truncate max-w-[200px]">{evt.location}</td>
                    <td className="py-4 px-6">
                      <span className={`text-[13px] font-medium tracking-[0.01em] leading-[1.25] px-2 py-1 rounded-md border ${status.classes}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center justify-center bg-heading/10 text-heading font-medium px-3 py-1 rounded-md text-sm leading-[1.25]">
                        {aCount}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted">This organization hasn&apos;t hosted any events yet.</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}
