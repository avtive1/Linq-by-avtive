import { queryNeonOne } from "@/lib/neon-db";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EventRegisterPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { id } = await params;
  const sParams = await searchParams;
  
  // 1. Resolve event by short_id first
  let event = await queryNeonOne<{ id: string }>(
    `SELECT id FROM public.events WHERE short_id = $1 LIMIT 1`,
    [id]
  );
  
  // 2. Fallback to UUID lookup if not found by short_id
  if (!event && id.length > 20) {
    event = await queryNeonOne<{ id: string }>(
      `SELECT id FROM public.events WHERE id = $1 LIMIT 1`,
      [id]
    );
  }

  if (!event) {
    redirect("/");
  }

  // 3. Forward query parameters to /cards/new
  const query = new URLSearchParams();
  query.set("eventId", event.id);
  query.set("share", "true");
  
  Object.entries(sParams).forEach(([key, value]) => {
    if (typeof value === "string") {
      if (key === "r") {
        query.set("role", value === "g" ? "guest" : "visitor");
      } else if (key === "c") {
        query.set("guestCategory", value);
      } else {
        query.set(key, value);
      }
    }
  });

  redirect(`/cards/new?${query.toString()}`);
}
