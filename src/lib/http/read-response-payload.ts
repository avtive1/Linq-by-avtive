export type ApiResponsePayload = {
  data?: unknown;
  error?: unknown;
  success?: boolean;
  pagination?: { total?: number };
} | null;

export async function readResponsePayload(res: Response): Promise<ApiResponsePayload> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await res.json().catch(() => null)) as ApiResponsePayload;
  }
  const text = await res.text().catch(() => "");
  return text ? { error: text } : null;
}

export function asPayloadRecord(payload: ApiResponsePayload): Record<string, unknown> | null {
  const data = payload?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

export function getPayloadError(payload: ApiResponsePayload, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}
