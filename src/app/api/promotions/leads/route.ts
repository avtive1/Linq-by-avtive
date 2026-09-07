import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "@/auth";
import { getLeadDatabaseAudience } from "@/lib/promotions/campaign-sender";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const eventId = searchParams.get("eventId") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 500;

    const leads = await getLeadDatabaseAudience({ eventId, limit });

    return NextResponse.json({
      success: true,
      count: leads.length,
      leads: leads.slice(0, 100), // Return preview sample
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load leads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
