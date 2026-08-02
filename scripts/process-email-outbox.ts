import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import path from "node:path";
import nodemailer from "nodemailer";
import { Client } from "pg";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

type QueuedEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type OutboxRow = {
  id: string;
  payload: QueuedEmail;
  attempts: number;
  max_attempts: number;
};

function retryDelaySeconds(attempt: number) {
  return Math.min(60 * 2 ** Math.min(attempt, 8), 60 * 60);
}

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim() || process.env.DATABASE_URL_DIRECT?.trim();
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!connectionString || !user || !pass) {
    throw new Error("DATABASE_URL, SMTP_USER, and SMTP_PASS are required.");
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.bypass_rls', 'true', true)");
    const { rows } = await client.query<OutboxRow>(
      `WITH candidates AS (
         SELECT id
         FROM public.email_outbox
         WHERE (status = 'pending' AND available_at <= now())
            OR (status = 'processing' AND locked_until < now())
         ORDER BY available_at ASC, created_at ASC
         LIMIT 25
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
    );
    await client.query("COMMIT");

    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT || "587");
    const transporter = nodemailer.createTransport({
      host,
      port: Number.isFinite(port) && port > 0 ? port : 587,
      secure: port === 465,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
      tls: { minVersion: "TLSv1.2" },
      auth: { user, pass },
    });

    let sent = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || user,
          to: row.payload.to,
          subject: row.payload.subject,
          text: row.payload.text,
          html: row.payload.html,
          messageId: `<${row.id || randomUUID()}@avtive.app>`,
        });
        await client.query(
          `UPDATE public.email_outbox
           SET status = 'sent', sent_at = now(), locked_until = NULL, last_error = NULL, updated_at = now()
           WHERE id = $1`,
          [row.id],
        );
        sent += 1;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Email provider rejected the message.";
        const exhausted = row.attempts >= row.max_attempts;
        await client.query(
          `UPDATE public.email_outbox
           SET status = $2,
               available_at = CASE WHEN $2 = 'pending' THEN now() + ($3::text || ' seconds')::interval ELSE available_at END,
               locked_until = NULL,
               last_error = $4,
               updated_at = now()
           WHERE id = $1`,
          [row.id, exhausted ? "failed" : "pending", retryDelaySeconds(row.attempts), message.slice(0, 1_000)],
        );
        failed += 1;
      }
    }

    console.log(JSON.stringify({ claimed: rows.length, sent, failed }));
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
