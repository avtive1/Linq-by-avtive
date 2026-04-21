alter table public.organization_join_requests enable row level security;

drop policy if exists org_join_requests_select_owner_or_requester on public.organization_join_requests;
create policy org_join_requests_select_owner_or_requester
on public.organization_join_requests
for select
using (owner_user_id = auth.uid() or requester_user_id = auth.uid());

drop policy if exists org_join_requests_insert_requester_only on public.organization_join_requests;
create policy org_join_requests_insert_requester_only
on public.organization_join_requests
for insert
with check (requester_user_id = auth.uid());

drop policy if exists org_join_requests_update_owner_only on public.organization_join_requests;
create policy org_join_requests_update_owner_only
on public.organization_join_requests
for update
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());
