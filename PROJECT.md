# Project: Avtive Attendee Card

A Next.js 16 app for generating shareable attendee cards for conferences/events.
Users sign up, create events, share registration links, and attendees fill in a form
to generate a downloadable card with their photo, role, and a LinkedIn QR code.

## Stack

| Layer       | Tech                                                                  |
| ----------- | --------------------------------------------------------------------- |
| Framework   | **Next.js 16.2.1** (App Router only — no `pages/`)                    |
| React       | **19.2** (Canary features available; uses `use()` hook)               |
| Language    | TypeScript 5, strict mode, `@/*` → `./src/*`                          |
| Styling     | **Tailwind CSS v4** — CSS-first config in `src/app/globals.css`       |
| Backend     | **Supabase** (auth + Postgres + Storage) via `@supabase/ssr`          |
| UI extras   | `sonner` (toasts), `lucide-react` (icons)                             |
| Card export | `html-to-image` (renders the card div to PNG/JPEG client-side)        |
| QR codes    | `qrcode` — generated locally (no third-party API)                     |

Build/dev runs Turbopack by default (Next 16). No `--turbopack` flag needed.

## ⚠ Next.js 16 — Breaking changes vs. older training data

Read these BEFORE writing code. The codebase is correctly on the new conventions —
do not "fix" them back to the old ones.

1. **`middleware.ts` → `proxy.ts`.** This project's auth gate lives at `src/proxy.ts`,
   with an exported `proxy(request)` function (NOT `middleware`). Edge runtime is
   NOT supported in `proxy` — it runs on Node only. Config flags renamed too
   (e.g. `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`).
2. **Async Request APIs.** `cookies()`, `headers()`, `draftMode()`, and route
   `params` / `searchParams` are now `Promise<...>` and MUST be awaited.
   - Server components: `const params = await props.params;` (see `cards/[id]/page.tsx`)
   - Client components: `const { id } = use(params);` from React (see `dashboard/events/[id]/page.tsx`)
3. **Turbopack default** for both `next dev` and `next build`. `.next/dev/` is the
   dev output dir (not `.next/`). Don't add `--turbopack` to scripts.
4. **`next lint` removed.** `package.json` uses `"lint": "eslint"` directly.
   `next build` no longer runs lint.
5. **Parallel routes** require explicit `default.js` files now (build fails without).
6. **`next/image`**: `images.domains` deprecated → use `remotePatterns`. Local images
   with query strings need `images.localPatterns.search`. Default `qualities` is `[75]`.
7. **`serverRuntimeConfig` / `publicRuntimeConfig` removed.** Use `process.env` directly,
   or `await connection()` first if you need runtime (not build-time) reads.
8. **`experimental.dynamicIO` → `cacheComponents`** at the top level of `next.config`.
9. **PPR**: `experimental_ppr` segment config removed; opt in via `cacheComponents: true`.
10. **`cacheLife` / `cacheTag`** are stable — drop the `unstable_` prefix.

Full upgrade notes: `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`.
General docs index: `node_modules/next/dist/docs/index.md`.

## Project layout

```
src/
├── app/
│   ├── layout.tsx              # Root: Inter font, Sonner Toaster
│   ├── page.tsx                # Marketing landing page
│   ├── globals.css             # Tailwind v4 @theme + glass-panel utilities
│   ├── login/                  # Supabase auth — sign in (+ forgot-password link)
│   ├── signup/                 # Supabase auth — sign up (handles email-confirm flow)
│   ├── forgot-password/        # Sends password reset link via Supabase
│   ├── reset-password/         # Lands from email link, sets new password
│   ├── cards/
│   │   ├── new/page.tsx        # PUBLIC registration form (always requires ?eventId)
│   │   │                       #   Wrapped in <Suspense> for useSearchParams
│   │   └── [id]/
│   │       ├── page.tsx        # Server component, async params, fetches via Supabase
│   │       ├── CardView.tsx    # Client view + html-to-image download
│   │       └── edit/page.tsx   # Owner-only edit form (uses use(params))
│   └── dashboard/
│       ├── layout.tsx
│       ├── page.tsx            # Lists user's events with status pill, create-event modal
│       └── events/[id]/page.tsx# Client component, uses use(params)
│                               #   edit/delete/duplicate event flows
├── components/
│   ├── CardPreview.tsx         # The 800×420 attendee card visual; QR via `qrcode` lib
│   ├── GradientBackground.tsx  # Decorative bg used on every screen
│   └── ui.tsx                  # TextInput, Button, FilePicker (with built-in
│                               # photo validation), Select, Skeleton, AnimatedCounter
├── lib/
│   ├── supabase.ts             # createBrowserClient + getFileUrl + getSignedFileUrl
│   │                           # + isUserLoggedIn
│   └── utils.ts                # getEventStatus(date) → Past/Today/Upcoming pill
├── types/
│   └── card.ts                 # CardData, EventData (camelCase shape)
└── proxy.ts                    # Auth gate (was middleware): redirects
                                # /dashboard/* → /login when no session, and
                                # /login,/signup → /dashboard when session exists
                                # /forgot-password and /reset-password are NOT gated
```

Other notable files:

- `next.config.ts` — currently empty (no options set).
- `tailwind.config.ts` — exists but theme tokens actually live in
  `globals.css` `@theme` block (Tailwind v4 CSS-first). The config's
  `content: ["./src/pages/**/*..."]` still references a non-existent `pages` dir.

## Supabase

Browser client created with `createBrowserClient` in `src/lib/supabase.ts`.
SSR client (in `proxy.ts`) uses `createServerClient` with cookie adapters.

**Environment variables** (`.env.local`, gitignored):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Tables (inferred from queries)

`events`
- `id` (uuid), `name`, `location`, `date`, `user_id` (FK auth.users), `created_at`

