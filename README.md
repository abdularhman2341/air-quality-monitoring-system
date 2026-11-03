# Air Quality Monitoring System — LPG Leak Detection MVP

An IoT prototype that detects possible liquefied petroleum gas (LPG) leaks in restaurant and home kitchens, sounds a local alarm without depending on the internet, and shows live readings, alerts, and history on a web dashboard.

**Holberton Portfolio Project — SAU-0226-Team 15**

> **Current status: Stage 4 — MVP Development** (11 October – 21 November 2026). Deployed, with two real devices and one simulator running end to end.

**Live app:** <https://air-quality-monitoring-system-production-534c.up.railway.app> · Health check: [`/api/v1/health`](https://air-quality-monitoring-system-production-534c.up.railway.app/api/v1/health)

## Overview

An ESP32 reads a Figaro TGS2610-D00 LPG sensor, calculates an estimated concentration, and controls a local buzzer and LED. It publishes readings over MQTT/TLS to a Mosquitto broker. A Node.js backend validates and stores them in PostgreSQL through Prisma, serves the REST API and the React dashboard from one domain, and pushes live events through Socket.IO.

The project evolved from a broader air-quality concept (Stage 1) to LPG leak monitoring. See the [Project Charter](docs/stage-2%20project%20charter.md) for the reasoning and scope.

## Problem and Target Audience

- **Restaurant owners** who need to monitor several kitchen devices from one account.
- **Home-kitchen users** who need a local alarm and access to their device's history.

The prototype is intended for development and evaluation. It is not a substitute for an approved safety installation, and displayed concentrations are estimates until reference testing is completed.

## MVP Features

| Feature | Behavior | User stories |
| --- | --- | --- |
| Local alarm | On the ESP32: on at 1000 ppm (beeping), continuous from 1500 ppm, off below 800 ppm. Works with or without internet. No alarm during the 2-minute sensor warm-up. | US-03 |
| Live dashboard | Current estimated PPM with the threshold, latest reading time, and online/offline state per device. | US-02, US-08, US-10 |
| Web alerts | Alert state on the dashboard and a stored alert history (start, end, peak). | US-04 |
| History | Readings and alerts by device and date range, with CSV export. | US-07, US-09, US-11 |
| Accounts and isolation | Sign-up and sign-in with JWT sessions; each account sees only its own devices. Change email and delete account with the current password. | US-01, US-06 |
| Multiple devices | One account can link several devices with a MAC address and pairing code, and remove them. | US-05 |
| Languages | Arabic (right-to-left) and English. | — |

## System Architecture

![System architecture](docs/diagrams/architecture.png)

1. **Sensor → ESP32:** The ESP32 reads the sensor every 5 s, estimates `lpg_ppm_est`, and decides the alarm locally.
2. **ESP32 → Mosquitto:** Each device publishes readings, alarm events, and status to `aqms/devices/{mac}/…` over MQTT/TLS with its own credentials; the broker reports a dropped device through its Last Will (about 45 s).
3. **Mosquitto → Backend:** MQTT.js receives messages on Railway's private network; the backend validates the payload and the device.
4. **Backend ↔ PostgreSQL:** Readings, alerts, devices, accounts, and sessions are stored through Prisma.
5. **Backend → Dashboard:** Socket.IO delivers live events only to the device owner's room.
6. **Dashboard ↔ REST API:** Express (`/api/v1`) handles accounts, devices, and history over HTTPS with JWT.

### Deployment (Railway)

| Service | Notes |
| --- | --- |
| Backend | Builds the React frontend and serves it with the API and Socket.IO on one domain (root `Dockerfile`). Runs `npm run migrate` before each deploy. |
| Mosquitto | `mosquitto/Dockerfile`. Devices connect over TLS on 8883 through a public TCP proxy; the backend connects on 1883 over the private network. There is no public plain-text port. |
| PostgreSQL | Private network only. |

## Technology Stack

| Area | Technology |
| --- | --- |
| Microcontroller | ESP32 DevKit V1 |
| Sensor | Figaro TGS2610-D00 (LPG) |
| Local indicators | Buzzer (GPIO 25) and LED (GPIO 26) |
| Telemetry | MQTT over TLS, Eclipse Mosquitto |
| Backend | Node.js 22, Express, MQTT.js |
| Live updates | Socket.IO |
| Database | PostgreSQL with Prisma |
| Frontend | React (Vite), designed in Figma |
| Hosting | Railway |

