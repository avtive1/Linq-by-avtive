import { getAdminUserById } from "@/lib/admin";
import { queryNeon } from "@/lib/neon-db";
import { Users, Calendar, ArrowLeft, Mail, Sparkles, Rocket, TrendingUp, Target } from "lucide-react";
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
  let attendees: Array<{ id: string; event_id: string; created_at: string }> = [];
  if (eventIds.length > 0) {
    attendees = await queryNeon<{ id: string; event_id: string; created_at: string }>(
      `SELECT id, event_id, created_at
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

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentEventsCount = events.filter(e => new Date(e.created_at) >= thirtyDaysAgo).length;
  const newAttendeesCount = attendees.filter(a => new Date(a.created_at) >= thirtyDaysAgo).length;
  
  const avgGrowthRate = recentEventsCount > 0 ? (newAttendeesCount / recentEventsCount).toFixed(1) : "0";

  return (
    <div className="px-2 sm:px-4 lg:px-6 py-12 sm:py-16">
      <Link href="/admin" className="flex items-center gap-2 text-sm font-medium text-muted hover:text-primary hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-md w-fit mb-6">
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>

      <div className="flex flex-col gap-2 mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
                  <h1 className="text-4xl font-black text-heading tracking-tight leading-none flex items-center gap-3">
                    {profile?.organization_name || "Organization Overview"}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-[12px] font-black uppercase tracking-[0.1em] text-primary-strong bg-primary/10 px-3 py-1 rounded-sm border border-primary/20">
                      @{profile?.username || user?.username || "unknown"}
                    </span>
                    <span className="text-[12px] font-black uppercase tracking-[0.1em] text-muted-foreground bg-slate-100 px-3 py-1 rounded-sm border border-border flex items-center gap-1.5">
                      <Calendar size={14} /> {events.length} Campaigns
                    </span>
                    <span className="text-[12px] font-black uppercase tracking-[0.1em] text-muted-foreground bg-slate-100 px-3 py-1 rounded-sm border border-border flex items-center gap-1.5">
                      <Users size={14} /> {attendees.length} Members
                    </span>
                    <div className="h-4 w-px bg-border/60 mx-1 hidden sm:block" />
                    <p className="text-[13px] text-muted font-medium flex items-center gap-2">
                      <Mail size={16} /> {user?.email || "unknown"}
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



      {/* Premium Event Performance Grid */}
      <div className="glass-panel p-6 rounded-2xl mb-10 relative overflow-hidden shadow-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 relative z-10">
          <div className="flex flex-col gap-1">
            <h2 className="text-4xl font-black text-heading tracking-tight leading-none flex items-center gap-3">
              <TrendingUp className="text-primary-strong" size={28} />
              Operational Scorecard
            </h2>
            <p className="text-[14px] text-muted font-medium mt-1">Detailed breakdown of recent event engagement levels.</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[12px] font-black uppercase tracking-[0.1em] px-3 py-1.5 rounded-sm border border-primary/20 bg-primary/5 text-primary-strong shadow-xs">
              Last 30 Days
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="group relative overflow-hidden bg-linear-to-br from-white to-primary/5 border border-border/40 p-10 rounded-2xl flex flex-col gap-6 shadow-md transition-all duration-500 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <div className="w-16 h-16 rounded-xl bg-primary/15 flex items-center justify-center text-primary-strong shadow-inner group-hover:scale-110 transition-transform duration-500">
                <Rocket size={32} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[12px] font-black uppercase tracking-[0.2em] text-primary-strong leading-none px-3 py-1.5 rounded-sm bg-primary/10 border border-primary/20">Active Velocity</span>
              </div>
            </div>
            <div className="relative z-10 flex flex-col gap-2">
              <span className="text-7xl font-black text-heading tracking-tight leading-none group-hover:text-primary-strong transition-colors">{recentEventsCount}</span>
              <div className="flex flex-col gap-1">
                <span className="text-[12px] font-black uppercase tracking-[0.2em] text-muted">Recent Campaigns</span>
                <span className="text-[13px] font-medium text-muted/60 opacity-80 leading-tight">New events successfully launched within the last 30 days.</span>
              </div>
            </div>
            <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden relative z-10 shadow-inner mt-2">
              <div className="h-full bg-linear-to-r from-primary to-primary-strong rounded-full w-2/3 shadow-[0_0_8px_rgba(var(--primary),0.4)] animate-pulse" />
            </div>
          </div>

          <div className="group relative overflow-hidden bg-linear-to-br from-white to-info/5 border border-border/40 p-10 rounded-2xl flex flex-col gap-6 shadow-md transition-all duration-500 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-info/10 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <div className="w-16 h-16 rounded-xl bg-info/15 flex items-center justify-center text-info shadow-inner group-hover:scale-110 transition-transform duration-500">
                <TrendingUp size={32} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[12px] font-black uppercase tracking-[0.2em] text-info leading-none px-3 py-1.5 rounded-sm bg-info/10 border border-info/20">Network Impact</span>
              </div>
            </div>
            <div className="relative z-10 flex flex-col gap-2">
              <span className="text-7xl font-black text-heading tracking-tight leading-none group-hover:text-info transition-colors">{newAttendeesCount}</span>
              <div className="flex flex-col gap-1">
                <span className="text-[12px] font-black uppercase tracking-[0.2em] text-muted">New Connections</span>
                <span className="text-[13px] font-medium text-muted/60 opacity-80 leading-tight">Newly registered attendees engaged across recent campaigns (30d).</span>
              </div>
            </div>
            <div className="h-1.5 w-full bg-info/10 rounded-full overflow-hidden relative z-10 shadow-inner mt-2">
              <div className="h-full bg-linear-to-r from-info to-[#0ea5e9] rounded-full w-3/4 shadow-[0_0_8px_rgba(14,165,233,0.4)] animate-pulse" />
            </div>
          </div>

          <div className="group relative overflow-hidden bg-linear-to-br from-white to-heading/5 border border-border/40 p-10 rounded-2xl flex flex-col gap-6 shadow-md transition-all duration-500 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-heading/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <div className="w-16 h-16 rounded-xl bg-heading/10 flex items-center justify-center text-heading shadow-inner group-hover:scale-110 transition-transform duration-500">
                <Target size={32} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[12px] font-black uppercase tracking-[0.2em] text-heading leading-none px-3 py-1.5 rounded-sm bg-heading/10 border border-heading/20">Engagement Core</span>
              </div>
            </div>
            <div className="relative z-10 flex flex-col gap-2">
              <span className="text-7xl font-black text-heading tracking-tight leading-none">{avgGrowthRate}</span>
              <div className="flex flex-col gap-1">
                <span className="text-[12px] font-black uppercase tracking-[0.2em] text-muted">Avg / Recent Campaign</span>
                <span className="text-[13px] font-medium text-muted/60 opacity-80 leading-tight">Average attendee acquisition rate per recently launched campaign.</span>
              </div>
            </div>
            <div className="h-1.5 w-full bg-heading/10 rounded-full overflow-hidden relative z-10 shadow-inner mt-2">
              <div className="h-full bg-linear-to-r from-heading to-[#1e293b] rounded-full w-1/2 shadow-[0_0_8px_rgba(0,0,0,0.2)] animate-pulse" />
            </div>
          </div>
        </div>
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
