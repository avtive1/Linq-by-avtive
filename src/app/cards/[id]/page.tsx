import Link from "next/link";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";
import { Info } from "lucide-react";
import CardView from "./CardView";
import { CardData } from "@/types/card";
import { parseEventSponsors } from "@/lib/sponsors";
import { Metadata } from "next";
import { decryptAttendeeSensitiveFields } from "@/lib/security/attendee-sensitive";
import { getAdminUserById } from "@/lib/admin";
import { queryNeonOne } from "@/lib/neon-db";
import { getServerAuthSession } from "@/auth";
import { verifyAttendeeCardToken } from "@/lib/security/tokens";
import { isValidUuid } from "@/lib/validation/uuid";
import { ensureAuthSchema } from "@/lib/auth-db";
import { cookies } from "next/headers";

/** Card branding comes from DB; avoid stale HTML after org logo updates. */
export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params;
  const id = params.id;
  const defaultTitle = "Attendee Card | AVTIVE";
  const defaultDesc = "Digital attendee badge for professional networking.";
  const fallbackImage = "https://linq.avtive.app/logo-preview.png"; // Make sure this exists or use a real public logo

  if (!isValidUuid(id)) {
    return { title: defaultTitle, description: defaultDesc };
  }

  try {
    // Timeout-resistant query (or just standard fetch)
    const record = await queryNeonOne<Record<string, unknown>>(
      `SELECT id, name, event_name, event_id, card_preview_url, photo_url 
       FROM public.attendees 
       WHERE id = $1`,
      [id]
    );

    if (!record) {
      return { title: defaultTitle, description: defaultDesc };
    }

    // Name and card_preview_url are Class C (public), no decryption needed
    const attendeeName = String(record.name || "Attendee").trim();
    const eventName = String(record.event_name || "Exclusive Event").trim();
    
    const cardTitle = `${attendeeName} Card | AVTIVE`;
    const cardDesc = `Attendee badge for ${eventName}. Scan to connect and view profile.`;
    
    let imageUrl = String(record.card_preview_url || "").trim();
    if (!imageUrl && process.env.CLOUDINARY_CLOUD_NAME && record.event_id) {
      imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/card-previews/${record.event_id}/${id}-horizontal`;
    }
    
    // Fallback if no image found
    if (!imageUrl) imageUrl = fallbackImage;

    const shareUrl = `https://linq.avtive.app/cards/${id}`;

    return {
      title: cardTitle,
      description: cardDesc,
      metadataBase: new URL("https://linq.avtive.app"),
      openGraph: {
        title: cardTitle,
        description: cardDesc,
        url: shareUrl,
        siteName: "AVTIVE",
        images: [
          { 
            url: imageUrl, 
            width: 1200, 
            height: 630,
            alt: `${attendeeName}'s Badge Preview`,
          }
        ],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: cardTitle,
        description: cardDesc,
        images: [imageUrl],
      },
    };
  } catch (err) {
    console.error("Metadata generation error:", err);
    return { 
      title: defaultTitle,
      description: defaultDesc,
      openGraph: {
        images: [fallbackImage],
      }
    };
  }
}

