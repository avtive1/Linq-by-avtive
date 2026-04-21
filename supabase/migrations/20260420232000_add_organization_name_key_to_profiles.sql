alter table public.profiles
add column if not exists organization_name_key text;

create index if not exists profiles_organization_name_key_idx
on public.profiles (organization_name_key);
