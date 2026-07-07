"use client";
import { useState } from "react";
import Link from "next/link";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button } from "@/components/ui";
import { ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Email is required");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Invalid email format");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(payload?.error || "Failed to send reset email."));
      }

      setSent(true);
      toast.success("If the account exists, a reset email has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center py-12 px-2 sm:px-4 lg:px-6 overflow-x-hidden overflow-y-auto bg-surface">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[520px] animate-slide-up">
        <Link
          href="/login"
          className="mb-5 inline-flex items-center gap-2 text-[13px] font-normal text-text-muted hover:text-text-primary hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-indigo/30 focus-visible:ring-offset-2 rounded-lg group"
        >
          <div className="w-9 h-9 rounded-lg bg-canvas/80 backdrop-blur-sm border border-border flex items-center justify-center group-hover:bg-canvas group-hover:border-border shadow-sm">
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform text-text-primary" />
          </div>
          <span>Back to sign in</span>
        </Link>

        <div className="mb-6 flex justify-center">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-xmuted">AVTIVE</span>
        </div>

        <div className="rounded-lg border border-border bg-canvas p-8 sm:p-12 shadow-[0_12px_32px_rgba(90,79,207,0.10)]">
          {sent ? (
            <div className="flex flex-col items-center text-center gap-6 py-6">
              <div className="w-14 h-14 rounded-lg bg-royal-indigo/10 flex items-center justify-center text-text-primary">
                <Mail size={26} />
              </div>
              <div className="flex flex-col gap-4">
                <h1 className="text-[32px] font-medium text-text-primary tracking-[-0.01em] leading-[1.15]">
                  Check your inbox
                </h1>
                <p className="text-[15px] text-text-muted leading-[1.65] max-w-[360px]">
                  If an account exists for <span className="font-medium text-text-primary">{email}</span>, we sent a reset link. Click it to set a new password.
                </p>
              </div>
              <Button
                href="/login"
                variant="primary"
                fullWidth
                size="lg"
                className="mt-2"
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-8">
              <div className="flex flex-col gap-4">
                <h1 className="text-[32px] font-medium text-text-primary tracking-[-0.01em] leading-[1.15]">
                  Reset your password
                </h1>
                <p className="text-[15px] text-text-muted leading-[1.65]">
                  Enter your email and we&apos;ll send you a link to reset it.
                </p>
              </div>

              <TextInput
                label="Email Address"
                required
                type="email"
                placeholder="you@example.com"
                icon="email"
                value={email}
                error={error}
                onChange={(v) => { setEmail(v); if (error) setError(""); }}
              />

              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending..." : "Send reset link"}
              </Button>

              <div className="flex items-center justify-center gap-1 text-[13px] text-text-muted">
                <span>Remembered it?</span>
                <Link
                  href="/login"
                  className="font-medium text-royal-indigo hover:underline underline-offset-4 transition-all"
                >
                  Sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}//