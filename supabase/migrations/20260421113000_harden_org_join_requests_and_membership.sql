alter table public.organization_join_requests
add column if not exists reapply_after timestamptz,
add column if not exists rejection_reason text;

create index if not exists org_join_requests_requester_status_reapply_idx
on public.organization_join_requests (requester_user_id, status, reapply_after);

create unique index if not exists organization_members_single_active_org_per_member
on public.organization_members (member_user_id)
where status = 'active';
