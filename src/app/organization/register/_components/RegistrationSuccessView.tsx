"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface RegistrationSuccessViewProps {
  referenceNumber: string;
  organizationName: string;
  contactEmail: string;
}

export function RegistrationSuccessView({
  referenceNumber,
  organizationName,
  contactEmail,
}: RegistrationSuccessViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyRef = async () => {
    try {
      await navigator.clipboard.writeText(referenceNumber);
      setCopied(true);
      toast.success("Reference number copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.info(`Reference: ${referenceNumber}`);
    }
  };

  return (
    <Card className="w-full max-w-xl mx-auto p-6 sm:p-8 border-hairline-soft bg-white shadow-md animate-slide-up text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50 mb-5">
        <CheckCircle2 size={36} strokeWidth={2.2} />
      </div>

      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1 mb-3">
        Registration Submitted
      </Badge>

      <h1 className="text-2xl sm:text-3xl font-bold text-heading tracking-tight">
        Thank You for Registering
      </h1>

      <p className="text-sm text-muted max-w-md mx-auto mt-2 leading-relaxed">
        Your registration request for <strong className="text-heading font-semibold">{organizationName}</strong> has been received and is now pending review by our team.
      </p>

      {/* Reference Box */}
      <div className="my-6 rounded-xl border border-hairline-soft bg-surface/60 p-4 sm:p-5 text-left">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Reference Number</span>
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[11px] font-semibold gap-1.5">
            <Clock size={12} />
            Pending Review
          </Badge>
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-hairline-soft">
          <span className="font-mono text-lg sm:text-xl font-bold tracking-wider text-primary">
            {referenceNumber}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyRef}
            className="h-8 gap-1.5 text-xs border-hairline-strong font-medium hover:bg-white"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-600" />
                Copied
              </>
            ) : (
              <>
                <Copy size={14} />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Next Steps Timeline */}
      <div className="text-left border-t border-hairline-soft pt-5 mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Expected Next Steps</h3>
        <ul className="space-y-3 text-sm text-ink">
          <li className="flex items-start gap-3">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[10px] mt-0.5">
              1
            </div>
            <span>
              <strong>Administrative Review:</strong> Our operations team will verify your organization credentials within 1-2 business days.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[10px] mt-0.5">
              2
            </div>
            <span>
              <strong>Email Notification:</strong> Confirmation and credentials will be sent directly to <strong className="text-heading font-medium">{contactEmail}</strong>.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[10px] mt-0.5">
              3
            </div>
            <span>
              <strong>Console Activation:</strong> Once approved, sign in to unlock event management, custom badge templates, and lead analytics.
            </span>
          </li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link href={`/organization/status?ref=${encodeURIComponent(referenceNumber)}`} className="w-full sm:w-auto">
          <Button variant="default" className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold px-6">
            Track Status
          </Button>
        </Link>
        <Link href="/" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto border-hairline-strong font-medium">
            Return to Home
          </Button>
        </Link>
      </div>
    </Card>
  );
}
