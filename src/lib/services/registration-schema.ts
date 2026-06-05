import { queryNeon } from "@/lib/neon-db";

let schemaEnsured = false;

export async function ensureRegistrationRequestsSchema() {
  if (schemaEnsured) return;

  await queryNeon(
    `CREATE TABLE IF NOT EXISTS public.registration_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NULL,
      event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
      organization_id uuid NOT NULL,
      status text NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
      rejection_reason text NULL,
      attendee_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      card_email_lookup_tag text NULL,
      card_id uuid NULL,
      reviewed_by_user_id uuid NULL,
      reviewed_at timestamptz NULL,
      attendee_notified_at timestamptz NULL,
      notification_error text NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
  );

  await queryNeon(
    `CREATE INDEX IF NOT EXISTS registration_requests_org_status_idx
     ON public.registration_requests (organization_id, status)`,
  );

  await queryNeon(
    `CREATE INDEX IF NOT EXISTS registration_requests_event_status_idx
     ON public.registration_requests (event_id, status)`,
  );

  await queryNeon(
    `CREATE UNIQUE INDEX IF NOT EXISTS registration_requests_pending_email_event_uidx
     ON public.registration_requests (event_id, card_email_lookup_tag)
     WHERE status = 'PENDING' AND card_email_lookup_tag IS NOT NULL`,
  );

  schemaEnsured = true;
}
