"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Store user in localStorage for demo
    if (typeof window !== "undefined") {
      localStorage.setItem("avtive_user", JSON.stringify({ email: form.email }));
    }
    router.push("/dashboard");
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-6">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[440px] bg-white border border-border rounded-3xl p-10 shadow-xl shadow-primary/5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          {/* Brand */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold tracking-[0.2em] text-muted/40 uppercase">
              AVTIVE
            </span>
            <h1 className="text-2xl font-bold text-heading">Create Account</h1>
            <p className="text-sm text-muted">Join smart networking today.</p>
          </div>

          {/* Form fields */}
          <div className="flex flex-col gap-4">
            <TextInput
              label="Full Name"
              required
              placeholder="John Doe"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
            />
            <TextInput
              label="Email Address"
              required
              type="email"
              placeholder="hello@example.com"
              icon="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
            />
            <TextInput
              label="Password"
              required
              type="password"
              placeholder="Create password"
              icon="lock"
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
            />
          </div>

          <Button type="submit" variant="primary" fullWidth className="h-12 text-base">
            Sign up
          </Button>

          {/* Footer link */}
          <div className="flex items-center justify-center gap-1 text-sm text-muted">
            <span>Already have an account?</span>
            <Link
              href="/login"
              className="font-semibold text-primary hover:underline underline-offset-4 transition-all"
            >
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}