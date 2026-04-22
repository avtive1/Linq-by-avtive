-- Allow access_grants to be organization-wide (null event_id)
-- This enables global permission grants for team members.

ALTER TABLE public.access_grants ALTER COLUMN event_id DROP NOT NULL;

-- Update the unique index to support organization-wide grants (null event_id)
DROP INDEX IF EXISTS public.access_grants_active_unique;

-- Unique grant for a user on a specific event
CREATE UNIQUE INDEX access_grants_active_event_specific_unique 
ON public.access_grants (event_id, grantee_user_id, permission)
WHERE status = 'active' AND event_id IS NOT NULL;

-- Unique grant for a user globally (no event_id)
CREATE UNIQUE INDEX access_grants_active_global_unique 
ON public.access_grants (grantee_user_id, permission)
WHERE status = 'active' AND event_id IS NULL;

-- Update RLS on events table to check for global 'create_event' grants
DROP POLICY IF EXISTS "Users and organization members can insert events" ON public.events;

CREATE POLICY "Users and organization members can insert events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (
  -- 1. User is inserting their own event
  (user_id = auth.uid())
  OR 
  -- 2. User has 'create_event' in their role template for this org
  EXISTS (
    SELECT 1 
    FROM public.organization_members m
    JOIN public.organization_role_permission_templates t 
      ON m.org_owner_user_id = t.org_owner_user_id 
      AND m.role_label = t.role_label
    WHERE m.member_user_id = auth.uid()
      AND m.org_owner_user_id = events.user_id
      AND 'create_event' = ANY(t.permissions)
  )
  OR
  -- 3. User has been granted global 'create_event' access
  EXISTS (
    SELECT 1 FROM public.access_grants g
    WHERE g.grantee_user_id = auth.uid()
      AND g.granted_by_user_id = events.user_id
      AND g.permission = 'create_event'
      AND g.status = 'active'
      AND g.event_id IS NULL
  )
);
