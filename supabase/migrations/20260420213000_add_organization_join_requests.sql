create table if not exists public.organization_join_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  requested_org_name text not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_join_requests_owner_status_idx
on public.organization_join_requests(owner_user_id, status);

create index if not exists org_join_requests_requester_status_idx
on public.organization_join_requests(requester_user_id, status);

create unique index if not exists org_join_requests_pending_unique
on public.organization_join_requests(requester_user_id, owner_user_id)
where status = 'pending';
