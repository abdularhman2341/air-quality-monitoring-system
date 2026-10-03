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
