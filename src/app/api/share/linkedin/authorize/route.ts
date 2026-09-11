import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import {
  getLinkedInOAuthConfig,
  createLinkedInStateToken,
  generateLinkedInAuthUrl,
  LINKEDIN_STATE_COOKIE_NAME,
} from "@/lib/services/linkedin.service";
import { isValidUuid } from "@/lib/validation/uuid";
import { logger } from "@/lib/logger-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cardId = searchParams.get("cardId")?.trim();
    const shareToken = searchParams.get("shareToken")?.trim();
    const isPopup = searchParams.get("popup") === "true";

    if (!cardId || !isValidUuid(cardId)) {
      return NextResponse.json({ error: "A valid card ID is required." }, { status: 400 });
    }

    const origin = req.nextUrl.origin;
    let config;
    try {
      config = getLinkedInOAuthConfig(origin);
    } catch (configErr) {
      const msg = configErr instanceof Error ? configErr.message : "LinkedIn not configured";
      return NextResponse.json({ error: msg }, { status: 503 });
    }

    const nonce = randomBytes(16).toString("hex");
    const stateToken = await createLinkedInStateToken({
      cardId,
      shareToken: shareToken || undefined,
      isPopup,
      nonce,
      timestamp: Date.now(),
    });

    const cookieStore = await cookies();
    cookieStore.set({
      name: LINKEDIN_STATE_COOKIE_NAME,
      value: stateToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60, // 15 minutes
      path: "/",
    });

    const authUrl = generateLinkedInAuthUrl(stateToken, config);
    return NextResponse.redirect(authUrl);
  } catch (err: unknown) {
    logger.error({ err }, "Failed to initiate LinkedIn OAuth authorization");
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
