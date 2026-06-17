-- Row-Level Security: defense-in-depth tenant isolation.
-- app.current_tenant = organization owner user id (org boundary).
-- app.current_user = authenticated user id (for requester-scoped reads).
-- app.bypass_rls = 'true' for platform admin / migrations only.

CREATE OR REPLACE FUNCTION public.rls_bypass_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(current_setting('app.bypass_rls', true), '') = 'true';
$$;

CREATE OR REPLACE FUNCTION public.rls_current_tenant()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.rls_current_user()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user', true), '')::uuid;
$$;

-- events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.events;
CREATE POLICY tenant_isolation ON public.events
  USING (
    public.rls_bypass_enabled()
    OR user_id = public.rls_current_tenant()
  )
  WITH CHECK (
    public.rls_bypass_enabled()
    OR user_id = public.rls_current_tenant()
  );

-- organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.organizations;
CREATE POLICY tenant_isolation ON public.organizations
  USING (
    public.rls_bypass_enabled()
    OR owner_user_id = public.rls_current_tenant()
  )
  WITH CHECK (
    public.rls_bypass_enabled()
    OR owner_user_id = public.rls_current_tenant()
  );

-- organization_members
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.organization_members;
CREATE POLICY tenant_isolation ON public.organization_members
  USING (
    public.rls_bypass_enabled()
    OR org_owner_user_id = public.rls_current_tenant()
    OR member_user_id = public.rls_current_user()
  )
  WITH CHECK (
    public.rls_bypass_enabled()
    OR org_owner_user_id = public.rls_current_tenant()
  );

-- organization_role_permission_templates
ALTER TABLE public.organization_role_permission_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_role_permission_templates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.organization_role_permission_templates;
CREATE POLICY tenant_isolation ON public.organization_role_permission_templates
  USING (
    public.rls_bypass_enabled()
    OR org_owner_user_id = public.rls_current_tenant()
  )
  WITH CHECK (
    public.rls_bypass_enabled()
    OR org_owner_user_id = public.rls_current_tenant()
  );

-- organization_join_requests
ALTER TABLE public.organization_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_join_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.organization_join_requests;
CREATE POLICY tenant_isolation ON public.organization_join_requests
  USING (
    public.rls_bypass_enabled()
    OR owner_user_id = public.rls_current_tenant()
    OR requester_user_id = public.rls_current_user()
  )
  WITH CHECK (
    public.rls_bypass_enabled()
    OR owner_user_id = public.rls_current_tenant()
    OR requester_user_id = public.rls_current_user()
  );

-- access_requests
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.access_requests;
CREATE POLICY tenant_isolation ON public.access_requests
  USING (
    public.rls_bypass_enabled()
    OR owner_user_id = public.rls_current_tenant()
    OR requester_user_id = public.rls_current_user()
  )
  WITH CHECK (
    public.rls_bypass_enabled()
    OR owner_user_id = public.rls_current_tenant()
    OR requester_user_id = public.rls_current_user()
  );

-- access_grants
ALTER TABLE public.access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_grants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.access_grants;
CREATE POLICY tenant_isolation ON public.access_grants
  USING (
    public.rls_bypass_enabled()
    OR granted_by_user_id = public.rls_current_tenant()
    OR grantee_user_id = public.rls_current_user()
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = access_grants.event_id
        AND e.user_id = public.rls_current_tenant()
    )
  )
  WITH CHECK (
    public.rls_bypass_enabled()
    OR granted_by_user_id = public.rls_current_tenant()
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = access_grants.event_id
        AND e.user_id = public.rls_current_tenant()
    )
  );

-- registration_requests
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.registration_requests;
CREATE POLICY tenant_isolation ON public.registration_requests
  USING (
    public.rls_bypass_enabled()
    OR organization_id = public.rls_current_tenant()
    OR user_id = public.rls_current_user()
  )
  WITH CHECK (
    public.rls_bypass_enabled()
    OR organization_id = public.rls_current_tenant()
    OR user_id = public.rls_current_user()
  );

-- attendees
ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendees FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.attendees;
CREATE POLICY tenant_isolation ON public.attendees
  USING (
    public.rls_bypass_enabled()
    OR user_id = public.rls_current_tenant()
    OR user_id = public.rls_current_user()
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = attendees.event_id
        AND e.user_id = public.rls_current_tenant()
    )
  )
  WITH CHECK (
    public.rls_bypass_enabled()
    OR user_id = public.rls_current_tenant()
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = attendees.event_id
        AND e.user_id = public.rls_current_tenant()
    )
  );

-- short_links (creator-scoped)
ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.short_links FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.short_links;
CREATE POLICY tenant_isolation ON public.short_links
  USING (
    public.rls_bypass_enabled()
    OR created_by_user_id = public.rls_current_tenant()
    OR created_by_user_id = public.rls_current_user()
  )
  WITH CHECK (
    public.rls_bypass_enabled()
    OR created_by_user_id = public.rls_current_tenant()
    OR created_by_user_id = public.rls_current_user()
  );
