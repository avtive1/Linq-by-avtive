alter table public.attendees
add column if not exists guest_category text;

create index if not exists attendees_guest_category_idx
on public.attendees (guest_category);
