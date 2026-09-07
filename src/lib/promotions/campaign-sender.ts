import nodemailer from "nodemailer";
import { logger } from "@/lib/logger-server";
import { queryNeon, runWithRlsBypassAsync } from "@/lib/neon-db";
import {
  analyzeEmailSpamScore,
  interpolateEmailContent,
  type SpamScoreAnalysis,
  type RecipientLead,
} from "./spam-analyzer";

export {
  analyzeEmailSpamScore,
  interpolateEmailContent,
  type SpamScoreAnalysis,
  type RecipientLead,
};

export interface SendCampaignOptions {
  senderName?: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  recipients: RecipientLead[];
  organizationName?: string;
  isTestSend?: boolean;
}

export interface CampaignSendResult {
  total: number;
  sentCount: number;
  failedCount: number;
  isSimulated: boolean;
  errors: string[];
  durationMs: number;
}

import { decryptAttendeeSensitiveFields } from "@/lib/security/attendee-sensitive";

/**
 * Queries real leads from Neon DB attendees, registration requests, & profiles.
 */
export async function getLeadDatabaseAudience(filter?: {
  eventId?: string;
  limit?: number;
}): Promise<RecipientLead[]> {
  try {
    const leadsMap = new Map<string, RecipientLead>();
    const maxLimit = Math.min(Math.max(filter?.limit || 1000, 1), 5000);

    // 1. Fetch from attendees table (verified leads who registered or got cards)
    const attendeeQuery = filter?.eventId
      ? `SELECT id, name, company, card_email, custom_fields, event_id FROM public.attendees WHERE event_id = $1 LIMIT $2`
      : `SELECT id, name, company, card_email, custom_fields, event_id FROM public.attendees LIMIT $1`;

    const attendeeParams = filter?.eventId
      ? [filter.eventId, maxLimit]
      : [maxLimit];

    const rawAttendees = await runWithRlsBypassAsync(() =>
      queryNeon<Record<string, unknown>>(attendeeQuery, attendeeParams),
    );

    for (const raw of rawAttendees || []) {
      const { row: decrypted } = decryptAttendeeSensitiveFields(raw);
      const customFields =
        decrypted.custom_fields && typeof decrypted.custom_fields === "object" && !Array.isArray(decrypted.custom_fields)
          ? (decrypted.custom_fields as Record<string, unknown>)
          : {};

      const rawEmail = String(
        decrypted.card_email ||
        customFields.email ||
        customFields.Email ||
        customFields.card_email ||
        ""
      ).trim().toLowerCase();

      if (rawEmail && rawEmail.includes("@") && !leadsMap.has(rawEmail)) {
        leadsMap.set(rawEmail, {
          email: rawEmail,
          name: typeof decrypted.name === "string" && decrypted.name ? decrypted.name : undefined,
          company: typeof decrypted.company === "string" && decrypted.company ? decrypted.company : undefined,
          source: "attendee",
        });
      }
    }

    // 2. Fetch from registration_requests table
    const regQuery = filter?.eventId
      ? `SELECT id, event_id, status, attendee_payload FROM public.registration_requests WHERE event_id = $1 AND status != 'REJECTED' LIMIT $2`
      : `SELECT id, event_id, status, attendee_payload FROM public.registration_requests WHERE status != 'REJECTED' LIMIT $1`;

    const regParams = filter?.eventId
      ? [filter.eventId, maxLimit]
      : [maxLimit];

    const regRows = await runWithRlsBypassAsync(() =>
      queryNeon<{
        id: string;
        event_id: string;
        status: string;
        attendee_payload?: Record<string, unknown>;
      }>(regQuery, regParams),
    ).catch(() => []);

    for (const row of regRows || []) {
      const payload = row.attendee_payload || {};
      const regEmail = String(
        payload.email ||
        payload.card_email ||
        payload.Email ||
        ""
      ).trim().toLowerCase();

      if (regEmail && regEmail.includes("@") && !leadsMap.has(regEmail)) {
        leadsMap.set(regEmail, {
          email: regEmail,
          name: typeof payload.name === "string" && payload.name ? payload.name : undefined,
          company: typeof payload.company === "string" && payload.company ? payload.company : undefined,
          source: "attendee",
        });
      }
    }

    // 3. Fetch from auth_users / profiles if not specifically event filtered
    if (!filter?.eventId) {
      const userRows = await runWithRlsBypassAsync(() =>
        queryNeon<{
          email: string;
          username: string | null;
          organization_name: string | null;
        }>(
          `SELECT u.email, p.username, p.organization_name
           FROM public.auth_users u
           LEFT JOIN public.profiles p ON p.id = u.user_id
           WHERE u.email IS NOT NULL
           LIMIT $1`,
          [maxLimit],
        ),
      ).catch(() => []);

      (userRows || []).forEach((row) => {
        const email = row.email.trim().toLowerCase();
        if (email && email.includes("@") && !leadsMap.has(email)) {
          leadsMap.set(email, {
            email,
            name: row.username || undefined,
            company: row.organization_name || undefined,
            source: "profile",
          });
        }
      });
    }

    return Array.from(leadsMap.values());
  } catch (err) {
    logger.error({ err }, "Error fetching lead database audience");
    return [];
  }
}

