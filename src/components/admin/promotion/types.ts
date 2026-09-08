export type PromotionChannel = "newsletter" | "linkedin" | "whatsapp";

export interface PromotionTemplate {
  id: string;
  channel: PromotionChannel;
  name: string;
  subject?: string;
  heading?: string;
  message: string;
  imageUrl?: string;
  attachmentUrl?: string;
  caption?: string;
}

export interface TeamAccessRole {
  id: string;
  label: string;
  enabled: boolean;
}

export interface ChannelEditorState {
  subject: string;
  heading: string;
  message: string;
  imageUrl: string;
  attachmentUrl: string;
  caption: string;
}

export interface SendResult {
  success: boolean;
  channel: PromotionChannel;
  sentCount: number;
  eligibleCount: number;
  message: string;
  error?: string;
}
