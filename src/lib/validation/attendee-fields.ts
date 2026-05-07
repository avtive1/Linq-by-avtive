export const ATTENDEE_FIELD_LIMITS = {
  name: 60,
  role: 60,
  company: 80,
} as const;

const URL_LIKE_PATTERN = /(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,}(\/|$))/i;
const NAME_ALLOWED_PATTERN = /^[A-Za-z][A-Za-z\s.'-]*$/;
const ROLE_COMPANY_ALLOWED_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\s.&()/'-]*$/;

function normalizeText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function validateName(value: string) {
  if (!value) return "Full Name is required.";
  if (value.length > ATTENDEE_FIELD_LIMITS.name) {
    return `Full Name must be at most ${ATTENDEE_FIELD_LIMITS.name} characters.`;
  }
  if (URL_LIKE_PATTERN.test(value) || /[?=&]/.test(value)) {
    return "Full Name cannot contain links or query text.";
  }
  if (!NAME_ALLOWED_PATTERN.test(value)) {
    return "Full Name can only include letters, spaces, apostrophes, periods, and hyphens.";
  }
  return null;
}

function validateRole(value: string) {
  if (!value) return "Designation is required.";
  if (value.length > ATTENDEE_FIELD_LIMITS.role) {
    return `Designation must be at most ${ATTENDEE_FIELD_LIMITS.role} characters.`;
  }
  if (URL_LIKE_PATTERN.test(value) || /[?=&]/.test(value)) {
    return "Designation cannot contain links or query text.";
  }
  if (!ROLE_COMPANY_ALLOWED_PATTERN.test(value)) {
    return "Designation contains invalid characters.";
  }
  return null;
}

function validateCompany(value: string) {
  if (!value) return "Organization is required.";
  if (value.length > ATTENDEE_FIELD_LIMITS.company) {
    return `Organization must be at most ${ATTENDEE_FIELD_LIMITS.company} characters.`;
  }
  if (URL_LIKE_PATTERN.test(value) || /[?=&]/.test(value)) {
    return "Organization cannot contain links or query text.";
  }
  if (!ROLE_COMPANY_ALLOWED_PATTERN.test(value)) {
    return "Organization contains invalid characters.";
  }
  return null;
}

export function validateAttendeeCoreFields(payload: Record<string, unknown>) {
  const normalized = { ...payload };
  const hasName = Object.prototype.hasOwnProperty.call(payload, "name");
  const hasRole = Object.prototype.hasOwnProperty.call(payload, "role");
  const hasCompany = Object.prototype.hasOwnProperty.call(payload, "company");

  const name = hasName ? normalizeText(payload.name) : "";
  const role = hasRole ? normalizeText(payload.role) : "";
  const company = hasCompany ? normalizeText(payload.company) : "";

  if (hasName) {
    const error = validateName(name);
    if (error) return { ok: false as const, error };
    normalized.name = name;
  }
  if (hasRole) {
    const error = validateRole(role);
    if (error) return { ok: false as const, error };
    normalized.role = role;
  }
  if (hasCompany) {
    const error = validateCompany(company);
    if (error) return { ok: false as const, error };
    normalized.company = company;
  }

  return { ok: true as const, payload: normalized };
}
