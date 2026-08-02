# Authentication Handoff

## Current State

Authentication has been migrated from Auth.js / NextAuth credentials to Neon Auth.

- Neon Auth server entrypoint: `src/lib/auth/neon.ts`
- Neon Auth client entrypoint: `src/lib/auth/client.ts`
- Auth API handler: `src/app/api/auth/[...path]/route.ts`
- App session compatibility helper: `src/auth.ts`
- Protected-route proxy: `src/proxy.ts`

The app still uses its existing business identity tables:

- `public.profiles`
- `public.auth_users`

Neon Auth is the login/session/password authority. The app maps a Neon Auth user to the internal app user through `auth_users.neon_auth_user_id`, falling back to email linking during session resolution.

## Runtime Flow

1. Users sign up or sign in through Neon Auth.
2. The app provisions or resolves the existing internal profile/auth row.
3. `getServerAuthSession()` returns the same application-facing shape used by authorization code:
   - `session.user.id`
   - `session.user.email`
   - `session.user.role`
   - `session.user.organizationName`
4. API routes and Server Components continue using that internal user id for ownership, admin checks, and tenant logic.

## Legacy Password Migration

Existing users who only have an app-owned `auth_users.password_hash` can keep using their previous email and password.

On login:

1. The client first tries Neon Auth.
2. If Neon Auth rejects the credentials, `/api/auth/migrate-legacy-login` verifies the previous Argon2 password hash.
3. If the old password is valid, the client creates the Neon Auth account with the same email and password.
4. The normal session resolver links that Neon Auth user back to the existing internal app user by email.

This is intentionally just-in-time. Bulk password migration is not possible from hashes alone without an official Neon Auth hash-import API or the users' plaintext passwords.

## Environment

Required:

- `NEON_AUTH_BASE_URL`
- `NEON_AUTH_COOKIE_SECRET`
- `DATABASE_URL`
- `DATABASE_URL_DIRECT`

Obsolete:

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

## Notes

- The old Auth.js credentials route, provider, JWT callbacks, `SessionProvider`, `useSession`, `signIn`, and `signOut` usage have been removed.
- Password reset and password change now call Neon Auth APIs.
- The historical `login_email_otp` table remains in the schema but is no longer part of the active login flow.
- Clerk remains installed and wrapped in layout/middleware because removing Clerk was outside this migration scope.
