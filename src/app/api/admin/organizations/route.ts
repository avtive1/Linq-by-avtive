import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/auth";
import { validatePasswordPolicy } from "@/lib/security/password-policy";
import { createOrganizationOwnerByAdmin } from "@/lib/auth-db";
import { validateCsrfOrigin } from "@/lib/security/csrf";

function isSessionAdmin(session: Awaited<ReturnType<typeof getServerAuthSession>>) {
  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const role = String(session?.user?.role || "").toLowerCase();
  const email = String(session?.user?.email || "").trim().toLowerCase();
  return role === "admin" || Boolean(email && adminEmails.includes(email));
}

export async function POST(req: Request) {
  try {
    const csrf = validateCsrfOrigin(req);
    if (!csrf.ok) return NextResponse.json({ error: csrf.reason || "CSRF validation failed." }, { status: 403 });
    const session = await getServerAuthSession();
    if (!session?.user?.id || !isSessionAdmin(session)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const body = (await req.json()) as { organizationName?: string; email?: string; password?: string };
    const organizationName = String(body.organizationName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!organizationName || !email || !password) {
      return NextResponse.json({ error: "Organization name, email, and password are required." }, { status: 400 });
    }
    if (organizationName.length > 120) {
      return NextResponse.json({ error: "Organization name is too long." }, { status: 400 });
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
    }
    const passwordIssues = validatePasswordPolicy(password);
    if (passwordIssues.length > 0) {
      return NextResponse.json({ error: passwordIssues[0] }, { status: 400 });
    }

    const data = await createOrganizationOwnerByAdmin({ organizationName, email, password });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create organization.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
