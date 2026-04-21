create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  organization_name_key text not null unique,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organizations_owner_unique_idx
on public.organizations (owner_user_id);

with ranked_profiles as (
  select
    p.id as user_id,
    p.organization_name,
    p.organization_name_key,
    p.created_at,
    coalesce(lower(p.role::text), 'user') as role_key,
    row_number() over (
      partition by p.organization_name_key
      order by
        case when coalesce(lower(p.role::text), 'user') = 'admin' then 0 else 1 end,
        p.created_at asc,
        p.id asc
    ) as rn
  from public.profiles p
  where coalesce(p.organization_name_key, '') <> ''
)
insert into public.organizations (organization_name, organization_name_key, owner_user_id)
select
  rp.organization_name,
  rp.organization_name_key,
  rp.user_id
from ranked_profiles rp
where rp.rn = 1
on conflict (organization_name_key) do nothing;

update public.organization_join_requests r
set owner_user_id = o.owner_user_id
from public.organizations o
where o.organization_name_key = regexp_replace(lower(trim(r.requested_org_name)), '[^a-z0-9]', '', 'g')
  and r.owner_user_id <> o.owner_user_id;
