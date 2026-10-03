# Section 2.2: PostgreSQL Database Schema Specification

## 1. Schema Overview

The LPG Leak Detection System utilizes a relational **PostgreSQL** database designed for high temporal write efficiency, relational integrity, and multi-tenant data isolation. The schema comprises four primary tables:

1. `users`: Stores authenticated account credentials.
2. `devices`: Tracks registered ESP32 hardware units.
3. `sensor_readings`: Stores time-series LPG concentration telemetry logs.
4. `alert_events`: Maintains an immutable audit log of safety threshold exceedances.

---

## 2. Table Specifications

```markdown
### 2.1 Table: `users`
Stores registered kitchen/restaurant managers with hashed credentials.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique account identifier |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL | Account login email address |
| `password_hash` | `VARCHAR(255)` | NOT NULL | Bcrypt hashed password string |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `CURRENT_TIMESTAMP` | Account creation timestamp |

---

### 2.2 Table: `devices`
Tracks individual ESP32 hardware detectors assigned to user accounts.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(50)` | PRIMARY KEY | Hardware Identifier / MAC Address (e.g., `ESP32-A1B2C3`) |
| `user_id` | `UUID` | FOREIGN KEY (`users.id`), NOT NULL | Owner user account link for data isolation |
| `name` | `VARCHAR(100)` | NOT NULL | Custom friendly label (e.g., "Main Kitchen Unit") |
| `status` | `VARCHAR(20)` | DEFAULT `'offline'`, CHECK (`status IN ('online', 'offline')`) | Device connectivity status |
| `last_seen` | `TIMESTAMPTZ` | NULLABLE | Timestamp of the last received telemetry heartbeat |

---

### 2.3 Table: `sensor_readings`
Time-series storage for continuous LPG telemetry sent from ESP32 sensors.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | PRIMARY KEY | Auto-incrementing time-series entry ID |
| `device_id` | `VARCHAR(50)` | FOREIGN KEY (`devices.id`), NOT NULL | Originating ESP32 device ID |
| `raw_adc` | `INTEGER` | NOT NULL, CHECK (`raw_adc BETWEEN 0 AND 4095`) | Unprocessed 12-bit ADC value |
| `lpg_ppm` | `REAL` | NOT NULL | Calculated LPG concentration in Parts Per Million ($PPM$) |
| `recorded_at` | `TIMESTAMPTZ` | DEFAULT `CURRENT_TIMESTAMP` | Timestamp of reading arrival at the backend |

---

### 2.4 Table: `alert_events`
Stores incident records logged whenever $PPM \ge \text{Threshold}$.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | PRIMARY KEY | Unique alert incident identifier |
| `device_id` | `VARCHAR(50)` | FOREIGN KEY (`devices.id`), NOT NULL | Device that detected the leak |
| `lpg_ppm` | `REAL` | NOT NULL | Gas concentration recorded during the incident |
| `threshold_limit` | `REAL` | NOT NULL | Configured limit crossed (e.g., `1000.0`) |
| `triggered_at` | `TIMESTAMPTZ` | DEFAULT `CURRENT_TIMESTAMP` | Incident start timestamp |
```
---

## 3. SQL Data Definition Language (DDL Script)

```sql
-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Devices Table
CREATE TABLE devices (
    id VARCHAR(50) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
    last_seen TIMESTAMPTZ
);

-- 3. Create Sensor Readings Table
CREATE TABLE sensor_readings (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    raw_adc INTEGER NOT NULL CHECK (raw_adc BETWEEN 0 AND 4095),
    lpg_ppm REAL NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Alert Events Table
CREATE TABLE alert_events (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    lpg_ppm REAL NOT NULL,
    threshold_limit REAL NOT NULL,
    triggered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Database Performance Indexes
CREATE INDEX idx_sensor_readings_device_time ON sensor_readings(device_id, recorded_at DESC);
CREATE INDEX idx_alert_events_device_time ON alert_events(device_id, triggered_at DESC);
CREATE INDEX idx_devices_user_id ON devices(user_id);
