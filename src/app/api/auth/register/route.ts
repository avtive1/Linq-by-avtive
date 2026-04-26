import { NextResponse } from "next/server";
import { registerUser } from "@/lib/auth-db";
import { validatePasswordPolicy } from "@/lib/security/password-policy";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      username?: string;
      organizationName?: string;
      organizationLogoUrl?: string;
      linkedin?: string;
    };

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const username = String(body.username || "").trim().toLowerCase();
    const organizationName = String(body.organizationName || "").trim();
    const organizationLogoUrl = String(body.organizationLogoUrl || "").trim();
    const linkedin = String(body.linkedin || "").trim();

    if (!email || !password || !username || !organizationName || !organizationLogoUrl) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_.]+$/.test(username) || username.length < 3) {
      return NextResponse.json({ error: "Invalid username." }, { status: 400 });
    }
    const passwordIssues = validatePasswordPolicy(password);
    if (passwordIssues.length > 0) {
      return NextResponse.json({ error: passwordIssues[0] }, { status: 400 });
    }

    const data = await registerUser({ email, password, username, organizationName, organizationLogoUrl, linkedin });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Registration failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
