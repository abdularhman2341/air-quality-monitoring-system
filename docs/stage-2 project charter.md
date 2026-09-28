# Stage 2: Project Charter

**Project:** Air Quality Monitoring System - LPG Leak Detection MVP  
**Team:** SAU-0226-Team 15  
**Repository:** `air-quality-monitoring-system`  
**Document date:** 28 September 2026

## 0. Project Objectives

### Purpose

Develop an Internet of Things (IoT) prototype that helps restaurant owners and home-kitchen users monitor for a possible liquefied petroleum gas (LPG) leak. The system will combine sensor readings, an estimated gas-concentration value, a local buzzer and LED, and a web dashboard with stored readings and alert history. It will give users access to current observations and historical records while providing local alerts independently of internet connectivity.

### Project Focus

The project has evolved from the broader air-quality concept documented in Stage 1 to LPG leak monitoring in restaurants and home kitchens. The selected hardware is a **Figaro TGS2610-D00 sensor and ESP32 DevKit V1**, replacing the earlier MQ-135 and MQ-138 sensor selection. The core flow from the sensor through the backend to the dashboard remains unchanged.

### SMART Objectives

**Target completion date for all three objectives: 21 November 2026**, the end of Stage 4.

| ID | Objective | Acceptance criteria |
| --- | --- | --- |
| O1 | Collect sensor readings and an estimated LPG concentration from at least one physical device, store them with the device identifier and reading time, and display current readings and historical records on the web dashboard. | Run an end-to-end test and compare device messages with database records and dashboard values. Document the concentration calculation and reference-test results separately from data-transfer tests. |
| O2 | Activate the local buzzer and LED when the defined alarm condition is met, and show and store the corresponding web alert when connectivity is available. Local alarm operation must not depend on an internet connection. | Test conditions below and at or above the selected alarm threshold, verify local indicators and stored web events, and test local alarm operation during an internet outage. Record software-trigger tests separately from physical sensor-response tests. |
| O3 | Allow one user account to monitor multiple devices while preventing another account from accessing those devices' data. | Test at least two physical devices under one account and verify that their readings and history remain separately identifiable. Use a second account to verify that unauthorized access is rejected. |

Alarm thresholds, the concentration-conversion method, and measurement-validation criteria will be defined during technical planning and verified through testing.

## 1. Stakeholders and Team Roles

### Stakeholders

| Stakeholder | Involvement or interest |
| --- | --- |
| Project team | Plans, designs, implements, tests, documents, and presents the MVP. |
| Mentors and training institution | Provide project guidance and assess deliverables against the course requirements. |
| Restaurant owners | Intended users who need access to kitchen-device readings, alerts, and history, including multiple devices within one account. |
| Home-kitchen users | Intended users who need local alerts and access to their device's readings and history. |

### Responsibilities

| Team member | Role | Responsibilities |
| --- | --- | --- |
| **Abdulrahman Asiri** | Backend Developer | Receive and validate device messages; develop application APIs, business logic, sign-in, and user-access controls; deliver readings and alerts to the frontend. Integrate backend services with the database-access layer in coordination with the database developer. Test, fix, and document backend work. |
| **Khalid Aloraini** | Frontend Designer and Developer | Design the interface in Figma and implement the web dashboard, account screens, device views, readings, alerts, and history. Connect the interface to backend services. Test, fix, and document frontend work. |
| **Abdulmalik Alaqeel** | Hardware Developer, Database Developer, and Project Manager | Integrate and program the sensor, ESP32, buzzer, and LED. Own database design and implementation, tables and relationships, schema changes, queries and data-access operations, data integrity, and database-access permissions. Test and document hardware and database work, including measurement validation and its limitations. Coordinate progress and follow up on team deliverables. |

**Backend and database responsibilities:** Application APIs, business logic, and user authorization belong to backend development. Database structure and the code responsible for storing, retrieving, and updating data belong to database development. Both developers agree on the data exchanged between these parts. Database connection permissions are separate from user permissions inside the application.

**Shared responsibilities:** Each member tests and documents their own work and addresses its defects. The team jointly performs integration testing and reviews documentation for consistency. The project manager coordinates progress and completion across the team.

### Collaboration and Decision-Making

The team uses Discord and a WhatsApp group for communication and holds **three meetings per week** to review progress, discuss blockers, and coordinate work. Technical decisions are shared and resolved by **majority vote: at least two of the three members**. Figma is the required interface-design tool following the mentors' direction.

