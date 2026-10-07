# 4. API Specifications

**Project:** Air Quality Monitoring System - LPG Leak Detection MVP
**Team:** SAU-0226-Team 15

This section describes the external services the system depends on, the MQTT interface between each device and the backend, the REST API the web dashboard uses, and the real-time events pushed to the dashboard.

```
ESP32 (TGS2610-D00) --MQTT--> Broker --MQTT--> Node.js/Express --REST + Socket.IO--> Web Dashboard
                                                     |
                                                  Database
```

---

## 4.1 External Services and APIs

| Service | Purpose in the MVP | Why chosen |
|---|---|---|
| **MQTT Broker** (Eclipse Mosquitto, self-hosted, or HiveMQ Cloud free tier) | Carries messages from each ESP32 to the Node.js backend: readings, alarm events, and connection state | MQTT is lightweight and suited to constrained IoT devices. Its publish/subscribe model lets new devices be added without backend changes. It supports QoS 1 delivery, and its Last Will and Testament (LWT) feature reports a device as offline automatically, which supports the connection-state requirement and risk R3. |
| **NTP** (`pool.ntp.org`) | Synchronizes the ESP32 clock so each reading carries an accurate reading time | Objective O1 requires readings stored with their reading time. The backend also records its own receive time as a fallback if the device clock is not synchronized. |

**External APIs deliberately not used:**

- **SMS/WhatsApp providers** (e.g., Twilio) are out of scope for this version, as stated in the project charter.
- **Outdoor air-quality APIs** (OpenAQ, OpenWeatherMap) do not apply. The system measures indoor LPG at a specific kitchen, not outdoor air pollution.

---

## 4.2 Device-to-Backend Interface (MQTT)

### Device identification

Each ESP32 uses its factory-assigned **WiFi MAC address** as its unique identifier, read in firmware with `WiFi.macAddress()`. This lets several devices run on the same WiFi network with no per-device code changes.

| Use | Format | Example |
|---|---|---|
| `device_id` (topics, payloads, URLs, database) | 12 uppercase hex characters, no separators | `A4CF123B9E01` |
| Display in the dashboard | Colon-separated | `A4:CF:12:3B:9E:01` |
| MQTT Client ID | `aqms-` + `device_id` | `aqms-A4CF123B9E01` |

- The backend normalizes any MAC it receives (removes `:` or `-`, converts to uppercase) before storing or comparing it.
- The separator-free form is used in topics and URLs because it is simpler to parse and needs no escaping.
- A unique Client ID per device is required: if two devices connect with the same Client ID, the broker disconnects the first one.
- **The MAC address is an identifier, not a secret.** It is visible to anyone on the same network, so it is not enough on its own to link a device to an account. Linking also requires a `pairing_code` (see `POST /devices`).

### Topics

Each device authenticates to the broker with its own credentials. The backend subscribes to `aqms/devices/+/#`.

| Topic | Direction | QoS | Retained | Sent when |
|---|---|---|---|---|
| `aqms/devices/{mac}/readings` | Device → Backend | 1 | No | Every reading interval (e.g., 5 s) |
| `aqms/devices/{mac}/alarms` | Device → Backend | 1 | No | When the local alarm turns on or off |
| `aqms/devices/{mac}/status` | Device → Backend | 1 | Yes | On connect (`online`); the broker publishes the LWT message (`offline`) if the device drops |

The backend rejects any message whose `device_id` in the payload does not match the `{mac}` in the topic, or that belongs to an unregistered device.

Delivery uses QoS 1, so the broker acknowledges each message with PUBACK. This confirms receipt by the broker, not storage by the backend. If the connection drops, the device keeps its local alarm running and retries the connection.

### Reading payload

```json
{
  "device_id": "A4CF123B9E01",
  "seq": 1024,
  "sensor_raw_adc": 1834,
  "sensor_voltage": 1.48,
  "rs_ro_ratio": 0.62,
  "lpg_ppm_est": 420,
  "alarm_active": false,
  "ts": "2026-10-07T15:30:00Z"
}
```

- `lpg_ppm_est` is an **estimate** whose accuracy has not yet been established (see Measurement and Safety Boundaries in the project charter).
- `seq` is a counter that helps detect lost or duplicate messages during disconnection tests.

### Alarm event payload

```json
{
  "device_id": "A4CF123B9E01",
  "event": "alarm_on",
  "lpg_ppm_est": 1250,
  "threshold_ppm": 1000,
  "ts": "2026-10-07T15:31:10Z"
}
```

`event` is either `alarm_on` or `alarm_off`. The alarm decision is made on the device, so the buzzer and LED work without internet (O2). This message only reports the event to the web system.

### Status payload

```json
{
  "device_id": "A4CF123B9E01",
  "state": "online",
  "ip": "192.168.1.23",
  "ts": "2026-10-07T15:29:58Z"
}
```

`ip` is informational only and helps when debugging several devices on one network. Devices are never identified by IP, because the router can change it.

---

## 4.3 Internal REST API (Express)

