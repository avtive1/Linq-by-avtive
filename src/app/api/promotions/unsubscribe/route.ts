import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger-server";

export const dynamic = "force-dynamic";

/**
 * Handle RFC 8058 One-Click POST unsubscribe from email clients
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get("email") || "";
    const token = searchParams.get("token") || "";

    logger.info({ email, token }, "Promotional email one-click unsubscribe received");

    return new NextResponse("Unsubscribed successfully.", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    logger.error({ err: error }, "Error handling unsubscribe POST");
    return new NextResponse("Error processing unsubscribe request", { status: 500 });
  }
}

/**
 * Handle browser GET unsubscribe page
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const email = searchParams.get("email") || "your email address";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed &bull; Linq by Avtive</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: #ffffff; max-width: 440px; width: 100%; padding: 40px 32px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.06); text-align: center; }
    .icon { width: 52px; height: 52px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 50%; color: #16a34a; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 24px; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 10px; color: #0f172a; }
    p { font-size: 14px; line-height: 1.6; color: #64748b; margin: 0 0 24px; }
    .email-tag { display: inline-block; background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-weight: 600; color: #334155; font-size: 13px; margin-bottom: 16px; }
    .btn { display: inline-block; padding: 10px 20px; font-size: 14px; font-weight: 600; color: #ffffff; background: #7c3aed; border-radius: 8px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10003;</div>
    <h1>You have been unsubscribed</h1>
    <span class="email-tag">${email.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>
    <p>You will no longer receive promotional emails and product announcements from this sender. Transactional receipts and account security notices will continue.</p>
    <a href="https://linq.avtive.app" class="btn">Return to Linq</a>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
