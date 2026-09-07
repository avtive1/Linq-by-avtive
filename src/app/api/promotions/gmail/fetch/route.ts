import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "@/auth";
import { fetchGmailPromotions } from "@/lib/promotions/gmail-inbound";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q") || "category:promotions";
    const pageToken = searchParams.get("pageToken") || undefined;
    const maxResults = searchParams.get("maxResults") ? parseInt(searchParams.get("maxResults")!, 10) : 20;

    const result = await fetchGmailPromotions({
      q,
      labelIds: ["CATEGORY_PROMOTIONS"],
      pageToken,
      maxResults,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch Gmail promotions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
