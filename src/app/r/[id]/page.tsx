import { queryNeonOne } from "@/lib/neon-db";
import { redirect } from "next/navigation";

export default async function ShortLinkPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { id } = await params;
  const sParams = await searchParams;
  
  // Try finding by short_id first
  let event = await queryNeonOne<{ id: string }>(
    `SELECT id FROM public.events WHERE short_id = $1 LIMIT 1`,
    [id]
  );
  
  // Fallback to UUID if not found by short_id (supports existing long links too)
  if (!event) {
    // Simple check if it looks like a UUID
    if (id.length > 20) {
      event = await queryNeonOne<{ id: string }>(
        `SELECT id FROM public.events WHERE id = $1 LIMIT 1`,
        [id]
      );
    }
  }

  if (!event) {
    redirect("/");
  }

  // Build the target URL for the registration page
  const query = new URLSearchParams();
  query.set("eventId", event.id);
  query.set("share", "true"); // Always set share for tracked links
  
  // Handle shorter query parameters for even cleaner links
  Object.entries(sParams).forEach(([key, value]) => {
    if (typeof value === 'string') {
      if (key === 'r') {
        // Map r=g to role=guest, r=v to role=visitor
        query.set('role', value === 'g' ? 'guest' : 'visitor');
      } else if (key === 'c') {
        // Map c=Category to guestCategory=Category
        query.set('guestCategory', value);
      } else {
        query.set(key, value);
      }
    }
  });

  redirect(`/cards/new?${query.toString()}`);
}
