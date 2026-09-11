import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import { isValidUuid } from "@/lib/validation/uuid";
import { getServerAuthSession } from "@/auth";
import { verifyAttendeeCardToken } from "@/lib/security/tokens";
import { decryptAttendeeSensitiveFields } from "@/lib/security/attendee-sensitive";
import {
  unsealLinkedInSession,
  initializeLinkedInImageUpload,
  uploadImageBinaryToLinkedIn,
  createLinkedInImagePost,
  LINKEDIN_AUTH_COOKIE_NAME,
} from "@/lib/services/linkedin.service";
import {
  buildCardLinkedInSharePost,
  buildPublicCardShareLandingUrl,
} from "@/lib/share/linkedin-card-share";
import { resolveCardOpenGraphImage } from "@/lib/share/card-open-graph";
import { logger } from "@/lib/logger-server";

export const dynamic = "force-dynamic";

// In-memory debounce map for duplicate post protection (prevents rapid double-clicks)
const recentShareAttempts = new Map<string, { timestamp: number; result?: { postUrn: string; postUrl: string } }>();

// Clean up debounce cache entries older than 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of recentShareAttempts.entries()) {
    if (now - val.timestamp > 120000) {
      recentShareAttempts.delete(key);
    }
  }
}, 60000).unref?.();

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      cardId?: string;
      shareToken?: string;
      commentary?: string;
    };

    const cardId = String(body.cardId || "").trim();
    const shareToken = String(body.shareToken || "").trim();
    const customCommentary = body.commentary;

    if (!cardId || !isValidUuid(cardId)) {
      return NextResponse.json({ error: "A valid card ID is required." }, { status: 400 });
    }

    // 1. Verify LinkedIn session
    const cookieStore = await cookies();
    const rawSessionCookie = cookieStore.get(LINKEDIN_AUTH_COOKIE_NAME)?.value;
    if (!rawSessionCookie) {
      return NextResponse.json(
        {
          error: "Please connect your LinkedIn account first.",
          code: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    const linkedInSession = await unsealLinkedInSession(rawSessionCookie);
    if (!linkedInSession || !linkedInSession.accessToken) {
      return NextResponse.json(
        {
          error: "LinkedIn authorization expired. Please connect your LinkedIn account.",
          code: "AUTH_EXPIRED",
        },
        { status: 401 }
      );
    }

    // 2. Double-post / rapid click prevention
    const debounceKey = `${cardId}:${linkedInSession.memberSub}`;
    const recent = recentShareAttempts.get(debounceKey);
    const now = Date.now();
    if (recent && now - recent.timestamp < 15000) {
      if (recent.result) {
        return NextResponse.json({
          success: true,
          postUrn: recent.result.postUrn,
          postUrl: recent.result.postUrl,
          memberName: linkedInSession.memberName,
          isDuplicatePrevented: true,
        });
      }
      return NextResponse.json(
        { error: "A LinkedIn post request is already in progress for this card. Please wait a moment." },
        { status: 429 }
      );
    }
    recentShareAttempts.set(debounceKey, { timestamp: now });

    // 3. Fetch attendee record and verify existence
    const rawAttendee = await queryNeonOne<Record<string, unknown>>(
      `SELECT * FROM public.attendees WHERE id = $1`,
      [cardId]
    );

    if (!rawAttendee) {
      recentShareAttempts.delete(debounceKey);
      return NextResponse.json({ error: "Attendee card not found." }, { status: 404 });
    }

    const { row: secureAttendee } = decryptAttendeeSensitiveFields(rawAttendee);

    // 4. Security: Check card ownership / view permission
    const appSession = await getServerAuthSession();
    const authedUserId = String(appSession?.user?.id || "").trim();
    const sessionEmail = String(appSession?.user?.email || "").trim().toLowerCase();
    const attendeeEmail = String(secureAttendee.card_email || "").trim().toLowerCase();

    let hasAccess = false;

    // Check signed attendee card token
    if (shareToken) {
      try {
        const verified = await verifyAttendeeCardToken(shareToken);
        const tokenCardId = String(verified.payload.cardId || "").trim();
        const tokenScope = String(verified.payload.scope || "").trim();
        if (tokenCardId === cardId && (tokenScope.includes("card:read") || tokenScope.includes("card:edit"))) {
          hasAccess = true;
        }
      } catch {
        hasAccess = false;
      }
    }

    // Check logged-in user
    if (!hasAccess && authedUserId) {
      const isCardOwner = Boolean(
        (rawAttendee.user_id && String(rawAttendee.user_id).trim() === authedUserId) ||
        (sessionEmail && attendeeEmail && attendeeEmail === sessionEmail)
      );

      const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const role = String(appSession?.user?.role || "").toLowerCase();
      const isAdmin = role === "admin" || Boolean(sessionEmail && adminEmails.includes(sessionEmail));

      let isOrganizer = false;
      if (rawAttendee.event_id) {
        const event = await queryNeonOne<{ user_id: string | null }>(
          `SELECT user_id FROM public.events WHERE id = $1`,
          [rawAttendee.event_id]
        );
        if (event?.user_id === authedUserId) {
          isOrganizer = true;
        }
      }

      hasAccess = isCardOwner || isAdmin || isOrganizer;
    }

    // If viewing public card page without login, allow attendee who authorizes their own LinkedIn
    if (!hasAccess && !authedUserId) {
      hasAccess = true;
    }

    if (!hasAccess) {
      recentShareAttempts.delete(debounceKey);
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to share this attendee card." },
        { status: 403 }
      );
    }

    // 5. Resolve the attendee card image URL from server
    let resolvedImageUrl = String(secureAttendee.card_preview_url || "").trim();
    if (!resolvedImageUrl && secureAttendee.event_id && process.env.CLOUDINARY_CLOUD_NAME) {
      resolvedImageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/card-previews/${secureAttendee.event_id}/${cardId}-horizontal`;
    }

    if (!resolvedImageUrl) {
      // Fallback through open-graph resolver
      resolvedImageUrl = resolveCardOpenGraphImage({
        cardPreviewUrl: secureAttendee.card_preview_url,
        eventId: secureAttendee.event_id,
        cardId,
        cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
      });
    }

    if (!resolvedImageUrl) {
      recentShareAttempts.delete(debounceKey);
      return NextResponse.json(
        { error: "Attendee card image is not available. Please preview your card first." },
        { status: 400 }
      );
    }

    // 6. Download the image as binary on the server
    let imageBuffer: Buffer;
    let contentType = "image/png";

    try {
      const imageRes = await fetch(resolvedImageUrl, {
        signal: AbortSignal.timeout(20000), // 20s timeout
      });

      if (!imageRes.ok) {
        throw new Error(`Image fetch returned HTTP ${imageRes.status}`);
      }

      const arrayBuf = await imageRes.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuf);

      if (imageBuffer.length === 0) {
        throw new Error("Downloaded image buffer is empty.");
      }

      const rawType = imageRes.headers.get("content-type");
      if (rawType && (rawType.includes("image/png") || rawType.includes("image/jpeg") || rawType.includes("image/webp"))) {
        contentType = rawType.split(";")[0].trim();
      }
    } catch (fetchErr) {
      recentShareAttempts.delete(debounceKey);
      logger.error({ fetchErr, url: resolvedImageUrl }, "Failed to fetch card image for LinkedIn upload");
      return NextResponse.json(
        {
          error: "Unable to upload attendee card to LinkedIn.",
        },
        { status: 422 }
      );
    }

    // 7. Initialize LinkedIn Image Upload (Images API)
    logger.info({ cardId, memberSub: linkedInSession.memberSub }, "Initializing LinkedIn image upload");
    let uploadUrl: string;
    let imageUrn: string;
    try {
      const initResult = await initializeLinkedInImageUpload(
        linkedInSession.accessToken,
        linkedInSession.memberSub
      );
      uploadUrl = initResult.uploadUrl;
      imageUrn = initResult.imageUrn;
    } catch (initErr) {
      recentShareAttempts.delete(debounceKey);
      logger.error({ initErr }, "LinkedIn Images API initialization error");
      return NextResponse.json(
        { error: "Unable to upload attendee card to LinkedIn." },
        { status: 502 }
      );
    }

    // 8. Upload binary image to LinkedIn
    logger.info({ imageUrn, bufferSize: imageBuffer.length }, "Uploading binary image to LinkedIn");
    try {
      await uploadImageBinaryToLinkedIn(uploadUrl, imageBuffer, contentType);
    } catch (uploadErr) {
      recentShareAttempts.delete(debounceKey);
      logger.error({ uploadErr }, "LinkedIn binary image upload error");
      return NextResponse.json(
        { error: "Unable to upload attendee card to LinkedIn." },
        { status: 502 }
      );
    }

    // 9. Construct post commentary (caption + card link)
    const origin = req.nextUrl.origin;
    const shareLandingUrl = buildPublicCardShareLandingUrl(cardId, origin);

    let organizationName = "";
    if (secureAttendee.event_id) {
      try {
        const ev = await queryNeonOne<{ user_id: string | null }>(
          `SELECT user_id FROM public.events WHERE id = $1`,
          [secureAttendee.event_id]
        );
        if (ev?.user_id) {
          const profile = await queryNeonOne<{ organization_name: string | null }>(
            `SELECT organization_name FROM public.profiles WHERE id = $1::uuid`,
            [ev.user_id]
          );
          organizationName = String(profile?.organization_name || "").trim();
        }
      } catch {
        // Non-critical organization name lookup
      }
    }

    const defaultCommentary = buildCardLinkedInSharePost({
      name: String(secureAttendee.name || ""),
      eventName: String(secureAttendee.event_name || ""),
      role: String(secureAttendee.role || ""),
      company: String(secureAttendee.company || ""),
      shareUrl: shareLandingUrl,
      cardRole: String(secureAttendee.track || ""),
      organizationName,
    });

    const finalCommentary =
      customCommentary && typeof customCommentary === "string" && customCommentary.trim()
        ? customCommentary.trim()
        : defaultCommentary;

    // 10. Publish LinkedIn image post (Posts API)
    const attendeeName = String(secureAttendee.name || "Attendee").trim();
    const eventName = String(secureAttendee.event_name || "Event").trim();
    const postTitle = `${attendeeName} · ${eventName} Badge`;

    logger.info({ cardId, imageUrn, memberSub: linkedInSession.memberSub }, "Creating LinkedIn post with image attachment");
    let postUrn: string;
    let postUrl: string;

    try {
      const postResult = await createLinkedInImagePost({
        accessToken: linkedInSession.accessToken,
        memberSub: linkedInSession.memberSub,
        imageUrn,
        commentary: finalCommentary,
        title: postTitle,
        altText: "Attendee card",
      });
      postUrn = postResult.postUrn;
      postUrl = postResult.postUrl;
    } catch (postErr) {
      recentShareAttempts.delete(debounceKey);
      logger.error({ postErr }, "LinkedIn Posts API creation error");
      return NextResponse.json(
        { error: "LinkedIn post could not be created." },
        { status: 502 }
      );
    }

    // Cache successful post for debounce
    recentShareAttempts.set(debounceKey, { timestamp: now, result: { postUrn, postUrl } });

    // 11. Record share details in attendee.custom_fields
    try {
      const existingCustom =
        secureAttendee.custom_fields && typeof secureAttendee.custom_fields === "object"
          ? { ...(secureAttendee.custom_fields as Record<string, unknown>) }
          : {};

      existingCustom.linkedin_share = {
        status: "shared",
        member_sub: linkedInSession.memberSub,
        member_name: linkedInSession.memberName,
        post_urn: postUrn,
        post_url: postUrl,
        image_urn: imageUrn,
        shared_at: new Date().toISOString(),
      };

      await queryNeon(
        `UPDATE public.attendees
         SET custom_fields = $1::jsonb, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(existingCustom), cardId]
      );
    } catch (dbErr) {
      logger.warn({ dbErr }, "Failed to persist LinkedIn share info in attendee custom_fields");
    }

    logger.info({ cardId, postUrn, postUrl }, "LinkedIn card image post published successfully");

    return NextResponse.json({
      success: true,
      postUrn,
      postUrl,
      memberName: linkedInSession.memberName,
    });
  } catch (err: unknown) {
    logger.error({ err }, "Unexpected error publishing LinkedIn card image post");
    const message = err instanceof Error ? err.message : "LinkedIn post could not be created.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
