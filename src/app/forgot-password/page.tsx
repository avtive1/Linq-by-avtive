"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { ArrowLeft, Mail, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = email.trim().toLowerCase();
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
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 404 || payload?.error?.includes("User not registered")) {
          setError("User not registered. Please check your email or sign up.");
          return;
        }
        if (res.status === 429 && payload?.cooldownSeconds) {
          setError(payload?.error || `Please wait ${payload.cooldownSeconds}s before requesting a new code.`);
          return;
        }
        throw new Error(payload?.error || "Could not send reset code. Please try again.");
      }

      toast.success("Verification code sent to your email!");
      router.push(`/forgot-password/verify?email=${encodeURIComponent(trimmed)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isUnregisteredError = error === "User not registered. Please check your email or sign up.";

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

        {/* Forgot Password Card */}
        <div className="rounded-[16px] sm:rounded-[20px] border border-border bg-canvas p-6 sm:p-10 shadow-[0_12px_32px_rgba(116,59,232,0.08)]">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-[24px] sm:text-[28px] font-semibold text-[#171717] tracking-tight leading-[1.2]">
                Reset your password
              </h1>
              <p className="text-[14px] sm:text-[15px] text-[#858585] leading-[1.6]">
                Enter your registered email address and we&apos;ll send you a 6-digit verification code.
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <div
                role="alert"
                className="rounded-[12px] bg-[#FEF2F2] border border-[#FCA5A5]/70 p-3.5 text-[13px] sm:text-[14px] font-medium text-[#B91C1C] flex items-start gap-2.5"
              >
                <AlertCircle size={18} className="shrink-0 mt-0.5 text-[#DC2626]" />
                <div className="flex-1">
                  <span>{error}</span>
                  {isUnregisteredError && (
                    <div className="mt-1.5">
                      <Link
                        href="/signup"
                        className="font-semibold underline underline-offset-2 text-[#991B1B] hover:text-[#7F1D1D] transition-colors"
                      >
                        Create an account &rarr;
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Email Field */}
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
                  Sending code...
                </span>
              ) : (
                "Send verification code"
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
        </div>
      </div>
    </main>
  );
}