## 2. Scope

### In Scope

| Area | MVP commitment |
| --- | --- |
| Physical device | Use the TGS2610-D00 with ESP32 DevKit V1, a buzzer, and an LED. |
| Sensor readings and concentration | Collect sensor readings and calculate and display a numerical LPG-concentration estimate, with the calculation method and validation status documented. |
| Local alarm | Evaluate the defined alarm condition on the device and operate its buzzer and LED independently of internet connectivity. |
| Data storage and dashboard | Store readings and alert events in the database. Display current readings and historical records by device, with timestamps, connection state, and the time of the latest reading. |
| Web alerts | Show reported alarm events in the connected web dashboard and retain their history in the database. |
| Accounts and device access | Provide sign-in and allow a user to monitor multiple devices within one account. Restrict device data to its authorized account. |
| Physical testing and demonstration | Test multi-device support using at least two physical devices. Use one physical device for the presentation scenario. |
| Project deliverables | Produce the charter, technical documentation, implemented MVP, test evidence, and project-closure deliverables. |

Hardware and spare devices are available for implementation and multi-device testing.

### Out of Scope

- SMS and WhatsApp notifications in the current version.
- Refrigerant-specific detection or a general-purpose, multi-gas air-quality product; the current target is LPG.
- Sharing the same device between several independent user accounts.
- Automatic gas shut-off equipment and commercial safety certification.

### Measurement and Safety Boundaries

The team will review **SASO GSO 1611** and relevant manufacturer documentation when defining alarm requirements.[1] Concentration estimates will be evaluated through appropriate reference testing under qualified supervision, with the method, results, and limitations documented.[2] Until validation is completed, displayed concentrations will be identified as estimates whose accuracy has not been established.

The prototype is intended for development and evaluation, not as a substitute for an approved safety installation. No compliance certification, accuracy percentage, or response-time guarantee is claimed. Software-trigger tests will not be treated as evidence of physical gas-detection performance.

## 3. Risks and Mitigation Strategies

| ID | Potential risk | Mitigation strategy |
| --- | --- | --- |
| R1 | The team may be unable to verify the accuracy of the concentration estimate within the project period. | Identify a suitable reference-testing method and qualified support early. Document the conversion method, test results, and limitations. Record any incomplete validation and avoid unsupported accuracy or certification claims. |
| R2 | Different assumptions about message formats and device identifiers may delay integration between hardware, backend, database, and frontend. | Agree on the exchanged data and identifiers before implementation. Establish a small end-to-end working path early rather than waiting for every component to be completed. |
| R3 | A network interruption may prevent readings and alerts from reaching the web system. | Keep local alarms independent of the internet, show connection state and the latest reading time, and test disconnection and reconnection. Recovery of missed readings will only be claimed where supported by the implemented and tested design. |
| R4 | Time pressure and overlapping tasks may delay deliverables or reduce the time available for integration testing. | Review progress and blockers during the three weekly meetings, prioritize core tasks, provide support or redistribute work by team agreement when needed, reserve time for integration testing, and avoid adding unapproved features. |

## 4. High-Level Plan

All dates are in **2026**.

| Stage | Schedule | Key milestone or deliverable |
| --- | --- | --- |
| **1 - Team Formation and Idea Development** | Completed | Team formation, idea evaluation, and selected-concept documentation. |
| **2 - Project Charter Development** | **20-26 September** | Project charter defining objectives, stakeholders and roles, scope, risks, and the high-level plan. |
| **3 - Technical Documentation** | **27 September-10 October** | Prioritized user stories, Figma designs, architecture and database design, sequence diagrams, API specifications, source-control and testing plans, and technical justifications. |
| **4 - MVP Development and Execution** | **11 October-21 November** | Implemented and integrated MVP with documented acceptance-test results. |
| **5 - Closure & Landing Page** | **22 November-5 December** | Project closure and landing page. |

Development will include early hardware testing and end-to-end integration, followed by acceptance testing and defect resolution before the end of Stage 4.

## References

- [Stage 1 Report: Team Formation and Idea Development](stage-1-report.md).
- [1] [Umm Al-Qura: Approval of amendments to three Saudi technical regulations, 16 February 2024](https://www.uqn.gov.sa/details?p=24531). Identifies SASO GSO 1611 as the updated reference for LPG gas-alarm and shut-off systems; the notice is not the complete standard.