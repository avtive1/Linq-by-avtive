"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";

function InviteOrgMemberInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const token = searchParams.get("t") || "";
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) setMessage("Missing invitation token.");
  }, [token]);

  const accept = async () => {
    if (!token) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/organization-members/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(String(payload?.error || "Could not accept invitation."));
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const loginHref = `/login?callbackUrl=${encodeURIComponent(`/invite/org-member?t=${encodeURIComponent(token)}`)}`;

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center py-12 px-4 overflow-hidden bg-transparent">
      <GradientBackground />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-white/80 backdrop-blur-md p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-heading mb-2">Organization invitation</h1>
        <p className="text-sm text-muted mb-6 leading-relaxed">
          Accept this invitation while signed in with the same email address the invite was sent to.
        </p>
        {!token ? (
          <p className="text-sm text-red-600">{message}</p>
        ) : status === "loading" ? (
          <p className="text-sm text-muted">Checking session…</p>
        ) : !session?.user ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">Sign in first, then return here to accept.</p>
            <Link href={loginHref}>
              <Button variant="primary" fullWidth size="lg">
                Sign in to continue
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted break-all">Signed in as {session.user.email}</p>
            {message ? <p className="text-sm text-red-600">{message}</p> : null}
            <Button variant="primary" fullWidth size="lg" disabled={busy} onClick={() => void accept()}>
              {busy ? "Working…" : "Accept invitation"}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function InviteOrgMemberPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <p className="text-sm text-muted">Loading…</p>
        </main>
      }
    >
      <InviteOrgMemberInner />
    </Suspense>
  );
}
