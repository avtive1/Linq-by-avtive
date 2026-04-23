"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button, FilePicker } from "@/components/ui";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { validatePasswordPolicy } from "@/lib/security/password-policy";
import { normalizeOrganizationName } from "@/lib/organization/normalize";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    organization: "",
    organizationLogo: "",
    username: "",
    linkedin: "",
  });
  const [usernameStatus, setUsernameStatus] = useState<"loading" | "available" | "taken" | "invalid" | null>(null);
  const [usernameLocked, setUsernameLocked] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const usernameCheckSeq = useRef(0);

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
    
    // Username
    if (!form.username) newErrors.username = "Username is required";
    else if (form.username.length < 3) newErrors.username = "Min 3 characters required";
    else if (!/^[a-zA-Z0-9_.]+$/.test(form.username)) newErrors.username = "Alphanumeric, underscore, or dot only";
    else if (usernameStatus === "taken") newErrors.username = "Username is already taken";
    
    // Password
    if (!form.password) newErrors.password = "Password is required";
    else {
      const passwordIssues = validatePasswordPolicy(form.password);
      if (passwordIssues.length > 0) newErrors.password = passwordIssues[0];
    }
    
    // Confirm Password
    if (!form.confirmPassword) newErrors.confirmPassword = "Please confirm your password";
    else if (form.confirmPassword !== form.password) newErrors.confirmPassword = "Passwords do not match";
    
    // Organization
    if (!form.organization) newErrors.organization = "Organization Name is required";
    if (!form.organizationLogo) newErrors.organizationLogo = "Organization logo is required";
    
    // LinkedIn (Optional)
    // Removed strict "/" check to allow full URLs

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setIsSubmitting(true);
    const cleanHandle = extractLinkedInHandle(form.linkedin);
    const normalizedOrganizationName = normalizeOrganizationName(form.organization);
    
    try {
      let organizationLogoUrl = form.organizationLogo;
      // Never store large base64 payloads in auth metadata/JWT.
      // Upload logo and store only a public URL.
      if (organizationLogoUrl.startsWith("data:")) {
        const uploadRes = await fetch("/api/media/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl: organizationLogoUrl, folder: "organization-logos" }),
        });
        const uploadPayload = await uploadRes.json();
        if (!uploadRes.ok || !uploadPayload?.data?.url) {
          throw new Error(uploadPayload?.error || "Organization logo upload failed.");
        }
        organizationLogoUrl = String(uploadPayload.data.url);
      }

      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          username: form.username.toLowerCase(),
          organizationName: normalizedOrganizationName,
          organizationLogoUrl,
          linkedin: cleanHandle,
        }),
      });
      const registerPayload = await registerRes.json().catch(() => ({}));
      if (!registerRes.ok) {
        throw new Error(registerPayload?.error || "Failed to create account.");
      }

      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (result?.error || !result?.ok) {
        throw new Error("Account created, but sign-in failed. Please sign in manually.");
      }
      toast.success("Account created successfully!");
      router.refresh();
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create account. Email may already exist.";
      setErrors({ email: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkUsername = async (username: string, signal?: AbortSignal) => {
    if (username.length < 3) {
      setUsernameStatus(null);
      return;
    }
    
    if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
      setUsernameStatus("invalid");
      return;
    }

    setUsernameStatus("loading");
    try {
      const res = await fetch(
        `/api/profile/username/availability?username=${encodeURIComponent(username.toLowerCase())}`,
        { signal },
      );
      if (!res.ok) throw new Error("Username availability check failed.");
      const payload = await res.json();
      if (signal?.aborted) return;
      if (payload?.data?.available === false) {
        setUsernameStatus("taken");
      } else {
        setUsernameStatus("available");
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      console.error("Username check error:", err);
      setUsernameStatus(null);
    }
  };

  // Debounced effect for username check
  useEffect(() => {
    // Clear status immediately while typing starts
    if (!form.username) {
      setUsernameStatus(null);
      return;
    }

    const controller = new AbortController();
    const seq = ++usernameCheckSeq.current;
    const timeout = setTimeout(async () => {
      await checkUsername(form.username, controller.signal);
      if (seq !== usernameCheckSeq.current || controller.signal.aborted) return;
    }, 500);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [form.username]);

  const update = (key: keyof typeof form) => (val: string) => {
    setForm(prev => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: "" }));
    }
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center py-12 px-2 sm:px-4 lg:px-6 overflow-hidden bg-transparent">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[420px] animate-slide-up">
        <Link 
          href="/" 
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary-strong hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-inline group"
        >
          <div className="w-8 h-8 rounded-sm bg-white/60 backdrop-blur-sm border border-border flex items-center justify-center group-hover:bg-white group-hover:border-primary/20 shadow-sm">
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </div>
          <span>Back to Home</span>
        </Link>
        {/* Card Header Label */}
        <div className="mb-6 flex justify-center">
          <span className="ui-eyebrow text-muted/70">
            AVTIVE
          </span>
        </div>

        {/* Signup Card */}
        <div className="glass-panel rounded-xl p-6 sm:p-8 shadow-2xl shadow-primary/5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">Create your profile</h1>
              <p className="text-base text-muted leading-[1.55]">
                Set up once. Generate a card for every event you attend.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {/* Autofill Trap: These hidden fields capture the browser's forced autofill so our real fields stay clean */}
              <input 
                type="text" 
                name="fake_user_name" 
                autoComplete="username" 
                style={{ display: "none" }} 
                tabIndex={-1} 
              />
              <input 
                type="password" 
                name="fake_password" 
                autoComplete="current-password" 
                style={{ display: "none" }} 
                tabIndex={-1} 
              />

              <TextInput
                label="Email Address"
                required
                type="email"
                name="email"
                autoComplete="email"
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
              <div className="relative">
                <TextInput
                  label="Username"
                  required
                  name="avtive_user_handle_v1"
                  autoComplete="off"
                  placeholder="choose_a_username"
                  icon="user"
                  value={form.username}
                  error={errors.username}
                  onChange={update("username")}
                  readOnly={usernameLocked}
                  onFocus={() => setUsernameLocked(false)}
                />
                {form.username.length >= 2 && (
                  <div className="absolute right-0 top-0 pt-[28px]">
                    {usernameStatus === "loading" && <div className="text-[13px] leading-tight font-medium text-muted animate-pulse">Checking...</div>}
                    {usernameStatus === "available" && <div className="text-[13px] leading-tight font-medium text-green-500">Available</div>}
                    {usernameStatus === "taken" && <div className="text-[13px] leading-tight font-medium text-danger">Taken</div>}
                    {usernameStatus === "invalid" && <div className="text-[13px] leading-tight font-medium text-danger">Invalid chars</div>}
                  </div>
                )}
              </div>
              <TextInput
                label="Organization Name"
                required
                placeholder="Enter your organization"
                value={form.organization}
                error={errors.organization}
                onChange={update("organization")}
              />
              <FilePicker
                label="Organization Logo"
                required
                value={form.organizationLogo}
                onChange={update("organizationLogo")}
                onError={(msg) => toast.error(msg)}
                error={errors.organizationLogo}
                cropAspect={1}
                cropTitle="Crop organization logo"
                cropSubtitle="Use a square crop for best card branding."
                cropApplyLabel="Apply logo"
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
              disabled={isSubmitting}
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
        </div>
      </div>
    </main>
  );
}
