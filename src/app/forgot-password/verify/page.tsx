"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { ArrowLeft, AlertCircle, Loader2, RefreshCw, KeyRound } from "lucide-react";
import { toast } from "sonner";

function VerifyCodeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!emailParam) {
      router.replace("/forgot-password");
    }
  }, [emailParam, router]);

  // Focus the first input on load
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleDigitChange = (index: number, value: string) => {
    setError("");
    // Take only the last entered digit
    const cleaned = value.replace(/\D/g, "");
    const char = cleaned.slice(-1);

    const next = [...digits];
    next[index] = char;
    setDigits(next);

    // Auto-advance
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
        inputRefs.current[index - 1]?.focus();
      } else {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const next = [...digits];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || "";
    }
    setDigits(next);

    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const fullCode = digits.join("");
  const isComplete = fullCode.length === 6;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isComplete || isSubmitting) return;

    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailParam,
          code: fullCode,
        }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(payload?.error || "Invalid or expired verification code.");
      }

      const resetToken = payload?.data?.resetToken;
      if (!resetToken) {
        throw new Error("Missing reset token from verification.");
      }

      toast.success("Code verified successfully!");
      router.push(`/reset-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(emailParam)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailParam }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Could not resend verification code.");
      }

      setCooldown(payload?.data?.cooldownSeconds || 60);
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      toast.success("A new 6-digit code has been sent!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-x-hidden overflow-y-auto bg-surface">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[480px] animate-slide-up">
        {/* Back Link */}
        <Link
          href="/forgot-password"
          className="mb-5 inline-flex items-center gap-2 text-[13px] font-normal text-text-muted hover:text-text-primary hover:underline underline-offset-4 transition-all duration-150 rounded-lg group"
        >
          <div className="w-9 h-9 rounded-lg bg-canvas/80 backdrop-blur-sm border border-border flex items-center justify-center group-hover:bg-canvas group-hover:border-border shadow-sm">
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform text-text-primary" />
          </div>
          <span>Change email</span>
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

        {/* Verification Card */}
        <div className="rounded-[16px] sm:rounded-[20px] border border-border bg-canvas p-6 sm:p-10 shadow-[0_12px_32px_rgba(116,59,232,0.08)]">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="w-12 h-12 rounded-xl bg-[#743BE8]/10 text-[#743BE8] flex items-center justify-center mb-1">
                <KeyRound size={24} />
              </div>
              <h1 className="text-[24px] sm:text-[28px] font-semibold text-[#171717] tracking-tight leading-[1.2]">
                Enter verification code
              </h1>
              <p className="text-[14px] sm:text-[15px] text-[#858585] leading-[1.6]">
                We sent a 6-digit code to{" "}
                <span className="font-semibold text-[#171717]">{emailParam || "your email"}</span>.
                The code expires in 10 minutes.
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <div
                role="alert"
                className="rounded-[12px] bg-[#FEF2F2] border border-[#FCA5A5]/70 p-3.5 text-[13px] sm:text-[14px] font-medium text-[#B91C1C] flex items-start gap-2.5"
              >
                <AlertCircle size={18} className="shrink-0 mt-0.5 text-[#DC2626]" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            {/* 6 Digit Inputs */}
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-[#171717] text-left select-none">
                6-digit code
              </label>
              <div className="flex items-center justify-between gap-2 sm:gap-3">
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    onPaste={handlePaste}
                    className="w-12 h-14 sm:w-14 sm:h-16 text-center text-[22px] sm:text-[24px] font-bold text-[#171717] rounded-[12px] border border-[#D8D8D8] bg-[#FFFFFF] focus:outline-none focus:border-[#743BE8] focus:ring-2 focus:ring-[#743BE8]/20 transition-all shadow-xs"
                    aria-label={`Digit ${idx + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isComplete || isSubmitting}
              className="w-full h-[52px] sm:h-[56px] rounded-[12px] text-[#FFFFFF] text-[15px] sm:text-[16px] font-medium flex items-center justify-center transition-all duration-200 cursor-pointer shadow-[0_4px_14px_rgba(116,59,232,0.22)] hover:shadow-[0_6px_20px_rgba(116,59,232,0.30)] hover:brightness-105 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(90deg, #743BE8 0%, #7139E8 50%, #7638E8 100%)",
              }}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={18} className="animate-spin" />
                  Verifying code...
                </span>
              ) : (
                "Verify code"
              )}
            </button>

            {/* Resend Cooldown / Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-[#F0F0F0] text-[13px] sm:text-[14px]">
              <span className="text-[#858585]">Didn&apos;t receive the code?</span>
              {cooldown > 0 ? (
                <span className="text-[#8E8E93] font-medium flex items-center gap-1.5 select-none">
                  <RefreshCw size={14} className="animate-spin text-[#8E8E93]" />
                  Resend in {cooldown}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending}
                  className="font-medium text-[#743BE8] hover:text-[#5820CC] hover:underline transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isResending ? "animate-spin" : ""} />
                  {isResending ? "Sending..." : "Resend code"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function VerifyCodePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface">
          <Loader2 size={28} className="animate-spin text-[#743BE8]" />
        </div>
      }
    >
      <VerifyCodeContent />
    </Suspense>
  );
}
