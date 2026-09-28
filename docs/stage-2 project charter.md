# Stage 2: Project Charter

**Project:** Air Quality Monitoring System — LPG Leak Detection MVP  
**Team:** SAU-0226-Team 15  
**Repository:** `abdularhman2341/air-quality-monitoring-system`  
**Document date:** 28 September 2026  
**Document status:** Draft for final team review before GitHub submission.  
**Implementation status:** Documentation and planning only. Hardware and spare devices are available; assembly, software implementation, and testing have not yet been reported as completed.

## 0. Project Objectives

### Purpose

Develop an Internet of Things (IoT) prototype that helps restaurant owners and home-kitchen users monitor for a possible liquefied petroleum gas (LPG) leak. The system will combine sensor readings, an estimated gas-concentration value, a local buzzer and LED, and a web dashboard with stored readings and alert history. The intended benefit is to make the device's observations and alerts accessible in one system; practical effectiveness and measurement accuracy remain to be tested.

### Scope Development Since Stage 1

Stage 1 described a broader air-quality concept, initially aimed at automotive air-conditioning workshops, with MQ-135 and MQ-138 sensors. The team has since narrowed the MVP to LPG leak monitoring in restaurants and home kitchens, using a **Figaro TGS2610-D00 sensor and ESP32 DevKit V1**. The core sensor-to-backend-to-dashboard concept remains, but the target users, gas, and selected sensor have changed. This charter records the current scope rather than presenting those changes as decisions made during Stage 1.

### SMART Objectives

All three objectives have a target completion date of **21 November 2026**, the end of Stage 4. The checks below are planned acceptance tests, not completed results.

| ID | Objective | Planned evidence of completion |
| --- | --- | --- |
| O1 | Collect sensor readings and an estimated LPG concentration from at least one physical device, store them with the device identifier and reading time, and display current readings and historical records on the web dashboard. | Run an end-to-end test and compare device messages with database records and dashboard values. Document the concentration calculation and any reference-test results separately. Correct data transfer alone does not establish measurement accuracy. |
| O2 | Activate the local buzzer and LED when the defined alarm condition is met, and show and store the corresponding web alert when connectivity is available. Local alarm operation must not depend on an internet connection. | Test conditions below and at/above the selected alarm threshold, check the local indicators and recorded web event, and test local operation during an internet outage. Distinguish software-trigger tests from actual sensor-response tests. |
| O3 | Allow one user account to monitor multiple devices while preventing another account from accessing those devices' data. | Use at least two physical devices under one account; verify that each device's readings and history remain separately identifiable. Use a second account to verify that unauthorized access is rejected. Spare devices will support this test; the presentation may use one physical device. |

The numerical alarm threshold, concentration-conversion method, and measurement-validation criteria remain to be established during technical planning and testing. No accuracy percentage or response-time guarantee is claimed in this charter.

## 1. Stakeholders and Team Roles

### Stakeholders

| Stakeholder | Involvement or interest |
| --- | --- |
| Project team | Plans, designs, implements, tests, documents, and presents the MVP. |
| Mentors and training institution | Provide project guidance and assess deliverables against the course requirements. |
| Restaurant owners | Intended users who need access to kitchen-device readings, alerts, and history, including multiple devices within one account. |
| Home-kitchen users | Intended users who need local alerts and access to their device's readings and history. |

The user groups above are intended beneficiaries, not confirmed pilot participants. No restaurant, laboratory, or external testing partner is recorded as a committed project partner.

### Responsibilities

| Team member | Role | Development, testing, and documentation responsibilities |
| --- | --- | --- |
| **Abdulrahman Asiri** | Backend Developer | Receive and validate device messages; develop the application's APIs, business logic, sign-in and user-access controls; deliver readings and alerts to the frontend. Integrate backend services with the database-access layer in coordination with the database owner. Test, fix, and document the backend work. |
| **Khalid Aloraini** | Frontend Designer and Developer | Design the interface in Figma and implement the web dashboard, account screens, device views, readings, alerts, and history. Connect the interface to backend services. Test, fix, and document the frontend work. |
| **Abdulmalik Alaqeel** | Hardware Developer, Database Developer, and Project Manager | Integrate and program the sensor, ESP32, buzzer, and LED. Own database design and implementation, tables and relationships, schema changes, database queries and data-access operations, data integrity, and database-access permissions. Test and document both hardware and database work, including the measurement-validation method and its limitations. Coordinate progress and follow up on team deliverables. |

