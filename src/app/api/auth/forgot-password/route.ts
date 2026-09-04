import { NextResponse } from "next/server";
import { neonAuth } from "@/auth";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { forgotPasswordBodySchema } from "@/lib/validators/auth.validator";

import { getPublicAppUrl } from "@/lib/app-url";

export async function POST(req: Request) {
  try {
    const parsed = await parseJsonBody(req, forgotPasswordBodySchema);
    if (!parsed.ok) return parsed.response;
    const { email } = parsed.data;

    const base = getPublicAppUrl(req);
    const result = await neonAuth.requestPasswordReset({
      email,
      redirectTo: `${base}/reset-password`,
    } as Parameters<typeof neonAuth.requestPasswordReset>[0]);
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: result.error.status || 400 });
    }
    return NextResponse.json({ data: { ok: true } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to start password reset.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
