import type { RegistrationFormConfig } from "@/lib/registration-form";
/** Sponsor shown on attendee cards (from the parent event). Max 5 per event. */
export type SponsorEntry = {
  name: string;
  logo_url: string;
};

export type CardData = {
  id: string;
  name: string;
  role: string;
  company: string;
  email: string;
  location: string;
  eventName: string;
  sessionDate: string;
  sessionTime?: string;
  year: string;
  linkedin?: string;
  track?: string;
  guestCategory?: string;
  photo?: string;
  eventId?: string; // Links to events collection
  designType?: string;
  color?: string;
  fontFamily?: string;
  cardRole?: "guest" | "visitor";
  /** Resolved from the linked event for card rendering */
  sponsors?: SponsorEntry[];
  /** Organization branding resolved from event owner */
  organizationName?: string;
  organizationLogoUrl?: string;
  /** Persisted Cloudinary render for fast reloads */
  cardPreviewUrl?: string;
  /** Persisted Cloudinary vertical renders */
  verticalFrontUrl?: string;
  verticalBackUrl?: string;
};

export type EventData = {
  id: string;
  name: string;
  location: string;
  location_type?: string;
  date: string;
  time?: string;
  user?: string;
  created?: string;
  logo_url?: string;
  sponsors?: SponsorEntry[];
  registration_form_config?: RegistrationFormConfig;
};
