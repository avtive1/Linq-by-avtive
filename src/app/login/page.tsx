"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const configuredAdminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      toast.success("Welcome back!");

      const isAdminByEmail = configuredAdminEmails.includes(email.toLowerCase());
      const role = data.user?.user_metadata?.role;
      const isAdminByRole = typeof role === "string" && role.toLowerCase() === "admin";

      if (isAdminByEmail || isAdminByRole) {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Incorrect email or password.");
    }
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center py-6 px-4 sm:px-6 overflow-hidden bg-transparent">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[420px] animate-slide-up">
        <Link 
          href="/" 
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary-strong hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-[4px] group"
        >
          <div className="w-8 h-8 rounded-sm bg-white/60 backdrop-blur-sm border border-border flex items-center justify-center group-hover:bg-white group-hover:border-primary/20 shadow-sm">
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </div>
          <span>Back to Home</span>
        </Link>

        {/* Brand */}
        <div className="mb-6 flex justify-center">
          <span className="ui-eyebrow text-muted/70">
            AVTIVE
          </span>
        </div>

        {/* Login Card */}
        <div className="glass-panel rounded-xl p-6 sm:p-8 shadow-2xl shadow-primary/5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold text-heading tracking-tight leading-tight">Welcome back</h1>
              <p className="text-base text-muted leading-[1.55]">
                Please enter your details to sign in.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <TextInput
                label="Email Address"
                required
                type="email"
                placeholder="you@example.com"
                icon="email"
                value={email}
                onChange={setEmail}
              />
              <TextInput
                label="Password"
                required
                type="password"
                placeholder="••••••••••••"
                icon="lock"
                value={password}
                onChange={setPassword}
              />
              <Link
                href="/forgot-password"
                className="self-end text-xs font-semibold text-primary-strong hover:underline underline-offset-4 transition-all"
              >
                Forgot password?
              </Link>
            </div>

            {/* Inline error message */}
            {error && (
              <p className="text-sm text-red-500 font-medium -mt-4 text-center">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              disabled={!email || !password}
              className="h-12 text-base shadow-lg shadow-primary/20"
            >
              Sign in
            </Button>

            <div className="flex items-center justify-center gap-1 text-sm text-muted">
              <span>Don't have an account?</span>
              <Link
                href="/signup"
                className="font-semibold text-primary-strong hover:underline underline-offset-4 transition-all"
              >
                Create one
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}