// This makes the page a Server Component
export default async function CardViewPage(props: { 
  params: Promise<{ id: string }>;
  searchParams: Promise<{ share?: string; token?: string; impersonate?: string }>;
}) {
  const appendVersionParam = (url: string, version: string) => {
    const cleanUrl = String(url || "").trim();
    if (!cleanUrl || !version) return cleanUrl;
    const sep = cleanUrl.includes("?") ? "&" : "?";
    return `${cleanUrl}${sep}v=${encodeURIComponent(version)}`;
  };
  const readString = (value: unknown) => (typeof value === "string" ? value : "");
  const params = await props.params;
  const searchParams = await props.searchParams;
  const id = params.id;
  if (!isValidUuid(id)) {
    return (
      <main className="relative min-h-screen w-full flex items-center justify-center p-8 text-center bg-transparent">
        <GradientBackground />
        <div className="relative z-10 flex flex-col items-center gap-4 glass-panel p-10 rounded-xl shadow-2xl max-w-sm animate-slide-up">
          <div className="flex flex-col gap-1">
            <p className="text-heading font-semibold">Invalid card link</p>
          </div>
        </div>
      </main>
    );
  }
  const isShareMode = searchParams?.share === "true";
  const cookieStore = await cookies();
  const savedViewMode = cookieStore.get("cardViewMode")?.value;
  const initialViewMode: "horizontal" | "vertical" =
    savedViewMode === "vertical" ? "vertical" : "horizontal";
  const token = String(searchParams?.token || "");
  const impersonateId = String(searchParams?.impersonate || "").trim();
  let card: CardData | null = null;

  try {
    await ensureAuthSchema();
    const session = await getServerAuthSession();
    const authedUserId = String(session?.user?.id || "").trim();
    let hasSignedAccess = false;
    if (!authedUserId && token) {
      try {
        const verified = await verifyAttendeeCardToken(token);
        hasSignedAccess =
          String(verified.payload.cardId || "") === id &&
          String(verified.payload.scope || "").includes("card:read");
      } catch {
        hasSignedAccess = false;
      }
    }
    if (!authedUserId && !hasSignedAccess) {
      return (
        <main className="relative min-h-screen w-full flex items-center justify-center p-8 text-center bg-transparent">
          <GradientBackground />
          <div className="relative z-10 flex flex-col items-center gap-4 glass-panel p-10 rounded-xl shadow-2xl max-w-sm animate-slide-up">
            <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-muted">
              <Info size={24} />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-heading font-semibold">Access denied</p>
              <p className="text-sm text-muted">Sign in or use a valid secure card link.</p>
            </div>
            <Link href="/login" className="mt-2">
              <Button variant="secondary">Go to Login</Button>
            </Link>
          </div>
        </main>
      );
    }

    const record = await queryNeonOne<Record<string, unknown>>(
      `SELECT * FROM public.attendees WHERE id = $1`,
      [id],
    );
    
    if (record) {
      const { row: secureRecord } = decryptAttendeeSensitiveFields(record);
      const previewVersion = [
        String(secureRecord.updated_at || "").trim(),
        readString(secureRecord.photo_url),
        readString(secureRecord.name),
        readString(secureRecord.role),
        readString(secureRecord.company),
        readString(secureRecord.card_color),
        readString(secureRecord.linkedin),
      ]
        .filter(Boolean)
        .join("|");
      let sponsors = undefined as CardData["sponsors"];
      let organizationName = "";
      let organizationLogoUrl = "";
      if (secureRecord.event_id) {
        const ev = await queryNeonOne<{ sponsors: unknown; user_id: string | null; logo_url: string | null }>(
          `SELECT sponsors, user_id, logo_url
           FROM public.events
           WHERE id = $1`,
          [secureRecord.event_id],
        );
        if (ev) {
          sponsors = parseEventSponsors(ev.sponsors);
          const campaignLogoUrl = String(ev.logo_url || "").trim();
          
          if (ev.user_id) {
            try {
              const ownerId = String(ev.user_id).trim();
              const profileData = await queryNeonOne<{
                organization_name: string | null;
                organization_logo_url: string | null;
              }>(
                `SELECT
                   organization_name,
                   to_jsonb(p.*)->>'organization_logo_url' AS organization_logo_url
                 FROM public.profiles p
                 WHERE id = $1::uuid`,
                [ownerId],
              );
              let userData: Awaited<ReturnType<typeof getAdminUserById>> | null = null;
              try {
                userData = await getAdminUserById(ownerId);
              } catch {
                userData = null;
              }
              organizationName =
                String(profileData?.organization_name || "").trim() ||
                (typeof userData?.publicMetadata?.organization_name === "string"
                  ? String(userData.publicMetadata.organization_name).trim()
                  : "");
              
              // Campaign-specific logo takes precedence over profile logo
              organizationLogoUrl = campaignLogoUrl ||
                String(profileData?.organization_logo_url || "").trim() ||
                (typeof userData?.publicMetadata?.organization_logo_url === "string"
                  ? String(userData.publicMetadata.organization_logo_url).trim()
                  : "");
            } catch (brandingErr) {
              console.error("Branding fetch failed:", brandingErr);
            }
          }
        }
      }

      card = {
        id: readString(secureRecord.id),
        name: readString(secureRecord.name),
      
        role: readString(secureRecord.role) || "Attendee", 
        company: readString(secureRecord.company),
        email: readString(secureRecord.card_email),
        eventId: readString(secureRecord.event_id) || undefined,
        eventName: readString(secureRecord.event_name),
        sessionDate: readString(secureRecord.session_date),
        sessionTime: readString(secureRecord.session_time) || undefined,
        location: readString(secureRecord.location),
        track: readString(secureRecord.track),
        year: readString(secureRecord.year),
        linkedin: readString(secureRecord.linkedin),
        photo: readString(secureRecord.photo_url) || undefined,
        designType: readString(secureRecord.design_type),
        color: readString(secureRecord.card_color),
        fontFamily: readString(secureRecord.card_font) || undefined,
        cardRole: readString(secureRecord.track) as "guest" | "visitor",
        sponsors,
        organizationName,
        organizationLogoUrl,
        cardPreviewUrl:
          appendVersionParam(
            readString(secureRecord.card_preview_url) ||
          (process.env.CLOUDINARY_CLOUD_NAME && readString(secureRecord.event_id)
            ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/card-previews/${readString(secureRecord.event_id)}/${readString(secureRecord.id)}-horizontal`
            : ""),
            previewVersion,
          ) || undefined,
        verticalFrontUrl:
          process.env.CLOUDINARY_CLOUD_NAME && readString(secureRecord.event_id)
            ? appendVersionParam(
                `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/card-previews/${readString(secureRecord.event_id)}/${readString(secureRecord.id)}-vertical-front`,
                previewVersion,
              )
            : undefined,
        verticalBackUrl:
          process.env.CLOUDINARY_CLOUD_NAME && readString(secureRecord.event_id)
            ? appendVersionParam(
                `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/card-previews/${readString(secureRecord.event_id)}/${readString(secureRecord.id)}-vertical-back`,
                previewVersion,
              )
            : undefined,
      };
    }
  } catch (err) {
    console.error("Server-side fetch error:", err);
    card = null;
  }

  if (!card) {
    return (
      <main className="relative min-h-screen w-full flex items-center justify-center p-8 text-center bg-transparent">
        <GradientBackground />
        <div className="relative z-10 flex flex-col items-center gap-4 glass-panel p-10 rounded-xl shadow-2xl max-w-sm animate-slide-up">
          <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-muted">
            <Info size={24} />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-heading font-semibold">Card not found</p>
            <p className="text-sm text-muted">
                The card you&apos;re looking for doesn&apos;t exist or my connection to the database is sleeping.
            </p>
          </div>
          {!isShareMode && (
            <Link href="/dashboard" className="mt-2">
              <Button variant="secondary">Back to Dashboard</Button>
            </Link>
          )}
        </div>
      </main>
    );
  }

  return (
    <CardView
      card={card}
      isShareMode={isShareMode}
      initialViewMode={initialViewMode}
      impersonateId={impersonateId}
    />
  );
}