export type SecurityClass = "A" | "B" | "C";

export type DataClassRule = {
  field: string;
  class: SecurityClass;
  owner: string;
  rationale: string;
};

export const ATTENDEE_DATA_CLASS_RULES: DataClassRule[] = [
  { field: "name", class: "C", owner: "product", rationale: "Displayed publicly on attendee cards." },
  { field: "role", class: "C", owner: "product", rationale: "Displayed publicly on attendee cards." },
  { field: "company", class: "C", owner: "product", rationale: "Displayed publicly on attendee cards." },
  { field: "event_name", class: "C", owner: "product", rationale: "Displayed publicly on attendee cards." },
  { field: "session_date", class: "C", owner: "product", rationale: "Displayed publicly on attendee cards." },
  { field: "session_time", class: "C", owner: "product", rationale: "Displayed publicly on attendee cards." },
  { field: "location", class: "C", owner: "product", rationale: "Displayed publicly on attendee cards." },
  { field: "track", class: "C", owner: "product", rationale: "Displayed publicly on attendee cards." },
  { field: "year", class: "C", owner: "product", rationale: "Displayed publicly on attendee cards." },
  { field: "design_type", class: "C", owner: "product", rationale: "Presentation-only card setting." },
  { field: "card_color", class: "C", owner: "product", rationale: "Presentation-only card setting." },
  { field: "card_font", class: "C", owner: "product", rationale: "Presentation-only card setting." },
  { field: "photo_url", class: "C", owner: "product", rationale: "Rendered publicly on attendee card." },
  { field: "card_preview_url", class: "C", owner: "product", rationale: "Used in social previews for cards." },
  { field: "card_email", class: "A", owner: "security", rationale: "Sensitive PII; not required on public views." },
  { field: "linkedin", class: "A", owner: "security", rationale: "May contain personal profile/contact URL." },
];

export const ATTENDEE_CLASS_A_FIELDS = ATTENDEE_DATA_CLASS_RULES
  .filter((r) => r.class === "A")
  .map((r) => r.field);

export const ATTENDEE_CLASS_B_FIELDS = ATTENDEE_DATA_CLASS_RULES
  .filter((r) => r.class === "B")
  .map((r) => r.field);

export const ATTENDEE_CLASS_C_FIELDS = ATTENDEE_DATA_CLASS_RULES
  .filter((r) => r.class === "C")
  .map((r) => r.field);
