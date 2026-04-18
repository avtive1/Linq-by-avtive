import { getAdminClient } from "@/lib/admin";
import { Users, Calendar, ArrowLeft, Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { getEventStatus } from "@/lib/utils";

export const revalidate = 0;

export default async function OrganizationDrillDownPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const adminClient = getAdminClient();

  // 1. Fetch User Details
  const { data: userResponse, error: userError } = await adminClient.auth.admin.getUserById(params.id);
  const user = userResponse?.user;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-20">
        <h2 className="text-2xl font-bold text-heading">Organization Not Found</h2>
        <Link href="/admin">
          <button className="mt-4 px-6 py-2 bg-primary text-primary-foreground border border-primary rounded-md font-semibold transition-all duration-150 hover:brightness-95 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">Back to Dashboard</button>
        </Link>
      </div>
    );
  }

  // 1.5 Fetch Profile Details (for username and organization name)
  const { data: profile } = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // 2. Fetch Events for this User
  const { data: rawEvents, error: eventError } = await adminClient
    .from("events")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  
  const events = rawEvents || [];
  const eventIds = events.map(e => e.id);

  // 3. Fetch Attendees for these Events
  let attendees: any[] = [];
  if (eventIds.length > 0) {
    const { data: attendeeData } = await adminClient
      .from("attendees")
      .select("id, event_id")
      .in("event_id", eventIds);
    attendees = attendeeData || [];
  }

  // Count Attendees per Event
  const attendeeCountsByEvent = new Map();
  attendees.forEach(a => {
    attendeeCountsByEvent.set(a.event_id, (attendeeCountsByEvent.get(a.event_id) || 0) + 1);
  });

  const totalEvents = events.length;
  const totalAttendees = attendees.length;

  return (
    <div className="px-4 sm:px-6 py-8 sm:py-12">
      <Link href="/admin" className="flex items-center gap-2 text-sm font-bold text-muted hover:text-primary hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-[4px] w-fit mb-6">
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>

      <div className="flex flex-col gap-2 mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-bold text-heading tracking-tight flex items-center gap-3">
              {profile?.organization_name || user.user_metadata?.organization_name || "Organization Details"}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
              <span className="text-primary-strong bg-primary/10 px-2 py-0.5 rounded-sm">
                @{profile?.username || user.email?.split("@")[0]}
              </span>
              <p className="text-muted flex items-center gap-2">
                <Mail size={16} /> {user.email}
              </p>
            </div>
          </div>
          <Link 
            href={`/dashboard?impersonate=${user.id}`}
            className="flex items-center justify-center gap-2 bg-primary-strong/10 text-primary-strong border border-primary/30 px-5 py-2.5 rounded-sm font-bold text-sm hover:bg-primary/20 transition-all active:scale-[0.97]"
          >
            <Sparkles size={18} />
            View as Organization
          </Link>
        </div>
      </div>

      {/* Organization Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="glass-panel p-6 rounded-lg flex items-center gap-6 group hover:bg-white transition-all shadow-sm">
          <div className="w-16 h-16 rounded-sm bg-info/15 flex items-center justify-center text-info shrink-0">
            <Calendar size={28} />
          </div>
          <div className="flex flex-col">
            <span className="ui-eyebrow mb-1">Events Hosted</span>
            <span className="text-5xl font-bold text-heading tracking-tight leading-none">{totalEvents}</span>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-lg flex items-center gap-6 group hover:bg-white transition-all shadow-sm">
          <div className="w-16 h-16 rounded-sm bg-heading/15 flex items-center justify-center text-heading shrink-0">
            <Users size={28} />
          </div>
          <div className="flex flex-col">
            <span className="ui-eyebrow mb-1">Total Attendees</span>
            <span className="text-5xl font-bold text-heading tracking-tight leading-none">{totalAttendees}</span>
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold text-heading tracking-tight pl-2">Hosted Events</h2>
        
        <div className="bg-white/50 backdrop-blur-md rounded-xl border border-border/50 overflow-hidden shadow-sm">
          <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[900px] text-left border-collapse">
            <thead>
              <tr className="bg-surface border-b border-border text-xs font-semibold tracking-[0.02em] text-muted">
                <th className="py-4 px-6 font-semibold">Event Name</th>
                <th className="py-4 px-6 font-semibold">Date</th>
                <th className="py-4 px-6 font-semibold">Location</th>
                <th className="py-4 px-6 font-semibold">Status</th>
                <th className="py-4 px-6 font-semibold text-center">Attendees</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {events.map((evt) => {
                const status = getEventStatus(evt.date);
                const aCount = attendeeCountsByEvent.get(evt.id) || 0;
                
                return (
                  <tr key={evt.id} className={`hover:bg-white transition-colors cursor-default ${status.label === 'Past' ? 'opacity-70' : ''}`}>
                    <td className="py-4 px-6 font-semibold text-heading text-sm">{evt.name}</td>
                    <td className="py-4 px-6 text-muted text-sm">{evt.date}</td>
                    <td className="py-4 px-6 text-muted text-sm truncate max-w-[200px]">{evt.location}</td>
                    <td className="py-4 px-6">
                      <span className={`text-xs font-semibold tracking-[0.03em] px-2 py-1 rounded-sm border ${status.classes}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center justify-center bg-heading/10 text-heading font-semibold px-3 py-1 rounded-sm text-sm">
                        {aCount}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted">This organization hasn't hosted any events yet.</td>
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
