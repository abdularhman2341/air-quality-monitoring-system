-- 001_init.sql
-- Schema v1 for the LPG Leak Detection MVP.
-- Matches the data contract in 04-api-specifications.md.
-- Run once on an empty database: psql "$DATABASE_URL" -f migrations/001_init.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- users: one account per person. Passwords are stored only as hashes.
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id            BIGSERIAL    PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash TEXT         NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Emails are unique regardless of letter case.
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

-- ---------------------------------------------------------------------------
-- devices: one row per ESP32, identified by its Wi-Fi MAC address.
-- owner_id is NULL until a user links the device with its pairing code.
-- ---------------------------------------------------------------------------
CREATE TABLE devices (
    device_id         CHAR(12)     PRIMARY KEY,
    owner_id          BIGINT       REFERENCES users (id) ON DELETE SET NULL,
    pairing_code_hash TEXT         NOT NULL,
    name              VARCHAR(100),
    location          VARCHAR(150),
    connection_state  VARCHAR(10)  NOT NULL DEFAULT 'offline',
    online_since      TIMESTAMPTZ,
    last_reading_at   TIMESTAMPTZ,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),

    -- 12 uppercase hex characters, no separators (e.g. A4CF123B9E01).
    CONSTRAINT devices_mac_format CHECK (device_id ~ '^[0-9A-F]{12}$'),
    CONSTRAINT devices_connection_state_valid
        CHECK (connection_state IN ('online', 'offline'))
);

-- Dashboard query: all devices of one account.
CREATE INDEX devices_owner_idx ON devices (owner_id);

-- ---------------------------------------------------------------------------
-- readings: one row per MQTT message on aqms/devices/{mac}/readings.
-- ---------------------------------------------------------------------------
CREATE TABLE readings (
    id             BIGSERIAL     PRIMARY KEY,
    device_id      CHAR(12)      NOT NULL REFERENCES devices (device_id) ON DELETE CASCADE,
    seq            INTEGER,
    sensor_raw_adc INTEGER,
    sensor_voltage NUMERIC(6, 3),
    rs_ro_ratio    NUMERIC(8, 4),
    lpg_ppm_est    NUMERIC(8, 1) NOT NULL,
    alarm_active   BOOLEAN       NOT NULL DEFAULT false,
    reading_time   TIMESTAMPTZ   NOT NULL,   -- time sent by the device (ts)
    received_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT readings_adc_range     CHECK (sensor_raw_adc IS NULL OR sensor_raw_adc BETWEEN 0 AND 4095),
    CONSTRAINT readings_ppm_positive  CHECK (lpg_ppm_est >= 0)
);

-- One reading per device per timestamp: QoS 1 may deliver the same message twice,
-- and the backend inserts with ON CONFLICT (device_id, reading_time) DO NOTHING.
-- Also serves dashboard and history queries (one device, newest first).
CREATE UNIQUE INDEX readings_device_time_key ON readings (device_id, reading_time DESC);

-- ---------------------------------------------------------------------------
-- alerts: one row per alarm episode (alarm_on until alarm_off).
-- ended_at stays NULL while the alarm is still active.
-- ---------------------------------------------------------------------------
CREATE TABLE alerts (
    id               BIGSERIAL     PRIMARY KEY,
    device_id        CHAR(12)      NOT NULL REFERENCES devices (device_id) ON DELETE CASCADE,
    started_at       TIMESTAMPTZ   NOT NULL,
    ended_at         TIMESTAMPTZ,
    peak_lpg_ppm_est NUMERIC(8, 1) NOT NULL,
    threshold_ppm    NUMERIC(8, 1) NOT NULL,

    CONSTRAINT alerts_end_after_start CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Alert history: one device, newest first.
CREATE INDEX alerts_device_time_idx ON alerts (device_id, started_at DESC);

-- A device can have at most one open (still active) alert at a time.
CREATE UNIQUE INDEX alerts_one_open_per_device ON alerts (device_id) WHERE ended_at IS NULL;

COMMIT;
