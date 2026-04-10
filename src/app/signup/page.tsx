"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button } from "@/components/ui";
import { toast } from "sonner";
import { Mail, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";

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
  const [emailSent, setEmailSent] = useState(false);

  const extractLinkedInHandle = (val: string) => {
    if (!val) return "";
    // Remove protocol, domain, and common paths to get the handle
    return val
      .replace(/https?:\/\//, "")
      .replace(/www\.linkedin\.com\/in\//, "")
      .replace(/\/$/, "") // remove trailing slash
      .split("/")[0]; // takeee first segment after /in/ if any
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
    
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            linkedin: cleanHandle,
          }
        }
      });

      if (signUpError) throw signUpError;

      // If Supabase email confirmation is enabled, no session is returned —
      // surface a "check your inbox" state instead of redirecting.
      if (!data.session) {
        setEmailSent(true);
        toast.success("Check your inbox to confirm your email.");
        return;
      }

      toast.success("Account created successfully!");
      router.push("/dashboard");
    } catch (err: any) {
      setErrors({ email: err?.message || "Failed to create account. Email may already exist." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const update = (key: keyof typeof form) => (val: string) => {
    setForm({ ...form, [key]: val });
    if (errors[key]) {
      setErrors({ ...errors, [key]: "" });
    }
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center py-6 px-4 sm:px-6 overflow-hidden bg-transparent">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[420px] animate-slide-up">
        {/* Back Button */}
        <Link 
          href="/" 
          className="absolute -top-12 left-0 flex items-center gap-2 text-sm font-medium text-muted hover:text-primary-strong transition-all group"
        >
          <div className="w-8 h-8 rounded-full bg-white/50 backdrop-blur-sm border border-border flex items-center justify-center group-hover:bg-white group-hover:border-primary/20 shadow-sm">
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </div>
          <span>Back to Home</span>
        </Link>
        {/* Card Header Label */}
        <div className="mb-6 flex justify-center">
          <span className="text-[12px] font-bold tracking-[0.2em] text-muted/30 uppercase">
            AVTIVE
          </span>
        </div>

        {/* Signup Card */}
        <div className="glass-panel rounded-[12px] p-6 sm:p-8 shadow-2xl shadow-primary/5">
          {emailSent ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="w-14 h-14 rounded-[10px] bg-primary/15 flex items-center justify-center text-primary-strong">
                <Mail size={26} />
              </div>
              <div className="flex flex-col gap-1.5">
                <h1 className="text-xl font-bold text-heading tracking-tight">Check your inbox</h1>
                <p className="text-sm text-muted leading-relaxed max-w-[320px]">
                  We sent a confirmation link to <span className="font-semibold text-heading">{form.email}</span>.
                  Click it to activate your account, then sign in.
                </p>
              </div>
              <Link href="/login" className="w-full mt-2">
                <Button variant="primary" fullWidth size="lg" className="h-12 text-base shadow-lg shadow-primary/20">
                  Go to sign in
                </Button>
              </Link>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-xl font-bold text-heading tracking-tight">Create your profile</h1>
              <p className="text-sm text-muted leading-relaxed">
                Set up once. Generate a card for every event you attend.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <TextInput
                label="Email Address"
                required
                type="email"
                placeholder="Enter your email"
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
                className="font-semibold text-primary-strong hover:underline underline-offset-4 transition-all"
              >
                Sign in
              </Link>
            </div>
          </form>
          )}
        </div>
      </div>
    </main>
  );
}
