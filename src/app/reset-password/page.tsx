"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Loader2,
  Check,
  X,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { validatePasswordPolicy, PASSWORD_POLICY } from "@/lib/security/password-policy";
import { createClient } from "@/utils/supabase/client";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [checkingSession, setCheckingSession] = useState(true);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [sessionError, setSessionError] = useState<string>("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Check URL parameters and validate Supabase recovery session
  useEffect(() => {
    let isMounted = true;

    async function checkRecoverySession() {
      try {
        const errorParam = searchParams.get("error");
        const errorDescParam = searchParams.get("error_description");
        if (errorParam || errorDescParam) {
          if (isMounted) {
            setSessionError(errorDescParam || errorParam || "Invalid or expired recovery link.");
            setIsValidSession(false);
            setCheckingSession(false);
          }
          return;
        }

        // If a code query parameter exists in URL (e.g. direct redirect without /auth/callback)
        const code = searchParams.get("code");
        if (code) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) {
            if (isMounted) {
              setSessionError(exchangeErr.message || "Failed to exchange recovery code.");
              setIsValidSession(false);
              setCheckingSession(false);
            }
            return;
          }
        }

        // Check whether Supabase has an active session / user
        const { data: { user }, error: userErr } = await supabase.auth.getUser();

        if (userErr || !user) {
          if (isMounted) {
            setSessionError("No active password recovery session found. Please request a new link.");
            setIsValidSession(false);
            setCheckingSession(false);
          }
          return;
        }

        if (isMounted) {
          setUserEmail(user.email || "");
          setIsValidSession(true);
          setCheckingSession(false);
        }
      } catch (err) {
        if (isMounted) {
          setSessionError(err instanceof Error ? err.message : "Session verification failed.");
          setIsValidSession(false);
          setCheckingSession(false);
        }
      }
    }

    // Also listen to PASSWORD_RECOVERY event from auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session?.user)) {
        if (isMounted) {
          setUserEmail(session?.user?.email || "");
          setIsValidSession(true);
          setCheckingSession(false);
        }
      }
    });

    checkRecoverySession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [searchParams, supabase]);

  // Live password validation checks based on project PASSWORD_POLICY
  const hasMinLength = password.length >= PASSWORD_POLICY.minLength;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const isMatch = Boolean(password && confirmPassword && password === confirmPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!password) {
      newErrors.password = "Password is required.";
    } else {
      const issues = validatePasswordPolicy(password);
      if (issues.length > 0) {
        newErrors.password = issues[0];
      }
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your new password.";
    } else if (confirmPassword !== password) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      // 1. Update password via Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        throw new Error(updateError.message || "Could not update password.");
      }

      // 2. Synchronize new password with database public.auth_users
      try {
        await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
      } catch {
        // Non-blocking sync
      }

      toast.success("Password updated successfully!");
      setIsSuccess(true);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Failed to update password." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-[16px] sm:rounded-[20px] border border-border bg-canvas p-6 sm:p-10 shadow-[0_12px_32px_rgba(116,59,232,0.08)]">
      {/* 1. LOADING STATE */}
      {checkingSession && (
        <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
          <Loader2 size={36} className="animate-spin text-[#743BE8]" />
          <p className="text-[15px] font-medium text-[#555555]">
            Verifying recovery session...
          </p>
        </div>
      )}

      {/* 2. INVALID / EXPIRED LINK STATE */}
      {!checkingSession && isValidSession === false && (
        <div className="flex flex-col items-center text-center gap-6 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-[#FEF2F2] border border-[#FCA5A5]/60 text-[#DC2626] flex items-center justify-center">
            <AlertCircle size={36} strokeWidth={2.2} />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-[22px] sm:text-[26px] font-semibold text-[#171717] tracking-tight">
              Recovery link expired or invalid
            </h1>
            <p className="text-[14px] sm:text-[15px] text-[#666666] leading-relaxed max-w-[380px]">
              {sessionError || "This password reset link is invalid, has expired, or has already been used."}
            </p>
          </div>

          <p className="text-[13px] text-[#858585] leading-relaxed max-w-[360px]">
            For your security, password reset links can only be used once. Please request a new link to choose a new password.
          </p>

          <div className="w-full flex flex-col gap-3 pt-2">
            <Link
              href="/forgot-password"
              className="w-full h-[50px] sm:h-[54px] rounded-[12px] text-[#FFFFFF] text-[15px] font-medium flex items-center justify-center transition-all duration-200 cursor-pointer shadow-[0_4px_14px_rgba(116,59,232,0.22)] hover:shadow-[0_6px_20px_rgba(116,59,232,0.30)] hover:brightness-105"
              style={{
                background: "linear-gradient(90deg, #743BE8 0%, #7139E8 50%, #7638E8 100%)",
              }}
            >
              Request new reset link
            </Link>

            <Link
              href="/login"
              className="w-full h-[48px] rounded-[12px] border border-[#D8D8D8] hover:bg-[#F9F9FB] text-[14px] font-medium text-[#202020] flex items-center justify-center transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      )}

      {/* 3. SUCCESS STATE */}
      {!checkingSession && isValidSession && isSuccess && (
        <div className="flex flex-col items-center text-center gap-6 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-[#743BE8]/10 text-[#743BE8] flex items-center justify-center">
            <CheckCircle2 size={36} strokeWidth={2.2} />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-[24px] sm:text-[26px] font-semibold text-[#171717] tracking-tight">
              Password reset successful!
            </h1>
            <p className="text-[14px] sm:text-[15px] text-[#666666] leading-relaxed">
              Your password has been securely updated. You can now sign in with your new password.
            </p>
          </div>

          <div className="w-full pt-2">
            <Link
              href="/login"
              className="w-full h-[52px] sm:h-[56px] rounded-[12px] text-[#FFFFFF] text-[15px] sm:text-[16px] font-medium flex items-center justify-center transition-all duration-200 cursor-pointer shadow-[0_4px_14px_rgba(116,59,232,0.22)] hover:shadow-[0_6px_20px_rgba(116,59,232,0.30)] hover:brightness-105"
              style={{
                background: "linear-gradient(90deg, #743BE8 0%, #7139E8 50%, #7638E8 100%)",
              }}
            >
              Back to sign in
            </Link>
          </div>
        </div>
      )}

      {/* 4. ACTIVE RESET FORM */}
      {!checkingSession && isValidSession && !isSuccess && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="inline-flex items-center gap-2 text-[12px] font-medium text-[#743BE8] bg-[#743BE8]/10 w-fit px-2.5 py-1 rounded-full">
              <ShieldCheck size={14} />
              <span>Verified recovery session</span>
            </div>
            <h1 className="text-[24px] sm:text-[28px] font-semibold text-[#171717] tracking-tight leading-[1.2]">
              Set new password
            </h1>
            <p className="text-[14px] sm:text-[15px] text-[#858585] leading-[1.6]">
              {userEmail ? (
                <>
                  Creating a new password for <strong className="text-[#171717]">{userEmail}</strong>
                </>
              ) : (
                "Create a strong, secure password for your account."
              )}
            </p>
          </div>

          {/* Form error alert */}
          {errors.form && (
            <div
              role="alert"
              className="rounded-[12px] bg-[#FEF2F2] border border-[#FCA5A5]/70 p-3.5 text-[13px] sm:text-[14px] font-medium text-[#B91C1C] flex items-start gap-2.5"
            >
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-[#DC2626]" />
              <span>{errors.form}</span>
            </div>
          )}

          {/* New Password Field */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="new-password"
              className="text-[14px] font-medium text-[#171717] select-none text-left"
            >
              New password
            </label>
            <div className="relative flex items-center w-full">
              <div className="absolute left-4 text-[#8E8E93] pointer-events-none">
                <Lock size={18} />
              </div>
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password || errors.form) {
                    setErrors((prev) => ({ ...prev, password: "", form: "" }));
                  }
                }}
                className={`w-full h-[52px] sm:h-[56px] pl-11 pr-12 rounded-[12px] border ${
                  errors.password ? "border-[#DC2626]" : "border-[#D8D8D8]"
                } bg-[#FFFFFF] text-[15px] sm:text-[16px] text-[#202020] placeholder:text-[#A0A0A0] focus:outline-none focus:border-[#743BE8] focus:ring-2 focus:ring-[#743BE8]/15 transition-all`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-[#8E8E93] hover:text-[#4A4A4A] transition-colors p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <span className="text-[12px] font-medium text-[#DC2626] text-left">
                {errors.password}
              </span>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="confirm-password"
              className="text-[14px] font-medium text-[#171717] select-none text-left"
            >
              Confirm new password
            </label>
            <div className="relative flex items-center w-full">
              <div className="absolute left-4 text-[#8E8E93] pointer-events-none">
                <Lock size={18} />
              </div>
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword || errors.form) {
                    setErrors((prev) => ({ ...prev, confirmPassword: "", form: "" }));
                  }
                }}
                className={`w-full h-[52px] sm:h-[56px] pl-11 pr-12 rounded-[12px] border ${
                  errors.confirmPassword ? "border-[#DC2626]" : "border-[#D8D8D8]"
                } bg-[#FFFFFF] text-[15px] sm:text-[16px] text-[#202020] placeholder:text-[#A0A0A0] focus:outline-none focus:border-[#743BE8] focus:ring-2 focus:ring-[#743BE8]/15 transition-all`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 text-[#8E8E93] hover:text-[#4A4A4A] transition-colors p-1"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="text-[12px] font-medium text-[#DC2626] text-left">
                {errors.confirmPassword}
              </span>
            )}
          </div>

          {/* Password Requirements Checklist */}
          <div className="p-3.5 rounded-[12px] bg-[#F7F7F8] border border-[#ECECEC] flex flex-col gap-2 text-left">
            <span className="text-[12px] font-medium text-[#555555]">Password requirements:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[12px]">
              <div className="flex items-center gap-1.5">
                {hasMinLength ? (
                  <Check size={14} className="text-[#16A34A] shrink-0" strokeWidth={3} />
                ) : (
                  <X size={14} className="text-[#A3A3A3] shrink-0" strokeWidth={2} />
                )}
                <span className={hasMinLength ? "text-[#16A34A] font-medium" : "text-[#737373]"}>
                  At least 12 characters
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {hasUpper && hasLower ? (
                  <Check size={14} className="text-[#16A34A] shrink-0" strokeWidth={3} />
                ) : (
                  <X size={14} className="text-[#A3A3A3] shrink-0" strokeWidth={2} />
                )}
                <span className={hasUpper && hasLower ? "text-[#16A34A] font-medium" : "text-[#737373]"}>
                  Upper & lower case
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {hasNumber && hasSymbol ? (
                  <Check size={14} className="text-[#16A34A] shrink-0" strokeWidth={3} />
                ) : (
                  <X size={14} className="text-[#A3A3A3] shrink-0" strokeWidth={2} />
                )}
                <span className={hasNumber && hasSymbol ? "text-[#16A34A] font-medium" : "text-[#737373]"}>
                  Number & symbol
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {isMatch ? (
                  <Check size={14} className="text-[#16A34A] shrink-0" strokeWidth={3} />
                ) : (
                  <X size={14} className="text-[#A3A3A3] shrink-0" strokeWidth={2} />
                )}
                <span className={isMatch ? "text-[#16A34A] font-medium" : "text-[#737373]"}>
                  Passwords match
                </span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={
              isSubmitting ||
              !hasMinLength ||
              !hasUpper ||
              !hasLower ||
              !hasNumber ||
              !hasSymbol ||
              !isMatch
            }
            className="w-full h-[52px] sm:h-[56px] rounded-[12px] text-[#FFFFFF] text-[15px] sm:text-[16px] font-medium flex items-center justify-center transition-all duration-200 cursor-pointer shadow-[0_4px_14px_rgba(116,59,232,0.22)] hover:shadow-[0_6px_20px_rgba(116,59,232,0.30)] hover:brightness-105 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(90deg, #743BE8 0%, #7139E8 50%, #7638E8 100%)",
            }}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Updating password...
              </span>
            ) : (
              "Save new password"
            )}
          </button>

          {/* Back Link */}
          <div className="flex items-center justify-center pt-1">
            <Link
              href="/login"
              className="text-[14px] text-[#858585] hover:text-[#171717] hover:underline transition-colors"
            >
              Cancel and return to sign in
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="relative min-h-screen w-full flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-x-hidden overflow-y-auto bg-surface">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[480px] animate-slide-up">
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

        {/* Suspense Wrapper */}
        <Suspense
          fallback={
            <div className="rounded-[16px] sm:rounded-[20px] border border-border bg-canvas p-10 flex flex-col items-center justify-center gap-4 text-center">
              <Loader2 size={36} className="animate-spin text-[#743BE8]" />
              <p className="text-[15px] font-medium text-[#555555]">Loading reset form...</p>
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
