const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "";

function ensureCloudinaryEnv() {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error(
      "Missing Cloudinary credentials. Expected CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.",
    );
  }
}

function getUploadEndpoint() {
  ensureCloudinaryEnv();
  return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
}

function getDestroyEndpoint() {
  ensureCloudinaryEnv();
  return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`;
}

function getAuthHeader() {
  const token = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString("base64");
  return `Basic ${token}`;
}

export function extractCloudinaryPublicId(url: string): string | null {
  if (!url || !url.includes("/upload/")) return null;
  try {
    const parsed = new URL(url);
    const marker = "/upload/";
    const idx = parsed.pathname.indexOf(marker);
    if (idx < 0) return null;
    const tail = parsed.pathname.slice(idx + marker.length);
    const withoutVersion = tail.replace(/^v\d+\//, "");
    const withoutExt = withoutVersion.replace(/\.[a-zA-Z0-9]+$/, "");
    return withoutExt || null;
  } catch {
    return null;
  }
}

export async function uploadImageToCloudinary(input: {
  file: string;
  folder?: string;
  publicId?: string;
}): Promise<{ secureUrl: string; publicId: string }> {
  const formData = new FormData();
  formData.append("file", input.file);
  if (input.folder) formData.append("folder", input.folder);
  if (input.publicId) formData.append("public_id", input.publicId);

  const response = await fetch(getUploadEndpoint(), {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
    },
    body: formData,
  });
  const payload = (await response.json()) as { secure_url?: string; public_id?: string; error?: { message?: string } };
  if (!response.ok || !payload?.secure_url || !payload?.public_id) {
    throw new Error(payload?.error?.message || "Cloudinary upload failed.");
  }
  return { secureUrl: payload.secure_url, publicId: payload.public_id };
}

export async function deleteImageFromCloudinary(publicId: string): Promise<"ok" | "not found"> {
  if (!publicId) return "not found";
  const formData = new FormData();
  formData.append("public_id", publicId);
  const response = await fetch(getDestroyEndpoint(), {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
    },
    body: formData,
  });
  const payload = (await response.json()) as { result?: string; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Cloudinary delete failed.");
  }
  if (payload?.result !== "ok" && payload?.result !== "not found") {
    throw new Error("Cloudinary delete did not confirm removal.");
  }
  return payload.result;
}