- **Base URL:** `/api/v1`
- **Format:** JSON request and response bodies
- **Authentication:** JWT in the header `Authorization: Bearer <token>`. Every endpoint requires it except register, login, and health.
- **Authorization rule (O3):** Every device, reading, and alert query is filtered by the signed-in user's ID. A request for another account's device returns `404`, not `403`, so the API does not reveal that the device exists.

### Authentication

| Method | Path | Input | Success output |
|---|---|---|---|
| POST | `/auth/register` | Body: `{ "name", "email", "password" }` | `201` `{ "user": { "id", "name", "email" } }` |
| POST | `/auth/login` | Body: `{ "email", "password" }` | `200` `{ "token", "user": { "id", "name", "email" } }` |
| GET | `/auth/me` | None | `200` `{ "id", "name", "email" }` |

### Devices

| Method | Path | Input | Success output |
|---|---|---|---|
| GET | `/devices` | None | `200` list of the user's devices with their latest state |
| POST | `/devices` | Body: `{ "mac_address", "pairing_code", "name", "location" }` | `201` the linked device. `400` if the MAC format is invalid; `409` if the device is already linked to another account |
| GET | `/devices/:mac` | None | `200` one device with its latest reading |
| PATCH | `/devices/:mac` | Body: `{ "name"?, "location"? }` | `200` the updated device |
| DELETE | `/devices/:mac` | None | `204` unlinks the device from the account |

`POST /devices` accepts the MAC with or without colons; the backend normalizes it.

Example `GET /devices` response:

```json
[
  {
    "device_id": "A4CF123B9E01",
    "mac_display": "A4:CF:12:3B:9E:01",
    "name": "Main kitchen",
    "location": "Restaurant A",
    "connection_state": "online",
    "last_reading_at": "2026-10-07T15:30:00Z",
    "latest": { "lpg_ppm_est": 420, "alarm_active": false },
    "estimate_validated": false
  },
  {
    "device_id": "A4CF123B9E7F",
    "mac_display": "A4:CF:12:3B:9E:7F",
    "name": "Grill station",
    "location": "Restaurant A",
    "connection_state": "offline",
    "last_reading_at": "2026-10-07T14:52:18Z",
    "latest": { "lpg_ppm_est": 95, "alarm_active": false },
    "estimate_validated": false
  }
]
```

### Readings

| Method | Path | Input | Success output |
|---|---|---|---|
| GET | `/devices/:mac/readings` | Query: `from`, `to` (ISO 8601), `page` (default 1), `limit` (default 100, max 1000) | `200` `{ "data": [ readings ], "page", "limit", "total" }` |
| GET | `/devices/:mac/readings/latest` | None | `200` the most recent reading |

Each reading in `data`:

```json
{
  "id": 88213,
  "lpg_ppm_est": 420,
  "sensor_voltage": 1.48,
  "alarm_active": false,
  "reading_time": "2026-10-07T15:30:00Z",
  "received_at": "2026-10-07T15:30:01Z"
}
```

### Alerts

| Method | Path | Input | Success output |
|---|---|---|---|
| GET | `/alerts` | Query: `device_id`?, `from`?, `to`?, `page`?, `limit`? | `200` paginated alert history across all of the user's devices |
| GET | `/devices/:mac/alerts` | Query: `from`?, `to`?, `page`?, `limit`? | `200` paginated alert history for one device |

Each alert:

```json
{
  "id": 517,
  "device_id": "A4CF123B9E01",
  "started_at": "2026-10-07T15:31:10Z",
  "ended_at": "2026-10-07T15:34:45Z",
  "peak_lpg_ppm_est": 1310,
  "threshold_ppm": 1000
}
```

### Health

| Method | Path | Input | Success output |
|---|---|---|---|
| GET | `/health` | None | `200` `{ "status": "ok", "db": "up", "mqtt": "connected" }` |

### Error format

All errors use one shape:

```json
{ "error": { "code": "DEVICE_NOT_FOUND", "message": "Device not found." } }
```

| Status | When |
|---|---|
| 400 | Invalid input (missing field, bad date, invalid MAC, `limit` too large) |
| 401 | Missing, invalid, or expired token; wrong login credentials |
| 404 | Resource not found, **or it belongs to another account** |
| 409 | Email already registered; device already linked to an account |
| 500 | Unexpected server error |

---

## 4.4 Real-Time Updates (WebSocket via Socket.IO)

So the dashboard shows new readings and alerts without refreshing, the backend pushes events over Socket.IO. The client connects with its JWT, and the server places it only in rooms for that user's devices, so the O3 access rule applies here too.

| Event | Payload |
|---|---|
| `reading:new` | Same shape as one reading, plus `device_id` |
| `alert:new` | Same shape as one alert (sent on `alarm_on`, updated on `alarm_off`) |
| `device:status` | `{ "device_id", "state": "online" \| "offline", "ts" }` |

---

> **Note:** The reading interval, `threshold_ppm`, and pagination limits shown above are placeholders. Final values will be set when the alarm thresholds are defined during technical planning, as stated in the project charter.
