# Authentication, Clerk & Email — Handoff Document

**Project:** `avtive` (Next.js App Router)  
**Purpose:** Single reference for what is implemented, what is not, and how pieces fit together. Share this with teammates.

---

## 1. Executive summary

| Area | Status |
|------|--------|
| **NextAuth (email + password)** | Implemented — primary UI on `/login` |
| **Clerk (hosted identity)** | Partially wired (middleware, provider, DB bridge) — **no Clerk widget or hosted redirect on `/login` currently** |
| **Transactional emails (Resend)** | Implemented in API routes — **requires env vars** |
| **Org owner welcome (super admin)** | Implemented — email after org creation |
| **Team member invite + owner notice** | Implemented — email after **Step 2** save in dashboard modal |
| **Invite acceptance page** | Implemented — `/invite/org-member?t=…` |
| **Optional email OTP (org accounts, password login)** | Implemented — gated by env |
| **Clerk Organizations & Clerk-native invites** | **Not** implemented |
| **Auto-provision DB user for Clerk-only signup** | **Not** implemented (email must match existing `auth_users` row for bridge) |

---

## 2. Two parallel concepts (do not confuse)

### A. **Authentication** — who is signed in?

- **NextAuth (credentials):** User submits email + password on `/login`. Session stored as JWT cookie. Internal user id = `auth_users.user_id` / `profiles.id`.

- **Clerk:** Separate session (Clerk cookies). Clerk user id looks like `user_…`. The app **maps** Clerk → internal id when **Clerk primary email matches `auth_users.email`** and `clerk_user_id` is stored (see §4).

These can coexist: middleware considers **either** NextAuth JWT **or** Clerk user id for “is someone logged in?” for redirects.

### B. **Transactional email** — invites, welcome, OTP codes

- Powered by **Resend** (`src/lib/notifications/email.ts`), **not** by Clerk.
- **Independent** of Clerk: if Resend keys are missing, emails fail silently (logged); Clerk can still work.

---

## 3. What runs in production code today

### 3.1 Root layout

- **`ClerkProvider`** wraps the app (`src/app/layout.tsx`).
- **`AuthSessionProvider`** (NextAuth `SessionProvider`) is still present for client hooks like `useSession`.

### 3.2 Middleware

- File: **`src/middleware.ts`** (not `proxy.ts`).
- Uses **`clerkMiddleware`** from Clerk **and** NextAuth JWT (`getToken`) for:
  - Rate limiting on `/api/*`
  - Redirect unauthenticated users away from `/dashboard` and `/admin`
  - Clerk session counts as “authenticated” for those redirects even without NextAuth cookie

**Note:** Next.js 16 may log a deprecation warning preferring `proxy.ts`; build still succeeds with `middleware.ts`.

### 3.3 Login page (`/login`)

- **Only** custom **email + password** form + optional **6-digit OTP step** (see §6).
- **Clerk `<SignIn />` widget was removed** intentionally (product decision).
- Therefore users **cannot** start Clerk sign-in from `/login` unless you add either:
  - Embedded `<SignIn />`, or  
  - A link/button to **Clerk hosted sign-in URL** (Dashboard → Clerk → configure paths / URLs).

### 3.4 Server session resolution

- **`getServerAuthSession()`** (`src/auth.ts`): tries NextAuth session first; if absent, tries Clerk → internal profile via `resolveLinkedInternalUserIdFromClerk` + `getAuthSessionPayloadByUserId`.
- **`getServerUserIdFromCookies()`** (`src/lib/auth-server.ts`): uses merged session above → returns internal `user_id`.

### 3.5 Database (Clerk bridge)

- **`auth_users.clerk_user_id`** (+ partial unique index); **`password_hash`** can be null for future Clerk-only rows.
- **`linkAuthUserToClerkUser`**, **`getInternalUserIdByClerkUserId`** in `src/lib/auth-db.ts`.
- **`src/lib/clerk-user-bridge.ts`** resolves Clerk session → internal id using email match + linking.

---

## 4. Clerk without widget — is it possible?

**Yes.** Clerk does not require an embedded widget:

- **Hosted sign-in:** Redirect users to Clerk’s hosted URL; after sign-in, redirect back to your app (`NEXT_PUBLIC_CLERK_SIGN_IN_URL` / dashboard paths — set in Clerk project).
- **Small `SignInButton`:** Opens Clerk flow without full embedded card.

**Today:** Neither hosted redirect nor widget is on `/login`, so **Clerk-based login UX is incomplete** unless users arrive via another entry point or existing Clerk session.

---

## 5. Email / Resend features

### 5.1 Environment variables

| Variable | Role |
|----------|------|
| **`RESEND_API_KEY`** | Required for any send via `sendTransactionalEmail` |
| **`EMAIL_FROM`** | Sender; must be allowed by Resend (verified domain or Resend-approved test sender). Code defaults to `no-reply@avtive.app` if unset — that default **fails** until domain is verified in Resend. |
| **`NEXT_PUBLIC_APP_URL`** | Base URL for links inside emails (invites). Fallback: `http://localhost:3000` or `VERCEL_URL`. |

