This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Security Configuration

The app now supports envelope encryption for selected attendee fields and signed attendee-card tokens.

Required server-side env vars:

- `SECURITY_KEKS_JSON` - JSON map of base64 32-byte KEKs, e.g. `{"kek_v1":"...base64..."}`.
- `SECURITY_ACTIVE_KEK_ID` - active KEK id (example: `kek_v1`).
- `SECURITY_HMAC_KEY` - base64 key used for deterministic lookup tags.
- `ATTENDEE_TOKEN_KEYS_JSON` - array of token keypairs:
  `[{ "kid":"atk_v1", "privateKeyPem":"-----BEGIN PRIVATE KEY-----...", "publicKeyPem":"-----BEGIN PUBLIC KEY-----..." }]`
- `ATTENDEE_TOKEN_ACTIVE_KID` - active token signing key id.
- Optional: `ATTENDEE_TOKEN_ISSUER`, `ATTENDEE_TOKEN_AUDIENCE`, `ATTENDEE_TOKEN_TTL_SECONDS`, `PASSWORD_PEPPER`.

Operational docs:

- `docs/security/data-classification.md`
- `docs/security/keys-and-rotation.md`
- `docs/security/incident-runbook.md`

Bulk re-encryption script:

```bash
npx tsx scripts/reencrypt-attendees.ts
```
