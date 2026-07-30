import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth-db";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { validateCsrfOrigin } from "@/lib/security/csrf";

const legacyLoginMigrationBodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export async function POST(req: Request) {
  const csrf = validateCsrfOrigin(req);
  if (!csrf.ok) {
    return NextResponse.json(
      { error: csrf.reason || "CSRF validation failed." },
      { status: 403 },
    );
  }

  const parsed = await parseJsonBody(req, legacyLoginMigrationBodySchema);
  if (!parsed.ok) return parsed.response;

  const user = await verifyPassword(parsed.data.email, parsed.data.password);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  return NextResponse.json({
    data: {
      canMigrate: true,
      name: user.username || user.email,
    },
  });
}
