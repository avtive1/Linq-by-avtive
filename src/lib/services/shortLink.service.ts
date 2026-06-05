import { getPublicAppUrl } from "@/lib/app-url";
import { insertRow, queryNeon, queryNeonOne } from "@/lib/neon-db";
import { generateUrlSlug } from "@/lib/utils/slugGenerator";
import { ensureShortLinksSchema } from "@/lib/services/short-link-schema";

const SLUG_LENGTH = Number(process.env.SHORT_LINK_SLUG_LENGTH || 6);
const MAX_CREATE_ATTEMPTS = 8;

function normalizeTargetPath(path: string): string {
  const trimmed = String(path || "").trim();
  if (!trimmed) throw new Error("targetPath is required.");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      return `${url.pathname}${url.search}`;
    } catch {
      throw new Error("Invalid target URL.");
    }
  }
  if (!trimmed.startsWith("/")) {
    return `/${trimmed}`;
  }
  return trimmed;
}

export async function resolveShortLinkTarget(slug: string): Promise<string | null> {
  await ensureShortLinksSchema();
  const row = await queryNeonOne<{ target_path: string; id: string }>(
    `SELECT id, target_path FROM public.short_links WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  if (!row?.target_path) return null;

  try {
    await queryNeon(
      `UPDATE public.short_links
       SET hit_count = hit_count + 1,
           last_accessed_at = now()
       WHERE id = $1`,
      [row.id],
    );
  } catch {
    // Analytics update is best-effort.
  }

  return row.target_path;
}

export async function findShortLinkByTargetPath(targetPath: string): Promise<{ slug: string } | null> {
  await ensureShortLinksSchema();
  const normalized = normalizeTargetPath(targetPath);
  const row = await queryNeonOne<{ slug: string }>(
    `SELECT slug FROM public.short_links WHERE target_path = $1 ORDER BY created_at ASC LIMIT 1`,
    [normalized],
  );
  return row?.slug ? { slug: row.slug } : null;
}

export async function createShortLink(input: {
  targetPath: string;
  createdByUserId?: string | null;
}): Promise<{ slug: string; targetPath: string }> {
  await ensureShortLinksSchema();
  const targetPath = normalizeTargetPath(input.targetPath);

  const existing = await findShortLinkByTargetPath(targetPath);
  if (existing) {
    return { slug: existing.slug, targetPath };
  }

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
    const slug = generateUrlSlug(SLUG_LENGTH);
    try {
      const row = await insertRow(
        "short_links",
        {
          slug,
          target_path: targetPath,
          created_by_user_id: input.createdByUserId || null,
        },
        "slug, target_path",
      );
      if (row?.slug) {
        return { slug: String(row.slug), targetPath };
      }
    } catch (error: unknown) {
      const isUniqueViolation =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        String((error as { code?: string }).code) === "23505";
      if (!isUniqueViolation) throw error;
    }
  }

  throw new Error("Could not allocate a unique short link slug.");
}

export async function ensureShortLinkForPath(
  targetPath: string,
  createdByUserId?: string | null,
): Promise<{ slug: string; shortPath: string; targetPath: string }> {
  const link = await createShortLink({ targetPath, createdByUserId });
  return {
    slug: link.slug,
    shortPath: `/ev/${link.slug}`,
    targetPath: link.targetPath,
  };
}

/** Server-side compact URL for emails and notifications. Falls back to the long URL on failure. */
export async function toPublicCompactUrl(
  targetPath: string,
  createdByUserId?: string | null,
): Promise<string> {
  const base = getPublicAppUrl();
  const normalized = normalizeTargetPath(targetPath);
  try {
    const link = await ensureShortLinkForPath(normalized, createdByUserId);
    return `${base}${link.shortPath}`;
  } catch {
    return `${base}${normalized}`;
  }
}