**Important:** Commented or empty `RESEND_API_KEY` → **no emails**.

### 5.2 Super admin creates organization

- **Route:** `POST /api/admin/organizations`
- **After success:** `sendOrganizationCreatedWelcomeEmail` → owner receives org name + **temporary password** + login URL.

### 5.3 Team member invite

- **Route:** `POST /api/organization-members`
- **Emails:**
  - Invitee: invite link → **`/invite/org-member?t=<token>`**
  - Owner: “team member added” notice
- **DB:** `organization_members.invite_token_hash`, `invite_token_expires_at`

### 5.4 Dashboard UX caveat — when is email sent?

Invite API is called **only when the owner completes Step 2** of the modal (“permissions” step) and submits — **not** on Step 1 “Next: Set Permissions” alone.

Flow:

1. Step 1: email + role → **Next** → only switches UI to Step 2.  
2. Step 2: select permissions → submit (**Update Permissions** / Saving…) → **`POST /api/organization-members`** → emails triggered.

### 5.5 Accept invite

- **Page:** `/invite/org-member` (client; uses `useSession`).
- **API:** `POST /api/organization-members/accept-invite` with `{ token }`; user must be logged in with **same email** as invitation.

### 5.6 Grant sync

- **`syncOrgMemberAccessGrantsFromTemplate`** (`src/lib/organization/sync-org-member-access-grants.ts`) runs when:
  - Member already had user id when added
  - Lazy email→user link in `GET /api/organization-members/me`
  - Successful accept-invite

---

## 6. Optional: email OTP on password login (organization users)

- **Enabled when:** `RESEND_API_KEY` is set **and** `ORG_LOGIN_EMAIL_OTP` is **not** `"false"`.
- **Who:** Users who are **org owners** (`organizations.owner_user_id`) **or** **active** `organization_members` rows.
- **Flow:** `/api/auth/request-login-otp` → email code → `signIn("credentials", { …, otp })`.
- **Disable for testing:** `ORG_LOGIN_EMAIL_OTP=false` in `.env.local`.

**Clerk login path does not use this OTP** — it’s tied to NextAuth credentials.

---

## 7. What is **not** implemented

1. **Clerk Organizations** (multi-tenant Clerk orgs, Clerk org roles).
2. **Clerk invitation API** replacing custom Resend invites.
3. **Clerk webhooks** (`user.created`, invitation accepted) syncing Postgres automatically.
4. **Embedded Clerk widget** or **hosted redirect** on `/login` (must be added if Clerk-only UX is required).
5. **Automatic creation** of full `profiles` + `auth_users` rows for brand-new users who exist **only** in Clerk with no prior DB row (invite/email bridge expects matching email in `auth_users` for full internal consistency unless signup/admin creates them).

---

## 8. Files reference (quick map)

| Topic | Location |
|-------|-----------|
| NextAuth options + Clerk merge session | `src/auth.ts` |
| Clerk ↔ DB bridge | `src/lib/clerk-user-bridge.ts`, `src/lib/auth-db.ts` |
| Middleware + Clerk + JWT | `src/middleware.ts` |
| Login UI | `src/app/login/page.tsx` |
| Resend core | `src/lib/notifications/email.ts` |
| Org / team email copy | `src/lib/notifications/org-emails.ts` |
| App URL for links | `src/lib/app-url.ts` |
| Login OTP | `src/lib/auth-login-otp.ts`, `src/app/api/auth/request-login-otp/route.ts` |
| Admin org + welcome mail | `src/app/api/admin/organizations/route.ts` |
| Team member + mails + token | `src/app/api/organization-members/route.ts` |
| Accept invite API | `src/app/api/organization-members/accept-invite/route.ts` |
| Invite page | `src/app/invite/org-member/page.tsx` |
| Grant sync | `src/lib/organization/sync-org-member-access-grants.ts` |

---

## 9. Suggested checklist for a new developer

1. [ ] `.env.local`: `NEXTAUTH_SECRET`, DB URL, Clerk keys (if using Clerk), Resend keys (if using emails).  
2. [ ] Confirm product decision: **password-only login** vs **Clerk hosted** vs **Clerk widget** on `/login`.  
3. [ ] If emails matter: uncomment/set `RESEND_API_KEY`, valid `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL`.  
4. [ ] Test super-admin org creation → owner inbox.  
5. [ ] Test team invite **through Step 2** → invitee + owner inboxes.  
6. [ ] Test accept-invite flow with matching login email.  

---

## 10. One-line summary for stakeholders

**“The app supports NextAuth password login with optional email OTP for org users; Clerk is integrated at middleware/provider/session-merge level but has no sign-in UI on `/login` unless we add a widget or hosted redirect. Team and org emails use Resend and fire after specific API actions—not from Clerk.”**

---

*Document generated for internal handoff. Update this file when architecture changes.*