`attendees`
- `id` (uuid), `user_id` (nullable — public share registrations have no user),
  `name`, `role`, `company`, `card_email`, `event_name`, `session_date`,
  `location`, `track`, `linkedin`, `year`, `photo_url`, `event_id`, `created_at`

### Storage

- Bucket: **`attendee_photos`** — uploaded photos go here. The DB stores the
  storage path; `getFileUrl("attendee_photos", path)` produces the public URL.
- Photo validation (JPEG/PNG/WebP, ≤5 MB) is enforced inside `<FilePicker>` in
  `src/components/ui.tsx`. Forms that use it should pass `onError={toast.error}`
  so users see why a file was rejected — by the time the parent's `onChange`
  fires, the data URL is already validated.
- `src/lib/supabase.ts` exports both `getFileUrl` (sync, public bucket only) and
  `getSignedFileUrl(bucket, path, expiresIn)` (async, time-limited URLs). The
  bucket is currently public, so reads use `getFileUrl`. If you ever flip the
  bucket to private, every call site that maps `photo_url → photo` must become
  async and use `getSignedFileUrl` — see read sites in
  `app/dashboard/events/[id]/page.tsx`, `app/cards/[id]/page.tsx`,
  `app/cards/[id]/edit/page.tsx`. Cascading deletes (event delete, attendee
  delete, photo replace on edit) already remove storage objects via
  `supabase.storage.from("attendee_photos").remove([path])` so they keep
  working under either mode.

### Field naming

DB uses **snake_case** (`card_email`, `event_id`, `session_date`, `photo_url`).
TypeScript types in `src/types/card.ts` use **camelCase** (`email`, `eventId`,
`sessionDate`, `photo`). Mapping happens manually at every read/write site —
keep that pattern when adding new fields.

## Auth flow

1. User signs up / logs in via `/signup` or `/login`. These pages call Supabase
   auth client-side and the session is persisted via cookies. If Supabase email
   confirmation is on, signup detects `!data.session` and shows a "check your
   inbox" state instead of redirecting.
2. Forgot/reset: `/forgot-password` calls `resetPasswordForEmail` with
   `redirectTo: <origin>/reset-password`. The reset page listens for the
   `PASSWORD_RECOVERY` auth event and only enables the submit button once the
   recovery session is present, then calls `updateUser({ password })` and signs
   the user out so they re-login with the new password.
3. `src/proxy.ts` runs on every request (matcher excludes static assets):
   - If hitting `/dashboard/*` without a session → redirect to `/login`
   - If hitting `/login` or `/signup` while logged in → redirect to `/dashboard`
   - `/forgot-password` and `/reset-password` are intentionally NOT gated, so
     the recovery session can be applied without bouncing to `/dashboard`.
4. Public attendee registration uses `/cards/new?eventId=…&share=true` — does
   NOT require auth. The created `attendees` row gets `user_id = null`.
   `/cards/new` blocks visits without an `eventId` query param and renders an
   "Invalid registration link" screen instead. The dead "internal create card"
   code path was removed in Batch 2 — there is no longer a non-share branch.
5. Editing an attendee card via `/cards/[id]/edit` is gated *inside the page*
   (not by `proxy.ts`, since it lives outside `/dashboard`). Authorization rule:
   the signed-in user must be the `user_id` on the parent `events` row. Cards
   without an `event_id` fall back to checking `attendees.user_id` if present.

## Theme & styling

- Brand colors (defined in `globals.css` `@theme`):
  - `--color-primary: #79D980` (light green)
  - `--color-heading: #23468C` (dark blue)
  - `--color-surface: #F9FAFB`
  - `--color-muted: #6B7280`
- Heavy use of **glassmorphism** via the `glass-panel` utility class
  (white/blur background with subtle border).
- Typography: **Inter** loaded via `next/font/google` in root layout.
- Animations: custom `slide-up`, `fade-in` etc. defined in `globals.css`,
  triggered with `animate-*` classes.

## Common patterns to follow when editing

- **Fetching with cleanup**: components use a `let isMounted = true;` flag plus a
  cleanup function in `useEffect` to avoid setState after unmount. Match this
  pattern when adding new fetches.
- **Toast errors**: use `sonner`'s `toast.error(...)` / `toast.success(...)` —
  `<Toaster />` is mounted in the root layout.
- **Form validation**: pages collect field-level errors in a
  `Record<string, string>` state object and clear them on change.
- **`<Suspense>` for `useSearchParams`**: any page using it must wrap the inner
  component in `<Suspense>`. See `src/app/cards/new/page.tsx` for the pattern.
- **Server vs client params**: server components `await props.params`; client
  components `use(params)` from React.
- **Photo uploads**: rely on `<FilePicker>`'s built-in validation. Don't
  re-validate file size/type at the call site — it's already enforced before
  the data URL reaches `onChange`.
- **Event status**: use `getEventStatus(date)` from `@/lib/utils` to render the
  Past/Today/Upcoming pill — don't reinvent the date math.
- **Cascading deletes**: when removing an event, also delete all its
  `attendees` rows AND `supabase.storage.remove([...photo_paths])`. The event
  detail page's delete flow is the reference implementation.
- **Destructive action UX**: typed-confirmation modal (user must type the
  resource name to enable the delete button). See the delete-event modal in
  `app/dashboard/events/[id]/page.tsx`.
- **Button icons**: `<Button>` no longer auto-injects a trailing chevron. If
  you want one, pass `icon={<ChevronRight ... />}` explicitly.

## Scripts

```bash
npm run dev     # next dev (Turbopack, outputs to .next/dev)
npm run build   # next build (Turbopack)
npm run start   # next start
npm run lint    # eslint  (NOT next lint — that command no longer exists)
```
