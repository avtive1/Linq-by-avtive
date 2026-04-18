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
  photo?: string;
  eventId?: string; // Links to events collection
  designType?: string;
  color?: string;
  fontFamily?: string;
  cardRole?: "guest" | "visitor";
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
};
