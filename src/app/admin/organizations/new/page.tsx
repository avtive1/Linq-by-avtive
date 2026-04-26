"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, TextInput } from "@/components/ui";
import { toast } from "sonner";

export default function NewOrganizationByAdminPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
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
    <div className="flex flex-col gap-6 px-2 py-6 sm:px-4 sm:py-6 lg:px-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary-strong"
      >
        <ArrowLeft size={14} />
        Back to Admin
      </Link>

      <div className="max-w-[560px] rounded-xl border border-primary/20 bg-white/90 p-6 shadow-md">
        <h1 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">
          Create Organization Account
        </h1>
        <p className="mt-2 text-sm text-muted">
          Super admin can register an organization owner account using email and password.
          Username and profile picture will be mandatory on first login.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <TextInput
            label="Organization Owner Email"
            required
            type="email"
            placeholder="owner@organization.com"
            value={email}
            onChange={setEmail}
            error={error ? "" : undefined}
          />
          <TextInput
            label="Temporary Password"
            required
            type="password"
            placeholder="Set a strong password"
            value={password}
            onChange={setPassword}
          />
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={() => router.push("/admin")}>
              Cancel
            </Button>
            <Button type="submit" fullWidth disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Organization"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
