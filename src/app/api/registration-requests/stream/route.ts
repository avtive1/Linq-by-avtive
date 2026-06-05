import { cookies } from "next/headers";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { queryNeonOne } from "@/lib/neon-db";
import { canReviewEventRegistrations } from "@/lib/services/registration.service";
import { orgChannel, subscribeRegistrationChannel } from "@/lib/services/realtime.service";
import { isValidUuid } from "@/lib/validation/uuid";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId") || "";
  if (!isValidUuid(eventId)) {
    return new Response("Invalid eventId", { status: 400 });
  }

  const cookieStore = await cookies();
  const reviewerUserId = await getServerUserIdFromCookies(cookieStore);
  if (!reviewerUserId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const event = await queryNeonOne<{ user_id: string }>(
    `SELECT user_id FROM public.events WHERE id = $1`,
    [eventId],
  );
  if (!event?.user_id) {
    return new Response("Event not found", { status: 404 });
  }

  const canReview = await canReviewEventRegistrations(reviewerUserId, event.user_id);
  if (!canReview) {
    return new Response("Forbidden", { status: 403 });
  }

  const organizationId = event.user_id;
  const channel = orgChannel(organizationId, eventId);
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("connected", { eventId, organizationId });

      unsubscribe = subscribeRegistrationChannel(channel, (message) => {
        send(message.event, message.payload);
      });

      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 25000);
    },
    cancel() {
      if (unsubscribe) unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
