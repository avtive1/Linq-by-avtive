"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import GradientBackground from "@/components/GradientBackground";
import { ArrowLeft, Mail, AlertCircle, Loader2, CheckCircle2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const getRedirectUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/auth/callback?next=/reset-password`;
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return `${appUrl}/auth/callback?next=/reset-password`;
  };

  const handleSendResetEmail = async (targetEmail: string) => {
    setError("");
    const trimmed = targetEmail.trim().toLowerCase();
    if (!trimmed) {
      setError("Email address is required.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const redirectTo = getRedirectUrl();

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });

      if (resetError) {
        throw new Error(resetError.message || "Failed to send password reset email.");
      }

      setSubmittedEmail(trimmed);
      setIsSubmitted(true);
      setCooldown(60);
      toast.success("Password reset link sent! Check your inbox.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send reset link.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSendResetEmail(email);
  };

  const handleResend = async () => {
    if (cooldown > 0 || isSubmitting) return;
    await handleSendResetEmail(submittedEmail);
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-x-hidden overflow-y-auto bg-surface">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[460px] animate-slide-up">
        {/* Back Link */}
        <Link
          href="/login"
          className="mb-5 inline-flex items-center gap-2 text-[13px] font-normal text-text-muted hover:text-text-primary hover:underline underline-offset-4 transition-all duration-150 rounded-lg group"
        >
          <div className="w-9 h-9 rounded-lg bg-canvas/80 backdrop-blur-sm border border-border flex items-center justify-center group-hover:bg-canvas group-hover:border-border shadow-sm">
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform text-text-primary" />
          </div>
          <span>Back to sign in</span>
        </Link>

        {/* Linq Logo */}
        <div className="mb-6 flex justify-center">
          <Link href="/" className="inline-block transition-opacity hover:opacity-90">
            <Image
              src="/linq-logo.png"
              alt="Linq"
              width={110}
              height={32}
              style={{ width: "auto" }}
              className="h-8 object-contain cursor-pointer"
              priority
            />
          </Link>
        </div>

        {/* Card Container */}
        <div className="rounded-[16px] sm:rounded-[20px] border border-border bg-canvas p-6 sm:p-10 shadow-[0_12px_32px_rgba(116,59,232,0.08)]">
          {!isSubmitted ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <h1 className="text-[24px] sm:text-[28px] font-semibold text-[#171717] tracking-tight leading-[1.2]">
                  Reset your password
                </h1>
                <p className="text-[14px] sm:text-[15px] text-[#858585] leading-[1.6]">
                  Enter your registered email address and we&apos;ll send you a secure link to reset your password.
                </p>
              </div>

              {/* Error Alert */}
              {error && (
                <div
                  role="alert"
                  className="rounded-[12px] bg-[#FEF2F2] border border-[#FCA5A5]/70 p-3.5 text-[13px] sm:text-[14px] font-medium text-[#B91C1C] flex items-start gap-2.5"
                >
                  <AlertCircle size={18} className="shrink-0 mt-0.5 text-[#DC2626]" />
                  <span>{error}</span>
                </div>
              )}

              {/* Email Input */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="forgot-email"
                  className="text-[14px] font-medium text-[#171717] select-none text-left"
                >
                  Email address
                </label>
                <div className="relative flex items-center w-full">
                  <div className="absolute left-4 text-[#8E8E93] pointer-events-none">
                    <Mail size={18} />
                  </div>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError("");
                    }}
                    className="w-full h-[52px] sm:h-[56px] pl-11 pr-4 rounded-[12px] border border-[#D8D8D8] bg-[#FFFFFF] text-[15px] sm:text-[16px] text-[#202020] placeholder:text-[#A0A0A0] focus:outline-none focus:border-[#743BE8] focus:ring-2 focus:ring-[#743BE8]/15 transition-all"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                className="w-full h-[52px] sm:h-[56px] rounded-[12px] text-[#FFFFFF] text-[15px] sm:text-[16px] font-medium flex items-center justify-center transition-all duration-200 cursor-pointer shadow-[0_4px_14px_rgba(116,59,232,0.22)] hover:shadow-[0_6px_20px_rgba(116,59,232,0.30)] hover:brightness-105 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(90deg, #743BE8 0%, #7139E8 50%, #7638E8 100%)",
                }}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Sending reset link...
                  </span>
                ) : (
                  "Send reset link"
                )}
              </button>

              {/* Bottom Links */}
              <div className="flex items-center justify-center gap-1.5 text-[14px] text-[#8A8A8A] pt-1">
                <span>Remembered your password?</span>
                <Link
                  href="/login"
                  className="font-medium text-[#743BE8] hover:text-[#5820CC] hover:underline transition-colors"
                >
                  Sign in
                </Link>
              </div>
            </form>
          ) : (
            <div className="flex flex-col items-center text-center gap-6 animate-fade-in">
              {/* Success Icon */}
              <div className="w-16 h-16 rounded-full bg-[#743BE8]/10 text-[#743BE8] flex items-center justify-center">
                <CheckCircle2 size={36} strokeWidth={2.2} />
              </div>

              {/* Title & Description */}
              <div className="flex flex-col gap-2">
                <h1 className="text-[24px] sm:text-[26px] font-semibold text-[#171717] tracking-tight">
                  Check your email
                </h1>
                <p className="text-[14px] sm:text-[15px] text-[#666666] leading-[1.6]">
                  We have sent a password reset link to:
                </p>
                <p className="text-[15px] sm:text-[16px] font-medium text-[#171717] bg-[#F4F4F6] py-2 px-3.5 rounded-lg break-all">
                  {submittedEmail}
                </p>
              </div>

              <p className="text-[13px] text-[#858585] leading-relaxed">
                Click the recovery link inside the email to set a new password. If you don&apos;t see it, check your spam or junk folder.
              </p>

              {/* Error if Resend Fails */}
              {error && (
                <div
                  role="alert"
                  className="w-full rounded-[12px] bg-[#FEF2F2] border border-[#FCA5A5]/70 p-3 text-[13px] font-medium text-[#B91C1C] flex items-start gap-2 text-left"
                >
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-[#DC2626]" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="w-full flex flex-col gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || isSubmitting}
                  className="w-full h-[48px] rounded-[12px] border border-[#D8D8D8] hover:bg-[#F9F9FB] text-[14px] font-medium text-[#202020] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Resending...</span>
                    </>
                  ) : cooldown > 0 ? (
                    <span>Resend email in {cooldown}s</span>
                  ) : (
                    <>
                      <RotateCw size={15} />
                      <span>Resend reset email</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSubmitted(false);
                    setError("");
                  }}
                  className="text-[13px] text-[#743BE8] hover:text-[#5820CC] font-medium hover:underline py-1 transition-colors"
                >
                  Try a different email
                </button>
              </div>

              <div className="pt-2 border-t border-border w-full flex justify-center">
                <Link
                  href="/login"
                  className="text-[14px] text-[#858585] hover:text-[#171717] transition-colors"
                >
                  &larr; Back to sign in
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}