import { logger } from "@/lib/logger-server";

export interface GmailPromotionMessage {
  id: string;
  threadId: string;
  snippet: string;
  sender: string;
  senderName: string;
  senderEmail: string;
  recipient: string;
  subject: string;
  date: string;
  timestampMs: number;
  labelIds: string[];
  isPromotion: boolean;
  category: "CATEGORY_PROMOTIONS" | "CATEGORY_UPDATES" | "OTHER";
}

export interface FetchGmailPromotionsOptions {
  accessToken?: string;
  q?: string; // defaults to "category:promotions"
  labelIds?: string[]; // defaults to ["CATEGORY_PROMOTIONS"]
  maxResults?: number;
  pageToken?: string;
}

export interface GmailPromotionsResponse {
  messages: GmailPromotionMessage[];
  nextPageToken?: string;
  resultSizeEstimate: number;
  isMockFeed?: boolean;
  source: "live_gmail_api" | "sandbox_promotions_stream";
}

const SAMPLE_PROMOTIONS_FEED: GmailPromotionMessage[] = [
  {
    id: "msg_promo_01",
    threadId: "th_01",
    sender: "Figma Events <events@figma.com>",
    senderName: "Figma Events",
    senderEmail: "events@figma.com",
    recipient: "team@avtive.app",
    subject: "🎨 Config 2026: Early Bird Registration & Keynote Lineup Announced",
    snippet: "Join 15,000+ creators for design systems, AI tooling, and exclusive partner workshops...",
    date: new Date(Date.now() - 3600000 * 4).toUTCString(),
    timestampMs: Date.now() - 3600000 * 4,
    labelIds: ["CATEGORY_PROMOTIONS", "UNREAD", "INBOX"],
    isPromotion: true,
    category: "CATEGORY_PROMOTIONS",
  },
  {
    id: "msg_promo_02",
    threadId: "th_02",
    sender: "Stripe Team <partnerships@stripe.com>",
    senderName: "Stripe Partnerships",
    senderEmail: "partnerships@stripe.com",
    recipient: "founders@avtive.app",
    subject: "💳 Special Offer: 0% Processing on your first $50,000 in volume",
    snippet: "Upgrade your payment stack today. Experience unified billing, instant payouts, and global card routing...",
    date: new Date(Date.now() - 3600000 * 12).toUTCString(),
    timestampMs: Date.now() - 3600000 * 12,
    labelIds: ["CATEGORY_PROMOTIONS", "INBOX"],
    isPromotion: true,
    category: "CATEGORY_PROMOTIONS",
  },
  {
    id: "msg_promo_03",
    threadId: "th_03",
    sender: "AWS Startups <aws-activate@amazon.com>",
    senderName: "AWS Startups",
    senderEmail: "aws-activate@amazon.com",
    recipient: "admin@avtive.app",
    subject: "☁️ Exclusive AWS Activate Credits: Claim up to $25k in cloud credits",
    snippet: "Accelerate your infrastructure with AWS Activate. Apply now before the promotional window closes...",
    date: new Date(Date.now() - 3600000 * 24).toUTCString(),
    timestampMs: Date.now() - 3600000 * 24,
    labelIds: ["CATEGORY_PROMOTIONS", "INBOX"],
    isPromotion: true,
    category: "CATEGORY_PROMOTIONS",
  },
  {
    id: "msg_promo_04",
    threadId: "th_04",
    sender: "Vercel Platform <announcements@vercel.com>",
    senderName: "Vercel Platform",
    senderEmail: "announcements@vercel.com",
    recipient: "dev@avtive.app",
    subject: "⚡ Next.js Conf: VIP Pass & Early Access Passes Now Live",
    snippet: "Discover Next.js server actions, edge computing breakthroughs, and developer workshops...",
    date: new Date(Date.now() - 3600000 * 48).toUTCString(),
    timestampMs: Date.now() - 3600000 * 48,
    labelIds: ["CATEGORY_PROMOTIONS", "INBOX"],
    isPromotion: true,
    category: "CATEGORY_PROMOTIONS",
  },
  {
    id: "msg_promo_05",
    threadId: "th_05",
    sender: "GitHub Team <notifications@github.com>",
    senderName: "GitHub Team",
    senderEmail: "notifications@github.com",
    recipient: "engineering@avtive.app",
    subject: "🤖 GitHub Copilot Enterprise: 30-day team trial extension",
    snippet: "Supercharge your team's pull request workflow and indexing with enterprise security guarantees...",
    date: new Date(Date.now() - 3600000 * 72).toUTCString(),
    timestampMs: Date.now() - 3600000 * 72,
    labelIds: ["CATEGORY_PROMOTIONS", "INBOX"],
    isPromotion: true,
    category: "CATEGORY_PROMOTIONS",
  },
];

