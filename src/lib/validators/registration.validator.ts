import { z } from "zod";
import { emailFieldSchema } from "@/lib/validators/common.validator";

export const registrationReviewBodySchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    rejectionReason: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "reject" && !String(value.rejectionReason || "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rejectionReason"],
        message: "rejectionReason is required when decision is reject.",
      });
    }
  });

export const shortLinkCreateBodySchema = z.object({
  targetPath: z
    .string()
    .trim()
    .min(1, "targetPath is required.")
    .max(2048, "targetPath is too long."),
});

export const attendeeRegistrationBodySchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    role: z.string().trim().min(1).max(60).optional(),
    company: z.string().trim().max(80).optional(),
    card_email: emailFieldSchema.optional().or(z.literal("")),
    event_id: z.string().uuid().optional(),
    track: z.enum(["guest", "visitor"]).optional(),
    linkedin: z.string().trim().max(2048).optional(),
    photo_url: z.string().trim().max(2048).optional(),
    card_preview_url: z.string().trim().max(2048).optional(),
    card_color: z.string().trim().max(100).optional(),
    custom_fields: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const markAttendanceBodySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Attendance code must be a 6-digit number."),
});
