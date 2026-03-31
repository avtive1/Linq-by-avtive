"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button } from "@/components/ui";
import { pb } from "@/lib/pocketbase";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await pb.collection("users").authWithPassword(email, password);
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (err: any) {
      setError("Incorrect email or password.");
    }
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center py-12 px-4 sm:px-6 overflow-hidden">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Back Button */}
        <Link 
          href="/" 
          className="absolute -top-12 left-0 flex items-center gap-2 text-sm font-medium text-muted hover:text-primary transition-all group"
        >
          <div className="w-8 h-8 rounded-full bg-white/50 backdrop-blur-sm border border-border flex items-center justify-center group-hover:bg-white group-hover:border-primary/20 shadow-sm">
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </div>
          <span>Back to Home</span>
        </Link>

        {/* Brand */}
        <div className="mb-6 flex justify-center">
          <span className="text-[12px] font-bold tracking-[0.2em] text-muted/30 uppercase">
            AVTIVE
          </span>
        </div>

        {/* Login Card */}
        <div className="bg-white/80 backdrop-blur-2xl border border-border rounded-[24px] p-6 sm:p-8 shadow-2xl shadow-primary/5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-bold text-heading tracking-tight">Welcome back</h1>
              <p className="text-sm text-muted leading-relaxed">
                Please enter your details to sign in.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <TextInput
                label="Email Address"
                required
                type="email"
                placeholder="hello@alignui.com"
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
              className="h-12 text-base shadow-lg shadow-primary/20"
            >
              Sign in
            </Button>

            <div className="flex items-center justify-center gap-1 text-sm text-muted">
              <span>Don't have an account?</span>
              <Link
                href="/signup"
                className="font-semibold text-primary hover:underline underline-offset-4 transition-all"
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