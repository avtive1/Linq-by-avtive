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
import { AlertCircle, ArrowLeft, Lock, Mail } from "lucide-react";

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

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-x-hidden overflow-y-auto bg-surface px-[max(0.75rem,env(safe-area-inset-left))] py-10 sm:px-[max(1.5rem,env(safe-area-inset-left))]">
      <GradientBackground />
      <div className="relative z-10 w-full max-w-[520px] min-w-0 animate-slide-up px-1 sm:px-0">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mb-5 h-auto gap-2 px-0 text-[13px] font-normal text-text-muted hover:bg-transparent hover:text-text-primary hover:underline focus-visible:ring-royal-indigo/30 group",
          )}
        >
          <span className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "bg-canvas/80 backdrop-blur-sm")}>
            <ArrowLeft size={16} className="text-text-primary transition-transform group-hover:-translate-x-0.5" />
          </span>
          <span>Back to Home</span>
        </Link>

        <div className="mb-6 flex justify-center">
          <Image
            src="/linq-logo.png"
            alt="Linq"
            width={110}
            height={32}
            className="h-8 w-auto object-contain"
            priority
          />
        </div>

        <Card className="rounded-lg bg-canvas shadow-[0_12px_32px_rgba(90,79,207,0.10)]">
          <form onSubmit={handleSubmit}>
            <CardHeader className="gap-4 px-6 pt-6 sm:px-8 sm:pt-8">
              <CardTitle className="text-[32px] font-medium leading-[1.15] tracking-[-0.01em] text-text-primary">
                Welcome back
              </CardTitle>
              <CardDescription className="text-[15px] leading-[1.65] text-text-muted">
                Please enter your details to sign in.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-8 px-6 pb-6 sm:px-8 sm:pb-8">
              <Separator />

              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address</Label>
                  <InputGroup>
                    <InputGroupAddon>
                      <Mail aria-hidden="true" />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="email"
                      required
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      aria-invalid={Boolean(error)}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </InputGroup>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <InputGroup>
                    <InputGroupAddon>
                      <Lock aria-hidden="true" />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="password"
                      required
                      type="password"
                      autoComplete="current-password"
                      placeholder="Password"
                      value={password}
                      aria-invalid={Boolean(error)}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </InputGroup>
                </div>

                {needsOtpStep ? (
                  <div className="grid gap-2">
                    <Label htmlFor="otp">Email verification code</Label>
                    <InputGroup>
                      <InputGroupAddon>
                        <Lock aria-hidden="true" />
                      </InputGroupAddon>
                      <InputGroupInput
                        id="otp"
                        required
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="6-digit code"
                        value={otp}
                        aria-invalid={Boolean(error)}
                        onChange={(event) => setOtp(event.target.value)}
                      />
                    </InputGroup>
                  </div>
                ) : null}
              </div>

              {needsOtpStep ? (
                <Alert>
                  <Mail aria-hidden="true" />
                  <AlertDescription>
                    We sent a code to your email. Enter it to finish signing in to your organization account.
                  </AlertDescription>
                </Alert>
              ) : null}

              {error ? (
                <Alert variant="destructive">
                  <AlertCircle aria-hidden="true" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={!email || !password || isSubmitting || (needsOtpStep && !otp.trim())}
              >
                {isSubmitting ? "Signing in..." : needsOtpStep ? "Verify and sign in" : "Sign in"}
              </Button>
              {needsOtpStep ? (
                <Button
                  type="button"
                  variant="link"
                  className="mx-auto h-auto text-[13px] text-text-muted hover:text-text-primary"
                  onClick={() => {
                    setNeedsOtpStep(false);
                    setOtp("");
                    setError("");
                  }}
                >
                  Use a different account
                </Button>
              ) : null}
            </CardContent>
          </form>
        </Card>
      </div>
    </main>
  );
}
