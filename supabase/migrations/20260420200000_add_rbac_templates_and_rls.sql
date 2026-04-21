create table if not exists public.organization_role_permission_templates (
  id uuid primary key default gen_random_uuid(),
  org_owner_user_id uuid not null references auth.users(id) on delete cascade,
  role_label text not null,
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists org_role_permission_templates_unique
on public.organization_role_permission_templates (org_owner_user_id, role_label);

alter table public.access_requests enable row level security;
alter table public.access_grants enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_role_permission_templates enable row level security;

drop policy if exists access_requests_select_owner_or_requester on public.access_requests;
create policy access_requests_select_owner_or_requester
on public.access_requests
for select
using (owner_user_id = auth.uid() or requester_user_id = auth.uid());

drop policy if exists access_requests_insert_requester_only on public.access_requests;
create policy access_requests_insert_requester_only
on public.access_requests
for insert
with check (requester_user_id = auth.uid());

drop policy if exists access_requests_update_owner_only on public.access_requests;
create policy access_requests_update_owner_only
on public.access_requests
for update
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists access_grants_select_grantee_or_owner on public.access_grants;
create policy access_grants_select_grantee_or_owner
on public.access_grants
for select
using (grantee_user_id = auth.uid() or granted_by_user_id = auth.uid());

drop policy if exists organization_members_select_owner_or_member on public.organization_members;
create policy organization_members_select_owner_or_member
on public.organization_members
for select
using (org_owner_user_id = auth.uid() or member_user_id = auth.uid());

drop policy if exists organization_members_insert_owner_only on public.organization_members;
create policy organization_members_insert_owner_only
on public.organization_members
for insert
with check (org_owner_user_id = auth.uid());

drop policy if exists organization_members_update_owner_only on public.organization_members;
create policy organization_members_update_owner_only
on public.organization_members
for update
using (org_owner_user_id = auth.uid())
with check (org_owner_user_id = auth.uid());

drop policy if exists org_role_templates_owner_only_select on public.organization_role_permission_templates;
create policy org_role_templates_owner_only_select
on public.organization_role_permission_templates
for select
using (org_owner_user_id = auth.uid());

drop policy if exists org_role_templates_owner_only_insert on public.organization_role_permission_templates;
create policy org_role_templates_owner_only_insert
on public.organization_role_permission_templates
for insert
with check (org_owner_user_id = auth.uid());

drop policy if exists org_role_templates_owner_only_update on public.organization_role_permission_templates;
create policy org_role_templates_owner_only_update
on public.organization_role_permission_templates
for update
using (org_owner_user_id = auth.uid())
with check (org_owner_user_id = auth.uid());
