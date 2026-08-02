import { NextResponse } from "next/server";
import { processEmailOutbox } from "@/lib/notifications/email-outbox";
import { logger } from "@/lib/logger-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processEmailOutbox();
    if (result.failed > 0) {
      logger.warn({ outbox: result }, "Email outbox worker completed with delivery failures");
    } else if (result.claimed > 0) {
      logger.info({ outbox: result }, "Email outbox worker completed");
    }
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Email outbox processing failed.";
    logger.error({ err: error instanceof Error ? error : undefined }, "Email outbox worker failed");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
