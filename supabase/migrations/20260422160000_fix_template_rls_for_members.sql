-- Fix RLS for organization_role_permission_templates to allow members to see their own organization's templates
-- This is required for the event creation RLS check to work for team members

-- 1. Update SELECT policy for organization_role_permission_templates
DROP POLICY IF EXISTS org_role_templates_owner_only_select ON public.organization_role_permission_templates;

CREATE POLICY "Owners and members can view templates"
ON public.organization_role_permission_templates
FOR SELECT
TO authenticated
USING (
  -- User is the owner
  (org_owner_user_id = auth.uid())
  OR
  -- User is a member of this organization
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE member_user_id = auth.uid()
      AND org_owner_user_id = public.organization_role_permission_templates.org_owner_user_id
  )
);

-- 2. Ensure organization_members table also has proper SELECT access for members (already exists but double check)
-- Policy "organization_members_select_owner_or_member" on public.organization_members already allows this.
