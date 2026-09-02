import crypto from "node:crypto";
import { queryNeonAsSystem, queryNeonOneAsSystem } from "@/lib/neon-db";
import { normalizeOrganizationName, toOrganizationKey } from "@/lib/organization/normalize";
import { normalizeAuthEmail } from "@/lib/auth-db";
import { logger } from "@/lib/logger-server";
import {
  sendOrganizationRegistrationReceivedEmail,
  sendOrganizationRegistrationApprovedEmail,
  sendOrganizationRegistrationRejectedEmail,
  sendOrganizationRegistrationChangesRequestedEmail,
} from "@/lib/notifications/org-registration-emails";
import type {
  OrganizationRegistrationInput,
  OrganizationRegistrationUpdateInput,
} from "@/lib/validators/organization-registration.validator";

export type RegistrationStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED";

export type OrganizationRegistrationRecord = {
  id: string;
  reference_number: string;
  status: RegistrationStatus;
  applicant_user_id: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  contact_designation: string;
  contact_linkedin: string | null;
  organization_name: string;
  organization_name_key: string;
  organization_website: string | null;
  organization_description: string | null;
  organization_logo_url: string;
  social_links: Record<string, string>;
  industry: string | null;
  organization_type: string | null;
  company_size: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  rejection_reason: string | null;
  changes_requested_notes: string | null;
  created_organization_id: string | null;
  created_at: string;
  updated_at: string;
  reviewer_email?: string | null;
  reviewer_name?: string | null;
};

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
};

let argon2Promise: Promise<typeof import("argon2")> | null = null;
function getArgon2() {
  if (!argon2Promise) {
    argon2Promise = import("argon2");
  }
  return argon2Promise;
}

