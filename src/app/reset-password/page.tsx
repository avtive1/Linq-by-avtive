"use client";

import { Suspense, useState, useEffect } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { validatePasswordPolicy, PASSWORD_POLICY } from "@/lib/security/password-policy";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const t = String(searchParams.get("token") || "").trim();
    setToken(t);
  }, [searchParams]);

  // Live password validation checks
  const hasMinLength = password.length >= PASSWORD_POLICY.minLength;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const isMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!token) {
      newErrors.token = "Missing reset session token. Please request a new verification code.";
    }

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
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Could not complete password reset.");
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
    <main className="relative min-h-screen w-full flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-x-hidden overflow-y-auto bg-surface">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[480px] animate-slide-up">
        {/* Back Link */}
        <Link
          href="/login?prompt=login"
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

        {/* Card */}
        <div className="rounded-[16px] sm:rounded-[20px] border border-border bg-canvas p-6 sm:p-10 shadow-[0_12px_32px_rgba(116,59,232,0.08)]">
          {isSuccess ? (
            /* Success State */
            <div className="flex flex-col items-center text-center gap-6 py-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={36} strokeWidth={2.2} />
              </div>

              <div className="flex flex-col gap-2">
                <h1 className="text-[24px] sm:text-[28px] font-semibold text-[#171717] tracking-tight leading-[1.2]">
                  Password reset successful!
                </h1>
                <p className="text-[14px] sm:text-[15px] text-[#858585] leading-[1.6] max-w-[380px]">
                  Your password has been securely updated. Please sign in using your new password to access your dashboard.
                </p>
              </div>

              <Link
                href="/login?prompt=login"
                className="w-full h-[52px] sm:h-[56px] rounded-[12px] text-[#FFFFFF] text-[15px] sm:text-[16px] font-medium flex items-center justify-center transition-all duration-200 shadow-[0_4px_14px_rgba(116,59,232,0.22)] hover:shadow-[0_6px_20px_rgba(116,59,232,0.30)] hover:brightness-105 active:scale-[0.99] mt-2"
                style={{
                  background: "linear-gradient(90deg, #743BE8 0%, #7139E8 50%, #7638E8 100%)",
                }}
              >
                Back to Sign In
              </Link>
            </div>
          ) : !token ? (
            /* Missing Token State */
            <div className="flex flex-col items-center text-center gap-6 py-4">
              <div className="w-14 h-14 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <AlertCircle size={30} />
              </div>

              <div className="flex flex-col gap-2">
                <h1 className="text-[22px] sm:text-[24px] font-semibold text-[#171717] tracking-tight">
                  Missing reset session
                </h1>
                <p className="text-[14px] text-[#858585] leading-[1.6]">
                  A valid reset session is required to change your password. Please request a new verification code.
                </p>
              </div>

              <Link
                href="/forgot-password"
                className="w-full h-[50px] rounded-[12px] text-[#FFFFFF] text-[15px] font-medium flex items-center justify-center transition-all shadow-[0_4px_14px_rgba(116,59,232,0.22)] hover:brightness-105"
                style={{
                  background: "linear-gradient(90deg, #743BE8 0%, #7139E8 50%, #7638E8 100%)",
                }}
              >
                Request reset code
              </Link>
            </div>
          ) : (
            /* Reset Password Form */
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <h1 className="text-[24px] sm:text-[28px] font-semibold text-[#171717] tracking-tight leading-[1.2]">
                  Set a new password
                </h1>
                <p className="text-[14px] sm:text-[15px] text-[#858585] leading-[1.6]">
                  Choose a strong password with at least 12 characters.
                </p>
              </div>

              {/* Form level error */}
              {(errors.form || errors.token) && (
                <div
                  role="alert"
                  className="rounded-[12px] bg-[#FEF2F2] border border-[#FCA5A5]/70 p-3.5 text-[13px] sm:text-[14px] font-medium text-[#B91C1C] flex items-start gap-2.5"
                >
                  <AlertCircle size={18} className="shrink-0 mt-0.5 text-[#DC2626]" />
                  <span className="flex-1">{errors.form || errors.token}</span>
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
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: "" }));
                    }}
                    className="w-full h-[52px] sm:h-[56px] pl-11 pr-12 rounded-[12px] border border-[#D8D8D8] bg-[#FFFFFF] text-[15px] sm:text-[16px] text-[#202020] placeholder:text-[#A0A0A0] focus:outline-none focus:border-[#743BE8] focus:ring-2 focus:ring-[#743BE8]/15 transition-all"
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
                  <p className="text-[13px] font-medium text-destructive mt-0.5 text-left">
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="confirm-password"
                  className="text-[14px] font-medium text-[#171717] select-none text-left"
                >
                  Confirm password
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
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: "" }));
                    }}
                    className="w-full h-[52px] sm:h-[56px] pl-11 pr-12 rounded-[12px] border border-[#D8D8D8] bg-[#FFFFFF] text-[15px] sm:text-[16px] text-[#202020] placeholder:text-[#A0A0A0] focus:outline-none focus:border-[#743BE8] focus:ring-2 focus:ring-[#743BE8]/15 transition-all"
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
                  <p className="text-[13px] font-medium text-destructive mt-0.5 text-left">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Password Requirements Checklist */}
              <div className="rounded-[12px] bg-[#F9F9FB] border border-[#EBEBEF] p-4 text-[12px] sm:text-[13px] text-[#555555]">
                <p className="font-semibold text-[#171717] mb-2.5 text-left">Password requirements:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  <div className={`flex items-center gap-2 ${hasMinLength ? "text-emerald-600 font-medium" : "text-[#777777]"}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${hasMinLength ? "bg-emerald-100 text-emerald-600" : "bg-[#E5E5E8] text-[#888888]"}`}>
                      <Check size={11} strokeWidth={2.5} />
                    </div>
                    <span>At least 12 characters</span>
                  </div>
                  <div className={`flex items-center gap-2 ${hasUpper ? "text-emerald-600 font-medium" : "text-[#777777]"}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${hasUpper ? "bg-emerald-100 text-emerald-600" : "bg-[#E5E5E8] text-[#888888]"}`}>
                      <Check size={11} strokeWidth={2.5} />
                    </div>
                    <span>One uppercase letter</span>
                  </div>
                  <div className={`flex items-center gap-2 ${hasLower ? "text-emerald-600 font-medium" : "text-[#777777]"}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${hasLower ? "bg-emerald-100 text-emerald-600" : "bg-[#E5E5E8] text-[#888888]"}`}>
                      <Check size={11} strokeWidth={2.5} />
                    </div>
                    <span>One lowercase letter</span>
                  </div>
                  <div className={`flex items-center gap-2 ${hasNumber ? "text-emerald-600 font-medium" : "text-[#777777]"}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${hasNumber ? "bg-emerald-100 text-emerald-600" : "bg-[#E5E5E8] text-[#888888]"}`}>
                      <Check size={11} strokeWidth={2.5} />
                    </div>
                    <span>One number</span>
                  </div>
                  <div className={`flex items-center gap-2 ${hasSymbol ? "text-emerald-600 font-medium" : "text-[#777777]"}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${hasSymbol ? "bg-emerald-100 text-emerald-600" : "bg-[#E5E5E8] text-[#888888]"}`}>
                      <Check size={11} strokeWidth={2.5} />
                    </div>
                    <span>One special character</span>
                  </div>
                  {confirmPassword && (
                    <div className={`flex items-center gap-2 ${isMatch ? "text-emerald-600 font-medium" : "text-destructive font-medium"}`}>
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${isMatch ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-destructive"}`}>
                        <Check size={11} strokeWidth={2.5} />
                      </div>
                      <span>{isMatch ? "Passwords match" : "Passwords do not match"}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !password || !confirmPassword || !isMatch}
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
                  "Update password"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface">
          <Loader2 size={28} className="animate-spin text-[#743BE8]" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
