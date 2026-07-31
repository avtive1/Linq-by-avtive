-- Provision the least-privileged role used by tenant-scoped application queries.
-- Deploy-time only: request handlers must not create roles or grant privileges.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant_rls') THEN
    CREATE ROLE app_tenant_rls NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_tenant_rls;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tenant_rls;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_tenant_rls;
GRANT app_tenant_rls TO CURRENT_USER;
