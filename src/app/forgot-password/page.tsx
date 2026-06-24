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
    <main className="relative min-h-screen w-full flex items-center justify-center py-12 px-2 sm:px-4 lg:px-6 overflow-x-hidden overflow-y-auto bg-transparent">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[520px] animate-slide-up">
        <Link
          href="/login"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-[4px] group"
        >
          <div className="w-8 h-8 rounded-sm bg-white/60 backdrop-blur-sm border border-border flex items-center justify-center group-hover:bg-white group-hover:border-hairline-strong shadow-sm">
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </div>
          <span>Back to sign in</span>
        </Link>

        <div className="mb-8 flex justify-center">
          <span className="ui-eyebrow text-muted/70">
            AVTIVE
          </span>
        </div>

        <div className="card-base glass-panel rounded-xl p-8 sm:p-12">
          {sent ? (
            <div className="flex flex-col items-center text-center gap-6 py-6">
              <div className="w-14 h-14 rounded-sm bg-brand-yellow/20 flex items-center justify-center text-ink">
                <Mail size={26} />
              </div>
              <div className="flex flex-col gap-4">
                <h1 className="text-2xl font-bold text-heading tracking-tight leading-tight">Check your inbox</h1>
                <p className="text-base text-muted leading-[1.55] max-w-[320px]">
                  If an account exists for <span className="font-semibold text-heading">{email}</span>, we sent a reset link. Click it to set a new password.
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
                <h1 className="text-2xl font-bold text-heading tracking-tight leading-tight">Reset your password</h1>
                <p className="text-base text-muted leading-[1.55]">
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

              <div className="flex items-center justify-center gap-1 text-sm text-muted">
                <span>Remembered it?</span>
                <Link
                  href="/login"
                  className="font-semibold text-brand-blue hover:underline underline-offset-4 transition-all"
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