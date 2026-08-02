import "server-only";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { getEmailSocialIconAttachments } from "@/lib/email-templates/social-icons";
import { getOrganizationEmailLogoAttachment } from "@/lib/email-templates/organization-logo";
import { logger } from "@/lib/logger-server";
import { queryNeonAsSystem } from "@/lib/neon-db";
import { sendTransactionalEmail } from "@/lib/notifications/email";

export type QueuedBrandedEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type OutboxRow = {
  id: string;
  payload: QueuedBrandedEmail;
  attempts: number;
  max_attempts: number;
};

export type EmailQueueResult = {
  queued: boolean;
  id?: string;
  error?: string;
};

function retryDelaySeconds(attempt: number) {
  return Math.min(60 * 2 ** Math.min(attempt, 8), 60 * 60);
}

export async function enqueueBrandedTransactionalEmail(
  input: QueuedBrandedEmail,
): Promise<EmailQueueResult> {
  try {
    const rows = await queryNeonAsSystem<{ id: string }>(
      `INSERT INTO public.email_outbox
       (idempotency_key, payload, status, available_at)
       VALUES ($1, $2::jsonb, 'pending', now())
       RETURNING id`,
      [`email:${randomUUID()}`, JSON.stringify(input)],
    );
    const id = rows[0]?.id;
    if (id) {
      after(async () => {
        try {
          const result = await processEmailOutboxMessage(id);
          if (result.failed > 0) {
            logger.warn({ emailId: id, outbox: result }, "Immediate email delivery failed; message remains in the outbox");
          }
        } catch (error: unknown) {
          logger.error(
            { emailId: id, err: error instanceof Error ? error : undefined },
            "Immediate email delivery crashed; message remains in the outbox",
          );
        }
      });
    }
    return { queued: Boolean(id), id };
  } catch (error: unknown) {
    logger.error({ err: error instanceof Error ? error : undefined }, "Failed to queue transactional email");
    return { queued: false, error: error instanceof Error ? error.message : "Failed to queue email." };
  }
}

async function claimEmailBatch(limit: number): Promise<OutboxRow[]> {
  return queryNeonAsSystem<OutboxRow>(
    `WITH candidates AS (
       SELECT id
       FROM public.email_outbox
       WHERE (status = 'pending' AND available_at <= now())
          OR (status = 'processing' AND locked_until < now())
       ORDER BY available_at ASC, created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE public.email_outbox AS o
     SET status = 'processing',
         attempts = o.attempts + 1,
         locked_until = now() + interval '5 minutes',
         updated_at = now()
     FROM candidates
     WHERE o.id = candidates.id
     RETURNING o.id, o.payload, o.attempts, o.max_attempts`,
    [limit],
  );
}

async function claimEmailById(id: string): Promise<OutboxRow | null> {
  const rows = await queryNeonAsSystem<OutboxRow>(
    `UPDATE public.email_outbox
     SET status = 'processing',
         attempts = attempts + 1,
         locked_until = now() + interval '5 minutes',
         updated_at = now()
     WHERE id = $1
       AND (
         (status = 'pending' AND available_at <= now())
         OR (status = 'processing' AND locked_until < now())
       )
     RETURNING id, payload, attempts, max_attempts`,
    [id],
  );
  return rows[0] || null;
}

async function markDelivered(id: string) {
  await queryNeonAsSystem(
    `UPDATE public.email_outbox
     SET status = 'sent', sent_at = now(), locked_until = NULL, last_error = NULL, updated_at = now()
     WHERE id = $1`,
    [id],
  );
}

async function markFailed(row: OutboxRow, error: string) {
  const exhausted = row.attempts >= row.max_attempts;
  await queryNeonAsSystem(
    `UPDATE public.email_outbox
     SET status = $2,
         available_at = CASE WHEN $2 = 'pending' THEN now() + ($3::text || ' seconds')::interval ELSE available_at END,
         locked_until = NULL,
         last_error = $4,
         updated_at = now()
     WHERE id = $1`,
    [row.id, exhausted ? "failed" : "pending", retryDelaySeconds(row.attempts), error.slice(0, 1_000)],
  );
}

async function deliverEmailRow(row: OutboxRow) {
  const result = await sendTransactionalEmail({
    ...row.payload,
    attachments: row.payload.html
      ? [getOrganizationEmailLogoAttachment(), ...getEmailSocialIconAttachments()]
      : undefined,
    messageId: `<${row.id}@avtive.app>`,
  });
  if (result.sent) {
    await markDelivered(row.id);
    return { sent: 1, failed: 0 };
  }

  await markFailed(row, result.error || "Email provider rejected the message.");
  return { sent: 0, failed: 1 };
}

export async function processEmailOutbox(limit = 25) {
  const rows = await claimEmailBatch(Math.min(Math.max(limit, 1), 100));
  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const outcome = await deliverEmailRow(row);
    sent += outcome.sent;
    failed += outcome.failed;
  }

  return { claimed: rows.length, sent, failed };
}

/** Attempts immediate delivery after enqueue; Cron retains retry responsibility. */
export async function processEmailOutboxMessage(id: string) {
  const row = await claimEmailById(id);
  if (!row) return { claimed: 0, sent: 0, failed: 0 };

  const outcome = await deliverEmailRow(row);
  return { claimed: 1, ...outcome };
}
