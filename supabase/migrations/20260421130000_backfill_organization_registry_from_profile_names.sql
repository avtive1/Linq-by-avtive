update public.profiles
set organization_name_key = regexp_replace(lower(trim(organization_name)), '[^a-z0-9]', '', 'g')
where coalesce(organization_name, '') <> ''
  and coalesce(organization_name_key, '') = '';

with ranked_profiles as (
  select
    p.id as user_id,
    p.organization_name,
    regexp_replace(lower(trim(coalesce(p.organization_name, ''))), '[^a-z0-9]', '', 'g') as computed_org_key,
    p.created_at,
    coalesce(lower(p.role::text), 'user') as role_key,
    row_number() over (
      partition by regexp_replace(lower(trim(coalesce(p.organization_name, ''))), '[^a-z0-9]', '', 'g')
      order by
        case when coalesce(lower(p.role::text), 'user') = 'admin' then 0 else 1 end,
        p.created_at asc,
        p.id asc
    ) as rn
  from public.profiles p
  where coalesce(trim(p.organization_name), '') <> ''
)
insert into public.organizations (organization_name, organization_name_key, owner_user_id)
select
  rp.organization_name,
  rp.computed_org_key,
  rp.user_id
from ranked_profiles rp
where rp.rn = 1
  and coalesce(rp.computed_org_key, '') <> ''
on conflict (organization_name_key) do update
set organization_name = excluded.organization_name,
    owner_user_id = excluded.owner_user_id,
    updated_at = now();
