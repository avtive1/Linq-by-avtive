create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  requested_action text not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists access_requests_event_idx on public.access_requests(event_id);
create index if not exists access_requests_owner_status_idx on public.access_requests(owner_user_id, status);
create index if not exists access_requests_requester_status_idx on public.access_requests(requester_user_id, status);

create unique index if not exists access_requests_pending_unique
on public.access_requests (event_id, requester_user_id, requested_action)
where status = 'pending';
