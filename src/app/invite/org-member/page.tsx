"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";
import { Eye, EyeOff } from "lucide-react";

function InviteOrgMemberInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const token = searchParams.get("t") || "";
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [invitedEmail, setInvitedEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!token) {
      setMessage("Missing invitation token.");
      return;
    }
    fetch(`/api/organization-members/invite-info?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.email) setInvitedEmail(data.email);
      })
      .catch(() => {});
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
            <p className="text-sm text-muted">Create an account to accept your invitation.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const email = String(fd.get("email") || "");
                const username = String(fd.get("username") || "");
                const password = String(fd.get("password") || "");
                if (!email || !username || !password) return;
                
                setBusy(true);
                setMessage("");
                try {
                  const res = await fetch("/api/auth/register-invited", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, username, password }),
                  });
                  const payload = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setMessage(String(payload?.error || "Could not create account."));
                    setBusy(false);
                    return;
                  }
                  
                  // Now sign in automatically
                  const nextAuth = await import("next-auth/react");
                  const signInRes = await nextAuth.signIn("credentials", {
                    email,
                    password,
                    redirect: false,
                  });
                  
                  if (!signInRes || signInRes.error) {
                    setMessage("Account created, but sign-in failed. Please sign in manually.");
                    setBusy(false);
                    return;
                  }
                  
                  // Wait a brief moment to ensure cookies are set
                  await new Promise(r => setTimeout(r, 500));
                  
                  // After sign in, accept the invite
                  const acceptRes = await fetch("/api/organization-members/accept-invite", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token }),
                  });
                  
                  if (!acceptRes.ok) {
                    if (acceptRes.status === 401) {
                      // Cookie might not be available to fetch yet, reload to apply session
                      window.location.reload();
                      return;
                    }
                    const acceptPayload = await acceptRes.json().catch(() => ({}));
                    setMessage(String(acceptPayload?.error || "Account created, but could not accept invitation."));
                    setBusy(false);
                    return;
                  }
                  
                  window.location.href = "/dashboard";
                } catch {
                  setMessage("Something went wrong.");
                  setBusy(false);
                }
              }}
              className="flex flex-col gap-3"
            >
              <input
                type="email"
                name="email"
                required
                readOnly
                value={invitedEmail}
                placeholder="Loading email..."
                className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm shadow-sm transition-colors text-muted-foreground focus-visible:outline-none cursor-not-allowed"
              />
              <input
                type="text"
                name="username"
                required
                placeholder="Username (e.g. john_doe)"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  placeholder="Password (min 12 chars, upper, lower, number, special)"
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 pr-10 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {message ? <p className="text-sm text-red-600">{message}</p> : null}
              <Button type="submit" variant="primary" fullWidth size="lg" disabled={busy}>
                {busy ? "Working…" : "Sign up & Accept"}
              </Button>
            </form>
            <div className="mt-2 text-center text-sm">
              <span className="text-muted">Already have an account? </span>
              <Link href={loginHref} className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </div>
          </div>
        ) : session?.user?.email?.trim().toLowerCase() !== invitedEmail?.trim().toLowerCase() && invitedEmail ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-md bg-yellow-50 p-4 border border-yellow-200">
              <p className="text-sm text-yellow-800 leading-relaxed">
                You are currently signed in as <strong className="break-all">{session.user.email}</strong>, but this invitation was sent to <strong className="break-all">{invitedEmail}</strong>.
              </p>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              Please sign out of your current account to accept this invitation using the correct email address.
            </p>
            <Button
              variant="primary"
              fullWidth
              size="lg"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await signOut({ redirect: false });
                setBusy(false);
              }}
            >
              Sign out & Switch accounts
            </Button>
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
