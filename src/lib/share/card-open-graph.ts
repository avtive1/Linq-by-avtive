import { getPublicAppUrl } from "@/lib/app-url";
import { toAbsolutePublicUrl } from "@/lib/share/linkedin-card-share";

const FALLBACK_OG_IMAGE = "https://linq.avtive.app/logo-preview.png";

/** LinkedIn recommends 1200×630; apply Cloudinary crop when possible. */
export function optimizeImageForLinkedInOg(imageUrl: string): string {
  const trimmed = String(imageUrl || "").trim();
  if (!trimmed) return trimmed;
  if (!trimmed.includes("res.cloudinary.com") || !trimmed.includes("/image/upload/")) {
    return trimmed;
  }
  if (trimmed.includes("/image/upload/w_1200,")) {
    return trimmed;
  }
  return trimmed.replace(
    "/image/upload/",
    "/image/upload/w_1200,h_630,c_fill,f_auto,q_auto/",
  );
}

export function resolveCardOpenGraphImage(input: {
  cardPreviewUrl?: unknown;
  eventId?: unknown;
  cardId: string;
  cloudinaryCloudName?: string;
}): string {
  const base = getPublicAppUrl();
  let imageUrl = String(input.cardPreviewUrl || "").trim();

  if (!imageUrl && input.cloudinaryCloudName && input.eventId) {
    imageUrl = `https://res.cloudinary.com/${input.cloudinaryCloudName}/image/upload/w_1200,h_630,c_fill,f_auto,q_auto/card-previews/${String(input.eventId)}/${input.cardId}-horizontal`;
  }

  if (!imageUrl) {
    return FALLBACK_OG_IMAGE;
  }

  return optimizeImageForLinkedInOg(toAbsolutePublicUrl(imageUrl, base));
}

export function buildCardShareLandingPath(cardId: string): string {
  return `/cards/${encodeURIComponent(cardId)}/share`;
}

export function buildCardOpenGraphMeta(input: {
  cardId: string;
  attendeeName: string;
  eventName: string;
  imageUrl: string;
}) {
  const base = getPublicAppUrl();
  const cardTitle = `${input.attendeeName} | ${input.eventName}`;
  const cardDesc = `${input.attendeeName} is attending ${input.eventName}. View their AVTIVE attendee badge.`;
  const shareUrl = `${base}${buildCardShareLandingPath(input.cardId)}`;

  return {
    title: cardTitle,
    description: cardDesc,
    metadataBase: new URL(base),
    openGraph: {
      title: cardTitle,
      description: cardDesc,
      url: shareUrl,
      siteName: "AVTIVE",
      images: [
        {
          url: input.imageUrl,
          width: 1200,
          height: 630,
          alt: `${input.attendeeName}'s event badge`,
        },
      ],
      type: "website" as const,
    },
    twitter: {
      card: "summary_large_image" as const,
      title: cardTitle,
      description: cardDesc,
      images: [input.imageUrl],
    },
  };
}
