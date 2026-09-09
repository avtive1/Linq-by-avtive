"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import GradientBackground from "@/components/GradientBackground";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Lock, Mail, X } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [needsOtpStep, setNeedsOtpStep] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parseError = (err: unknown) => {
    if (err instanceof Error && err.message) return err.message;
    return "Incorrect email or password.";
  };

  const resolvePostLoginTarget = async () => {
    let target = "/dashboard";
    try {
      const adminRes = await fetch("/api/auth/admin-state", { cache: "no-store" });
      const adminPayload = await adminRes.json().catch(() => ({}));
      const isAdmin = Boolean(adminRes.ok && adminPayload?.data?.isAdmin);
      target = isAdmin ? "/admin" : "/dashboard";
    } catch {
      target = "/dashboard";
    }
    const rawCb = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("callbackUrl") : null;
    const safeCb = rawCb && rawCb.startsWith("/") && !rawCb.startsWith("//") ? rawCb : null;
    return safeCb || target;
  };

  const finishLogin = async () => {
    const target = await resolvePostLoginTarget();
    router.replace(target);
    router.refresh();
  };

  const tryLegacyMigrationLogin = async (trimmedEmail: string) => {
    let migrationRes: Response;
    try {
      migrationRes = await fetch("/api/auth/migrate-legacy-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
    } catch {
      setError("Could not check your previous password. Please try again.");
      return true;
    }
    const migrationPayload = await migrationRes.json().catch(() => ({}));
    if (!migrationRes.ok || migrationPayload?.data?.canMigrate !== true) {
      if (migrationRes.status !== 401) {
        setError(String(migrationPayload?.error || "Could not migrate your previous login. Please try again."));
        return true;
      }
      return false;
    }

    const signupResult = await authClient.signUp.email({
      email: trimmedEmail,
      password,
      name: String(migrationPayload.data.name || trimmedEmail),
    });
    if (signupResult.error) {
      setError(
        signupResult.error.message?.toLowerCase().includes("already")
          ? "Your old password was verified, but this email already exists in Neon Auth. Please use password reset once to sync it."
          : signupResult.error.message ||
              "Your old password was verified, but the Neon Auth account could not be created. Please reset your password.",
      );
      return true;
    }
    const signInResult = await authClient.signIn.email({
      email: trimmedEmail,
      password,
    });
    if (signInResult.error) {
      setError(
        signInResult.error.message ||
          "Your account was migrated, but sign-in failed. Please try signing in again.",
      );
      return true;
    }
    await finishLogin();
    return true;
  };

  const signInWithNeon = async (trimmedEmail: string) => {
    try {
      return await authClient.signIn.email({
        email: trimmedEmail,
        password,
      });
    } catch (err: unknown) {
      return {
        data: null,
        error: {
          message: err instanceof Error ? err.message : "Neon Auth sign-in failed.",
        },
      };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (needsOtpStep) {
        const code = otp.trim();
        if (!code) {
          setError("Enter the verification code from your email.");
          return;
        }
        const result = await signInWithNeon(trimmedEmail);
        if (result?.error) {
          const migrated = await tryLegacyMigrationLogin(trimmedEmail);
          if (!migrated) setError("Incorrect email, password, or verification code.");
          return;
        }
        if (result?.data) {
          await finishLogin();
          return;
        }
        setError("Sign-in failed. Please try again.");
        return;
      }

      const result = await signInWithNeon(trimmedEmail);
      if (result?.error) {
        const migrated = await tryLegacyMigrationLogin(trimmedEmail);
        if (!migrated) setError(result.error.message || "Incorrect email or password.");
        return;
      }
      if (result?.data) {
        await finishLogin();
        return;
      }
      setError("Sign-in failed. Please try again.");
    } catch (err: unknown) {
      setError(parseError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="min-h-dvh w-full bg-white flex flex-col justify-center select-text">
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-dvh w-full">
        {/* Left Column: Login Form */}
        <div className="flex flex-col justify-center items-center px-6 sm:px-12 lg:px-16 xl:px-24 py-12">
          <div className="w-full max-w-md flex flex-col">
            {/* Logo */}
            <div className="mb-8">
              <Link href="/">
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

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-bold text-heading tracking-tight mb-6">
              Log in to Linq
            </h1>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Email Address */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-semibold text-slate-700">
                  Email address
                </label>
                <div className="relative flex items-center">
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="info@avtive.app"
                    className="w-full h-11 px-3.5 pr-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5B4DFB]/30 focus:border-[#5B4DFB] transition-all"
                  />
                  {email && (
                    <button
                      type="button"
                      onClick={() => setEmail("")}
                      className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  Password
                </label>
                <div className="relative flex items-center">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 px-3.5 pr-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5B4DFB]/30 focus:border-[#5B4DFB] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-start">
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-[#5B4DFB] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              {/* OTP Field if needed */}
              {needsOtpStep && (
                <div className="flex flex-col gap-1.5 mt-2">
                  <label htmlFor="otp" className="text-xs font-semibold text-slate-700">
                    Email verification code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="6-digit code"
                    className="w-full h-11 px-3.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5B4DFB]/30 focus:border-[#5B4DFB] transition-all"
                  />
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200/80 p-3 text-xs font-medium text-red-700 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!email || !password || isSubmitting || (needsOtpStep && !otp.trim())}
                className="mt-2 w-full rounded-lg bg-[#5B4DFB] hover:bg-[#4d3feb] text-white text-sm font-semibold py-2.5 px-4 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Signing in..." : needsOtpStep ? "Verify and login" : "Login"}
              </button>

              {/* Register Link */}
              <div className="text-center mt-4 text-xs text-neutral-600">
                Don&apos;t have an account?{" "}
                <Link
                  href="/organization/register"
                  className="font-semibold text-[#5B4DFB] hover:underline"
                >
                  Register here
                </Link>
              </div>

              {needsOtpStep && (
                <button
                  type="button"
                  onClick={() => {
                    setNeedsOtpStep(false);
                    setOtp("");
                    setError("");
                  }}
                  className="text-center text-xs text-neutral-500 hover:text-neutral-700 mt-1 cursor-pointer"
                >
                  Use a different account
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Right Column: Hero Branding */}
        <div className="hidden lg:flex flex-col justify-center items-start bg-white lg:bg-[#fafbff] border-l border-slate-100 px-10 xl:px-20 py-12">
          <div className="max-w-xl text-left">
            {/* Eyebrow / Category Tagline */}
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#818CF8] mb-4 sm:mb-5">
              DIGITAL NETWORKING · EVENT CARDS · ORGANIZATION PORTALS
            </p>

            {/* Main Headline */}
            <h2 className="text-4xl sm:text-5xl xl:text-[54px] font-extrabold tracking-tight text-[#111827] leading-[1.1] mb-6">
              Every connection,
              <span className="block text-[#5B4DFB] mt-1">creates opportunity</span>
            </h2>

            {/* Body Paragraph */}
            <p className="text-base sm:text-[16px] font-normal leading-relaxed text-[#64748B] max-w-xl mb-8">
              Linq turns event registration and organization onboarding into a single, elegant step. Share one link, let attendees generate beautiful, scannable cards, and manage every organization seamlessly.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
