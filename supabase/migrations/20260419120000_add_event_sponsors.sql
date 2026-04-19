-- Event sponsors: up to 5 entries as JSON array of { "name": string, "logo_url": string }
-- Run this in the Supabase SQL editor or via `supabase db push` if you use the CLI.

alter table public.events
  add column if not exists sponsors jsonb not null default '[]'::jsonb;

comment on column public.events.sponsors is 'Array of sponsor objects: name + public logo_url (max 5, enforced in app).';
