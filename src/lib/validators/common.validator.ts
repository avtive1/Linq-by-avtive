import { z } from "zod";

export const uuidParamSchema = z.string().uuid("Invalid id.");

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const emailFieldSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email format.")
  .max(254);

export const trimmedString = (max: number, label = "Value") =>
  z.string().trim().min(1, `${label} is required.`).max(max);
