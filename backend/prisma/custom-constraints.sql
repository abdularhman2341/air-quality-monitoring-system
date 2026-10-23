-- ---------------------------------------------------------------------------
-- Custom constraints
-- Rules that schema.prisma cannot express. Paste this block at the END of the
-- init migration (prisma/migrations/<timestamp>_init/migration.sql) before
-- applying it. See prisma/README.md, "Custom constraints".
-- ---------------------------------------------------------------------------

-- Emails are stored in lowercase, so the unique index on email is case-insensitive.
ALTER TABLE "users"
  ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"));

-- Device MAC: 12 uppercase hex characters, no separators (e.g. A4CF123B9E01).
ALTER TABLE "devices"
  ADD CONSTRAINT "devices_mac_format" CHECK ("device_id" ~ '^[0-9A-F]{12}$');

-- ESP32 ADC is 12-bit: raw values are 0-4095.
ALTER TABLE "readings"
  ADD CONSTRAINT "readings_adc_range"
  CHECK ("sensor_raw_adc" IS NULL OR "sensor_raw_adc" BETWEEN 0 AND 4095);

-- Gas concentration cannot be negative.
ALTER TABLE "readings"
  ADD CONSTRAINT "readings_ppm_positive" CHECK ("lpg_ppm_est" >= 0);

-- An alert cannot end before it starts.
ALTER TABLE "alerts"
  ADD CONSTRAINT "alerts_end_after_start"
  CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at");

-- A device can have at most one open (still active) alert at a time.
CREATE UNIQUE INDEX "alerts_one_open_per_device"
  ON "alerts" ("device_id") WHERE "ended_at" IS NULL;

-- ---------------------------------------------------------------------------
-- Added in migration add_sessions (paste this part at the end of THAT
-- migration, not the init migration).
-- ---------------------------------------------------------------------------

-- A session must expire after it is created.
ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_expiry_after_creation" CHECK ("expires_at" > "created_at");