**Backend–database boundary:** Application APIs, business logic, and user authorization belong to backend development. Database structure and the code responsible for storing, retrieving, and updating data belong to database development. The two owners agree on the data exchanged between these parts. Database connection permissions are distinct from a user's permissions inside the application.

**Shared responsibilities:** Each member tests and documents their own work and addresses its defects. The team jointly tests integration and reviews the final document for consistency. Project management coordinates completion; it does not replace each member's responsibility for their own deliverables.

### Collaboration and Decision-Making

The team uses Discord and a WhatsApp group for communication. It will hold **three meetings per week** to review progress, discuss blockers, and coordinate work. Technical decisions are shared and resolved by **majority vote: at least two of the three members**. All members review the assembled charter before submission. Figma is the required interface-design tool following the mentors' direction.

## 2. Scope

### In Scope

| Area | MVP commitment |
| --- | --- |
| Physical device | Use the TGS2610-D00 with ESP32 DevKit V1, a buzzer, and an LED. |
| Sensor readings and concentration | Collect sensor readings and calculate and display a numerical LPG-concentration estimate. Document the calculation and validation status; an unverified estimate must not be described as a proven measurement. |
| Local alarm | Evaluate the defined alarm condition on the device and operate its buzzer and LED independently of internet connectivity. |
| Data storage and dashboard | Store readings and alert events in the database; display current readings and historical records by device, with timestamps, connection state, and the time of the latest reading. |
| Web alerts | Show reported alarm events in the connected web dashboard and retain their history in the database. |
| Accounts and device access | Provide sign-in and allow a user to view multiple devices within one account. Keep device data restricted to its authorized account. |
| Physical testing and demonstration | Test multi-device support using at least two physical devices. Use one physical device for the planned presentation scenario. |
| Project deliverables | Produce the charter, subsequent technical documentation, implemented MVP, test evidence, and project-closure deliverables according to their respective stages. |

### Out of Scope

- SMS and WhatsApp notifications in the current version.
- Refrigerant-specific detection or a general-purpose, multi-gas air-quality product; the current target is LPG.
- Sharing the same device between several independent user accounts; the selected scenario is several devices within one account.
- Automatic gas shut-off equipment or a claim that the prototype is a commercially certified safety device. The agreed core behavior is monitoring and alerting.

### Measurement and Safety Boundaries

The team plans to review **SASO GSO 1611** and relevant manufacturer documentation when defining alarm requirements. A Saudi official-gazette amendment published on 16 February 2024 identifies SASO GSO 1611 as the updated reference for LPG gas-alarm and shut-off systems.[1] Its complete requirements have **not** yet been reviewed for this prototype; this charter assigns no numerical limit to that standard and makes no claim of compliance.

Alarm requirements and measurement validation are separate concerns. OSHA's guidance on direct-reading monitors describes calibration checks against known, traceable concentrations and emphasizes following the manufacturer's instructions.[2] This is methodological guidance, not a Saudi regulatory requirement for the project.

The team will seek an appropriate reference-testing arrangement with qualified supervision and document the method, results, and limitations. Access to such testing is not yet confirmed. Until validation is completed, the concentration display will be identified as an estimate whose accuracy has not been established. A simulated alarm condition will not be reported as a successful physical gas-detection test. The prototype is for development and evaluation, not a substitute for an approved safety installation.

## 3. Risks and Mitigation Strategies

| ID | Potential risk | Mitigation strategy |
| --- | --- | --- |
| R1 | The team may be unable to verify the accuracy of the concentration estimate within the project period. | Identify a suitable reference-testing method and available qualified support early. Document the conversion method, test results, and limitations. Do not claim accuracy or certification without supporting evidence; record any uncompleted validation explicitly. |
| R2 | Different assumptions about message formats and device identifiers may delay integration between hardware, backend, database, and frontend. | Agree on the exchanged data and identifiers before implementation. Establish a small end-to-end working path early rather than waiting for every component to be completed. |
| R3 | A network interruption may prevent readings and alerts from reaching the web system. | Keep local alarms independent of the internet, show connection state and the latest reading time, and test disconnection and reconnection. Do not promise recovery of every missed reading unless that behavior has been designed and tested. |
| R4 | Time pressure and overlapping tasks may delay deliverables or reduce the time available for integration testing. | Review progress and blockers during the three weekly meetings, prioritize core tasks, provide support or redistribute work by team agreement when needed, reserve time for integration testing, and avoid adding unapproved features. |

