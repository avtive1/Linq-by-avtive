export type PromotionChannel = "newsletter" | "linkedin" | "whatsapp";

export type PromotionTheme = "default" | "minimal" | "dark" | "professional" | "event";

export interface PromotionTemplate {
  id: string;
  channel: PromotionChannel;
  name: string;
  subject?: string;
  heading?: string;
  message: string;
  imageUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  caption?: string;
  theme?: PromotionTheme;
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
  buttonText: string;
  buttonUrl: string;
  attachmentUrl: string;
  attachmentName: string;
  caption: string;
  theme: PromotionTheme;
}

export interface SendResult {
  success: boolean;
  channel: PromotionChannel;
  sentCount: number;
  eligibleCount: number;
  message: string;
  error?: string;
}
