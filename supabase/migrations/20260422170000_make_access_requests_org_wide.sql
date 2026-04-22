-- Allow access_requests to be organization-wide (null event_id)
-- This allows team members to request global permissions like 'create_event'.

ALTER TABLE public.access_requests ALTER COLUMN event_id DROP NOT NULL;

-- Update the unique index to support organization-wide requests (null event_id)
DROP INDEX IF EXISTS public.access_requests_pending_unique;

-- New unique index: (requester, owner, action) when event_id is NULL
CREATE UNIQUE INDEX access_requests_pending_org_wide_unique 
ON public.access_requests (requester_user_id, owner_user_id, requested_action)
WHERE status = 'pending' AND event_id IS NULL;

-- Keep the existing one for event-specific requests
CREATE UNIQUE INDEX access_requests_pending_event_specific_unique 
ON public.access_requests (event_id, requester_user_id, requested_action)
WHERE status = 'pending' AND event_id IS NOT NULL;
