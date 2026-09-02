import { listOrganizationRegistrationRequests } from "@/lib/organization/registration-db";
import { OrganizationRequestsTable } from "./_components/OrganizationRequestsTable";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Clock, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

export const revalidate = 0;

export default async function AdminOrganizationRequestsPage() {
  const data = await listOrganizationRegistrationRequests({ limit: 100 });

  return (
    <div className="flex flex-col gap-6 py-6 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))] lg:pl-[max(1.5rem,env(safe-area-inset-left))] lg:pr-[max(1.5rem,env(safe-area-inset-right))]">
      {/* Header Banner */}
      <Card className="relative animate-slide-up overflow-hidden rounded-xl border border-hairline-soft bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-3">
          <Badge variant="outline" className="w-fit gap-2 border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold tracking-[0.04em] text-primary-strong">
            <ShieldCheck size={14} />
            Organization Onboarding Management
          </Badge>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-heading">
            Organization Registration Requests
          </h1>
          <p className="max-w-2xl text-sm font-normal leading-relaxed text-muted">
            Review submitted company registrations, verify branding assets, approve organization creation, or request modifications.
          </p>
        </div>
      </Card>

      {/* Metric Counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4 animate-slide-up">
        <Card className="p-4 bg-white border-hairline-soft flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted block">Pending</span>
            <span className="text-2xl font-bold text-heading">{data.counts.pending}</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border-hairline-soft flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 flex items-center justify-center shrink-0">
            <AlertCircle size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted block">Changes Req.</span>
            <span className="text-2xl font-bold text-heading">{data.counts.changes_requested}</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border-hairline-soft flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted block">Approved</span>
            <span className="text-2xl font-bold text-heading">{data.counts.approved}</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border-hairline-soft flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center justify-center shrink-0">
            <XCircle size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted block">Rejected</span>
            <span className="text-2xl font-bold text-heading">{data.counts.rejected}</span>
          </div>
        </Card>
      </div>

      {/* Main Table */}
      <div className="animate-slide-up delay-75">
        <OrganizationRequestsTable
          initialRequests={data.requests}
          initialCounts={data.counts}
        />
      </div>
    </div>
  );
}
