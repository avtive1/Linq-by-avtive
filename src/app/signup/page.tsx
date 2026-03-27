"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    linkedin: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const extractLinkedInHandle = (val: string) => {
    if (!val) return "";
    // Remove protocol, domain, and common paths to get the handle
    return val
      .replace(/https?:\/\//, "")
      .replace(/www\.linkedin\.com\/in\//, "")
      .replace(/\/$/, "") // remove trailing slash
      .split("/")[0]; // take first segment after /in/ if any
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    // Email
    if (!form.email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = "Invalid email format";
    
    // Password
    if (!form.password) newErrors.password = "Password is required";
    else if (form.password.length < 8) newErrors.password = "Min 8 characters required";
    
    // Confirm Password
    if (!form.confirmPassword) newErrors.confirmPassword = "Please confirm your password";
    else if (form.confirmPassword !== form.password) newErrors.confirmPassword = "Passwords do not match";
    
    // LinkedIn (Optional)
    // Removed strict "/" check to allow full URLs

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setIsSubmitting(true);
    // Extract handle if URL was provided
    const cleanHandle = extractLinkedInHandle(form.linkedin);
    
    // Simulate API call
    await new Promise(r => setTimeout(r, 1000));
    
    if (typeof window !== "undefined") {
      localStorage.setItem("avtive_user", JSON.stringify({ 
        email: form.email, 
        linkedin: cleanHandle 
      }));
    }
    router.push("/dashboard");
    setIsSubmitting(false);
  };

  const update = (key: keyof typeof form) => (val: string) => {
    setForm({ ...form, [key]: val });
    if (errors[key]) {
      setErrors({ ...errors, [key]: "" });
    }
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center py-20 px-6 overflow-hidden">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[480px]">
        {/* Card Header Label */}
        <div className="mb-6 flex justify-center">
          <span className="text-[12px] font-bold tracking-[0.2em] text-muted/30 uppercase">
            AVTIVE
          </span>
        </div>

        {/* Signup Card */}
        <div className="bg-white/80 backdrop-blur-2xl border border-border rounded-[32px] p-8 md:p-12 shadow-2xl shadow-primary/5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-bold text-heading tracking-tight">Create your profile</h1>
              <p className="text-sm text-muted leading-relaxed">
                Set up once. Generate a card for every event you attend.
              </p>
            </div>

            <div className="flex flex-col gap-5">
              <TextInput
                label="Email Address"
                required
                type="email"
                placeholder="hello@alignui.com"
                icon="email"
                value={form.email}
                error={errors.email}
                onChange={update("email")}
              />
              <TextInput
                label="Password"
                required
                type="password"
                placeholder="••••••••••••"
                icon="lock"
                value={form.password}
                error={errors.password}
                onChange={update("password")}
              />
              <TextInput
                label="Confirm Password"
                required
                type="password"
                placeholder="••••••••••••"
                icon="lock"
                value={form.confirmPassword}
                error={errors.confirmPassword}
                onChange={update("confirmPassword")}
              />
              <TextInput
                label="LinkedIn URL"
                placeholder="linkedin.com/in/yourhandle"
                prefix="https://"
                value={form.linkedin}
                error={errors.linkedin}
                onChange={update("linkedin")}
              />
            </div>

            <Button 
              type="submit" 
              variant="primary" 
              fullWidth 
              size="lg"
              className="h-12 text-base shadow-lg shadow-primary/20"
            >
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>

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
      </div>
    </main>
  );
}