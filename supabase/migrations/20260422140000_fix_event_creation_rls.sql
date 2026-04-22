-- Fix RLS policy for events table to allow organization members with create_event permission to insert events
-- Run this in the Supabase SQL editor or via `supabase db push`.

-- 1. Enable RLS on events (it should be enabled, but let's be sure)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing insert policies if they are too restrictive
-- Usually there is one like "Users can insert their own events"
-- DROP POLICY IF EXISTS "Users can insert their own events" ON public.events;

-- 3. Create a comprehensive insert policy
CREATE POLICY "Users and organization members can insert events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (
  -- User is inserting their own event
  (user_id = auth.uid())
  OR 
  -- User is a member of the organization (user_id is the owner) and has 'create_event' permission in templates
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
);

-- 4. Also update SELECT policy so members can see events they are supposed to
-- (This might already be handled by access_grants, but organization members should see all events of the org)
CREATE POLICY "Organization members can view all organization events"
ON public.events
FOR SELECT
TO authenticated
USING (
  (user_id = auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE member_user_id = auth.uid()
      AND org_owner_user_id = events.user_id
  )
);
