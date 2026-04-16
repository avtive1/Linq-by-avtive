export type CardData = {
  id: string;
  name: string;
  role: string;
  company: string;
  email: string;
  location: string;
  eventName: string;
  sessionDate: string;
  year: string;
  linkedin?: string;
  track?: string;
  photo?: string;
  eventId?: string; // Links to events collection
  designType?: string;
  color?: string;
  fontFamily?: string;
  card_preview_url?: string;

};

export type EventData = {
  id: string;
  name: string;
  location: string;
  date: string;
  user?: string;
  created?: string;
  logo_url?: string;
};
