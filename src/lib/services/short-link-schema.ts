import { queryNeon } from "@/lib/neon-db";

let schemaEnsured = false;

export async function ensureShortLinksSchema() {
  if (schemaEnsured) return;

  await queryNeon(
    `CREATE TABLE IF NOT EXISTS public.short_links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug text NOT NULL,
      target_path text NOT NULL,
      created_by_user_id uuid NULL,
      hit_count bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_accessed_at timestamptz NULL
    )`,
  );

  await queryNeon(
    `CREATE UNIQUE INDEX IF NOT EXISTS short_links_slug_uidx ON public.short_links (slug)`,
  );

  await queryNeon(
    `CREATE INDEX IF NOT EXISTS short_links_target_path_idx ON public.short_links (target_path)`,
  );

  schemaEnsured = true;
}
