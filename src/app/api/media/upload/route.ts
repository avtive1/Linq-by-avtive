import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import { isValidImageDataUrl } from "@/lib/utils/image-data-url";

async function canUploadToFolder(userId: string, folder: string): Promise<boolean> {
  const normalized = folder.trim().replace(/^\/+|\/+$/g, "");
  if (!normalized) return false;

  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return false;

  if (parts[0] === "events") {
    return true;
  }
  if (parts[0] === "attendees" || parts[0] === "card-previews") {
    const eventId = parts[1];
    if (!eventId || eventId === "general") return true;
    const event = await queryNeonOne<{ user_id: string | null }>(
      `SELECT user_id FROM public.events WHERE id = $1 LIMIT 1`,
      [eventId],
    );
    return Boolean(event);
  }
  if (parts.length >= 3 && parts[1] === "sponsors") {
    return parts[0] === userId;
  }
  if (parts[0] === "sponsors") {
    return parts[1] === userId;
  }
  if (parts[0] === "organization-logos") {
    return true;
  }
  return false;
}

async function canPublicRegistrationUploadToFolder(folder: string): Promise<boolean> {
  const normalized = folder.trim().replace(/^\/+|\/+$/g, "");
  const parts = normalized.split("/").filter(Boolean);
  if (!(parts[0] === "attendees" || parts[0] === "card-previews")) return false;
  const eventId = String(parts[1] || "").trim();
  if (!eventId || eventId === "general") return true;
  const event = await queryNeonOne<{ id: string }>(
    `SELECT id FROM public.events WHERE id = $1 LIMIT 1`,
    [eventId],
  );
  return Boolean(event?.id);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      dataUrl?: string;
      folder?: string;
      publicId?: string;
    };
    const dataUrl = String(body.dataUrl || "").trim();
    if (!isValidImageDataUrl(dataUrl)) {
      return NextResponse.json({ error: "Invalid or empty image data." }, { status: 400 });
    }
    const folder = String(body.folder || "");
    if (!folder) {
      return NextResponse.json({ error: "folder is required." }, { status: 400 });
    }

    const normalizedFolder = folder.trim().replace(/^\/+|\/+$/g, "");
    const isSignupOrgLogoUpload = normalizedFolder === "organization-logos";
    const isPublicAttendeeOrPreview = await canPublicRegistrationUploadToFolder(folder);

    if (!isSignupOrgLogoUpload && !isPublicAttendeeOrPreview) {
      const cookieStore = await cookies();
      const userId = await getServerUserIdFromCookies(cookieStore);
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const allowed = await canUploadToFolder(userId, folder);
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

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
