insert into public.access_grants (event_id, grantee_user_id, granted_by_user_id, permission, status)
select
  e.id as event_id,
  m.member_user_id as grantee_user_id,
  m.org_owner_user_id as granted_by_user_id,
  'view_event' as permission,
  'active' as status
from public.organization_members m
join public.events e
  on e.user_id = m.org_owner_user_id
where m.status = 'active'
  and not exists (
    select 1
    from public.access_grants ag
    where ag.event_id = e.id
      and ag.grantee_user_id = m.member_user_id
      and ag.permission = 'view_event'
      and ag.status = 'active'
  );
