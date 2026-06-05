import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

export function zodErrorsToFieldMap(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_form";
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

/**
 * Returns a 400 response compatible with existing `{ error: string }` clients
 * while also exposing structured `errors` for newer consumers.
 */
export function validationErrorResponse(errors: Record<string, string>) {
  const first = Object.values(errors)[0] || "Validation failed.";
  return NextResponse.json(
    {
      success: false,
      error: first,
      message: "Validation failed",
      errors,
    },
    { status: 400 },
  );
}

export async function parseJsonBody<T>(req: Request, schema: ZodType<T>) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false as const, response: validationErrorResponse({ _form: "Invalid JSON body." }) };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, response: validationErrorResponse(zodErrorsToFieldMap(parsed.error)) };
  }

  return { ok: true as const, data: parsed.data };
}

export function parseQueryParams<T>(searchParams: URLSearchParams, schema: ZodType<T>) {
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, response: validationErrorResponse(zodErrorsToFieldMap(parsed.error)) };
  }
  return { ok: true as const, data: parsed.data };
}