Hardware and spare devices are already available. Waiting for their purchase or delivery is therefore not a current project blocker.

## 4. High-Level Plan

### Stages and Milestones

All dates below are in **2026**. Dates for Stages 2–5 were supplied by the team. Internal recovery and early-completion targets do not replace the official course schedule.

| Stage | Dates or sequence | Principal milestone or deliverable | Status at this draft |
| --- | --- | --- | --- |
| **1 — Team Formation and Idea Development** | Completed before Stage 2. | Team formation, comparison of ideas, and selected-concept documentation. | Submitted and assessed. |
| **2 — Project Charter Development** | Original window: **20–26 September**. Recovery target: **28 September**. | Reviewed charter covering objectives, stakeholders and roles, scope, risks, and the high-level plan; upload to GitHub. | Original deadline missed; consolidated draft awaiting final review and upload. |
| **3 — Technical Documentation** | Official window: **27 September–10 October**. Internal early-completion target: **28 September**, after Stage 2 review and upload. | Technical plan covering user stories, required Figma designs, architecture and database design, interactions, APIs, and source-control and testing plans. | Not started in this workflow; work is planned to begin after the Stage 2 charter is reviewed and uploaded. |
| **4 — MVP Development and Execution** | **11 October–21 November**. | Implement and integrate the system; execute and document the objective-specific acceptance tests; prepare a working MVP. | Planned. |
| **5 — Closure & Landing Page** | **22 November–5 December**. | Project closure and landing-page deliverables. Detailed requirements will be checked against the Stage 5 assignment. | Planned. |

### Recovery Plan and Completion Status

As of **28 September**, Stage 2 has not been completed within its original window ending on 26 September. The team plans to finish and review Stage 2, upload it to GitHub, and then complete Stage 3 on 28 September. This is the recovery target for Stage 2 and an internal early-completion target for Stage 3, whose official window is **27 September–10 October**. These are targets, **not a record that either stage has already been completed**. The Stage 4 start date remains 11 October. If an internal target is missed, the team will update the actual status rather than changing the original deadlines or recording unfinished work as completed.

Available hardware supports early physical testing once the test approach is defined. Integration is planned during development, not only at its end. Detailed technical decisions, diagrams, interface designs, APIs, and test procedures belong to Stage 3; this charter defines their purpose and delivery boundary without claiming those artifacts already exist.

### Stage 2 Review and Submission

The team must collectively review the assembled charter, upload it to the repository, and request the manual QA review required by the assignment. Submission and assessment status must be recorded separately; preparing this draft does not mean it has been uploaded or assessed.

## Basis and References

**Assignment basis:** The supplied *Portfolio Project — Project Charter Development (Stage 2)* requires project objectives, stakeholders and roles, scope, risks and mitigation, and a high-level plan. Team decisions and dates are based on the planning discussion on 28 September 2026. Official dates not provided in that discussion have not been invented. The assembled document remains subject to final team review.

**Project history:** [Stage 1 report](stage-1-report.md). It records the earlier concept and original responsibilities; the current scope and responsibility changes are stated in this charter.

**External references:** These support the measurement and standards discussion only. They do not establish that the prototype has been tested or certified.

[1] [Umm Al-Qura — Approval of amendments to three Saudi technical regulations, 16 February 2024](https://www.uqn.gov.sa/details?p=24531). See the gas-appliances annex entry changing SASO 1496 to SASO GSO 1611. The notice identifies the reference; it is not the complete standard.

[2] [OSHA — Calibrating and Testing Direct-Reading Monitors](https://www.osha.gov/publications/shib093013), Safety and Health Information Bulletin dated 26 November 2024. Used for general measurement-validation principles, not as a statement of Saudi legal applicability.
