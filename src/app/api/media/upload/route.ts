import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { queryNeonOne } from "@/lib/neon-db";

async function canUploadToFolder(userId: string, folder: string): Promise<boolean> {
  const normalized = folder.trim().replace(/^\/+|\/+$/g, "");
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
    // Organization logos are tenant assets; require authenticated user.
    return true;
  }
  return false;
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = await getServerUserIdFromCookies(cookieStore);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as {
      dataUrl?: string;
      folder?: string;
      publicId?: string;
    };
    const dataUrl = String(body.dataUrl || "");
    if (!dataUrl.startsWith("data:")) {
      return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
    }
    const folder = String(body.folder || "");
    if (!folder) {
      return NextResponse.json({ error: "folder is required." }, { status: 400 });
    }
    const allowed = await canUploadToFolder(userId, folder);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const uploaded = await uploadImageToCloudinary({
      file: dataUrl,
      folder,
      publicId: body.publicId ? String(body.publicId) : undefined,
    });
    return NextResponse.json(
      { data: { url: uploaded.secureUrl, publicId: uploaded.publicId } },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Media upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
