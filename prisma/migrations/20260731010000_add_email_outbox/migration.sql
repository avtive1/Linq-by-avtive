CREATE TABLE public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_outbox_status_check CHECK (status IN ('pending', 'processing', 'sent', 'failed'))
);

CREATE INDEX email_outbox_ready_idx
  ON public.email_outbox (available_at, created_at)
  WHERE status IN ('pending', 'processing');

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_outbox FORCE ROW LEVEL SECURITY;

CREATE POLICY system_only ON public.email_outbox
  USING (public.rls_bypass_enabled())
  WITH CHECK (public.rls_bypass_enabled());
