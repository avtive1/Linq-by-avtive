"use client";
import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button } from "@/components/ui";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { validatePasswordPolicy } from "@/lib/security/password-policy";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    const t = String(searchParams.get("token") || "");
    setToken(t);
    setHasRecoverySession(Boolean(t));
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!password) newErrors.password = "Password is required";
    else {
      const issues = validatePasswordPolicy(password);
      if (issues.length > 0) newErrors.password = issues[0];
    }

    if (!confirmPassword) newErrors.confirmPassword = "Please confirm your password";
    else if (confirmPassword !== password) newErrors.confirmPassword = "Passwords do not match";
    if (!token) newErrors.token = "Missing reset token.";

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

      toast.success("Password updated. Please sign in.");
      router.push("/login");
    } catch (err) {
      setErrors({ password: err instanceof Error ? err.message : "Failed to update password." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center py-12 px-2 sm:px-4 lg:px-6 overflow-x-hidden overflow-y-auto bg-surface">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[520px] animate-slide-up">
        <Link
          href="/login"
          className="mb-5 inline-flex items-center gap-2 text-[13px] font-normal text-text-muted hover:text-text-primary hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-indigo/30 focus-visible:ring-offset-2 rounded-lg group"
        >
          <div className="w-9 h-9 rounded-lg bg-canvas/80 backdrop-blur-sm border border-border flex items-center justify-center group-hover:bg-canvas group-hover:border-border shadow-sm">
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform text-text-primary" />
          </div>
          <span>Back to sign in</span>
        </Link>

        <div className="mb-6 flex justify-center">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-xmuted">AVTIVE</span>
        </div>

        <div className="rounded-lg border border-border bg-canvas p-8 sm:p-12 shadow-[0_12px_32px_rgba(90,79,207,0.10)]">
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <h1 className="text-[32px] font-medium text-text-primary tracking-[-0.01em] leading-[1.15]">
                Set a new password
              </h1>
              <p className="text-[15px] text-text-muted leading-[1.65]">
                {hasRecoverySession
                  ? "Choose a strong password you'll remember."
                  : "Request a fresh reset code from forgot password."}
              </p>
            </div>
            {errors.token ? <p className="text-[13px] text-error">{errors.token}</p> : null}

            <TextInput
              label="New Password"
              required
              type="password"
              placeholder="••••••••••••"
              icon="lock"
              value={password}
              error={errors.password}
              onChange={(v) => { setPassword(v); if (errors.password) setErrors({ ...errors, password: "" }); }}
            />
            <TextInput
              label="Confirm Password"
              required
              type="password"
              placeholder="••••••••••••"
              icon="lock"
              value={confirmPassword}
              error={errors.confirmPassword}
              onChange={(v) => { setConfirmPassword(v); if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: "" }); }}
            />

            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              disabled={isSubmitting || !hasRecoverySession}
            >
              {isSubmitting ? "Updating..." : "Update password"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
