import { describe, expect, it } from "vitest";
import {
  organizationRegistrationSubmitSchema,
  organizationRegistrationUpdateSchema,
  adminApproveRegistrationSchema,
  adminRejectRegistrationSchema,
  adminRequestChangesSchema,
  adminUpdateNotesSchema,
} from "@/lib/validators/organization-registration.validator";
import { normalizeOrganizationName, toOrganizationKey } from "@/lib/organization/normalize";
import { generateOrganizationRegistrationReceivedEmailHtml } from "@/lib/email-templates/organization-registration-received";
import { generateOrganizationRegistrationApprovedEmailHtml } from "@/lib/email-templates/organization-registration-approved";
import { generateOrganizationRegistrationRejectedEmailHtml } from "@/lib/email-templates/organization-registration-rejected";
import { generateOrganizationRegistrationChangesRequestedEmailHtml } from "@/lib/email-templates/organization-registration-changes-requested";

describe("Organization Registration Validation", () => {
  const validPayload = {
    contactName: "Alex Rivera",
    contactEmail: "alex.rivera@acmecorp.com",
    contactPhone: "+1 555-019-2834",
    contactDesignation: "Head of Operations",
    contactLinkedin: "https://www.linkedin.com/in/alexrivera",
    organizationName: "Acme Global Solutions",
    organizationWebsite: "https://www.acmecorp.com",
    organizationDescription: "Leading provider of global enterprise solutions and events.",
    organizationLogoUrl: "https://res.cloudinary.com/demo/image/upload/sample.png",
    socialLinks: {
      linkedin: "https://linkedin.com/company/acme",
      twitter: "https://x.com/acme",
      facebook: "https://facebook.com/acme",
      instagram: "https://instagram.com/acme",
    },
    industry: "Technology & Software",
    organizationType: "Private Corporation",
    companySize: "51-200 employees",
    country: "United States",
    city: "San Francisco",
    address: "500 Howard St, Suite 300",
    phone: "+1 555-123-4567",
    email: "info@acmecorp.com",
  };

  it("successfully validates a complete valid submission payload", () => {
    const result = organizationRegistrationSubmitSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("successfully validates with optional fields omitted", () => {
    const minimalPayload = {
      contactName: "Jane Doe",
      contactEmail: "jane@startup.io",
      contactPhone: "+1 555-000-1111",
      contactDesignation: "Co-Founder",
      organizationName: "Startup Labs",
      organizationLogoUrl: "https://example.com/logo.png",
    };
    const result = organizationRegistrationSubmitSchema.safeParse(minimalPayload);
    expect(result.success).toBe(true);
  });

  it("fails when required fields are missing or empty", () => {
    const invalid = {
      contactName: "",
      contactEmail: "not-an-email",
      contactPhone: "",
      contactDesignation: "",
      organizationName: "",
      organizationLogoUrl: "",
    };
    const result = organizationRegistrationSubmitSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issuePaths = result.error.issues.map((i) => i.path[0]);
      expect(issuePaths).toContain("contactName");
      expect(issuePaths).toContain("contactEmail");
      expect(issuePaths).toContain("contactPhone");
      expect(issuePaths).toContain("contactDesignation");
      expect(issuePaths).toContain("organizationName");
      expect(issuePaths).toContain("organizationLogoUrl");
    }
  });

  it("fails on invalid URL formats for websites or social channels", () => {
    const badUrls = {
      ...validPayload,
      organizationWebsite: "htp:/broken-url",
      socialLinks: {
        linkedin: "invalid-url-format",
      },
    };
    const result = organizationRegistrationSubmitSchema.safeParse(badUrls);
    expect(result.success).toBe(false);
  });

  it("validates update payload requiring reference number", () => {
    const updatePayload = {
      ...validPayload,
      referenceNumber: "ORG-20260902-8X7M",
    };
    const result = organizationRegistrationUpdateSchema.safeParse(updatePayload);
    expect(result.success).toBe(true);

    const missingRef = {
      ...validPayload,
      referenceNumber: "",
    };
    const badResult = organizationRegistrationUpdateSchema.safeParse(missingRef);
    expect(badResult.success).toBe(false);
  });
});

describe("Admin Review Action Validation", () => {
  it("validates admin approval schema", () => {
    expect(adminApproveRegistrationSchema.safeParse({}).success).toBe(true);
    expect(adminApproveRegistrationSchema.safeParse({ adminNotes: "Approved verified business" }).success).toBe(true);
  });

  it("enforces required rejection reason", () => {
    expect(adminRejectRegistrationSchema.safeParse({ rejectionReason: "" }).success).toBe(false);
    expect(adminRejectRegistrationSchema.safeParse({ rejectionReason: "a" }).success).toBe(false);
    expect(
      adminRejectRegistrationSchema.safeParse({
        rejectionReason: "Unable to verify business registration documents.",
        adminNotes: "Phone check failed.",
      }).success,
    ).toBe(true);
  });

  it("enforces required change request notes", () => {
    expect(adminRequestChangesSchema.safeParse({ changesRequestedNotes: "" }).success).toBe(false);
    expect(
      adminRequestChangesSchema.safeParse({
        changesRequestedNotes: "Please upload high resolution vector or square logo.",
      }).success,
    ).toBe(true);
  });

  it("validates admin notes update schema", () => {
    expect(adminUpdateNotesSchema.safeParse({ adminNotes: "Spoke with founder on phone." }).success).toBe(true);
  });
});

describe("Organization Key & Name Normalization", () => {
  it("normalizes organization names consistently for lookup and deduplication", () => {
    const raw = "   Acme Innovations & Technology Inc.   ";
    const normalized = normalizeOrganizationName(raw);
    expect(normalized).toBe("acme innovations & technology inc.");

    const key = toOrganizationKey(normalized);
    expect(key).toBe("acmeinnovationstechnologyinc");
  });
});

describe("Organization Registration Email Templates", () => {
  it("renders received confirmation email template correctly", () => {
    const html = generateOrganizationRegistrationReceivedEmailHtml({
      contactName: "Alex Rivera",
      organizationName: "Acme Corp",
      referenceNumber: "ORG-20260902-9999",
      statusUrl: "https://linq.avtive.app/organization/status?ref=ORG-20260902-9999",
    });

    expect(html).toContain("Alex Rivera");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("ORG-20260902-9999");
    expect(html).toContain("https://linq.avtive.app/organization/status?ref=ORG-20260902-9999");
  });

  it("renders approved email template correctly with temporary password", () => {
    const html = generateOrganizationRegistrationApprovedEmailHtml({
      contactName: "Alex Rivera",
      organizationName: "Acme Corp",
      loginEmail: "alex@acme.com",
      temporaryPassword: "SecurePassword123!@#",
      loginUrl: "https://linq.avtive.app/login",
    });

    expect(html).toContain("Alex Rivera");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("alex@acme.com");
    expect(html).toContain("SecurePassword123!@#");
    expect(html).toContain("https://linq.avtive.app/login");
  });

  it("renders rejected email template correctly with reason", () => {
    const html = generateOrganizationRegistrationRejectedEmailHtml({
      contactName: "Alex Rivera",
      organizationName: "Acme Corp",
      rejectionReason: "Incomplete documentation provided.",
    });

    expect(html).toContain("Alex Rivera");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("Incomplete documentation provided.");
  });

  it("renders changes requested email template correctly with edit URL", () => {
    const html = generateOrganizationRegistrationChangesRequestedEmailHtml({
      contactName: "Alex Rivera",
      organizationName: "Acme Corp",
      referenceNumber: "ORG-20260902-9999",
      changesRequestedNotes: "Please re-upload a transparent logo.",
      editUrl: "https://linq.avtive.app/organization/register?ref=ORG-20260902-9999",
    });

    expect(html).toContain("Alex Rivera");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("ORG-20260902-9999");
    expect(html).toContain("Please re-upload a transparent logo.");
    expect(html).toContain("https://linq.avtive.app/organization/register?ref=ORG-20260902-9999");
  });
});
