## 1. System Component Overview

The LPG Leak Detection System (`SAU-0226-Team 15`) is structured into four primary operational tiers to support real-time data streaming and offline hardware resilience:

1. **Edge Hardware Tier:** An **ESP32 microcontroller** interfaced with a high-precision **Figaro TGS2610 LPG Gas Sensor** and local alarm actuators (**Buzzer & LED**). Telemetry is processed locally to maintain instant fail-safe alerts without internet dependencies.
2. **MQTT Broker Tier:** Acts as an asynchronous message bus (e.g., Mosquitto) receiving low-latency telemetry payloads published by the ESP32 hardware via MQTT over TLS.
3. **Backend API Tier:** A **Node.js/Express** application subscribing to the MQTT broker to ingest gas telemetry, process safety thresholds ($PPM \ge \text{Threshold}$), execute authentication logic, and log records to the database.
4. **Database Tier:** A **PostgreSQL** relational database providing persistent time-series storage for sensor readings, registered devices, user accounts, and alert logs.
5. **Frontend Web Tier:** A **React SPA Dashboard** rendering real-time gas gauges, device connectivity indicators, and historical trend tables via REST and Socket.IO live events.

---

## Component Roles & Responsibilities

1. Edge Hardware Tier (ESP32 & Figaro TGS2610):

** Measures LPG gas concentration using the high-precision Figaro TGS2610 semiconductor sensor connected via a voltage divider to the ESP32 12-bit ADC.
** Executes local edge decision logic to sound an onboard Buzzer and LED instantly if $PPM \ge \text{Threshold}$ (operating independently of internet connectivity).
** Publishes periodic telemetry JSON payloads over MQTT to its own topic (`devices/{device_id}/telemetry`), including the calculated `lpg_ppm`, the local alarm state, and the `captured_at` time.

2. MQTT Broker Tier:

** Acts as a lightweight, asynchronous message distributor receiving low-overhead MQTT payloads from edge devices.
** Authenticates each device with its own username and password and applies an ACL so a device can publish only to its own topic.

3. Backend API Tier (Node.js / Express):

** Subscribes to the MQTT broker, validates incoming telemetry, and persists the PPM value calculated by the ESP32 into PostgreSQL. The backend does not recalculate PPM, so the local alarm and the web alert always use the same value.
** Exposes protected RESTful endpoints (/api/v1) using JWT bearer tokens for frontend client consumption.

4. Database Tier (PostgreSQL):

** Relational database storing account credentials (users), hardware mapping (devices), continuous time-series logs (sensor_readings), and audit incident logs (alert_events).

5. Frontend Web Tier (React SPA):

** Single-Page Application (SPA) offering real-time monitoring charts, device connectivity badges (online/offline), and filterable historical audit tables.

---

[ Edge Hardware Tier ]                [ MQTT Broker Tier ]                [ Backend API Tier ]                 [ Frontend Web Tier ]
+-------------------------+           +------------------+                +---------------------+              +--------------------+
|   ESP32 Microcontroller |           |  MQTT Broker     |                |  Node.js / Express  |              | React Web Dashboard|
|   - Figaro TGS2610      |--MQTT---->|  (Mosquitto/EMQX)|<---Subscribe---|  - Auth Controller  | <---REST---> |  - Auth Views      |
|     (LPG Gas Sensor)    | (JSON)    | devices/{id}/    |    (JSON Log)  |  - Reading Engine   |  (JSON API)  |  - Device Cards    |
|   - Local Buzzer & LED  |           | telemetry        |                |  - Alert Controller |              |  - Realtime Charts |
+-------------------------+           +------------------+                +---------------------+              +--------------------+
                                                                                     |
                                                                              [ PostgreSQL ]
                                                                           (Time-Series Database)
