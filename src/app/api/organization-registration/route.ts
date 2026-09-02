import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerUserIdFromCookies } from "@/lib/auth-server";
import { enterApiLogContextFromRequest } from "@/lib/request-log-context";
import { logger } from "@/lib/logger-server";
import {
  organizationRegistrationSubmitSchema,
  organizationRegistrationUpdateSchema,
} from "@/lib/validators/organization-registration.validator";
import {
  createOrganizationRegistrationRequest,
  updateOrganizationRegistrationRequest,
  getOrganizationRegistrationByReference,
} from "@/lib/organization/registration-db";

export async function POST(req: Request) {
  await enterApiLogContextFromRequest(req);
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const hasRef = typeof payload?.referenceNumber === "string" && payload.referenceNumber.trim().length > 0;

    let applicantUserId: string | null = null;
    try {
      const cookieStore = await cookies();
      applicantUserId = await getServerUserIdFromCookies(cookieStore);
    } catch {
      // Unauthenticated submissions are permitted
    }

    if (hasRef) {
      // Re-submission / update flow for CHANGES_REQUESTED
      const parsed = organizationRegistrationUpdateSchema.safeParse(body);
      if (!parsed.success) {
        const errorMsg = parsed.error.issues[0]?.message || "Invalid registration data.";
        return NextResponse.json({ error: errorMsg, details: parsed.error.issues }, { status: 400 });
      }

      const updated = await updateOrganizationRegistrationRequest(parsed.data.referenceNumber, parsed.data);
      return NextResponse.json(
        {
          data: {
            id: updated.id,
            referenceNumber: updated.reference_number,
            status: updated.status,
            organizationName: updated.organization_name,
            submittedAt: updated.created_at,
            updatedAt: updated.updated_at,
          },
        },
        { status: 200 },
      );
    }

    // New submission flow
    const parsed = organizationRegistrationSubmitSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || "Invalid registration data.";
      return NextResponse.json({ error: errorMsg, details: parsed.error.issues }, { status: 400 });
    }

    const created = await createOrganizationRegistrationRequest(parsed.data, applicantUserId);

    return NextResponse.json(
      {
        data: {
          id: created.id,
          referenceNumber: created.reference_number,
          status: created.status,
          organizationName: created.organization_name,
          submittedAt: created.created_at,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : "Failed to process organization registration.";
    logger.warn({ error: rawMessage }, "[api/organization-registration] request rejected");
    return NextResponse.json({ error: rawMessage }, { status: 400 });
  }
}

export async function GET(req: Request) {
  await enterApiLogContextFromRequest(req);
  try {
    const { searchParams } = new URL(req.url);
    const ref = searchParams.get("ref")?.trim();

    if (!ref) {
      return NextResponse.json({ error: "referenceNumber query param is required." }, { status: 400 });
    }

    const registration = await getOrganizationRegistrationByReference(ref);
    if (!registration) {
      return NextResponse.json({ error: "Registration request not found." }, { status: 404 });
    }

    // Sanitize output for public viewing
    return NextResponse.json({
      data: {
        id: registration.id,
        referenceNumber: registration.reference_number,
        status: registration.status,
        contactName: registration.contact_name,
        contactEmail: registration.contact_email,
        contactPhone: registration.contact_phone,
        contactDesignation: registration.contact_designation,
        contactLinkedin: registration.contact_linkedin,
        organizationName: registration.organization_name,
        organizationWebsite: registration.organization_website,
        organizationDescription: registration.organization_description,
        organizationLogoUrl: registration.organization_logo_url,
        socialLinks: registration.social_links,
        industry: registration.industry,
        organizationType: registration.organization_type,
        companySize: registration.company_size,
        country: registration.country,
        city: registration.city,
        address: registration.address,
        phone: registration.phone,
        email: registration.email,
        rejectionReason: registration.rejection_reason,
        changesRequestedNotes: registration.changes_requested_notes,
        createdAt: registration.created_at,
        updatedAt: registration.updated_at,
      },
    });
  } catch (error: unknown) {
    logger.error({ err: error instanceof Error ? error : undefined }, "[api/organization-registration] GET error");
    return NextResponse.json({ error: "Failed to look up registration status." }, { status: 500 });
  }
}