## Getting Started (Local Development)

### Prerequisites

- [Node.js](https://nodejs.org/) 22 or later
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (on Windows, enable WSL integration)
- Git

### 1. Clone and enter the repository

```bash
git clone https://github.com/abdularhman2341/air-quality-monitoring-system.git
cd air-quality-monitoring-system
git checkout develop
```

### 2. Start PostgreSQL and Mosquitto

Make sure Docker Desktop is running, then:

```bash
docker compose up -d
docker compose ps
```

Both `aqms-db` and `aqms-mqtt` should be running. The local broker listens on 1883 without TLS or passwords; it is for development only.

### 3. Configure and run the backend

```bash
cp backend/.env.example backend/.env
cd backend
npm install
npm run migrate
npm run seed:devices
npm run dev
```

`seed:devices` adds two demo devices with readings (pairing codes `482913` and `735104`). Use it only on a local database.

### 4. Run the frontend

In a second terminal, from the repository root:

```bash
cp frontend/.env.example frontend/.env
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>, create an account, and link `A4CF123B9E01` with pairing code `482913` from **Add Sensor**.

### 5. Send live readings with the simulator

In a third terminal:

```bash
cd backend
npm run simulate
```

Type `l` + Enter to simulate a gas leak (opens an alert), `q` + Enter to stop.

### 6. Verify

Open <http://localhost:3000/api/v1/health>. Expected response:

```json
{"status":"ok","database":"connected","mqtt":"connected"}
```

### Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the backend with auto-restart on file changes |
| `npm start` | Run the backend without auto-restart (used in production) |
| `npm run migrate` | Apply the Prisma migrations to create or update the tables (safe to run more than once) |
| `npm run seed:devices` | Add two demo devices with readings (local database only) |
| `npm run simulate [MAC]` | Run a fake ESP32 that publishes readings over MQTT (default MAC `A4CF123B9E01`) |
| `npm run db:migrate` | Create a new migration after changing `prisma/schema.prisma` (development only) |
| `npm run db:studio` | Browse the local database in Prisma Studio |
| `npm test` | Run the backend tests (needs a local database named `aqms_test`, see below) |
| `docker compose up -d` | Start the database and MQTT broker |
| `docker compose down` | Stop them (data is kept) |
| `docker compose logs db` | Show database logs |
| `docker compose down -v` | Stop them and delete the local database |

## Running the Tests

The backend tests use their own database and delete all of its data before each test, so they refuse to run unless the database name ends in `_test`. With `docker compose up -d` running, from `backend/`:

```bash
docker exec aqms-db createdb -U aqms aqms_test
DATABASE_URL=postgresql://aqms:aqms_dev_password@localhost:5432/aqms_test npx prisma migrate deploy
npm test
```

To use another test database, set `TEST_DATABASE_URL`. The tests cover sign-in and sessions, account deletion, device linking and removal, account isolation, MQTT ingestion, and alerts (see the [QA plan](docs/stage-3-report.md#62-qa-strategy)).

## Running the Simulator Against Production

The production broker accepts only TLS and per-device passwords. Ask the team for the CA certificate (`ca.crt`) and the simulator's password, then run from `backend/`:

```bash
NODE_EXTRA_CA_CERTS=/path/to/ca.crt \
MQTT_URL=mqtts://acela.proxy.rlwy.net:47740 \
SIM_MQTT_USERNAME=aqms-A4CF123B9E01 \
SIM_MQTT_PASSWORD=<simulator password> \
npm run simulate A4CF123B9E01
```

`Not authorized` means TLS worked but the username or password is wrong.

## Adding a Device

A device must be registered by the team before a user can link it. Secrets (MQTT passwords, pairing codes, `config.h`) never go into this repository.

1. **Broker account:** add `MAC:password` to the `MQTT_DEVICE_USERS` variable of the Mosquitto service on Railway and redeploy it. The start script creates the user `aqms-{MAC}` and an ACL that lets it write only to `aqms/devices/{MAC}/#`. One malformed entry stops the broker, so check the deploy log.
2. **Database row:** insert the device with the bcrypt hash of its pairing code:
   ```sql
   INSERT INTO devices (device_id, pairing_code_hash) VALUES ('<MAC>', '<bcrypt hash>');
   ```
3. **Firmware:** copy `firmware/gas_monitor/config.example.h` to `config.h`, fill in the broker host and port, the device's MQTT username and password, the CA certificate, the pairing code, and the Wi-Fi setup page password, then flash the ESP32.
4. **Link:** the owner opens **Add Sensor** and enters the MAC and pairing code.

Do step 2 before the device first connects. If the device connected before its row existed, its `online` status was dropped: restart the device.

## Backend Structure

The backend follows the layers in the [Stage 3 class diagram](docs/stage-3-report.md#33-backend-class-diagram): a request goes from a route to a controller, the controller calls a service, and the service uses the models.

```text
backend/
├── prisma/                schema.prisma and migrations (npm run migrate)
├── docs/openapi.yaml      REST API contract
├── tests/                 Jest and Supertest tests (npm test)
└── src/
    ├── server.js          Starts the HTTP server, MQTT ingestion, and Socket.IO
    ├── app.js             Express app: middleware, /api/v1 routes, built frontend, error handling
    ├── db/prisma.js       Shared Prisma Client (every database query)
    ├── config/            JWT and CORS settings
    ├── routes/            URL → controller mapping, one file per resource
    ├── controllers/       Read the request, call a service, send the response
    ├── services/          Business logic shared by REST and MQTT, plus the Socket.IO gateway
    ├── models/            BaseModel, User, Session, Device, Reading, Alert
    ├── middlewares/       requireAuth, notFound, errorHandler
    ├── errors/            HttpError, used for every API error
    ├── utils/             Input validation and device time checks
    └── scripts/           seedDevices.js (demo data), simulateDevice.js (fake ESP32)
```

Other folders: `frontend/` (React app), `firmware/gas_monitor/` (ESP32 sketch), `mosquitto/` (broker image and start script), `docs/` (stage reports and diagrams).

## Documentation

| Stage | Document |
| --- | --- |
| 1 | [Idea Development Report](docs/stage-1-report.md) |
| 2 | [Project Charter](docs/stage-2%20project%20charter.md) |
| 3 | [Technical Documentation Report](docs/stage-3-report.md) |
| | [1. User Stories and Mockups](docs/stage-3-report.md#1-user-stories-and-mockups) · [2. System Architecture](docs/stage-3-report.md#2-system-architecture) · [3. Components, Classes, and Database Design](docs/stage-3-report.md#3-components-classes-and-database-design) · [4. Sequence Diagrams](docs/stage-3-report.md#4-sequence-diagrams) · [5. API Specifications](docs/stage-3-report.md#5-api-specifications) · [6. SCM and QA Plans](docs/stage-3-report.md#6-scm-and-qa-plans) · [7. Technical Justifications](docs/stage-3-report.md#7-technical-justifications) |
| 4 | [Trello board](https://trello.com/b/JhIu8WfB/gas-monitor-stage-4) · [OpenAPI specification](backend/docs/openapi.yaml) · [Firmware](firmware/README.md) |

## Project Timeline (2026)

| Stage | Dates |
| --- | --- |
| 1 — Team Formation and Idea Development | Completed |
| 2 — Project Charter | 20–26 September |
| 3 — Technical Documentation | 27 September – 10 October |
| 4 — MVP Development | 11 October – 21 November |
| 5 — Closure and Landing Page | 22 November – 5 December |

## Team

| Team Member | Role |
| --- | --- |
| Abdulrahman Asiri | Backend Developer |
| Khalid Aloraini | Frontend Designer and Developer |
| Abdulmalik Alaqeel | Hardware Developer, Database Developer, and Project Manager |

## Technical References

- [MQTT protocol overview](https://mqtt.org/)
- [Eclipse Mosquitto configuration](https://mosquitto.org/man/mosquitto-conf-5.html)
- [MQTT.js documentation](https://github.com/mqttjs/MQTT.js)
- [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/)
- [Prisma documentation](https://www.prisma.io/docs)
