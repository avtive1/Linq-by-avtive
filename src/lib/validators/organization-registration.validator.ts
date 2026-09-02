import { z } from "zod";

function isValidUrl(val: string): boolean {
  if (!val || val.trim() === "") return true;
  try {
    const url = new URL(val.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const urlFieldSchema = z
  .string()
  .trim()
  .max(2048, "URL is too long.")
  .refine(isValidUrl, { message: "Please enter a valid URL (e.g. https://example.com)." })
  .optional()
  .or(z.literal(""));

const emailFieldSchema = z
  .string()
  .trim()
  .max(255, "Email is too long.")
  .email("Please enter a valid email address.");

const optionalEmailFieldSchema = z
  .string()
  .trim()
  .max(255, "Email is too long.")
  .email("Please enter a valid email address.")
  .optional()
  .or(z.literal(""));

export const socialLinksSchema = z
  .object({
    linkedin: urlFieldSchema,
    twitter: urlFieldSchema,
    facebook: urlFieldSchema,
    instagram: urlFieldSchema,
    other: urlFieldSchema,
  })
  .passthrough()
  .optional()
  .default({});

export const organizationRegistrationSubmitSchema = z.object({
  // Contact Person Information
  contactName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(100, "Full name must be at most 100 characters."),
  contactEmail: emailFieldSchema,
  contactPhone: z
    .string()
    .trim()
    .min(6, "Phone number must be at least 6 characters.")
    .max(30, "Phone number is too long."),
  contactDesignation: z
    .string()
    .trim()
    .min(2, "Job title / designation is required.")
    .max(100, "Job title is too long."),
  contactLinkedin: urlFieldSchema,

  // Organization Information
  organizationName: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters.")
    .max(120, "Organization name must be at most 120 characters."),
  organizationWebsite: urlFieldSchema,
  organizationDescription: z
    .string()
    .trim()
    .max(2000, "Organization description must be at most 2000 characters.")
    .optional()
    .or(z.literal("")),
  organizationLogoUrl: z
    .string()
    .trim()
    .min(1, "Organization logo is required.")
    .max(2048, "Logo URL is too long."),
  socialLinks: socialLinksSchema,

  // Organization Details
  industry: z.string().trim().max(100).optional().or(z.literal("")),
  organizationType: z.string().trim().max(100).optional().or(z.literal("")),
  companySize: z.string().trim().max(50).optional().or(z.literal("")),
  country: z.string().trim().max(100).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  address: z.string().trim().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: optionalEmailFieldSchema,
});

export const organizationRegistrationUpdateSchema = organizationRegistrationSubmitSchema.extend({
  referenceNumber: z.string().trim().min(6, "Reference number is required."),
});

export const adminApproveRegistrationSchema = z.object({
  adminNotes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const adminRejectRegistrationSchema = z.object({
  rejectionReason: z
    .string()
    .trim()
    .min(3, "Rejection reason must be at least 3 characters.")
    .max(1000, "Rejection reason must be at most 1000 characters."),
  adminNotes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const adminRequestChangesSchema = z.object({
  changesRequestedNotes: z
    .string()
    .trim()
    .min(3, "Please describe the requested changes.")
    .max(2000, "Requested changes notes must be at most 2000 characters."),
  adminNotes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const adminUpdateNotesSchema = z.object({
  adminNotes: z.string().trim().max(2000, "Admin notes must be at most 2000 characters.").optional().or(z.literal("")),
});

export type OrganizationRegistrationInput = z.infer<typeof organizationRegistrationSubmitSchema>;
export type OrganizationRegistrationUpdateInput = z.infer<typeof organizationRegistrationUpdateSchema>;
export type AdminApproveRegistrationInput = z.infer<typeof adminApproveRegistrationSchema>;
export type AdminRejectRegistrationInput = z.infer<typeof adminRejectRegistrationSchema>;
export type AdminRequestChangesInput = z.infer<typeof adminRequestChangesSchema>;
export type AdminUpdateNotesInput = z.infer<typeof adminUpdateNotesSchema>;
