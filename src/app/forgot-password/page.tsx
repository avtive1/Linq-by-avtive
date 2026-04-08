"use client";
import { useState } from "react";
import Link from "next/link";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button } from "@/components/ui";
import { supabase } from "@/lib/supabase";
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
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (resetError) throw resetError;

      setSent(true);
      toast.success("Reset link sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center py-6 px-4 sm:px-6 overflow-hidden bg-transparent">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[420px] animate-slide-up">
        <Link
          href="/login"
          className="absolute -top-12 left-0 flex items-center gap-2 text-sm font-medium text-muted hover:text-primary-strong transition-all group"
        >
          <div className="w-8 h-8 rounded-full bg-white/50 backdrop-blur-sm border border-border flex items-center justify-center group-hover:bg-white group-hover:border-primary/20 shadow-sm">
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </div>
          <span>Back to sign in</span>
        </Link>

        <div className="mb-6 flex justify-center">
          <span className="text-[12px] font-bold tracking-[0.2em] text-muted/30 uppercase">
            AVTIVE
          </span>
        </div>

        <div className="glass-panel rounded-[32px] p-6 sm:p-8 shadow-2xl shadow-primary/5">
          {sent ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center text-primary-strong">
                <Mail size={26} />
              </div>
              <div className="flex flex-col gap-1.5">
                <h1 className="text-xl font-bold text-heading tracking-tight">Check your inbox</h1>
                <p className="text-sm text-muted leading-relaxed max-w-[320px]">
                  If an account exists for <span className="font-semibold text-heading">{email}</span>, we sent a reset link. Click it to set a new password.
                </p>
              </div>
              <Link href="/login" className="w-full mt-2">
                <Button variant="primary" fullWidth size="lg" className="h-12 text-base shadow-lg shadow-primary/20">
                  Back to sign in
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <h1 className="text-xl font-bold text-heading tracking-tight">Reset your password</h1>
                <p className="text-sm text-muted leading-relaxed">
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
                className="h-12 text-base shadow-lg shadow-primary/20"
              >
                {isSubmitting ? "Sending..." : "Send reset link"}
              </Button>

              <div className="flex items-center justify-center gap-1 text-sm text-muted">
                <span>Remembered it?</span>
                <Link
                  href="/login"
                  className="font-semibold text-primary-strong hover:underline underline-offset-4 transition-all"
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
}
//