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

const IMMUTABLE_FIELDS: RegistrationFieldDefinition[] = [
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
  {
    id: "company",
    label: "Organization",
    inputType: "text",
    required: false,
    locked: true,
    enabled: true,
    placeholder: "Organization",
  },
  {
    id: "email",
    label: "Email",
    inputType: "email",
    required: false,
    locked: true,
    enabled: true,
    placeholder: "hello@example.com",
  },
  {
    id: "linkedin",
    label: "QR Code Link",
    inputType: "url",
    required: false,
    locked: true,
    enabled: true,
    placeholder: "linkedin.com/in/username or website",
  },
  {
    id: "photo",
    label: "Photo",
    inputType: "text",
    required: false,
    locked: true,
    enabled: true,
    placeholder: "Uploaded image",
  },
];

function cloneFields(fields: RegistrationFieldDefinition[]) {
  return fields.map((field) => ({ ...field }));
}

export function getDefaultRegistrationFormConfig(): RegistrationFormConfig {
  const defaults = cloneFields(IMMUTABLE_FIELDS);
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

  const immutableById = new Map(IMMUTABLE_FIELDS.map((f) => [f.id, f]));
  const next: RegistrationFieldDefinition[] = [];
  const seen = new Set<string>();

  for (const field of parsed) {
    if (seen.has(field.id)) continue;
    seen.add(field.id);
    const immutable = immutableById.get(field.id);
    if (immutable) {
      next.push({
        ...immutable,
        enabled: true,
        required: immutable.required,
        locked: true,
      });
      continue;
    }
    next.push({ ...field, locked: false });
  }

  for (const immutable of [...IMMUTABLE_FIELDS].reverse()) {
    if (!seen.has(immutable.id)) next.unshift({ ...immutable });
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
