import { getAdminUserById } from "@/lib/admin";
import { queryNeon, runWithRlsBypassAsync } from "@/lib/neon-db";
import { Users, Calendar, ArrowLeft, Mail, Sparkles, Rocket, TrendingUp, Target } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { getEventStatus } from "@/lib/utils";
import { isValidUuid } from "@/lib/validation/uuid";

export const revalidate = 0;

export default async function OrganizationDrillDownPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!isValidUuid(params.id)) {
    return (
      <div className="flex flex-col items-center justify-center p-20">
        <h2 className="text-2xl font-semibold tracking-[-0.03em] leading-[1.15] text-heading">Invalid Organization Id</h2>
        <Button href="/admin" variant="primary" className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    );
  }
  const user = await getAdminUserById(params.id).catch(() => null);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-20">
        <h2 className="text-2xl font-semibold tracking-[-0.03em] leading-[1.15] text-heading">Organization Not Found</h2>
        <Button href="/admin" variant="primary" className="mt-4">
          Back to Dashboard
        </Button>
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
  const events = await runWithRlsBypassAsync(() =>
    queryNeon<{
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
    ),
  );
  const eventIds = events.map(e => e.id);

  // 3. Fetch Attendees for these Events
  let attendees: Array<{ id: string; event_id: string; created_at: string }> = [];
  if (eventIds.length > 0) {
    attendees = await runWithRlsBypassAsync(() =>
      queryNeon<{ id: string; event_id: string; created_at: string }>(
        `SELECT id, event_id, created_at
         FROM public.attendees
         WHERE event_id = ANY($1::uuid[])`,
        [eventIds],
      ),
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
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-heading tracking-tight leading-[1.1] flex items-center gap-3 break-words min-w-0" style={{ fontWeight: 700 }}>
              {profile?.organization_name || "Organization Overview"}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary-strong bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20">
                @{profile?.username || user?.username || "unknown"}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted bg-surface px-2.5 py-1 rounded-md border border-border flex items-center gap-1.5">
                <Calendar size={14} /> {events.length} Campaigns
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted bg-surface px-2.5 py-1 rounded-md border border-border flex items-center gap-1.5">
                <Users size={14} /> {attendees.length} Members
              </span>
              <div className="h-4 w-px bg-border/60 mx-1 hidden sm:block" />
              <p className="text-sm text-muted font-normal flex items-center gap-2">
                <Mail size={16} /> {user?.emailAddresses?.[0]?.emailAddress || "unknown"}
              </p>
            </div>
          </div>
          <Button
            href={`/dashboard?impersonate=${user.id}`}
            variant="secondary"
            className="w-full justify-center sm:w-auto sm:min-w-[12rem]"
            icon={<Sparkles size={16} />}
          >
            View as Organization
          </Button>
        </div>
      </div>



      {/* Premium Event Performance Grid */}
      <div className="card-base mb-10 p-6">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15] flex items-center gap-3">
              <TrendingUp className="text-primary-strong" size={28} />
              Operational Scorecard
            </h2>
            <p className="text-sm text-muted font-normal mt-1">Detailed breakdown of recent event engagement levels.</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-semibold uppercase tracking-wide px-2.5 py-1.5 rounded-sm border border-primary/20 bg-primary/5 text-primary-strong shadow-xs">
              Last 30 Days
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="card-primary group flex flex-col gap-6 p-8">
            <div className="flex items-center justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-md border border-primary/25 bg-primary/12 text-primary-strong">
                <Rocket size={26} />
              </div>
              <span className="ui-label-primary px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20">Active Velocity</span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-5xl font-medium text-heading tracking-[-0.01em] leading-[1.02]">{recentEventsCount}</span>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Recent Campaigns</span>
                <span className="text-[13px] font-medium text-muted/60 opacity-80 leading-tight">New events successfully launched within the last 30 days.</span>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/10 mt-2">
              <div className="h-full bg-primary rounded-full w-2/3 animate-pulse" />
            </div>
          </div>

          <div className="card-primary group flex flex-col gap-6 p-8">
            <div className="flex items-center justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-md border border-primary/25 bg-primary/12 text-primary-strong">
                <TrendingUp size={26} />
              </div>
              <span className="ui-label-primary px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20">Network Impact</span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-5xl font-medium text-heading tracking-[-0.01em] leading-[1.02] group-hover:text-ink transition-colors">{newAttendeesCount}</span>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">New Connections</span>
                <span className="text-[13px] font-medium text-muted/60 opacity-80 leading-tight">Newly registered attendees engaged across recent campaigns (30d).</span>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/10 mt-2">
              <div className="h-full bg-primary rounded-full w-3/4 animate-pulse" />
            </div>
          </div>

          <div className="card-primary group flex flex-col gap-6 p-8">
            <div className="flex items-center justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-md border border-primary/25 bg-primary/12 text-primary-strong">
                <Target size={26} />
              </div>
              <span className="ui-label-primary px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20">Engagement Core</span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-5xl font-medium text-heading tracking-[-0.01em] leading-[1.02]">{avgGrowthRate}</span>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Avg / Recent Campaign</span>
                <span className="text-[13px] font-medium text-muted/60 opacity-80 leading-tight">Average attendee acquisition rate per recently launched campaign.</span>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/10 mt-2">
              <div className="h-full bg-primary rounded-full w-1/2 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15] pl-2 flex items-center gap-3">
          <Calendar size={28} className="text-primary" />
          Hosted Events
        </h2>
        
        <div className="overflow-hidden rounded-2xl border border-border/40 bg-white shadow-md">
          <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[900px] text-left border-collapse">
            <thead>
              <tr className="bg-surface border-b border-border text-xs font-semibold uppercase tracking-wide leading-tight text-muted">
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
                    <td className="py-5 px-6 font-medium text-heading text-sm">{evt.name}</td>
                    <td className="py-5 px-6 text-muted text-sm font-normal">{evt.date}</td>
                    <td className="py-5 px-6 text-muted text-sm font-normal truncate max-w-[200px]">{evt.location}</td>
                    <td className="py-5 px-6">
                      <span className={`text-xs font-semibold tracking-wide leading-tight px-2.5 py-1 rounded-md border ${status.classes}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-5 px-6 text-center">
                      <span className="inline-flex items-center justify-center bg-heading/10 text-heading font-semibold px-3 py-1.5 rounded-md text-sm leading-tight">
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
