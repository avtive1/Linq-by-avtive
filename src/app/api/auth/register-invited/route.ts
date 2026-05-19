import { NextResponse } from "next/server";
import { registerUser } from "@/lib/auth-db";
import { validatePasswordPolicy } from "@/lib/security/password-policy";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      username?: string;
    };

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const username = String(body.username || "").trim().toLowerCase();

    if (!email || !password || !username) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_.]+$/.test(username) || username.length < 3) {
      return NextResponse.json({ error: "Invalid username. Must be at least 3 characters and contain only letters, numbers, underscores, or dots." }, { status: 400 });
    }
    const passwordIssues = validatePasswordPolicy(password);
    if (passwordIssues.length > 0) {
      return NextResponse.json({ error: passwordIssues[0] }, { status: 400 });
    }

    // Pass empty organizationName so it doesn't create a new org
    const data = await registerUser({ email, password, username, organizationName: "" });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Registration failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
