"use client";

import { useEffect } from "react";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";
import { AlertTriangle } from "lucide-react";
import { logger } from "@/lib/logger-client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error({ err: error, digest: error.digest }, "Global app error");
  }, [error]);

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-8 text-center bg-transparent">
      <GradientBackground />
      <div className="relative z-10 flex flex-col items-center gap-5 card-base glass-panel p-10 rounded-xl max-w-md animate-slide-up">
        <div className="w-12 h-12 rounded-full bg-danger/15 flex items-center justify-center text-danger">
          <AlertTriangle size={24} />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-heading">Something went wrong</h1>
          <p className="text-sm text-muted">
            We hit an unexpected error. You can retry or return to the dashboard.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <Button href="/dashboard" variant="secondary">
            Go to Dashboard
          </Button>
        </div>
      </div>
    </main>
  );
}
