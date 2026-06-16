-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" TEXT NOT NULL,
    "organization_name" TEXT,
    "organization_name_key" TEXT,
    "role" TEXT,
    "organization_logo_url" TEXT,
    "profile_photo_url" TEXT,
    "owner_profile_setup_completed_at" TIMESTAMPTZ(6),
    "owner_onboarding_team_step_completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_users" (
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "email_normalized" TEXT,
    "password_hash" TEXT,
    "clerk_user_id" TEXT,
    "reset_token_hash" TEXT,
    "reset_token_expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_name" TEXT NOT NULL,
    "organization_name_key" TEXT NOT NULL,
    "owner_user_id" UUID,
    "organization_logo_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "location" TEXT,
    "location_type" TEXT,
    "date" TEXT,
    "time" TEXT,
    "logo_url" TEXT,
    "sponsors" JSONB,
    "registration_form_config" JSONB NOT NULL DEFAULT '{}',
    "short_id" TEXT,
    "card_color" TEXT NOT NULL DEFAULT 'purple',
    "card_font" TEXT NOT NULL DEFAULT 'inter',
    "horizontal_text_color" TEXT NOT NULL DEFAULT '',
    "vertical_text_color" TEXT NOT NULL DEFAULT '',
    "is_branding_finalized" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID,
    "user_id" UUID,
    "name" TEXT,
    "role" TEXT,
    "company" TEXT,
    "event_name" TEXT,
    "session_date" TEXT,
    "session_time" TEXT,
    "location" TEXT,
    "track" TEXT,
    "guest_category" TEXT,
    "year" TEXT,
    "design_type" TEXT,
    "card_color" TEXT,
    "card_font" TEXT,
    "photo_url" TEXT,
    "card_preview_url" TEXT,
    "card_email" TEXT,
    "linkedin" TEXT,
    "card_email_lookup_tag" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_owner_user_id" UUID NOT NULL,
    "member_user_id" UUID,
    "member_email" TEXT,
    "role_label" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "invite_token_hash" TEXT,
    "invite_token_expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_role_permission_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_owner_user_id" UUID NOT NULL,
    "role_label" TEXT NOT NULL,
    "permissions" TEXT[],
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_role_permission_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_join_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "requester_user_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "requested_org_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reapply_after" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "organization_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID,
    "requester_user_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "requested_action" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "owner_notified_at" TIMESTAMPTZ(6),
    "requester_notified_at" TIMESTAMPTZ(6),
    "notification_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_grants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID,
    "grantee_user_id" UUID NOT NULL,
    "granted_by_user_id" UUID NOT NULL,
    "permission" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "event_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "attendee_payload" JSONB NOT NULL DEFAULT '{}',
    "card_email_lookup_tag" TEXT,
    "card_id" UUID,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "attendee_notified_at" TIMESTAMPTZ(6),
    "notification_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "short_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "target_path" TEXT NOT NULL,
    "created_by_user_id" UUID,
    "hit_count" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_accessed_at" TIMESTAMPTZ(6),

    CONSTRAINT "short_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_email_otp" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_email_otp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- CreateIndex
CREATE INDEX "profiles_username_idx" ON "profiles"("username");

-- CreateIndex
CREATE INDEX "profiles_organization_name_key_idx" ON "profiles"("organization_name_key");

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_email_key" ON "auth_users"("email");

-- CreateIndex
CREATE INDEX "auth_users_email_idx" ON "auth_users"("email");

-- CreateIndex
CREATE INDEX "idx_auth_users_email_norm" ON "auth_users"("email_normalized");

-- CreateIndex
CREATE INDEX "auth_users_reset_token_hash_idx" ON "auth_users"("reset_token_hash");

-- CreateIndex
CREATE INDEX "auth_users_clerk_user_id_uidx" ON "auth_users"("clerk_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_organization_name_key_key" ON "organizations"("organization_name_key");

-- CreateIndex
CREATE INDEX "organizations_owner_user_id_idx" ON "organizations"("owner_user_id");

-- CreateIndex
CREATE INDEX "organizations_organization_name_key_idx" ON "organizations"("organization_name_key");

-- CreateIndex
CREATE UNIQUE INDEX "events_short_id_key" ON "events"("short_id");

-- CreateIndex
CREATE INDEX "events_user_id_created_at_idx" ON "events"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "events_short_id_idx" ON "events"("short_id");

-- CreateIndex
CREATE INDEX "attendees_event_id_created_at_idx" ON "attendees"("event_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "attendees_user_id_idx" ON "attendees"("user_id");

-- CreateIndex
CREATE INDEX "organization_members_member_status_idx" ON "organization_members"("member_user_id", "status");

-- CreateIndex
CREATE INDEX "idx_org_members_permission_lookup" ON "organization_members"("member_user_id", "org_owner_user_id", "status");

-- CreateIndex
CREATE INDEX "organization_members_owner_member_status_idx" ON "organization_members"("org_owner_user_id", "member_user_id", "status");

-- CreateIndex
CREATE INDEX "organization_members_org_owner_created_at_idx" ON "organization_members"("org_owner_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "organization_members_invite_token_hash_idx" ON "organization_members"("invite_token_hash");

-- CreateIndex
CREATE INDEX "organization_members_member_email_idx" ON "organization_members"("member_email");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_owner_email_key" ON "organization_members"("org_owner_user_id", "member_email");

-- CreateIndex
CREATE INDEX "organization_join_requests_owner_status_created_idx" ON "organization_join_requests"("owner_user_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "organization_join_requests_requester_created_idx" ON "organization_join_requests"("requester_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "access_requests_event_status_created_idx" ON "access_requests"("event_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "access_requests_owner_status_created_idx" ON "access_requests"("owner_user_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "access_requests_requester_created_idx" ON "access_requests"("requester_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "access_grants_grantee_status_idx" ON "access_grants"("grantee_user_id", "status");

-- CreateIndex
CREATE INDEX "access_grants_event_id_idx" ON "access_grants"("event_id");

-- CreateIndex
CREATE INDEX "access_grants_granted_by_status_idx" ON "access_grants"("granted_by_user_id", "status");

-- CreateIndex
CREATE INDEX "registration_requests_org_status_idx" ON "registration_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "registration_requests_event_status_idx" ON "registration_requests"("event_id", "status");

-- CreateIndex
CREATE INDEX "registration_requests_event_status_created_idx" ON "registration_requests"("event_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "registration_requests_card_id_idx" ON "registration_requests"("card_id");

-- CreateIndex
CREATE INDEX "registration_requests_user_id_idx" ON "registration_requests"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "short_links_slug_key" ON "short_links"("slug");

-- CreateIndex
CREATE INDEX "short_links_target_path_idx" ON "short_links"("target_path");

-- CreateIndex
CREATE INDEX "login_email_otp_user_expires_idx" ON "login_email_otp"("user_id", "expires_at" DESC);

-- AddForeignKey
ALTER TABLE "auth_users" ADD CONSTRAINT "auth_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_email_otp" ADD CONSTRAINT "login_email_otp_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Production constraints and partial indexes (not expressible in Prisma schema)
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS "auth_users_clerk_user_id_uidx";
CREATE UNIQUE INDEX "auth_users_clerk_user_id_uidx"
  ON "auth_users"("clerk_user_id")
  WHERE "clerk_user_id" IS NOT NULL;

ALTER TABLE "registration_requests"
  ADD CONSTRAINT "registration_requests_status_check"
  CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED'));

CREATE UNIQUE INDEX "registration_requests_pending_email_event_uidx"
  ON "registration_requests"("event_id", "card_email_lookup_tag")
  WHERE "status" = 'PENDING' AND "card_email_lookup_tag" IS NOT NULL;

CREATE INDEX "login_email_otp_user_active_idx"
  ON "login_email_otp"("user_id", "expires_at" DESC)
  WHERE "consumed_at" IS NULL;

CREATE INDEX "idx_access_requests_event_status_created"
  ON "access_requests"("event_id", "status", "created_at" DESC);
