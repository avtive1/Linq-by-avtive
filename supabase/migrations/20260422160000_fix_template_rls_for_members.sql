-- Fix RLS for organization_role_permission_templates to allow members to view their organization's templates.
-- This is required for the events insertion RLS check to succeed for members.

DROP POLICY IF EXISTS org_role_templates_owner_only_select ON public.organization_role_permission_templates;

CREATE POLICY "Allow owners and members to view organization templates"
ON public.organization_role_permission_templates
FOR SELECT
TO authenticated
USING (
  (org_owner_user_id = auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE member_user_id = auth.uid()
      AND org_owner_user_id = organization_role_permission_templates.org_owner_user_id
      AND status = 'active'
  )
);
