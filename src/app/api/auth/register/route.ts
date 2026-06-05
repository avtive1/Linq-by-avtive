import { NextResponse } from "next/server";
import { registerUser } from "@/lib/auth-db";
import { validatePasswordPolicy } from "@/lib/security/password-policy";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { registerBodySchema } from "@/lib/validators/auth.validator";

export async function POST(req: Request) {
  try {
    const parsed = await parseJsonBody(req, registerBodySchema);
    if (!parsed.ok) return parsed.response;

    const {
      email,
      password,
      username,
      organizationName,
      organizationLogoUrl = "",
      linkedin = "",
    } = parsed.data;

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
