export type RegistrationFieldInputType = "text" | "number" | "tel" | "url" | "email";

export type RegistrationFieldDefinition = {
  id: string;
  label: string;
  inputType: RegistrationFieldInputType;
  required: boolean;
  locked?: boolean;
  enabled: boolean;
  placeholder?: string;
};

export type RegistrationFormConfig = {
  guest: RegistrationFieldDefinition[];
  visitor: RegistrationFieldDefinition[];
};

const LOCKED_FIELDS: RegistrationFieldDefinition[] = [
  {
    id: "name",
    label: "Full Name",
    inputType: "text",
    required: true,
    locked: true,
    enabled: true,
    placeholder: "Full Name",
  },
  {
    id: "role",
    label: "Designation",
    inputType: "text",
    required: true,
    locked: true,
    enabled: true,
    placeholder: "Designation",
  },
];

const OPTIONAL_DEFAULTS: RegistrationFieldDefinition[] = [
  {
    id: "company",
    label: "Organization",
    inputType: "text",
    required: false,
    enabled: true,
    placeholder: "Organization",
  },
  {
    id: "email",
    label: "Email",
    inputType: "email",
    required: false,
    enabled: true,
    placeholder: "hello@example.com",
  },
  {
    id: "linkedin",
    label: "QR Code Link",
    inputType: "url",
    required: false,
    enabled: true,
    placeholder: "linkedin.com/in/username or website",
  },
  {
    id: "photo",
    label: "Photo",
    inputType: "text",
    required: false,
    enabled: true,
    placeholder: "Uploaded image",
  },
];

function cloneFields(fields: RegistrationFieldDefinition[]) {
  return fields.map((field) => ({ ...field }));
}

export function getDefaultRegistrationFormConfig(): RegistrationFormConfig {
  const defaults = [...cloneFields(LOCKED_FIELDS), ...cloneFields(OPTIONAL_DEFAULTS)];
  return {
    guest: cloneFields(defaults),
    visitor: cloneFields(defaults),
  };
}

function normalizeField(raw: unknown): RegistrationFieldDefinition | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const id = String(src.id || "").trim();
  const label = String(src.label || "").trim();
  const inputType = String(src.inputType || "").trim() as RegistrationFieldInputType;
  const allowedTypes: RegistrationFieldInputType[] = ["text", "number", "tel", "url", "email"];
  if (!id || !label || !allowedTypes.includes(inputType)) return null;
  return {
    id,
    label,
    inputType,
    required: Boolean(src.required),
    locked: Boolean(src.locked),
    enabled: "enabled" in src ? Boolean(src.enabled) : true,
    placeholder: String(src.placeholder || "").trim(),
  };
}

function normalizeRoleFields(raw: unknown): RegistrationFieldDefinition[] {
  const defaults = getDefaultRegistrationFormConfig().guest;
  const parsed = Array.isArray(raw) ? raw.map(normalizeField).filter(Boolean) as RegistrationFieldDefinition[] : [];
  if (!parsed.length) return defaults;

  const lockedById = new Map(LOCKED_FIELDS.map((f) => [f.id, f]));
  const next: RegistrationFieldDefinition[] = [];
  const seen = new Set<string>();

  for (const field of parsed) {
    if (seen.has(field.id)) continue;
    seen.add(field.id);
    const locked = lockedById.get(field.id);
    if (locked) {
      next.push({ ...locked, enabled: true, required: true, locked: true });
      continue;
    }
    next.push({ ...field, locked: false });
  }

  for (const locked of LOCKED_FIELDS) {
    if (!seen.has(locked.id)) next.unshift({ ...locked });
  }

  return next;
}

export function normalizeRegistrationFormConfig(raw: unknown): RegistrationFormConfig {
  if (!raw || typeof raw !== "object") return getDefaultRegistrationFormConfig();
  const src = raw as Record<string, unknown>;
  return {
    guest: normalizeRoleFields(src.guest),
    visitor: normalizeRoleFields(src.visitor),
  };
}

export function getEnabledFieldsForRole(config: RegistrationFormConfig, role: "guest" | "visitor") {
  return config[role].filter((field) => field.enabled);
}
