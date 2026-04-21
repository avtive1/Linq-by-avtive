create table if not exists public.access_grants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  grantee_user_id uuid not null references auth.users(id) on delete cascade,
  granted_by_user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists access_grants_event_grantee_idx
on public.access_grants(event_id, grantee_user_id, status);

create unique index if not exists access_grants_active_unique
on public.access_grants(event_id, grantee_user_id, permission)
where status = 'active';
