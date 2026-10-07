# Section 0: User Stories & MoSCoW Prioritization

## Project Metadata

* **Project Name:** Air Quality Monitoring System - LPG Leak Detection MVP
* **Team ID:** SAU-0226-Team 15
* **Repository:** `air-quality-monitoring-system`  
* **Document date:** 01 October 2026

---

## User Stories List & Prioritization (MoSCoW Matrix)

### 1. Must Have (Essential MVP Objectives)

Core operational requirements required for core system viability, covering Objectives **O1**, **O2**, and **O3**.

| ID | User Story | Priority | Target Objective / Scope |
| --- | --- | --- | --- |
| **US-01** | As a kitchen owner, I want to log in securely to my account, so that I can access and monitor my registered LPG devices. | **Must Have** | Accounts & Access (O3) |
| **US-02** | As a kitchen user, I want to view current sensor readings and estimated LPG concentration levels on the dashboard, so that I can monitor gas safety in real-time. | **Must Have** | Data Display & Sensor (O1) |
| **US-03** | As a kitchen user, I want the local device buzzer and LED to activate instantly when gas concentration exceeds the defined threshold, so that I am alerted to an LPG leak even without internet connectivity. | **Must Have** | Local Alarm & Hardware (O2) |
| **US-04** | As a kitchen owner, I want to see web alert notifications and historical alert logs on the dashboard when a leak occurs, so that I can track incident occurrences over time. | **Must Have** | Web Alerts & History (O1, O2) |
| **US-05** | As a restaurant owner, I want to add and monitor multiple gas detection devices under my single user account, so that I can manage safety across different kitchen areas simultaneously. | **Must Have** | Multi-device Support (O3) |
| **US-06** | As a user, I want my device data and history to be strictly isolated to my account, so that unauthorized users cannot access my operational data. | **Must Have** | Data Isolation & Security (O3) |
| **US-07** | As a kitchen owner, I want to view historical gas readings with timestamps by device, so that I can review past gas trends and audit safety logs. | **Must Have** | Data Storage & History (O1) |

---

### 2. Should Have (High-Value Reliability Features)

Features that enhance system usability and operational transparency.

| ID | User Story | Priority | Target Objective / Scope |
| --- | --- | --- | --- |
| **US-08** | As a kitchen owner, I want to see the device connectivity state (online/offline) and the latest reading timestamp on the dashboard, so that I know if the system is actively transmitting data. | **Should Have** | System Reliability (R3) |
| **US-09** | As a kitchen owner, I want to filter historical reading and alert logs by date range or specific device, so that I can quickly investigate specific safety events. | **Should Have** | Dashboard Usability |

---

### 3. Could Have (Desirable Enhancements)

Optional features to be implemented if time permits during Phase 4.

| ID | User Story | Priority | Target Objective / Scope |
| --- | --- | --- | --- |
| **US-10** | As a kitchen owner, I want to view the configured alarm threshold limit on the web dashboard, so that I know at what concentration level the local alarm will trigger. | **Could Have** | Dashboard Configuration |
| **US-11** | As a restaurant manager, I want to export historical gas readings and alert logs to a CSV file, so that I can archive safety reports internally. | **Could Have** | Data Reporting |

---

### 4. Won't Have (Out of MVP Scope)

Explicitly excluded features per the Project Charter to maintain scope integrity for this release.

| ID | User Story | Priority | Out of Scope Reason |
| --- | --- | --- | --- |
| **US-12** | As a kitchen owner, I want to receive SMS or WhatsApp alert messages during a gas leak event, so that I am notified when away from the dashboard. | **Won't Have** | Explicitly out of scope in Project Charter (MVP limits alerts to local hardware & web dashboard). |
| **US-13** | As a user, I want the system to automatically trigger a gas shut-off valve when a leak is detected, so that the gas supply is cut off automatically. | **Won't Have** | Out of scope due to safety certification, physical solenoid actuator complexity, and hardware constraints. |
| **US-14** | As a restaurant owner, I want to share access to the same device across multiple independent user accounts, so that external staff can log in separately. | **Won't Have** | Out of scope; enforcing strict single-account multi-device ownership rule for MVP simplicity. |
| **US-15** | As a user, I want to receive an OTP code to verify my account ownership upon sign-up, so that my account email is validated. | **Won't Have** | Out of scope for MVP to prevent external service dependencies; standard JWT & bcrypt password authentication provides sufficient access control. |

---

## UI/UX Mockups Plan (Figma Deliverables)

The frontend interface design requires four primary wireframes/mockups to be designed in Figma and linked in the final submission:

https://www.figma.com/design/k5UNJkKtfeYt9HBuPiIXqY/Untitled?node-id=0-1&p=f&t=Mank3nL8NS1aXxNC-0

1. **Sign-In Screen (Authentication)**
* **Scope:** User login interface implementing authentication and authorization logic.
* **Associated Stories:** `US-01`, `US-06`
* **Key Elements:** Email/password input, validation feedback, secure session initiation.


2. **Main Dashboard / Devices Overview**
* **Scope:** Multi-device operational management screen.
* **Associated Stories:** `US-02`, `US-05`, `US-08`
* **Key Elements:** Device grid/list, real-time connectivity badges (`Online` / `Offline`), latest reading timestamp, quick status indicators.


3. **Device Details & Real-Time Monitoring**
* **Scope:** Single-device live data view.
* **Associated Stories:** `US-02`, `US-04`
* **Key Elements:** Live estimated LPG concentration gauge/chart (ppm), threshold indicator, real-time visual alert banner.


4. **Historical Readings & Alert Logs**
* **Scope:** Audit trail and past trends view.
* **Associated Stories:** `US-04`, `US-07`, `US-09`
* **Key Elements:** Filterable data table (by device and timestamp range), alert history list with severity indicators.
