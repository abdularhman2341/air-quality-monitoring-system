-- These three rules were in custom-constraints.sql but never reached the init and
-- add_sessions migrations, so no database had them.

-- An alert cannot end before it starts.
ALTER TABLE "alerts"
  ADD CONSTRAINT "alerts_end_after_start"
  CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at");

-- A device can have at most one open (still active) alert at a time.
CREATE UNIQUE INDEX "alerts_one_open_per_device"
  ON "alerts" ("device_id") WHERE "ended_at" IS NULL;

-- A session must expire after it is created.
ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_expiry_after_creation" CHECK ("expires_at" > "created_at");
