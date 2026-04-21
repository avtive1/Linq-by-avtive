export function normalizeOrganizationName(input: string): string {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function toOrganizationKey(input: string): string {
  return normalizeOrganizationName(input).replace(/[^a-z0-9]/g, "");
}
