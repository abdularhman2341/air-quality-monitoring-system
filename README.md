# Air Quality Monitoring System — LPG Leak Detection MVP

An IoT prototype that detects possible liquefied petroleum gas (LPG) leaks in restaurant and home kitchens, sounds a local alarm without depending on the internet, and shows live readings, alerts, and history on a web dashboard.

**Holberton Portfolio Project — SAU-0226-Team 15**

> **Current status: Stage 3 — Technical Documentation.** Implementation starts in Stage 4 (11 October 2026). The architecture and features below describe the planned system.

## Overview

An ESP32 reads a Figaro TGS2610-D00 LPG sensor, calculates an estimated concentration, and controls a local buzzer and LED. It publishes readings over MQTT/TLS to a Mosquitto broker. A Node.js backend validates and stores them in PostgreSQL and pushes live readings and alerts to a React dashboard through Socket.IO.

The project evolved from a broader air-quality concept (Stage 1) to LPG leak monitoring. See the [Project Charter](docs/stage-2%20project%20charter.md) for the reasoning and scope.

## Problem and Target Audience

- **Restaurant owners** who need to monitor several kitchen devices from one account.
- **Home-kitchen users** who need a local alarm and access to their device's history.

The prototype is intended for development and evaluation. It is not a substitute for an approved safety installation, and displayed concentrations are estimates until reference testing is completed.

## MVP Features

| Feature | Behavior | User stories |
| --- | --- | --- |
| Local alarm | Buzzer and LED activate on the ESP32 when the threshold is reached, with or without internet. | US-03 |
| Live dashboard | Current estimated PPM, latest reading time, and online/offline state per device. | US-02, US-08 |
| Web alerts | Alert banner in the dashboard and a stored alert history. | US-04 |
| History | Readings and alerts by device and date range. | US-07, US-09 |
| Accounts and isolation | Sign-in with JWT; each account sees only its own devices. | US-01, US-06 |
| Multiple devices | One account can register and monitor several devices. | US-05 |

## System Architecture

![System architecture](docs/diagrams/architecture.png)

1. **Sensor → ESP32:** The ESP32 reads the sensor, calculates `lpg_ppm`, and evaluates the alarm locally.
2. **ESP32 → Mosquitto:** Each device publishes to its own topic `devices/{device_id}/telemetry` over MQTT/TLS with its own credentials.
3. **Mosquitto → Backend:** MQTT.js receives messages; the backend validates the payload and the device.
4. **Backend ↔ PostgreSQL:** Readings, alerts, and device status are stored through `pg`.
5. **Backend → Dashboard:** Socket.IO delivers live events only to the device owner's room.
6. **Dashboard ↔ REST API:** Express (`/api/v1`) handles sign-in, devices, and history over HTTPS with JWT.

## Technology Stack

| Area | Technology |
| --- | --- |
| Microcontroller | ESP32 DevKit V1 |
| Sensor | Figaro TGS2610-D00 (LPG) |
| Local indicators | Buzzer and LED |
| Telemetry | MQTT over TLS, Eclipse Mosquitto |
| Backend | Node.js, Express, MQTT.js |
| Live updates | Socket.IO |
| Database | PostgreSQL with `pg` |
| Frontend | React, designed in Figma |

## Documentation

| Stage | Document |
| --- | --- |
| 1 | [Idea Development Report](docs/stage-1-report.md) |
| 2 | [Project Charter](docs/stage-2%20project%20charter.md) |
| 3 | [User Stories & MoSCoW](docs/stage-3-user-stories.md) |
| 3 | [System Architecture](docs/stage-3-System-Architecture.md) · [System Components](docs/stage-3-System-Component.md) |
| 3 | [Class Diagram](docs/stage-3-Mermaid-UML-Class-Diagram.md) · [ER Diagram](docs/stage-3-ER-Diagram.md) · [Database Schema](docs/stage-3-database-schema.md) |
| 3 | [Sequence Diagrams](docs/stage-3-Sequence-Diagrams.md) |

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
