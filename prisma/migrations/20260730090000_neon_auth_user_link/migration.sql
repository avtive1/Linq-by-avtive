ALTER TABLE "auth_users"
  ADD COLUMN IF NOT EXISTS "neon_auth_user_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "auth_users_neon_auth_user_id_uidx"
  ON "auth_users"("neon_auth_user_id")
  WHERE "neon_auth_user_id" IS NOT NULL;
