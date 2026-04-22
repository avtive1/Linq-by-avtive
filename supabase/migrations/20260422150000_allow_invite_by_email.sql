-- Update organization_members to support inviting by email even if user hasn't signed up yet
-- 1. Add member_email column
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS member_email text;

-- 2. Make member_user_id nullable (so we can invite by email only)
ALTER TABLE public.organization_members ALTER COLUMN member_user_id DROP NOT NULL;

-- 3. Update the unique constraint. 
-- We want to prevent duplicate memberships for the same org + email.
ALTER TABLE public.organization_members DROP CONSTRAINT IF EXISTS organization_members_unique_pair;
-- Drop the index if it exists as a standalone index instead of a constraint
DROP INDEX IF EXISTS public.organization_members_unique_pair;

-- Create a new unique index that covers both UUID and email to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS organization_members_org_email_idx ON public.organization_members (org_owner_user_id, member_email);

-- 4. Backfill existing member_emails from auth.users (via a secure way or just let the API handle it)
-- For now, we'll just let the next API call sync them.