function generateRandomAlphaNum(length = 6): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Remove ambiguous chars like 0, 1, I, O
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export async function generateUniqueRegistrationReference(): Promise<string> {
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `ORG-${datePrefix}-${generateRandomAlphaNum(4)}`;
    const existing = await queryNeonOneAsSystem<{ id: string }>(
      `SELECT id FROM public.organization_registration_requests WHERE reference_number = $1 LIMIT 1`,
      [candidate],
    );
    if (!existing?.id) {
      return candidate;
    }
  }
  return `ORG-${datePrefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function createOrganizationRegistrationRequest(
  input: OrganizationRegistrationInput,
  applicantUserId?: string | null,
): Promise<OrganizationRegistrationRecord> {
  const contactEmail = normalizeAuthEmail(input.contactEmail);
  const orgName = input.organizationName.trim();
  const orgKey = toOrganizationKey(normalizeOrganizationName(orgName));

  if (!orgKey) {
    throw new Error("Invalid organization name.");
  }

  // Check if an existing approved organization has this exact name key
  const existingOrg = await queryNeonOneAsSystem<{ id: string; organization_name: string }>(
    `SELECT id, organization_name FROM public.organizations WHERE organization_name_key = $1 LIMIT 1`,
    [orgKey],
  );
  if (existingOrg?.id) {
    throw new Error(`An organization named "${existingOrg.organization_name}" already exists on Linq.`);
  }

  // Check if there is an active pending registration with the exact same organization key
  const activePending = await queryNeonOneAsSystem<{ reference_number: string }>(
    `SELECT reference_number FROM public.organization_registration_requests
     WHERE organization_name_key = $1
       AND status IN ('PENDING', 'UNDER_REVIEW')
     LIMIT 1`,
    [orgKey],
  );
  if (activePending?.reference_number) {
    throw new Error(
      `A registration request for "${orgName}" is already under review (Ref: ${activePending.reference_number}).`,
    );
  }

  const referenceNumber = await generateUniqueRegistrationReference();
  const socialLinksJson = JSON.stringify(input.socialLinks || {});

  const rows = await queryNeonAsSystem<OrganizationRegistrationRecord>(
    `INSERT INTO public.organization_registration_requests (
      reference_number,
      status,
      applicant_user_id,
      contact_name,
      contact_email,
      contact_phone,
      contact_designation,
      contact_linkedin,
      organization_name,
      organization_name_key,
      organization_website,
      organization_description,
      organization_logo_url,
      social_links,
      industry,
      organization_type,
      company_size,
      country,
      city,
      address,
      phone,
      email,
      created_at,
      updated_at
    ) VALUES (
      $1, 'PENDING', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16, $17, $18, $19, $20, $21, now(), now()
    ) RETURNING *`,
    [
      referenceNumber,
      applicantUserId || null,
      input.contactName.trim(),
      contactEmail,
      input.contactPhone.trim(),
      input.contactDesignation.trim(),
      input.contactLinkedin?.trim() || null,
      orgName,
      orgKey,
      input.organizationWebsite?.trim() || null,
      input.organizationDescription?.trim() || null,
      input.organizationLogoUrl.trim(),
      socialLinksJson,
      input.industry?.trim() || null,
      input.organizationType?.trim() || null,
      input.companySize?.trim() || null,
      input.country?.trim() || null,
      input.city?.trim() || null,
      input.address?.trim() || null,
      input.phone?.trim() || null,
      input.email ? normalizeAuthEmail(input.email) : null,
    ],
  );

  const created = rows[0];
  if (!created) {
    throw new Error("Failed to save organization registration request.");
  }

  // Enqueue confirmation email
  try {
    await sendOrganizationRegistrationReceivedEmail({
      to: contactEmail,
      contactName: input.contactName.trim(),
      organizationName: orgName,
      referenceNumber,
    });
  } catch (err: unknown) {
    logger.warn({ err }, "[organization-registration] failed to queue confirmation email");
  }

  return created;
}

export async function updateOrganizationRegistrationRequest(
  referenceNumber: string,
  input: OrganizationRegistrationUpdateInput,
): Promise<OrganizationRegistrationRecord> {
  const existing = await queryNeonOneAsSystem<OrganizationRegistrationRecord>(
    `SELECT * FROM public.organization_registration_requests WHERE reference_number = $1 LIMIT 1`,
    [referenceNumber.trim()],
  );

  if (!existing) {
    throw new Error("Registration request not found.");
  }

  if (existing.status !== "CHANGES_REQUESTED" && existing.status !== "PENDING") {
    throw new Error(`This request cannot be updated because its status is ${existing.status}.`);
  }

  const contactEmail = normalizeAuthEmail(input.contactEmail);
  const orgName = input.organizationName.trim();
  const orgKey = toOrganizationKey(normalizeOrganizationName(orgName));

  const rows = await queryNeonAsSystem<OrganizationRegistrationRecord>(
    `UPDATE public.organization_registration_requests
     SET contact_name = $1,
         contact_email = $2,
         contact_phone = $3,
         contact_designation = $4,
         contact_linkedin = $5,
         organization_name = $6,
         organization_name_key = $7,
         organization_website = $8,
         organization_description = $9,
         organization_logo_url = $10,
         social_links = $11::jsonb,
         industry = $12,
         organization_type = $13,
         company_size = $14,
         country = $15,
         city = $16,
         address = $17,
         phone = $18,
         email = $19,
         status = 'PENDING',
         updated_at = now()
     WHERE reference_number = $20
     RETURNING *`,
    [
      input.contactName.trim(),
      contactEmail,
      input.contactPhone.trim(),
      input.contactDesignation.trim(),
      input.contactLinkedin?.trim() || null,
      orgName,
      orgKey,
      input.organizationWebsite?.trim() || null,
      input.organizationDescription?.trim() || null,
      input.organizationLogoUrl.trim(),
      JSON.stringify(input.socialLinks || {}),
      input.industry?.trim() || null,
      input.organizationType?.trim() || null,
      input.companySize?.trim() || null,
      input.country?.trim() || null,
      input.city?.trim() || null,
      input.address?.trim() || null,
      input.phone?.trim() || null,
      input.email ? normalizeAuthEmail(input.email) : null,
      referenceNumber.trim(),
    ],
  );

  const updated = rows[0];
  if (!updated) {
    throw new Error("Failed to update organization registration request.");
  }

  try {
    await sendOrganizationRegistrationReceivedEmail({
      to: contactEmail,
      contactName: input.contactName.trim(),
      organizationName: orgName,
      referenceNumber,
    });
  } catch (err: unknown) {
    logger.warn({ err }, "[organization-registration] failed to queue re-submission email");
  }

  return updated;
}

export async function getOrganizationRegistrationByReference(
  referenceNumber: string,
): Promise<OrganizationRegistrationRecord | null> {
  const row = await queryNeonOneAsSystem<OrganizationRegistrationRecord>(
    `SELECT r.*,
            au.email AS reviewer_email,
            p.username AS reviewer_name
     FROM public.organization_registration_requests r
     LEFT JOIN public.auth_users au ON au.user_id = r.reviewed_by_user_id
     LEFT JOIN public.profiles p ON p.id = r.reviewed_by_user_id
     WHERE r.reference_number = $1
     LIMIT 1`,
    [referenceNumber.trim()],
  );
  return row || null;
}

export async function getOrganizationRegistrationById(
  id: string,
): Promise<OrganizationRegistrationRecord | null> {
  const row = await queryNeonOneAsSystem<OrganizationRegistrationRecord>(
    `SELECT r.*,
            au.email AS reviewer_email,
            p.username AS reviewer_name
     FROM public.organization_registration_requests r
     LEFT JOIN public.auth_users au ON au.user_id = r.reviewed_by_user_id
     LEFT JOIN public.profiles p ON p.id = r.reviewed_by_user_id
     WHERE r.id = $1
     LIMIT 1`,
    [id],
  );
  return row || null;
}

export type RegistrationListFilters = {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export type RegistrationListResult = {
  requests: OrganizationRegistrationRecord[];
  total: number;
  counts: {
    all: number;
    pending: number;
    under_review: number;
    changes_requested: number;
    approved: number;
    rejected: number;
  };
};

export async function listOrganizationRegistrationRequests(
  filters: RegistrationListFilters = {},
): Promise<RegistrationListResult> {
  const limit = Math.min(Math.max(filters.limit || 50, 1), 200);
  const offset = Math.max(filters.offset || 0, 0);
  const search = filters.search?.trim().toLowerCase() || "";
  const statusFilter = filters.status?.trim().toUpperCase();

  // Status counts aggregate
  const countRows = await queryNeonAsSystem<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text AS count
     FROM public.organization_registration_requests
     GROUP BY status`,
  );

  const counts = {
    all: 0,
    pending: 0,
    under_review: 0,
    changes_requested: 0,
    approved: 0,
    rejected: 0,
  };

  countRows.forEach((r) => {
    const num = parseInt(r.count, 10) || 0;
    counts.all += num;
    if (r.status === "PENDING") counts.pending = num;
    else if (r.status === "UNDER_REVIEW") counts.under_review = num;
    else if (r.status === "CHANGES_REQUESTED") counts.changes_requested = num;
    else if (r.status === "APPROVED") counts.approved = num;
    else if (r.status === "REJECTED") counts.rejected = num;
  });

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (statusFilter && statusFilter !== "ALL") {
    params.push(statusFilter);
    conditions.push(`r.status = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    const sParam = `$${params.length}`;
    conditions.push(
      `(LOWER(r.organization_name) LIKE ${sParam} OR LOWER(r.contact_name) LIKE ${sParam} OR LOWER(r.contact_email) LIKE ${sParam} OR LOWER(r.reference_number) LIKE ${sParam})`,
    );
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  params.push(limit);
  const limitParam = `$${params.length}`;
  params.push(offset);
  const offsetParam = `$${params.length}`;

  const rows = await queryNeonAsSystem<OrganizationRegistrationRecord>(
    `SELECT r.*,
            au.email AS reviewer_email,
            p.username AS reviewer_name
     FROM public.organization_registration_requests r
     LEFT JOIN public.auth_users au ON au.user_id = r.reviewed_by_user_id
     LEFT JOIN public.profiles p ON p.id = r.reviewed_by_user_id
     ${whereClause}
     ORDER BY r.created_at DESC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params,
  );

  return {
    requests: rows,
    total: counts.all,
    counts,
  };
}

