import { resolveShortLinkTarget } from "@/lib/services/shortLink.service";
import { redirect, notFound } from "next/navigation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ShortLinkRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const normalized = String(slug || "").trim();
  if (!normalized || normalized.length > 32) {
    notFound();
  }

  const targetPath = await resolveShortLinkTarget(normalized);
  if (!targetPath) {
    notFound();
  }

  redirect(targetPath);
}
