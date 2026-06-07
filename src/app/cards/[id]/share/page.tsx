import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildCardOpenGraphMeta, resolveCardOpenGraphImage } from "@/lib/share/card-open-graph";
import { loadCardSharePreview } from "@/lib/share/load-card-share-preview";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const preview = await loadCardSharePreview(id);
  if (!preview) {
    return { title: "Attendee Card | AVTIVE" };
  }

  const imageUrl = resolveCardOpenGraphImage({
    cardPreviewUrl: preview.cardPreviewUrl,
    eventId: preview.eventId,
    cardId: preview.id,
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });

  return buildCardOpenGraphMeta({
    cardId: preview.id,
    attendeeName: preview.name,
    eventName: preview.eventName,
    imageUrl,
  });
}

export default async function CardLinkedInSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const preview = await loadCardSharePreview(id);
  if (!preview) notFound();

  const imageUrl = resolveCardOpenGraphImage({
    cardPreviewUrl: preview.cardPreviewUrl,
    eventId: preview.eventId,
    cardId: preview.id,
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl flex flex-col items-center gap-6">
        <div className="text-center space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-white/60">AVTIVE attendee badge</p>
          <h1 className="text-3xl font-semibold tracking-tight">{preview.name}</h1>
          <p className="text-lg text-white/75">
            {preview.eventName}
            {preview.role || preview.company
              ? ` · ${[preview.role, preview.company].filter(Boolean).join(" at ")}`
              : ""}
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`${preview.name} attendee badge for ${preview.eventName}`}
          width={1200}
          height={630}
          className="w-full max-w-4xl rounded-xl border border-white/10 shadow-2xl"
        />
      </div>
    </main>
  );
}
