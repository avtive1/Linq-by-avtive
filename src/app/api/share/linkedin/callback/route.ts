import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getLinkedInOAuthConfig,
  verifyLinkedInStateToken,
  exchangeLinkedInAuthCode,
  getLinkedInMemberInfo,
  sealLinkedInSession,
  LINKEDIN_AUTH_COOKIE_NAME,
  LINKEDIN_STATE_COOKIE_NAME,
} from "@/lib/services/linkedin.service";
import { logger } from "@/lib/logger-server";

export const dynamic = "force-dynamic";

function renderPopupHtml(cardId: string, error?: string) {
  const isError = Boolean(error);
  const title = isError ? "LinkedIn Authorization Failed" : "LinkedIn Connected";
  const message = isError
    ? error
    : "Your LinkedIn account is now connected. Returning to your card...";
  const postMsg = isError
    ? JSON.stringify({ type: "LINKEDIN_AUTH_ERROR", error, cardId })
    : JSON.stringify({ type: "LINKEDIN_AUTH_SUCCESS", cardId });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #090d16;
      color: #f8fafc;
      text-align: center;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 32px 24px;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 8px; }
    p { font-size: 0.9rem; color: #94a3b8; line-height: 1.5; margin-bottom: 20px; }
    .status-icon { font-size: 2.5rem; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="status-icon">${isError ? "⚠️" : "✅"}</div>
    <h2>${title}</h2>
    <p>${message}</p>
  </div>
  <script>
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(${postMsg}, "*");
        setTimeout(() => window.close(), 600);
      } else {
        setTimeout(() => {
          window.location.href = "/cards/" + encodeURIComponent("${cardId}") + "?share=true&linkedin=${isError ? "error" : "connected"}";
        }, 1200);
      }
    } catch (e) {
      window.location.href = "/cards/" + encodeURIComponent("${cardId}") + "?share=true&linkedin=${isError ? "error" : "connected"}";
    }
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: isError ? 400 : 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const { searchParams } = new URL(req.url);

  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");

  const stateCookie = cookieStore.get(LINKEDIN_STATE_COOKIE_NAME)?.value;
  cookieStore.delete(LINKEDIN_STATE_COOKIE_NAME);

  if (errorParam) {
    logger.warn({ errorParam, errorDescription }, "LinkedIn OAuth callback received error");
    const verified = stateParam ? await verifyLinkedInStateToken(stateParam) : null;
    const cardId = verified?.cardId || "";
    if (verified?.isPopup) {
      return renderPopupHtml(cardId, errorDescription || errorParam || "Access was denied by LinkedIn.");
    }
    const targetUrl = cardId
      ? `/cards/${cardId}?share=true&linkedinError=${encodeURIComponent(errorDescription || errorParam)}`
      : "/";
    return NextResponse.redirect(new URL(targetUrl, req.url));
  }

  if (!code || !stateParam) {
    return NextResponse.json({ error: "Invalid callback query parameters." }, { status: 400 });
  }

  const verifiedState = await verifyLinkedInStateToken(stateParam);
  if (!verifiedState) {
    return NextResponse.json({ error: "Invalid or expired state parameter." }, { status: 400 });
  }

  // Cross-verify with state cookie if available
  if (stateCookie && stateCookie !== stateParam) {
    logger.warn("LinkedIn state cookie mismatch");
    return NextResponse.json({ error: "State verification mismatch." }, { status: 400 });
  }

  const { cardId, shareToken, isPopup } = verifiedState;

  try {
    const origin = req.nextUrl.origin;
    const config = getLinkedInOAuthConfig(origin);

    const tokenData = await exchangeLinkedInAuthCode(code, config);
    const memberInfo = await getLinkedInMemberInfo(tokenData.accessToken);

    const expiresAt = Date.now() + tokenData.expiresIn * 1000;
    const sealedSession = await sealLinkedInSession({
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      expiresAt,
      memberSub: memberInfo.sub,
      memberName: memberInfo.name,
      memberEmail: memberInfo.email,
      memberPicture: memberInfo.picture,
    });

    // Save encrypted session cookie
    cookieStore.set({
      name: LINKEDIN_AUTH_COOKIE_NAME,
      value: sealedSession,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: Math.min(tokenData.expiresIn, 60 * 24 * 60 * 60), // Up to 60 days
      path: "/",
    });

    if (isPopup) {
      return renderPopupHtml(cardId);
    }

    const returnUrl = new URL(`/cards/${cardId}`, req.url);
    returnUrl.searchParams.set("share", "true");
    returnUrl.searchParams.set("linkedin", "connected");
    if (shareToken) {
      returnUrl.searchParams.set("token", shareToken);
    }
    return NextResponse.redirect(returnUrl);
  } catch (err: unknown) {
    logger.error({ err }, "LinkedIn OAuth callback processing error");
    const errMsg = err instanceof Error ? err.message : "Failed to connect LinkedIn account.";
    if (isPopup) {
      return renderPopupHtml(cardId, errMsg);
    }
    const returnUrl = new URL(`/cards/${cardId}`, req.url);
    returnUrl.searchParams.set("share", "true");
    returnUrl.searchParams.set("linkedinError", encodeURIComponent(errMsg));
    if (shareToken) {
      returnUrl.searchParams.set("token", shareToken);
    }
    return NextResponse.redirect(returnUrl);
  }
}
