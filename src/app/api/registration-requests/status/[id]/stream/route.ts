import { getPublicRegistrationStatus } from "@/lib/services/registration.service";
import { subscribeRegistrationChannel, userChannel } from "@/lib/services/realtime.service";
import { isValidUuid } from "@/lib/validation/uuid";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidUuid(id)) {
    return new Response("Invalid request id", { status: 400 });
  }

  const initial = await getPublicRegistrationStatus(id);
  if (!initial) {
    return new Response("Registration request not found", { status: 404 });
  }

  const channel = userChannel(id);
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("status", initial);

      if (initial.status !== "PENDING") {
        controller.close();
        return;
      }

      unsubscribe = subscribeRegistrationChannel(channel, async (message) => {
        send(message.event, message.payload);
        const latest = await getPublicRegistrationStatus(id);
        if (latest && latest.status !== "PENDING") {
          send("status", latest);
          controller.close();
          if (unsubscribe) unsubscribe();
          if (heartbeat) clearInterval(heartbeat);
        }
      });

      heartbeat = setInterval(async () => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
        const latest = await getPublicRegistrationStatus(id);
        if (latest && latest.status !== "PENDING") {
          send("status", latest);
          controller.close();
          if (unsubscribe) unsubscribe();
          if (heartbeat) clearInterval(heartbeat);
        }
      }, 5000);
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
