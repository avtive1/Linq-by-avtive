alter table public.profiles
add column if not exists username_changed_at timestamptz;

alter table public.profiles
add column if not exists organization_name_changed_at timestamptz;
