"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button } from "@/components/ui";
import { ArrowLeft } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parseError = (err: unknown) => {
    if (err instanceof Error && err.message) return err.message;
    return "Incorrect email or password.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        callbackUrl: "/",
        redirect: false,
      });
      if (result?.error) {
        setError("Incorrect email or password.");
        return;
      }
      if (result?.ok) {
        let target = "/dashboard";
        try {
          const adminRes = await fetch("/api/auth/admin-state", { cache: "no-store" });
          const adminPayload = await adminRes.json().catch(() => ({}));
          const isAdmin = Boolean(adminRes.ok && adminPayload?.data?.isAdmin);
          target = isAdmin ? "/admin" : "/dashboard";
        } catch {
          target = "/dashboard";
        }
        router.replace(target);
        router.refresh();
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
    <main className="relative min-h-screen w-full flex items-center justify-center py-12 px-2 sm:px-4 lg:px-6 overflow-hidden bg-transparent">
      <GradientBackground />
      <div className="relative z-10 w-full max-w-[520px] animate-slide-up">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 text-sm font-normal text-muted hover:text-primary-strong hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-md group"
        >
          <div className="w-8 h-8 rounded-sm bg-white/60 backdrop-blur-sm border border-border flex items-center justify-center group-hover:bg-white group-hover:border-primary/20 shadow-sm">
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </div>
          <span>Back to Home</span>
        </Link>

        <div className="mb-8 flex justify-center">
          <span className="ui-eyebrow text-muted/70">AVTIVE</span>
        </div>

        <div className="glass-panel rounded-xl p-8 sm:p-12 shadow-2xl shadow-primary/5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <h1 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">Welcome back</h1>
              <p className="text-base text-muted leading-[1.55]">Please enter your details to sign in.</p>
            </div>

            <div className="flex flex-col gap-6">
              <TextInput label="Email Address" required type="email" placeholder="you@example.com" icon="email" value={email} onChange={setEmail} />
              <TextInput label="Password" required type="password" placeholder="••••••••••••" icon="lock" value={password} onChange={setPassword} />
            </div>

            {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}

            <Button type="submit" variant="primary" fullWidth size="lg" disabled={!email || !password || isSubmitting} className="h-12 text-base shadow-lg shadow-primary/20">
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