function generateSecureRandomPassword(length = 16): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + numbers + symbols;

  let pwd = "";
  pwd += upper[crypto.randomInt(0, upper.length)];
  pwd += lower[crypto.randomInt(0, lower.length)];
  pwd += numbers[crypto.randomInt(0, numbers.length)];
  pwd += symbols[crypto.randomInt(0, symbols.length)];

  while (pwd.length < length) {
    pwd += all[crypto.randomInt(0, all.length)];
  }

  return pwd
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("");
}

export async function approveOrganizationRegistration(
  id: string,
  adminUserId: string,
  adminNotes?: string | null,
): Promise<{
  success: boolean;
  alreadyApproved?: boolean;
  organizationId: string;
  userId: string;
  temporaryPassword?: string;
  organizationName: string;
}> {
  const req = await queryNeonOneAsSystem<OrganizationRegistrationRecord>(
    `SELECT * FROM public.organization_registration_requests WHERE id = $1 LIMIT 1`,
    [id],
  );

  if (!req) {
    throw new Error("Registration request not found.");
  }

  // Idempotency: If already approved, return existing organization info without duplicating
  if (req.status === "APPROVED" && req.created_organization_id) {
    const existingOrg = await queryNeonOneAsSystem<{ id: string; owner_user_id: string }>(
      `SELECT id, owner_user_id FROM public.organizations WHERE id = $1 LIMIT 1`,
      [req.created_organization_id],
    );
    if (existingOrg) {
      return {
        success: true,
        alreadyApproved: true,
        organizationId: existingOrg.id,
        userId: existingOrg.owner_user_id || req.applicant_user_id || "",
        organizationName: req.organization_name,
      };
    }
  }

  const contactEmail = normalizeAuthEmail(req.contact_email);
  const orgName = req.organization_name.trim();
  const orgKey = req.organization_name_key || toOrganizationKey(normalizeOrganizationName(orgName));

  // 1. Check if user exists with this email
  let userId = req.applicant_user_id;
  let temporaryPassword: string | undefined;

  if (!userId) {
    const existingAuth = await queryNeonOneAsSystem<{ user_id: string }>(
      `SELECT user_id FROM public.auth_users WHERE email_normalized = $1 OR LOWER(email) = $1 LIMIT 1`,
      [contactEmail],
    );
    if (existingAuth?.user_id) {
      userId = existingAuth.user_id;
    }
  }

  const argon2 = await getArgon2();

  if (!userId) {
    // Create a new user profile and auth credentials
    userId = crypto.randomUUID();
    temporaryPassword = generateSecureRandomPassword(16);
    const hash = await argon2.hash(temporaryPassword, ARGON2_OPTIONS);

    const baseUsername =
      (contactEmail.split("@")[0] || "user").toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 18) || "user";
    let pendingUsername = `${baseUsername}_${userId.replace(/-/g, "").slice(0, 6)}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      const u = await queryNeonOneAsSystem<{ id: string }>(
        `SELECT id FROM public.profiles WHERE username = $1 LIMIT 1`,
        [pendingUsername],
      );
      if (!u?.id) break;
      pendingUsername = `${baseUsername}_${crypto.randomUUID().replace(/-/g, "").slice(0, 6)}`;
    }

    await queryNeonAsSystem(
      `INSERT INTO public.profiles (id, username, organization_name, organization_name_key, organization_logo_url, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'user', now(), now())
       ON CONFLICT (id) DO UPDATE
       SET organization_name = EXCLUDED.organization_name,
           organization_name_key = EXCLUDED.organization_name_key,
           organization_logo_url = EXCLUDED.organization_logo_url,
           updated_at = now()`,
      [userId, pendingUsername, orgName, orgKey, req.organization_logo_url],
    );

    await queryNeonAsSystem(
      `INSERT INTO public.auth_users (user_id, email, email_normalized, password_hash, created_at, updated_at)
       VALUES ($1, $2, $2, $3, now(), now())
       ON CONFLICT (user_id) DO UPDATE
       SET email = EXCLUDED.email,
           email_normalized = EXCLUDED.email_normalized,
           password_hash = EXCLUDED.password_hash,
           updated_at = now()`,
      [userId, contactEmail, hash],
    );
  } else {
    // Existing user: update their profile organization details
    await queryNeonAsSystem(
      `UPDATE public.profiles
       SET organization_name = $1,
           organization_name_key = $2,
           organization_logo_url = COALESCE(organization_logo_url, $3),
           updated_at = now()
       WHERE id = $4`,
      [orgName, orgKey, req.organization_logo_url, userId],
    );
  }

  // 2. Insert or update the Organization record
  const orgRows = await queryNeonAsSystem<{ id: string }>(
    `INSERT INTO public.organizations (organization_name, organization_name_key, owner_user_id, organization_logo_url, created_at, updated_at)
     VALUES ($1, $2, $3, $4, now(), now())
     ON CONFLICT (organization_name_key) DO UPDATE
     SET organization_name = EXCLUDED.organization_name,
         owner_user_id = EXCLUDED.owner_user_id,
         organization_logo_url = EXCLUDED.organization_logo_url,
         updated_at = now()
     RETURNING id`,
    [orgName, orgKey, userId, req.organization_logo_url],
  );

  const orgId = orgRows[0]?.id;
  if (!orgId) {
    throw new Error("Failed to create organization record.");
  }

  // 3. Update the Registration Request to APPROVED
  const mergedNotes = adminNotes ? (req.admin_notes ? `${req.admin_notes}\n${adminNotes}` : adminNotes) : req.admin_notes;

  await queryNeonAsSystem(
    `UPDATE public.organization_registration_requests
     SET status = 'APPROVED',
         reviewed_by_user_id = $1,
         reviewed_at = now(),
         admin_notes = $2,
         created_organization_id = $3,
         updated_at = now()
     WHERE id = $4`,
    [adminUserId, mergedNotes, orgId, id],
  );

  // 4. Enqueue approval email notification
  try {
    await sendOrganizationRegistrationApprovedEmail({
      to: contactEmail,
      contactName: req.contact_name,
      organizationName: orgName,
      temporaryPassword,
    });
  } catch (err: unknown) {
    logger.warn({ err }, "[organization-registration] failed to queue approval email");
  }

  return {
    success: true,
    organizationId: orgId,
    userId,
    temporaryPassword,
    organizationName: orgName,
  };
}

export async function rejectOrganizationRegistration(
  id: string,
  adminUserId: string,
  rejectionReason: string,
  adminNotes?: string | null,
): Promise<OrganizationRegistrationRecord> {
  const req = await queryNeonOneAsSystem<OrganizationRegistrationRecord>(
    `SELECT * FROM public.organization_registration_requests WHERE id = $1 LIMIT 1`,
    [id],
  );

  if (!req) {
    throw new Error("Registration request not found.");
  }

  if (req.status === "APPROVED") {
    throw new Error("Cannot reject an already approved organization registration.");
  }

  const mergedNotes = adminNotes ? (req.admin_notes ? `${req.admin_notes}\n${adminNotes}` : adminNotes) : req.admin_notes;

  const rows = await queryNeonAsSystem<OrganizationRegistrationRecord>(
    `UPDATE public.organization_registration_requests
     SET status = 'REJECTED',
         rejection_reason = $1,
         reviewed_by_user_id = $2,
         reviewed_at = now(),
         admin_notes = $3,
         updated_at = now()
     WHERE id = $4
     RETURNING *`,
    [rejectionReason.trim(), adminUserId, mergedNotes, id],
  );

  const updated = rows[0];
  if (!updated) {
    throw new Error("Failed to reject registration request.");
  }

  try {
    await sendOrganizationRegistrationRejectedEmail({
      to: req.contact_email,
      contactName: req.contact_name,
      organizationName: req.organization_name,
      rejectionReason: rejectionReason.trim(),
    });
  } catch (err: unknown) {
    logger.warn({ err }, "[organization-registration] failed to queue rejection email");
  }

  return updated;
}

export async function requestChangesOnOrganizationRegistration(
  id: string,
  adminUserId: string,
  changesRequestedNotes: string,
  adminNotes?: string | null,
): Promise<OrganizationRegistrationRecord> {
  const req = await queryNeonOneAsSystem<OrganizationRegistrationRecord>(
    `SELECT * FROM public.organization_registration_requests WHERE id = $1 LIMIT 1`,
    [id],
  );

  if (!req) {
    throw new Error("Registration request not found.");
  }

  if (req.status === "APPROVED") {
    throw new Error("Cannot request changes on an already approved registration.");
  }

  const mergedNotes = adminNotes ? (req.admin_notes ? `${req.admin_notes}\n${adminNotes}` : adminNotes) : req.admin_notes;

  const rows = await queryNeonAsSystem<OrganizationRegistrationRecord>(
    `UPDATE public.organization_registration_requests
     SET status = 'CHANGES_REQUESTED',
         changes_requested_notes = $1,
         reviewed_by_user_id = $2,
         reviewed_at = now(),
         admin_notes = $3,
         updated_at = now()
     WHERE id = $4
     RETURNING *`,
    [changesRequestedNotes.trim(), adminUserId, mergedNotes, id],
  );

  const updated = rows[0];
  if (!updated) {
    throw new Error("Failed to update registration status to changes requested.");
  }

  try {
    await sendOrganizationRegistrationChangesRequestedEmail({
      to: req.contact_email,
      contactName: req.contact_name,
      organizationName: req.organization_name,
      referenceNumber: req.reference_number,
      changesRequestedNotes: changesRequestedNotes.trim(),
    });
  } catch (err: unknown) {
    logger.warn({ err }, "[organization-registration] failed to queue changes requested email");
  }

  return updated;
}

export async function updateOrganizationRegistrationAdminNotes(
  id: string,
  adminUserId: string,
  notes: string,
): Promise<OrganizationRegistrationRecord> {
  void adminUserId;
  const rows = await queryNeonAsSystem<OrganizationRegistrationRecord>(
    `UPDATE public.organization_registration_requests
     SET admin_notes = $1,
         updated_at = now()
     WHERE id = $2
     RETURNING *`,
    [notes.trim() || null, id],
  );

  const updated = rows[0];
  if (!updated) {
    throw new Error("Registration request not found.");
  }
  return updated;
}