/**
 * Fetches promotional emails from Gmail API using scope:
 * https://www.googleapis.com/auth/gmail.readonly
 * and query filter: q="category:promotions"
 */
export async function fetchGmailPromotions(
  options: FetchGmailPromotionsOptions = {},
): Promise<GmailPromotionsResponse> {
  const token =
    options.accessToken ||
    process.env.GMAIL_API_ACCESS_TOKEN ||
    process.env.GOOGLE_OAUTH_ACCESS_TOKEN;

  const query = options.q !== undefined ? options.q : "category:promotions";
  const maxResults = Math.min(options.maxResults || 20, 100);
  const pageToken = options.pageToken;

  // If no Gmail OAuth access token is provided in environment, provide sandbox simulated promotions
  if (!token) {
    let filtered = SAMPLE_PROMOTIONS_FEED;
    if (query && query !== "category:promotions") {
      const qLower = query.toLowerCase();
      filtered = SAMPLE_PROMOTIONS_FEED.filter(
        (m) =>
          m.subject.toLowerCase().includes(qLower) ||
          m.sender.toLowerCase().includes(qLower) ||
          m.snippet.toLowerCase().includes(qLower),
      );
    }

    return {
      messages: filtered,
      nextPageToken: undefined,
      resultSizeEstimate: filtered.length,
      isMockFeed: true,
      source: "sandbox_promotions_stream",
    };
  }

  try {
    const params = new URLSearchParams({
      maxResults: String(maxResults),
      q: query,
    });

    if (options.labelIds && options.labelIds.length > 0) {
      options.labelIds.forEach((lbl) => params.append("labelIds", lbl));
    } else {
      params.append("labelIds", "CATEGORY_PROMOTIONS");
    }

    if (pageToken) {
      params.append("pageToken", pageToken);
    }

    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`;
    const listRes = await fetch(listUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!listRes.ok) {
      const errText = await listRes.text();
      logger.error({ status: listRes.status, err: errText }, "Gmail API list call returned error");
      throw new Error(`Gmail API error (${listRes.status}): ${errText}`);
    }

    const listData = (await listRes.json()) as {
      messages?: Array<{ id: string; threadId: string }>;
      nextPageToken?: string;
      resultSizeEstimate?: number;
    };

    const rawMessages = listData.messages || [];
    const detailedMessages: GmailPromotionMessage[] = [];

    // Fetch message details in parallel
    await Promise.all(
      rawMessages.map(async (msgRef) => {
        try {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgRef.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
              },
            },
          );

          if (!msgRes.ok) return;

          const data = (await msgRes.json()) as {
            id: string;
            threadId: string;
            snippet?: string;
            labelIds?: string[];
            internalDate?: string;
            payload?: {
              headers?: Array<{ name: string; value: string }>;
            };
          };

          const headers = data.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

          const fromVal = getHeader("From");
          const subject = getHeader("Subject") || "No Subject";
          const toVal = getHeader("To");
          const dateVal = getHeader("Date") || new Date(Number(data.internalDate || Date.now())).toUTCString();

          // Extract display name and email from "Sender Name <email@example.com>"
          const match = fromVal.match(/^(.*?)\s*<(.+?)>$/);
          const senderName = match ? match[1].replace(/^"|"$/g, "").trim() : fromVal;
          const senderEmail = match ? match[2].trim() : fromVal;

          detailedMessages.push({
            id: data.id,
            threadId: data.threadId,
            snippet: data.snippet || "",
            sender: fromVal,
            senderName: senderName || "Promotional Sender",
            senderEmail: senderEmail || "unknown@domain.com",
            recipient: toVal,
            subject,
            date: dateVal,
            timestampMs: Number(data.internalDate || Date.now()),
            labelIds: data.labelIds || [],
            isPromotion: (data.labelIds || []).includes("CATEGORY_PROMOTIONS"),
            category: "CATEGORY_PROMOTIONS",
          });
        } catch (detailErr) {
          logger.error({ err: detailErr, id: msgRef.id }, "Error fetching message detail from Gmail API");
        }
      }),
    );

    // Sort descending by timestamp
    detailedMessages.sort((a, b) => b.timestampMs - a.timestampMs);

    return {
      messages: detailedMessages,
      nextPageToken: listData.nextPageToken,
      resultSizeEstimate: listData.resultSizeEstimate || detailedMessages.length,
      source: "live_gmail_api",
    };
  } catch (error) {
    logger.error({ err: error instanceof Error ? error : undefined }, "Gmail promotions fetch failed");
    return {
      messages: SAMPLE_PROMOTIONS_FEED,
      resultSizeEstimate: SAMPLE_PROMOTIONS_FEED.length,
      isMockFeed: true,
      source: "sandbox_promotions_stream",
    };
  }
}
