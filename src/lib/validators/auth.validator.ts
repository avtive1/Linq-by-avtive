import { z } from "zod";
import { emailFieldSchema } from "@/lib/validators/common.validator";

export const registerBodySchema = z.object({
  email: emailFieldSchema,
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username must be at least 3 characters.")
    .max(30)
    .regex(/^[a-z0-9_.]+$/, "Invalid username."),
  organizationName: z.string().trim().min(1, "Organization name is required.").max(120),
  organizationLogoUrl: z.string().trim().max(2048).optional(),
  linkedin: z.string().trim().max(2048).optional(),
});

export const loginOtpRequestBodySchema = z.object({
  email: emailFieldSchema,
  password: z.string().min(1, "Password is required.").max(128),
});

export const forgotPasswordBodySchema = z.object({
  email: emailFieldSchema,
});

export const resetPasswordBodySchema = z.object({
  token: z.string().trim().min(16, "Invalid reset token.").max(256),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});
