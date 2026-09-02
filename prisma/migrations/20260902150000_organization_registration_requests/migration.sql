-- CreateTable
CREATE TABLE IF NOT EXISTS public.organization_registration_requests (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reference_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "applicant_user_id" UUID,
    "contact_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "contact_designation" TEXT NOT NULL,
    "contact_linkedin" TEXT,
    "organization_name" TEXT NOT NULL,
    "organization_name_key" TEXT NOT NULL,
    "organization_website" TEXT,
    "organization_description" TEXT,
    "organization_logo_url" TEXT NOT NULL,
    "social_links" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "industry" TEXT,
    "organization_type" TEXT,
    "company_size" TEXT,
    "country" TEXT,
    "city" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "admin_notes" TEXT,
    "rejection_reason" TEXT,
    "changes_requested_notes" TEXT,
    "created_organization_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "organization_registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "organization_registration_requests_reference_number_key" ON public.organization_registration_requests("reference_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "org_reg_req_ref_num_idx" ON public.organization_registration_requests("reference_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "org_reg_req_status_created_idx" ON public.organization_registration_requests("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "org_reg_req_contact_email_idx" ON public.organization_registration_requests("contact_email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "org_reg_req_name_key_idx" ON public.organization_registration_requests("organization_name_key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "org_reg_req_applicant_user_idx" ON public.organization_registration_requests("applicant_user_id");
