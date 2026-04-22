"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { validatePasswordPolicy } from "@/lib/security/password-policy";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the user lands here from the email link.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setHasRecoverySession(true);
      }
    });

    // Also check existing session — if user already has a recovery session in cookies.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setHasRecoverySession(true);
    });

    return () => subscription.unsubscribe();
  }, []);

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

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("Password updated. Please sign in.");
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err) {
      setErrors({ password: err instanceof Error ? err.message : "Failed to update password." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center py-12 px-2 sm:px-4 lg:px-6 overflow-hidden bg-transparent">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[520px] animate-slide-up">
        <Link
          href="/login"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary-strong hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-[4px] group"
        >
          <div className="w-8 h-8 rounded-sm bg-white/60 backdrop-blur-sm border border-border flex items-center justify-center group-hover:bg-white group-hover:border-primary/20 shadow-sm">
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </div>
          <span>Back to sign in</span>
        </Link>

        <div className="mb-8 flex justify-center">
          <span className="ui-eyebrow text-muted/70">
            AVTIVE
          </span>
        </div>

        <div className="glass-panel rounded-xl p-8 sm:p-12 shadow-2xl shadow-primary/5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <h1 className="text-2xl font-bold text-heading tracking-tight leading-tight">Set a new password</h1>
              <p className="text-base text-muted leading-[1.55]">
                {hasRecoverySession
                  ? "Choose a strong password you'll remember."
                  : "Open this page from the link in your email. The reset session is missing."}
              </p>
            </div>

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
              className="h-12 text-base shadow-lg shadow-primary/20"
            >
              {isSubmitting ? "Updating..." : "Update password"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
