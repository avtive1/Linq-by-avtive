"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Mail,
  KeyRound,
  Sparkles,
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { validatePasswordPolicy } from "@/lib/security/password-policy";

function generateSecurePassword(): string {
  const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowers = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%^&*()_+~=";

  const getRandomChar = (chars: string) =>
    chars[Math.floor(Math.random() * chars.length)];

  // Guarantee at least 2 of each class
  const base = [
    getRandomChar(uppers),
    getRandomChar(uppers),
    getRandomChar(lowers),
    getRandomChar(lowers),
    getRandomChar(numbers),
    getRandomChar(numbers),
    getRandomChar(symbols),
    getRandomChar(symbols),
  ];

  const all = uppers + lowers + numbers + symbols;
  while (base.length < 16) {
    base.push(getRandomChar(all));
  }

  // Shuffle
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = base[i];
    base[i] = base[j];
    base[j] = temp;
  }

  return base.join("");
}

export default function NewOrganizationByAdminPage() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const passwordChecks = useMemo(() => {
    return {
      length: password.length >= 12,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      symbol: /[^A-Za-z0-9]/.test(password),
    };
  }, [password]);

  const isPasswordValid = useMemo(() => {
    return Object.values(passwordChecks).every(Boolean);
  }, [passwordChecks]);

  const handleGeneratePassword = () => {
    const newPwd = generateSecurePassword();
    setPassword(newPwd);
    setShowPassword(true);
    setError("");

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(newPwd).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        toast.success("Strong password generated and copied to clipboard!");
      }).catch(() => {
        toast.success("Strong password generated!");
      });
    } else {
      toast.success("Strong password generated!");
    }
  };

  const handleCopyPassword = () => {
    if (!password) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(password).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        toast.success("Password copied to clipboard.");
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOrg = organizationName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanOrg || !cleanEmail || !password) {
      const msg = "Organization name, email, and password are required.";
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!/\S+@\S+\.\S+/.test(cleanEmail)) {
      const msg = "Please provide a valid email address.";
      setError(msg);
      toast.error(msg);
      return;
    }

    const passwordIssues = validatePasswordPolicy(password);
    if (passwordIssues.length > 0) {
      setError(passwordIssues[0]);
      toast.error(passwordIssues[0]);
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: cleanOrg,
          email: cleanEmail,
          password,
        }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg =
          payload?.error ||
          (res.status === 409
            ? "An organization or account with these details already exists."
            : "Could not create organization account.");
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      toast.success(`Organization "${cleanOrg}" created successfully.`);
      router.push("/admin");
      router.refresh();
    } catch {
      const msg = "Network error. Could not create organization account.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-120px)] items-center justify-center px-2 py-6 sm:px-4 sm:py-8 lg:px-6">
      <Card className="w-full max-w-[620px] bg-white border border-border/70 shadow-2xl p-0 overflow-hidden rounded-2xl">
        <CardHeader className="p-6 sm:p-8 pb-4">
          <Link
            href="/admin"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "-ml-2 mb-2 w-fit gap-2 text-muted hover:text-ink transition-colors"
            )}
          >
            <ArrowLeft size={14} />
            Back to Admin
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-semibold">
              <Building2 size={20} />
            </div>
            <div>
              <CardTitle className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">
                Create Organization Account
              </CardTitle>
              <CardDescription className="mt-1 text-sm text-muted leading-relaxed">
                Register an organization owner account. A welcome email with login credentials will be dispatched.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="px-6 sm:px-8 py-4 flex flex-col gap-5">
            {error ? (
              <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3 text-destructive text-sm leading-snug">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{error}</div>
              </div>
            ) : null}

            {/* Organization Name */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-name" className="text-sm font-medium text-heading flex items-center gap-1.5">
                <Building2 size={15} className="text-muted" />
                Organization Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="org-name"
                required
                placeholder="e.g. Acme Innovations"
                value={organizationName}
                autoComplete="organization"
                onChange={(e) => {
                  setOrganizationName(e.target.value);
                  if (error) setError("");
                }}
                className="h-11 bg-white text-base text-ink focus-visible:ring-primary/20"
              />
            </div>

            {/* Organization Owner Email */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-email" className="text-sm font-medium text-heading flex items-center gap-1.5">
                <Mail size={15} className="text-muted" />
                Organization Owner Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="org-email"
                required
                type="email"
                placeholder="e.g. owner@acme.com"
                value={email}
                autoComplete="email"
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                className="h-11 bg-white text-base text-ink focus-visible:ring-primary/20"
              />
            </div>

            {/* Temporary Password */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="org-password" className="text-sm font-medium text-heading flex items-center gap-1.5">
                  <KeyRound size={15} className="text-muted" />
                  Temporary Password <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  {password ? (
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="text-xs font-medium text-muted hover:text-ink flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-surface"
                    >
                      {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-primary/5"
                  >
                    <Sparkles size={13} />
                    Generate Strong Password
                  </button>
                </div>
              </div>

              <div className="relative">
                <Input
                  id="org-password"
                  required
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 12 chars (e.g. Uppercase, numbers, symbols)"
                  value={password}
                  autoComplete="new-password"
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  className="h-11 pr-10 bg-white text-base text-ink focus-visible:ring-primary/20"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Live Password Policy Indicators */}
              <div className="mt-1 p-3 rounded-xl bg-surface/60 border border-border/50 flex flex-col gap-1.5 text-xs text-muted">
                <div className="font-medium text-ink mb-0.5">Password requirements:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div className={cn("flex items-center gap-1.5", passwordChecks.length ? "text-emerald-600 font-medium" : "text-muted")}>
                    {passwordChecks.length ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                    At least 12 characters
                  </div>
                  <div className={cn("flex items-center gap-1.5", passwordChecks.upper ? "text-emerald-600 font-medium" : "text-muted")}>
                    {passwordChecks.upper ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                    1 uppercase letter (A-Z)
                  </div>
                  <div className={cn("flex items-center gap-1.5", passwordChecks.lower ? "text-emerald-600 font-medium" : "text-muted")}>
                    {passwordChecks.lower ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                    1 lowercase letter (a-z)
                  </div>
                  <div className={cn("flex items-center gap-1.5", passwordChecks.number ? "text-emerald-600 font-medium" : "text-muted")}>
                    {passwordChecks.number ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                    1 number (0-9)
                  </div>
                  <div className={cn("flex items-center gap-1.5 sm:col-span-2", passwordChecks.symbol ? "text-emerald-600 font-medium" : "text-muted")}>
                    {passwordChecks.symbol ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                    1 special symbol (!@#$%^&*...)
                  </div>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="px-6 sm:px-8 py-6 border-t border-border/40 bg-surface/30 flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-1/2 h-11 text-sm font-medium"
              onClick={() => router.push("/admin")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={isSubmitting || !organizationName.trim() || !email.trim() || !isPasswordValid}
              className="w-full sm:w-1/2 h-11 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
            >
              {isSubmitting ? "Creating Organization..." : "Create Organization"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