/**
 * Dispatches mass promotional emails with batching, personalization, and deliverability headers.
 */
export async function sendPromotionalCampaign(options: SendCampaignOptions): Promise<CampaignSendResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let sentCount = 0;
  let failedCount = 0;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || "587");
  const defaultFrom = process.env.EMAIL_FROM || process.env.SMTP_USER || "promotions@avtive.app";
  const orgName = options.organizationName || "Linq by Avtive";
  const senderName = options.senderName || orgName;
  const fromHeader = `"${senderName.replace(/"/g, "")}" <${defaultFrom}>`;

  // If no SMTP credentials are configured or in test simulation mode:
  const isConfigured = Boolean(user && pass);
  const isSimulated = !isConfigured;

  if (isSimulated) {
    // In simulated environment (e.g. dev/staging without SMTP secret), we simulate successful delivery
    logger.info(
      { total: options.recipients.length, subject: options.subject },
      "Simulating promotional campaign send (No SMTP credentials configured)",
    );

    return {
      total: options.recipients.length,
      sentCount: options.recipients.length,
      failedCount: 0,
      isSimulated: true,
      errors: [],
      durationMs: Date.now() - startTime,
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number.isFinite(port) && port > 0 ? port : 587,
    secure: port === 465,
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 30_000,
    tls: { minVersion: "TLSv1.2" },
    auth: { user, pass },
  });

  // Batch process in chunks of 5 with pacing to avoid SMTP rate limits
  const chunkSize = 5;
  for (let i = 0; i < options.recipients.length; i += chunkSize) {
    const chunk = options.recipients.slice(i, i + chunkSize);

    await Promise.all(
      chunk.map(async (lead) => {
        try {
          const unsubToken = Buffer.from(`${lead.email}:${Date.now()}`).toString("base64url");
          const unsubUrl = `https://linq.avtive.app/api/promotions/unsubscribe?token=${unsubToken}&email=${encodeURIComponent(lead.email)}`;

          const personalizedSubject = interpolateEmailContent(options.subject, lead, orgName, unsubUrl);
          const personalizedHtml = interpolateEmailContent(options.htmlContent, lead, orgName, unsubUrl);
          const personalizedText = interpolateEmailContent(options.textContent, lead, orgName, unsubUrl);

          await transporter.sendMail({
            from: fromHeader,
            to: lead.email,
            subject: personalizedSubject,
            text: personalizedText,
            html: personalizedHtml,
            headers: {
              "List-Unsubscribe": `<${unsubUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              "X-Entity-Ref-ID": `promo-${Date.now()}-${lead.email}`,
            },
          });

          sentCount++;
        } catch (sendErr) {
          failedCount++;
          const msg = sendErr instanceof Error ? sendErr.message : "Unknown send error";
          errors.push(`Failed sending to ${lead.email}: ${msg}`);
          logger.error({ err: sendErr, recipient: lead.email }, "Promotional email chunk send failed");
        }
      }),
    );

    // Slight pacing pause between chunks (100ms)
    if (i + chunkSize < options.recipients.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return {
    total: options.recipients.length,
    sentCount,
    failedCount,
    isSimulated: false,
    errors: errors.slice(0, 5),
    durationMs: Date.now() - startTime,
  };
}
