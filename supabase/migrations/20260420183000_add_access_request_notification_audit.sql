alter table public.access_requests
add column if not exists owner_notified_at timestamptz;

alter table public.access_requests
add column if not exists requester_notified_at timestamptz;

alter table public.access_requests
add column if not exists notification_error text;
