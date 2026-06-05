import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { ensureShortLinkForPath } from "@/lib/services/shortLink.service";
import { parseJsonBody } from "@/lib/middlewares/validateRequest";
import { shortLinkCreateBodySchema } from "@/lib/validators/registration.validator";
import { validateCsrfOrigin } from "@/lib/security/csrf";

export async function POST(req: Request) {
  try {
    const csrf = validateCsrfOrigin(req);
    if (!csrf.ok) {
      return NextResponse.json({ error: csrf.reason || "CSRF validation failed." }, { status: 403 });
    }

    const cookieStore = await cookies();
    const userId = await getServerUserIdFromCookies(cookieStore);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseJsonBody(req, shortLinkCreateBodySchema);
    if (!parsed.ok) return parsed.response;

    const link = await ensureShortLinkForPath(parsed.data.targetPath, userId);
    return NextResponse.json(
      {
        data: {
          slug: link.slug,
          shortPath: link.shortPath,
          targetPath: link.targetPath,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create short link.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
