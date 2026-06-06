-- Production-safe performance indexes (idempotent).
-- Apply with: npm run db:indexes
-- All statements use IF NOT EXISTS — safe to re-run.

-- ---------------------------------------------------------------------------
-- events
-- Query: WHERE user_id = ? ORDER BY created_at DESC (dashboard event list)
-- FK:    user_id -> profiles.id
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS events_user_id_created_at_idx
  ON public.events (user_id, created_at DESC);

-- short_id lookups (/r/{slug}) — may already exist from runtime ensure
CREATE UNIQUE INDEX IF NOT EXISTS events_short_id_idx
  ON public.events (short_id);

-- ---------------------------------------------------------------------------
-- attendees
-- Query: WHERE event_id = ? ORDER BY created_at DESC
-- FK:    event_id -> events.id
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS attendees_event_id_created_at_idx
  ON public.attendees (event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS attendees_user_id_idx
  ON public.attendees (user_id)
  WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- organization_members (high-traffic permission checks)
-- Query: WHERE member_user_id = ? AND org_owner_user_id = ? AND status = 'active'
-- Query: WHERE org_owner_user_id = ? ORDER BY created_at DESC
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS organization_members_member_status_idx
  ON public.organization_members (member_user_id, status);

-- Permission lookup: WHERE member_user_id = ? AND org_owner_user_id = ? AND status = ?
CREATE INDEX IF NOT EXISTS idx_org_members_permission_lookup
  ON public.organization_members (member_user_id, org_owner_user_id, status);

CREATE INDEX IF NOT EXISTS organization_members_owner_member_status_idx
  ON public.organization_members (org_owner_user_id, member_user_id, status);

CREATE INDEX IF NOT EXISTS organization_members_org_owner_created_at_idx
  ON public.organization_members (org_owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS organization_members_invite_token_hash_idx
  ON public.organization_members (invite_token_hash)
  WHERE invite_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS organization_members_member_email_idx
  ON public.organization_members (member_email)
  WHERE member_email IS NOT NULL;

-- ---------------------------------------------------------------------------
-- access_requests
-- Query: WHERE event_id = ? AND status = 'pending' ORDER BY created_at DESC
-- Query: WHERE owner_user_id = ? AND status = 'pending' ORDER BY created_at DESC
-- Query: WHERE requester_user_id = ? ORDER BY created_at DESC
-- FK:    event_id, requester_user_id, owner_user_id
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS access_requests_event_status_created_idx
  ON public.access_requests (event_id, status, created_at DESC)
  WHERE event_id IS NOT NULL;

-- Non-partial index for EXPLAIN-friendly event pending queue scans
CREATE INDEX IF NOT EXISTS idx_access_requests_event_status_created
  ON public.access_requests (event_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS access_requests_owner_status_created_idx
  ON public.access_requests (owner_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS access_requests_requester_created_idx
  ON public.access_requests (requester_user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- access_grants
-- Query: WHERE grantee_user_id = ? AND status = 'active'
-- Query: WHERE event_id = ANY(...)
-- FK:    grantee_user_id, event_id, granted_by_user_id
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS access_grants_grantee_status_idx
  ON public.access_grants (grantee_user_id, status);

CREATE INDEX IF NOT EXISTS access_grants_event_id_idx
  ON public.access_grants (event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS access_grants_granted_by_status_idx
  ON public.access_grants (granted_by_user_id, status);

-- ---------------------------------------------------------------------------
-- registration_requests (extends runtime schema indexes)
-- Query: WHERE event_id = ? AND status = 'PENDING' ORDER BY created_at DESC
-- FK:    card_id, event_id, organization_id, user_id
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS registration_requests_event_status_created_idx
  ON public.registration_requests (event_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS registration_requests_card_id_idx
  ON public.registration_requests (card_id)
  WHERE card_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS registration_requests_user_id_idx
  ON public.registration_requests (user_id)
  WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- organization_join_requests
-- Query: WHERE owner_user_id = ? AND status = 'pending' ORDER BY created_at DESC
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS organization_join_requests_owner_status_created_idx
  ON public.organization_join_requests (owner_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS organization_join_requests_requester_created_idx
  ON public.organization_join_requests (requester_user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- organizations / profiles / auth_users
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS organizations_owner_user_id_idx
  ON public.organizations (owner_user_id);

CREATE INDEX IF NOT EXISTS organizations_organization_name_key_idx
  ON public.organizations (organization_name_key);

CREATE INDEX IF NOT EXISTS profiles_username_idx
  ON public.profiles (username);

CREATE INDEX IF NOT EXISTS profiles_organization_name_key_idx
  ON public.profiles (organization_name_key)
  WHERE organization_name_key IS NOT NULL;

-- Normalized email for index-friendly login lookups (replaces lower(email) predicates)
ALTER TABLE public.auth_users
  ADD COLUMN IF NOT EXISTS email_normalized TEXT;

UPDATE public.auth_users
SET email_normalized = lower(email)
WHERE email_normalized IS NULL
   OR email_normalized <> lower(email);

CREATE INDEX IF NOT EXISTS idx_auth_users_email_norm
  ON public.auth_users (email_normalized);

CREATE INDEX IF NOT EXISTS auth_users_reset_token_hash_idx
  ON public.auth_users (reset_token_hash)
  WHERE reset_token_hash IS NOT NULL;

-- ---------------------------------------------------------------------------
-- login_email_otp (active code verification)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS login_email_otp_user_active_idx
  ON public.login_email_otp (user_id, expires_at DESC)
  WHERE consumed_at IS NULL;

-- ---------------------------------------------------------------------------
-- short_links (slug already unique — target path lookup index)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS short_links_target_path_idx
  ON public.short_links (target_path);
