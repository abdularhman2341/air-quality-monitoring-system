# Section 2.2: PostgreSQL Database Schema Specification

## 1. Schema Overview

The LPG Leak Detection System uses a relational **PostgreSQL** database designed for time-series writes, relational integrity, and data isolation between accounts. Field names follow the [API Specifications](stage-3-Document-External-and-Internal-APIs.md). The schema has four tables:

1. `users`: Registered accounts.
2. `devices`: ESP32 units, identified by their WiFi MAC address.
3. `sensor_readings`: Time-series readings published by each device.
4. `alert_events`: One row per leak episode, from `alarm_on` to `alarm_off`.

---

## 2. Table Specifications

### 2.1 Table: `users`
Stores restaurant and home-kitchen users with hashed credentials.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique account identifier |
| `name` | `VARCHAR(100)` | NOT NULL | Display name |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL | Login email address (`409` if already registered) |
| `password_hash` | `VARCHAR(255)` | NOT NULL | Bcrypt hash; never returned by the API |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `CURRENT_TIMESTAMP` | Account creation timestamp |

---

### 2.2 Table: `devices`
Tracks each ESP32 unit and the account it is linked to.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `CHAR(12)` | PRIMARY KEY, CHECK (`id ~ '^[0-9A-F]{12}$'`) | WiFi MAC address, 12 uppercase hex characters (e.g., `A4CF123B9E01`) |
| `user_id` | `UUID` | FOREIGN KEY (`users.id`), NULL | Owner account; NULL until the device is linked |
| `pairing_code_hash` | `VARCHAR(255)` | NOT NULL | Hash of the pairing code required by `POST /devices` |
| `name` | `VARCHAR(100)` | NULL | Friendly label (e.g., "Main kitchen") |
| `location` | `VARCHAR(100)` | NULL | Optional location label (e.g., "Restaurant A") |
| `connection_state` | `VARCHAR(10)` | DEFAULT `'offline'`, CHECK (`connection_state IN ('online', 'offline')`) | Set from the device's `status` topic, including the broker's Last Will |
| `last_reading_at` | `TIMESTAMPTZ` | NULL | `reading_time` of the latest stored reading |
| `estimate_validated` | `BOOLEAN` | DEFAULT `FALSE` | Whether the concentration estimate has passed reference testing |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `CURRENT_TIMESTAMP` | When the device was provisioned |

A device row is provisioned with its MAC and pairing code when the firmware is flashed. `POST /devices` sets `user_id` only if the pairing code matches and the device is not already linked (`409` otherwise). `DELETE /devices/:mac` sets `user_id` back to NULL.

---

### 2.3 Table: `sensor_readings`
Time-series storage for readings published to `aqms/devices/{mac}/readings`.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | PRIMARY KEY | Reading identifier |
| `device_id` | `CHAR(12)` | FOREIGN KEY (`devices.id`), NOT NULL | Source device |
| `seq` | `INTEGER` | NULL | Device message counter, used to detect lost or repeated messages in tests |
| `sensor_raw_adc` | `INTEGER` | NOT NULL, CHECK (`sensor_raw_adc BETWEEN 0 AND 4095`) | 12-bit ADC value |
| `sensor_voltage` | `REAL` | NULL | Sensor output voltage |
| `rs_ro_ratio` | `REAL` | NULL | Sensor resistance ratio used for the estimate |
| `lpg_ppm_est` | `REAL` | NOT NULL | LPG concentration estimate calculated on the ESP32; accuracy not yet established |
| `alarm_active` | `BOOLEAN` | NOT NULL | Local alarm state when the reading was taken |
| `reading_time` | `TIMESTAMPTZ` | NOT NULL | Device time (`ts`, NTP-synchronized); set to `received_at` if the device clock is not synchronized |
| `received_at` | `TIMESTAMPTZ` | DEFAULT `CURRENT_TIMESTAMP` | Arrival time at the backend |

**Table constraint:** `UNIQUE (device_id, reading_time)` — MQTT QoS 1 can deliver the same message more than once; the backend inserts with `ON CONFLICT DO NOTHING` so a repeated message is stored only once.

---

### 2.4 Table: `alert_events`
One row per leak episode reported on `aqms/devices/{mac}/alarms`.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | PRIMARY KEY | Alert identifier |
| `device_id` | `CHAR(12)` | FOREIGN KEY (`devices.id`), NOT NULL | Device that raised the alarm |
| `started_at` | `TIMESTAMPTZ` | NOT NULL | `ts` of the `alarm_on` event |
| `ended_at` | `TIMESTAMPTZ` | NULL | `ts` of the `alarm_off` event; NULL while the alarm is active |
| `peak_lpg_ppm_est` | `REAL` | NOT NULL | Highest estimate during the episode, updated by readings while the alert is open |
| `threshold_ppm` | `REAL` | NOT NULL | Threshold configured on the device when the alarm turned on |

**Open-alert rule:** `CREATE UNIQUE INDEX one_open_alert ON alert_events (device_id) WHERE ended_at IS NULL` — a device can have only one open alert, so a repeated `alarm_on` message does not create a second episode.

---

## 3. Indexes

| Index | Columns | Supports |
| :--- | :--- | :--- |
| `idx_readings_device_time` | `sensor_readings (device_id, reading_time DESC)` | History by device and date range (`US-07`, `US-09`) and the latest reading per device (`US-02`) |
| `idx_alerts_device_time` | `alert_events (device_id, started_at DESC)` | Alert history by device and date range (`US-04`, `US-09`) |
| `one_open_alert` | `alert_events (device_id) WHERE ended_at IS NULL` | One open alert per device |
| `idx_devices_user` | `devices (user_id)` | Listing a user's devices and ownership checks (`US-05`, `US-06`) |

Device credentials for the MQTT broker are stored in the Mosquitto password file, not in this database, so the backend database never holds broker secrets.
