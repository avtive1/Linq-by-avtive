create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_owner_user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  role_label text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organization_members_unique_pair
on public.organization_members (org_owner_user_id, member_user_id);

create index if not exists organization_members_member_idx
on public.organization_members (member_user_id, status);
