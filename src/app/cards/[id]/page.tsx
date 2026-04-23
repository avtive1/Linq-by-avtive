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

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return {
    title: "Attendee Card | AVTIVE",
    description: "Secure attendee card access.",
  };
}

// This makes the page a Server Component
export default async function CardViewPage(props: { 
  params: Promise<{ id: string }>;
  searchParams: Promise<{ share?: string; token?: string }>;
}) {
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
  const token = String(searchParams?.token || "");
  let card: CardData | null = null;

  try {
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
      let sponsors = undefined as CardData["sponsors"];
      let organizationName = "";
      let organizationLogoUrl = "";
      if (secureRecord.event_id) {
        const ev = await queryNeonOne<{ sponsors: unknown; user_id: string | null }>(
          `SELECT sponsors, user_id
           FROM public.events
           WHERE id = $1`,
          [secureRecord.event_id],
        );
        if (ev) {
          sponsors = parseEventSponsors(ev.sponsors);
          if (ev.user_id) {
            try {
              const [userData, profileData] = await Promise.all([
                getAdminUserById(ev.user_id).catch(() => null),
                queryNeonOne<{ organization_name: string | null }>(
                  `SELECT organization_name FROM public.profiles WHERE id = $1`,
                  [ev.user_id],
                ),
              ]);
              organizationName =
                profileData?.organization_name ||
                (typeof userData?.publicMetadata?.organization_name === "string"
                  ? String(userData.publicMetadata.organization_name)
                  : "");
              organizationLogoUrl =
                typeof userData?.publicMetadata?.organization_logo_url === "string"
                  ? String(userData.publicMetadata.organization_logo_url)
                  : "";
            } catch (brandingErr) {
              console.error("Branding fetch failed:", brandingErr);
            }
          }
        }
      }

      card = {
        id: secureRecord.id,
        name: secureRecord.name,
      
        role: secureRecord.role || "Attendee", 
        company: secureRecord.company,
        email: secureRecord.card_email,
        eventId: secureRecord.event_id || undefined,
        eventName: secureRecord.event_name,
        sessionDate: secureRecord.session_date,
        sessionTime: secureRecord.session_time || undefined,
        location: secureRecord.location,
        track: secureRecord.track,
        year: secureRecord.year,
        linkedin: secureRecord.linkedin,
        photo: secureRecord.photo_url || undefined,
        designType: secureRecord.design_type,
        color: secureRecord.card_color,
        fontFamily: secureRecord.card_font || undefined,
        cardRole: secureRecord.track as "guest" | "visitor",
        sponsors,
        organizationName,
        organizationLogoUrl,
          cardPreviewUrl: typeof secureRecord.card_preview_url === "string" ? secureRecord.card_preview_url : undefined,
        verticalFrontUrl:
          process.env.CLOUDINARY_CLOUD_NAME && secureRecord.event_id
            ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/card-previews/${secureRecord.event_id}/${secureRecord.id}-vertical-front`
            : undefined,
        verticalBackUrl:
          process.env.CLOUDINARY_CLOUD_NAME && secureRecord.event_id
            ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/card-previews/${secureRecord.event_id}/${secureRecord.id}-vertical-back`
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

  return <CardView card={card} isShareMode={isShareMode} />;
}