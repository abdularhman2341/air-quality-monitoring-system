# Air Quality Monitoring System

An IoT monitoring project that connects ESP32 sensor observations to local alerts, a live web dashboard, and historical records.

**Holberton Portfolio Project — SAU-0226-Team 15**

> **Current status: Documentation and planning only.** Software development, hardware assembly, and testing have not started. The architecture and features below describe the planned system.

## Overview

The project aims to combine sensor monitoring with a usable web interface. An ESP32 will collect sensor observations and control a local buzzer and LED. A custom Node.js backend will receive readings through MQTT, store them in PostgreSQL, and deliver live updates and alerts to a React dashboard.

The team will build its own database schema, API, authentication, business logic, and frontend as part of the portfolio project.

## Problem and Target Audience

The initial audience is **owners and managers of independent automotive air-conditioning repair workshops in Riyadh**. The intended use case is to support inspections with an accessible view of sensor responses and a history of recorded observations.

The team's longer-term application interest includes refrigerant-leak monitoring. Gas-specific detection and concentration measurements depend on suitable sensor selection and validation; they are not established prototype capabilities at this stage.

Indoor monitoring in homes, offices, clinics, and childcare facilities represents possible later expansion.

## Planned MVP Features

| Feature | Intended behavior |
| --- | --- |
| Sensor acquisition | Collect separately identified observations from sensors connected to an ESP32. |
| Local alerts | Use a buzzer and LED when a configured prototype threshold is exceeded. Local evaluation will run on the ESP32 without depending on a cloud response. |
| Live dashboard | Display recent readings, timestamps, connection state, and clearly labelled sensor-response indicators. |
| Web alerts | Display a notification in the connected dashboard when a configured threshold condition is reported. |
| Historical records | Store readings and alert events for later review by device, sensor, and time range. |
| Authentication and authorization | Provide the team's own sign-in flow and enforce access to devices, readings, and live events. |
| Device management | Register and manage devices and their attached sensors through the backend API. |

## System Architecture

![Air Quality Monitoring System architecture: sensors connect to an ESP32, which publishes through an MQTT broker to a Node.js backend serving a web dashboard and PostgreSQL.](docs/diagrams/air-quality-system-architecture.png)

*Planned core data flow. The local buzzer and LED described above are additional ESP32 outputs and are not shown in this diagram.*

1. **Sensors → ESP32:** The microcontroller reads the connected sensors and evaluates the configured local alert conditions.
2. **ESP32 → MQTT broker:** The device publishes identifiable observations and relevant alert events over MQTT with TLS.
3. **MQTT broker → Node.js:** The backend subscribes through MQTT.js and validates messages and device identity.
4. **Node.js → Web dashboard:** Socket.IO delivers authorized live readings and web alerts.
5. **Node.js ↔ PostgreSQL:** The backend stores observations and events and retrieves historical data through `pg`.
6. **Dashboard ↔ HTTPS API:** Express handles authentication, device management, and historical queries.

Live delivery and database persistence are separate paths. A displayed event does not confirm that its database write has committed.

## Planned Technology Stack

| Area | Technology | Purpose |
| --- | --- | --- |
| Microcontroller | ESP32 | Read sensors, control local indicators, and publish telemetry. |
| Sensor | TGS2610  | Selected models for the planned prototype; measurement interpretation requires validation. |
| Local indicators | Buzzer and LED | Audible and visual threshold alerts. |
| Telemetry | MQTT over TLS | Transfer device observations and events. |
| Broker | Eclipse Mosquitto, suggested | Route MQTT messages by topic. |
| Backend | Node.js, Express, and MQTT.js | Implement the API, authentication, validation, and ingestion. |
| Live updates | Socket.IO | Deliver readings and alerts to connected authorized clients. |
| Frontend | React | Build the web dashboard. |
| Database | PostgreSQL with `pg` | Store users, devices, sensors, readings, and alert events. |
| Optional buffering | Redis Streams and a Node.js worker | Buffer and batch writes if recovery needs or measured traffic justify it. |

## Measurement and Data Design

The data model will distinguish **devices**, their attached **sensors**, and individual **readings**. Observations will include device and sensor identifiers, an event identifier, capture time, raw value, and its actual unit or representation. Alert records will reference the relevant device, observation, and threshold condition.

MQ-135 and MQ-138 respond to multiple gases and vapours. Initial displays will use raw readings or clearly labelled response indicators. The published [MQ-138 specification](https://www.winsen-sensor.com/product/mq138.html) describes targets such as toluene, acetone, alcohol, and hydrogen; it does not establish selective R-134a detection. Refrigerant identification, concentration values, and the meaning of alert thresholds require validation for the actual hardware and calibration method.

## Security and Reliability Goals

- Protect device telemetry with TLS and application requests with HTTPS.
- Use device-specific credentials, topic permissions, and backend validation.
- Enforce authorization on both API requests and live subscriptions.
- Handle repeated MQTT messages through stable event identifiers and duplicate protection.
- Show connection state and the time of the latest reading; refresh stored history after reconnecting.
- Verify local alerts, message validation, persistence, and recovery during implementation.

## Project Progression

The project follows Holberton's five-stage structure:

| Stage | Focus | Duration in the project overview |
| --- | --- | --- |
| 1 | Team Formation and Idea Development | 2 weeks |
| 2 | Project Charter | 2 weeks |
| 3 | Technical Documentation | 2 weeks |
| 4 | MVP Development | 4 weeks |
| 5 | Project Closure | 2 weeks |

The current deliverables belong to **Stage 1**. Installation commands and startup instructions will be added when implementation begins and can be verified.

## Team

**SAU-0226-Team 15**

| Team Member | Role |
| --- | --- |
| Abdulrahman Asiri | Backend Developer |
| Khalid Aloraini | Frontend Developer |
| Abdulmalik Alaqeel | Hardware Developer & Project Manager |

The team communicates through Discord and a WhatsApp group. Abdulmalik coordinates the project, while each member leads the assigned development area.

## Documentation

- [Stage 1 Report : Idea Development Documentation](docs/stage-1-report.md)
- [Core architecture diagram](docs/diagrams/air-quality-system-architecture.png)

## Technical References

- [MQTT protocol overview](https://mqtt.org/)
- [Eclipse Mosquitto configuration](https://mosquitto.org/man/mosquitto-conf-5.html)
- [MQTT.js documentation](https://github.com/mqttjs/MQTT.js)
- [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/)
- [Winsen MQ-135 specification](https://www.winsen-sensor.com/product/mq135.html)
- [Winsen MQ-138 specification](https://www.winsen-sensor.com/product/mq138.html)
