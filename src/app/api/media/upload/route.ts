import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { queryNeon, queryNeonOne } from "@/lib/neon-db";

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
    if (event?.user_id === userId) return true;

    // Active team members with edit/manage access can upload attendee assets and card previews.
    const membership = await queryNeonOne<{ id: string; role_label: string }>(
      `SELECT id
              , role_label
       FROM public.organization_members
       WHERE member_user_id = $1
         AND org_owner_user_id = $2
         AND status = 'active'
       LIMIT 1`,
      [userId, String(event?.user_id || "")],
    );
    if (!membership?.id) return false;

    const grants = await queryNeon<{ permission: string }>(
      `SELECT permission
       FROM public.access_grants
       WHERE event_id = $1
         AND grantee_user_id = $2
         AND status = 'active'`,
      [eventId, userId],
    );
    const permissionSet = new Set(grants.map((row) => String(row.permission || "")));
    if (permissionSet.has("manage_event") || permissionSet.has("edit_cards")) return true;

    // Fallback for recently approved members where event grants are not yet synced.
    const roleTemplate = await queryNeonOne<{ permissions: string[] | null }>(
      `SELECT permissions
       FROM public.organization_role_permission_templates
       WHERE org_owner_user_id = $1
         AND role_label = $2
       LIMIT 1`,
      [String(event?.user_id || ""), String(membership.role_label || "")],
    );
    const templatePermissions = new Set(Array.isArray(roleTemplate?.permissions) ? roleTemplate.permissions : []);
    return templatePermissions.has("manage_event") || templatePermissions.has("edit_cards");
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

async function canPublicRegistrationUploadToFolder(folder: string): Promise<boolean> {
  const normalized = folder.trim().replace(/^\/+|\/+$/g, "");
  const parts = normalized.split("/").filter(Boolean);
  if (!(parts[0] === "attendees" || parts[0] === "card-previews")) return false;
  const eventId = String(parts[1] || "").trim();
  if (!eventId || eventId === "general") return false;
  return true;
}

export async function POST(req: Request) {
  try {
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

    const normalizedFolder = folder.trim().replace(/^\/+|\/+$/g, "");
    const isSignupOrgLogoUpload = normalizedFolder === "organization-logos";

    let userId: string | null = null;
    if (!isSignupOrgLogoUpload) {
      const cookieStore = await cookies();
      userId = await getServerUserIdFromCookies(cookieStore);
      if (!userId) {
        const publicAllowed = await canPublicRegistrationUploadToFolder(folder);
        if (!publicAllowed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    if (userId) {
      const allowed = await canUploadToFolder(userId, folder);
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
