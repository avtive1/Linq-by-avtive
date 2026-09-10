"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { AlertCircle, Eye, EyeOff, Loader2, X } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [needsOtpStep, setNeedsOtpStep] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  return (
    <main className="w-full min-h-screen lg:h-screen lg:overflow-hidden bg-[#FFFFFF] flex flex-col justify-center select-text">
      <div className="flex flex-col lg:flex-row w-full h-full min-h-screen lg:min-h-0">
        {/* =========================================================================
            LEFT COLUMN: Authentication Form (~48% width)
           ========================================================================= */}
        <section className="w-full lg:w-[48%] h-full flex flex-col justify-center items-center px-6 sm:px-12 lg:px-12 xl:px-16 2xl:px-24 py-10 lg:py-6 bg-[#FFFFFF] z-10">
          <div className="w-full max-w-[500px] flex flex-col">
            {/* LINQ LOGO */}
            <div className="mb-[65px] lg:mb-[70px]">
              <Link href="/" className="inline-block transition-opacity hover:opacity-90">
                <Image
                  src="/linq-logo.png"
                  alt="linq"
                  width={120}
                  height={36}
                  className="w-[115px] sm:w-[120px] h-auto object-contain cursor-pointer"
                  priority
                />
              </Link>
            </div>

            {/* LOGIN HEADING */}
            <h1 className="text-[24px] leading-[30px] font-semibold text-[#171717] tracking-tight mb-[30px] text-left">
              Log in to Linq
            </h1>

            {/* AUTH FORM */}
            <form onSubmit={handleSubmit} className="w-full flex flex-col">
              {/* EMAIL FIELD */}
              <div className="flex flex-col mb-[22px]">
                <label
                  htmlFor="email"
                  className="text-[16px] font-medium text-[#171717] mb-[10px] text-left select-none"
                >
                  Email address
                </label>
                <div className="relative flex items-center w-full">
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="linq.avtive.app"
                    className="w-full h-[64px] px-[18px] pr-[52px] rounded-[14px] border border-[#D8D8D8] bg-[#FFFFFF] text-[16px] text-[#202020] placeholder:text-[#A0A0A0] focus:outline-none focus:border-[#743BE8] focus:ring-2 focus:ring-[#743BE8]/15 transition-all"
                  />
                  {email ? (
                    <button
                      type="button"
                      onClick={() => setEmail("")}
                      className="absolute right-[18px] w-6 h-6 rounded-full bg-[#EFEFEF] hover:bg-[#E2E2E2] text-[#8E8E93] hover:text-[#555555] flex items-center justify-center transition-colors cursor-pointer"
                      aria-label="Clear email input"
                    >
                      <X size={13} strokeWidth={2.5} />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* PASSWORD FIELD */}
              <div className="flex flex-col mb-[8px]">
                <label
                  htmlFor="password"
                  className="text-[16px] font-medium text-[#171717] mb-[10px] text-left select-none"
                >
                  Password
                </label>
                <div className="relative flex items-center w-full">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full h-[64px] px-[18px] pr-[52px] rounded-[14px] border border-[#D8D8D8] bg-[#FFFFFF] text-[16px] text-[#202020] placeholder:text-[#A0A0A0] focus:outline-none focus:border-[#743BE8] focus:ring-2 focus:ring-[#743BE8]/15 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-[18px] text-[#8E8E93] hover:text-[#4A4A4A] transition-colors cursor-pointer p-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff size={22} strokeWidth={1.8} />
                    ) : (
                      <Eye size={22} strokeWidth={1.8} />
                    )}
                  </button>
                </div>
              </div>

              {/* FORGOT PASSWORD */}
              <div className="flex justify-start mb-[55px]">
                <Link
                  href="/forgot-password"
                  className="text-[15px] sm:text-[16px] font-normal text-[#76549C] hover:text-[#5A3880] transition-colors cursor-pointer"
                >
                  Forgot password?
                </Link>
              </div>

              {/* OTP STEP (If active) */}
              {needsOtpStep && (
                <div className="flex flex-col mb-[22px]">
                  <label
                    htmlFor="otp"
                    className="text-[16px] font-medium text-[#171717] mb-[10px] text-left"
                  >
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
                    placeholder="Enter 6-digit code"
                    className="w-full h-[64px] px-[18px] rounded-[14px] border border-[#D8D8D8] bg-[#FFFFFF] text-[16px] text-[#202020] placeholder:text-[#A0A0A0] focus:outline-none focus:border-[#743BE8] focus:ring-2 focus:ring-[#743BE8]/15 transition-all"
                  />
                </div>
              )}

              {/* ERROR ALERT */}
              {error && (
                <div className="mb-[20px] rounded-[12px] bg-[#FEF2F2] border border-[#FCA5A5]/70 p-3.5 text-[14px] font-medium text-[#B91C1C] flex items-start gap-2.5">
                  <AlertCircle size={18} className="shrink-0 mt-0.5 text-[#DC2626]" />
                  <span>{error}</span>
                </div>
              )}

              {/* LOGIN BUTTON */}
              <button
                type="submit"
                disabled={!email || !password || isSubmitting || (needsOtpStep && !otp.trim())}
                className="w-full h-[60px] rounded-[13px] text-[#FFFFFF] text-[16px] font-medium flex items-center justify-center transition-all duration-200 cursor-pointer shadow-[0_4px_14px_rgba(116,59,232,0.22)] hover:shadow-[0_6px_20px_rgba(116,59,232,0.30)] hover:brightness-105 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed mb-[38px]"
                style={{
                  background: "linear-gradient(90deg, #743BE8 0%, #7139E8 50%, #7638E8 100%)",
                }}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Signing in...
                  </span>
                ) : needsOtpStep ? (
                  "Verify and login"
                ) : (
                  "Login"
                )}
              </button>

              {/* REGISTER PROMPT */}
              <div className="text-center text-[15px] sm:text-[16px] text-[#8A8A8A]">
                Don&apos;t have an email account?{" "}
                <Link
                  href="/organization/register"
                  className="text-[#743BE8] font-medium hover:text-[#5820CC] hover:underline transition-colors cursor-pointer"
                >
                  Register here
                </Link>
              </div>

              {/* SWITCH ACCOUNT FOR OTP */}
              {needsOtpStep && (
                <button
                  type="button"
                  onClick={() => {
                    setNeedsOtpStep(false);
                    setOtp("");
                    setError("");
                  }}
                  className="text-center text-[14px] text-[#8A8A8A] hover:text-[#4A4A4A] mt-3 cursor-pointer transition-colors"
                >
                  Use a different account
                </button>
              )}
            </form>
          </div>
        </section>

        {/* =========================================================================
            RIGHT COLUMN: Hero / Marketing Section (~52% width)
           ========================================================================= */}
        <section className="hidden lg:flex flex-col justify-center w-full lg:w-[52%] h-full relative overflow-hidden bg-[#FFFFFF] pl-10 xl:pl-16 2xl:pl-20 pr-8 xl:pr-14 2xl:pr-20 py-12 select-text">
          {/* Subtle Ambient Radial Glows */}
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden="true"
            style={{
              background: `
                radial-gradient(ellipse 65% 55% at 20% 45%, rgba(145, 91, 255, 0.08) 0%, rgba(255, 255, 255, 0) 70%),
                radial-gradient(ellipse 55% 50% at 15% 85%, rgba(214, 160, 255, 0.06) 0%, rgba(255, 255, 255, 0) 65%),
                radial-gradient(ellipse 50% 45% at 85% 80%, rgba(100, 180, 255, 0.04) 0%, rgba(255, 255, 255, 0) 60%),
                radial-gradient(ellipse 45% 40% at 65% 15%, rgba(145, 91, 255, 0.04) 0%, rgba(255, 255, 255, 0) 55%)
              `,
            }}
          />

          {/* Hero Content Container */}
          <div className="relative z-10 max-w-[660px] text-left">
            {/* TOP CATEGORY TAGLINE */}
            <p className="text-[12px] xl:text-[13px] font-medium uppercase tracking-[0.14em] text-[#9382C3] mb-[35px] select-none">
              GLOBAL NETWORKING • EVENT CREATORS • ORGANIZATIONS • PORTALS
            </p>

            {/* MAIN HERO HEADLINE WITH SUBTLE GHOST DISPLACEMENT EFFECT */}
            <div className="relative mb-[50px] select-text">
              {/* Subtle ghost typography shadow layer */}
              <div
                aria-hidden="true"
                className="absolute inset-0 select-none pointer-events-none opacity-25 filter blur-[2px] translate-x-[2.5px] -translate-y-[1px]"
              >
                <h2 className="text-[46px] xl:text-[58px] 2xl:text-[64px] font-extrabold tracking-[-0.03em] leading-[1.05]">
                  <span className="block text-[#151515]">Every connection</span>
                  <span className="block text-[#7040E5]">creates opportunity</span>
                </h2>
              </div>

              {/* Crisp Primary Headline */}
              <h2 className="relative text-[46px] xl:text-[58px] 2xl:text-[64px] font-extrabold tracking-[-0.03em] leading-[1.05]">
                <span className="block text-[#151515]">Every connection</span>
                <span className="block text-[#7040E5]">creates opportunity</span>
              </h2>
            </div>

            {/* HERO DESCRIPTION PARAGRAPH */}
            <p className="text-[18px] xl:text-[20px] font-normal leading-[1.62] text-[#858585] max-w-[640px]">
              Linq turns event registration and organization onboarding into a single, elegant step.
              Share one link, let attendees generate beautiful scannable cards, and manage every
              organization seamlessly.
            </p>
          </div>
        </section>

        {/* =========================================================================
            MOBILE/TABLET MARKETING FOOTER (<1024px)
           ========================================================================= */}
        <section className="flex lg:hidden flex-col justify-center w-full px-6 sm:px-12 py-10 bg-[#FAFAFC] border-t border-slate-100">
          <div className="w-full max-w-[500px] mx-auto text-left">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#9382C3] mb-3 select-none">
              GLOBAL NETWORKING • EVENT CREATORS • ORGANIZATIONS
            </p>
            <h2 className="text-[28px] sm:text-[34px] font-extrabold tracking-tight leading-[1.1] mb-3">
              <span className="block text-[#151515]">Every connection</span>
              <span className="block text-[#7040E5]">creates opportunity</span>
            </h2>
            <p className="text-[14px] sm:text-[15px] font-normal leading-relaxed text-[#858585]">
              Linq turns event registration and organization onboarding into a single, elegant step. Share one link, let attendees generate beautiful scannable cards, and manage every organization seamlessly.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

