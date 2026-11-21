-- CreateEnum
CREATE TYPE "connection_state" AS ENUM ('online', 'offline');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "device_id" CHAR(12) NOT NULL,
    "owner_id" INTEGER,
    "pairing_code_hash" TEXT NOT NULL,
    "name" VARCHAR(100),
    "location" VARCHAR(150),
    "connection_state" "connection_state" NOT NULL DEFAULT 'offline',
    "online_since" TIMESTAMPTZ(6),
    "last_reading_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("device_id")
);

-- CreateTable
CREATE TABLE "readings" (
    "id" SERIAL NOT NULL,
    "device_id" CHAR(12) NOT NULL,
    "seq" INTEGER,
    "sensor_raw_adc" INTEGER,
    "sensor_voltage" DOUBLE PRECISION,
    "rs_ro_ratio" DOUBLE PRECISION,
    "lpg_ppm_est" DOUBLE PRECISION NOT NULL,
    "alarm_active" BOOLEAN NOT NULL DEFAULT false,
    "reading_time" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" SERIAL NOT NULL,
    "device_id" CHAR(12) NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "peak_lpg_ppm_est" DOUBLE PRECISION NOT NULL,
    "threshold_ppm" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "devices_owner_id_idx" ON "devices"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "readings_device_id_reading_time_key" ON "readings"("device_id", "reading_time");

-- CreateIndex
CREATE INDEX "alerts_device_id_started_at_idx" ON "alerts"("device_id", "started_at");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "readings" ADD CONSTRAINT "readings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;

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
