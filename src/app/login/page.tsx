"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/dashboard");
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-6">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[440px] bg-white border border-border rounded-3xl p-10 shadow-xl shadow-primary/5 group">
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          {/* Brand */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold tracking-[0.2em] text-muted/40 uppercase">
              AVTIVE
            </span>
            <h1 className="text-2xl font-bold text-heading">Welcome back</h1>
            <p className="text-sm text-muted">Please enter your details to sign in.</p>
          </div>

          {/* Form fields */}
          <div className="flex flex-col gap-4">
            <TextInput
              label="Email Address"
              required
              type="email"
              placeholder="hello@example.com"
              icon="email"
              value={email}
              onChange={setEmail}
            />
            <TextInput
              label="Password"
              required
              type="password"
              placeholder="Enter password"
              icon="lock"
              value={password}
              onChange={setPassword}
            />
          </div>

          <Button type="submit" variant="primary" fullWidth className="h-12 text-base">
            Sign in
          </Button>

          {/* Footer link */}
          <div className="flex items-center justify-center gap-1 text-sm text-muted">
            <span>No account?</span>
            <Link
              href="/signup"
              className="font-semibold text-primary hover:underline underline-offset-4 transition-all"
            >
              Create one
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}