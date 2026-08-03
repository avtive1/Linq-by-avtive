"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function NewOrganizationByAdminPage() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationName.trim() || !email.trim() || !password) {
      setError("Organization name, email, and password are required.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: organizationName.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError(payload?.error || "Could not create organization account.");
        return;
      }
      toast.success("Organization account created.");
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Could not create organization account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-120px)] items-center justify-center px-2 py-6 sm:px-4 sm:py-8 lg:px-6">
      <Card className="w-full max-w-[620px] bg-white border border-border/70 shadow-2xl p-0 overflow-hidden">
        <CardHeader className="p-6 sm:p-8 pb-4">
          <Link
            href="/admin"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "-ml-2 mb-2 w-fit gap-2 text-steel hover:text-ink"
            )}
          >
            <ArrowLeft size={14} />
            Back to Admin
          </Link>
          <CardTitle className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">
            Create Organization Account
          </CardTitle>
          <CardDescription className="mt-1.5 text-sm text-muted leading-relaxed">
            Super admin can register an organization owner account using email and password.
            Username and profile picture will be mandatory on first login.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="px-6 sm:px-8 py-4 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-name" className="text-sm font-medium text-heading">
                Organization Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="org-name"
                required
                placeholder="Enter organization name"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="h-11 bg-white text-base text-ink"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="org-email" className="text-sm font-medium text-heading">
                Organization Owner Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="org-email"
                required
                type="email"
                placeholder="owner@organization.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-white text-base text-ink"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="org-password" className="text-sm font-medium text-heading">
                Temporary Password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="org-password"
                required
                type="password"
                placeholder="Set a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-white text-base text-ink"
              />
            </div>

            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
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
              disabled={isSubmitting}
              className="w-full sm:w-1/2 h-11 text-sm font-medium bg-primary text-primary-foreground"
            >
              {isSubmitting ? "Creating..." : "Create Organization"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
