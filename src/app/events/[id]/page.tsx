import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EventLandingPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { id } = await params;
  const sParams = await searchParams;
  const query = new URLSearchParams();
  Object.entries(sParams).forEach(([key, value]) => {
    if (typeof value === "string") {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  redirect(`/events/${id}/register${queryString ? `?${queryString}` : ""}`);
}
