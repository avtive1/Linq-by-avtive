# Email Outbox

Transactional email is stored in `email_outbox` before the application makes an
immediate delivery attempt. This does not require Vercel Cron or a paid Vercel
plan.

## Delivery Behavior

- A successful message ends in `sent` with `sent_at` populated.
- SMTP failures remain in `pending` with a retry time and error recorded.
- Without a scheduled worker, pending messages require a trusted operator to
  process them manually.
- The outbox ID is used as the `Message-ID`, helping receiving providers
  recognize a duplicate if a message is manually retried after SMTP accepts it.

## Manual Operations

Inspect aggregate queue state:

```text
npm.cmd run email:outbox:status
```

Process currently ready messages:

```text
npm.cmd run email:outbox:process
```

The processing command sends real queued messages through the configured SMTP
provider and does not require the local Next.js server to be running.
