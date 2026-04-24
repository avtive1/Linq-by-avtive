import { getAdminUserById } from "@/lib/admin";
import { queryNeon } from "@/lib/neon-db";
import { Users, Calendar, ArrowLeft, Mail, Sparkles, ExternalLink } from "lucide-react";
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
          <button className="mt-4 px-6 py-2 bg-primary text-primary-foreground border border-primary rounded-md text-sm leading-tight font-medium tracking-[0.01em] transition-all duration-150 hover:brightness-95 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">Back to Dashboard</button>
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
          <button className="mt-4 px-6 py-2 bg-primary text-primary-foreground border border-primary rounded-md text-sm leading-tight font-medium tracking-[0.01em] transition-all duration-150 hover:brightness-95 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">Back to Dashboard</button>
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
            className="flex items-center justify-center gap-2 bg-primary-strong/10 text-primary-strong border border-primary/30 px-5 py-2 rounded-md text-sm leading-tight font-medium tracking-[0.01em] hover:bg-primary/20 transition-all active:scale-[0.97]"
          >
            <Sparkles size={18} />
            View as Organization
          </Link>
        </div>
      </div>

      {/* Organization Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="group relative overflow-hidden bg-linear-to-br from-white via-white/95 to-info/5 border border-border/40 p-6 rounded-2xl flex items-center gap-6 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
          <div className="relative z-10 w-16 h-16 rounded-xl bg-info/15 flex items-center justify-center text-info shrink-0 shadow-inner group-hover:scale-110 transition-transform">
            <Calendar size={32} strokeWidth={2} />
          </div>
          <div className="relative z-10 flex flex-col">
            <span className="text-[12px] font-black uppercase tracking-[0.15em] text-muted leading-tight mb-1">Events Hosted</span>
            <span className="text-6xl font-black text-heading tracking-tight leading-none">{totalEvents}</span>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-linear-to-br from-white via-white/95 to-primary/5 border border-border/40 p-6 rounded-2xl flex items-center gap-6 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
          <div className="relative z-10 w-16 h-16 rounded-xl bg-heading/10 flex items-center justify-center text-heading shrink-0 shadow-inner group-hover:scale-110 transition-transform">
            <Users size={32} strokeWidth={2} />
          </div>
          <div className="relative z-10 flex flex-col">
            <span className="text-[12px] font-black uppercase tracking-[0.15em] text-muted leading-tight mb-1">Total Attendees</span>
            <span className="text-6xl font-black text-heading tracking-tight leading-none">{totalAttendees}</span>
          </div>
        </div>

        <div className="group relative overflow-hidden bg-linear-to-br from-white via-white/95 to-primary/10 border border-border/40 p-6 rounded-2xl flex items-center gap-6 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
          <div className="relative z-10 w-16 h-16 rounded-xl bg-primary/15 flex items-center justify-center text-primary-strong shrink-0 shadow-inner group-hover:scale-110 transition-transform">
            <Users size={32} strokeWidth={2} />
          </div>
          <div className="relative z-10 flex flex-col">
            <span className="text-[12px] font-black uppercase tracking-[0.15em] text-muted leading-tight mb-1">Avg Attendees</span>
            <span className="text-6xl font-black text-heading tracking-tight leading-none">{avgAttendeesPerEvent}</span>
          </div>
        </div>
      </div>

      {/* Premium Event Performance Grid */}
      <div className="glass-panel p-6 rounded-2xl mb-10 relative overflow-hidden shadow-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 relative z-10">
          <div className="flex flex-col gap-1">
            <h2 className="text-4xl font-black text-heading tracking-tight leading-none flex items-center gap-3">
              <Sparkles className="text-primary-strong" size={28} />
              Event Performance Snapshot
            </h2>
            <p className="text-[14px] text-muted font-medium mt-1">Detailed breakdown of recent event engagement levels.</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[12px] font-black uppercase tracking-[0.1em] px-3 py-1.5 rounded-sm border border-primary/20 bg-primary/5 text-primary-strong shadow-xs">
              Last {chartRows.length} events
            </span>
          </div>
        </div>

        {chartRows.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center gap-3 bg-surface/50 rounded-lg border border-dashed border-border">
            <Calendar className="text-muted/30" size={48} />
            <p className="text-sm text-muted font-medium">No events hosted yet. Performance insights will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {chartRows.map((row, idx) => {
              const width = Math.max(12, Math.round((row.attendees / chartMax) * 100));
              return (
                <Link
                  key={row.id} 
                  href={`/dashboard/events/${row.id}?impersonate=${user.id}`}
                  className="group relative bg-white border border-border/40 hover:border-primary/40 rounded-2xl p-6 transition-all duration-500 hover:shadow-md hover:-translate-y-1 block overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-5 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 -translate-y-2 group-hover:translate-x-0 group-hover:translate-y-0 z-20">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary-strong shadow-sm border border-primary/20">
                      <ExternalLink size={18} strokeWidth={2.5} />
                    </div>
                  </div>

                  <div className="flex flex-col h-full justify-between relative z-10">
                    <div className="flex flex-col gap-1 mb-6">
                      <span className="text-[12px] font-black text-primary-strong uppercase tracking-[0.15em] leading-none mb-1.5">
                        {new Date(row.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <h3 className="text-xl font-black text-heading leading-tight line-clamp-2 min-h-[3rem] group-hover:text-primary-strong transition-colors">
                        {row.name}
                      </h3>
                    </div>

                    <div className="flex items-end justify-between gap-4 mt-auto">
                      <div className="flex flex-col">
                        <span className="text-5xl font-black text-heading tracking-tight leading-none group-hover:text-primary-strong transition-colors">
                          {row.attendees}
                        </span>
                        <span className="text-[12px] font-black text-muted/50 uppercase tracking-[0.15em] mt-2">
                          Attendees
                        </span>
                      </div>
                      <div className="w-24 h-2 bg-heading/5 rounded-full overflow-hidden shadow-inner shrink-0 mb-1">
                        <div 
                          className="h-full bg-linear-to-r from-primary to-primary-strong rounded-full shadow-[0_0_8px_rgba(var(--primary),0.3)]" 
                          style={{ width: `${width}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-3xl font-black text-heading tracking-tight leading-none pl-2 flex items-center gap-3">
          <Calendar size={28} className="text-primary" />
          Hosted Events
        </h2>
        
        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-border/40 overflow-hidden shadow-md">
          <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[900px] text-left border-collapse">
            <thead>
              <tr className="bg-surface border-b border-border text-[12px] font-black uppercase tracking-[0.08em] leading-tight text-muted">
                <th className="py-3.5 px-6 font-medium">Event Name</th>
                <th className="py-3.5 px-6 font-medium">Date</th>
                <th className="py-3.5 px-6 font-medium">Location</th>
                <th className="py-3.5 px-6 font-medium">Status</th>
                <th className="py-3.5 px-6 font-medium text-center">Attendees</th>
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
                      <span className={`text-[13px] font-medium tracking-[0.01em] leading-tight px-2 py-1 rounded-md border ${status.classes}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center justify-center bg-heading/10 text-heading font-medium px-3 py-1 rounded-md text-sm leading-tight">
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
