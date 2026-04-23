import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteImageFromCloudinary, extractCloudinaryPublicId } from "@/lib/cloudinary";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { queryNeonOne } from "@/lib/neon-db";

async function canDeletePublicId(userId: string, publicId: string): Promise<boolean> {
  const normalized = publicId.trim().replace(/^\/+|\/+$/g, "");
  if (!normalized) return false;
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return false;

  if (parts[0] === "events") {
    return parts[1] === userId;
  }
  if (parts[0] === "attendees" || parts[0] === "card-previews") {
    const eventId = parts[1];
    if (!eventId || eventId === "general") return false;
    const event = await queryNeonOne<{ user_id: string | null }>(
      `SELECT user_id FROM public.events WHERE id = $1 LIMIT 1`,
      [eventId],
    );
    return event?.user_id === userId;
  }
  if (parts.length >= 3 && parts[1] === "sponsors") {
    return parts[0] === userId;
  }
  if (parts[0] === "organization-logos") {
    return true;
  }
  return false;
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = await getServerUserIdFromCookies(cookieStore);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as { publicId?: string; url?: string };
    const directPublicId = String(body.publicId || "");
    const fromUrl = body.url ? extractCloudinaryPublicId(String(body.url)) : null;
    const publicId = directPublicId || fromUrl || "";
    if (!publicId) {
      return NextResponse.json({ success: true }, { status: 200 });
    }
    const allowed = await canDeletePublicId(userId, publicId);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const result = await deleteImageFromCloudinary(publicId);
    return NextResponse.json({ success: true, data: { publicId, result } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Media delete failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
