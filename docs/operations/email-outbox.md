# Email Outbox

Transactional email is persisted in `email_outbox` before it is delivered. Product requests only need the enqueue operation to succeed; the Vercel Cron worker delivers messages separately and retries transient failures.

Each worker run emits structured logs when it claims messages, encounters delivery failures, or crashes. Alert on `Email outbox worker completed with delivery failures` and `Email outbox worker failed`.

## Deployment

1. Set a long random `CRON_SECRET` in every Vercel environment that runs the cron.
2. Deploy the migration `20260731010000_add_email_outbox` before application code that queues email.
3. Keep `vercel.json` deployed so `/api/cron/email-outbox` runs every five minutes.

## Operations

- A successful row ends in `sent` with `sent_at` populated.
- A delivery failure is retried with exponential backoff, up to five attempts.
- A worker interrupted after SMTP accepts a message can retry it. The message uses the outbox ID as its `Message-ID` to help receiving providers recognize a duplicate.
- Rows in `failed` need operator review. Investigate `last_error` and either requeue the row or correct the provider configuration.

## Manual Run

Use only from a trusted operator environment:

```text
GET /api/cron/email-outbox
Authorization: Bearer <CRON_SECRET>
```

For local development, inspect the aggregate queue state with:

```text
npm.cmd run email:outbox:status
```

Process the ready messages with:

```text
npm.cmd run email:outbox:process
```

The processing command sends real queued messages through the configured SMTP
provider and does not require the local Next.js server to be running.
