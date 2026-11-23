# Stage 4 Report: MVP Development and Execution

**Team:** SensorX  
**Project:** Air Quality Monitoring System - LPG Leak Detection MVP  
**Stage dates:** 11 October - 21 November 2026  
**Team:** Abdulrahman Asiri (Backend, SCM), Khalid Aloraini (Frontend and design), Abdulmalik Alaqeel (Hardware, Database, Project Manager). QA is shared: every test task names a member who did not build the feature as its QA reviewer.

This report is the Stage 4 deliverable. It records how the MVP planned in the [Stage 3 report](stage-3-report.md) was built: the sprint plan, what each sprint delivered and how the mentor reviewed it, what the team learned, the bugs found and fixed, and the test evidence for the three project objectives (O1 readings reach the dashboard, O2 local alarm without internet, O3 each account sees only its own data).

## Deliverables

| Deliverable | Where |
| --- | --- |
| Sprint planning | [Section 1](#1-sprint-planning) and the [Trello board](https://trello.com/b/JhIu8WfB/gas-monitor-stage-4) |
| Sprint reviews | [Section 3](#3-sprint-reviews) |
| Retrospectives | [Section 4](#4-retrospectives) |
| Source repository | <https://github.com/abdularhman2341/air-quality-monitoring-system> (branch `develop`; `main` for the final submission) |
| Bug tracking | [Section 5](#5-bug-tracking) and [GitHub issues](https://github.com/abdularhman2341/air-quality-monitoring-system/issues?q=is%3Aissue+label%3Abug) (every bug, linked to its fix pull request) |
| Testing evidence and results | [Section 6](#6-final-integration-and-qa-testing) and [GitHub Actions runs](https://github.com/abdularhman2341/air-quality-monitoring-system/actions) |
| Production environment | <https://air-quality-monitoring-system-production-534c.up.railway.app> · [health check](https://air-quality-monitoring-system-production-534c.up.railway.app/api/v1/health) · [Section 7](#7-production-environment) |

## Contents

1. [Sprint Planning](#1-sprint-planning)
2. [Execution, SCM and Progress Metrics](#2-execution-scm-and-progress-metrics)
3. [Sprint Reviews](#3-sprint-reviews)
4. [Retrospectives](#4-retrospectives)
5. [Bug Tracking](#5-bug-tracking)
6. [Final Integration and QA Testing](#6-final-integration-and-qa-testing)
7. [Production Environment](#7-production-environment)
8. [Carried Over to Stage 5](#8-carried-over-to-stage-5)

---

## 1. Sprint Planning

The user stories from Stage 3 (MoSCoW) were broken into tasks on the Trello board. Each card has an ID (`S<sprint>-<number>`), one owner, a MoSCoW priority, its dependencies, and a due date. The board has the lists Backlog, Next, To Do, In Progress, In Review (PR), Testing (QA) and Done. A card moves to Done when its pull request is merged and tested.

The stage was split into three sprints of about two weeks:

| Sprint | Dates | Goal |
| --- | --- | --- |
| 1 | 11 - 25 October | Foundations: repository, projects, deployment, data contract, first readings from the sensor to the dashboard (O1) |
| 2 | 26 October - 8 November | Safety and accounts: local alarm without internet (O2), alerts, sign-in, device pairing, isolation between accounts (O3), live updates |
| 3 | 9 - 21 November | Secondary features, production hardening, acceptance testing and defect fixing |

### 1.1 Sprint 1 plan (11 - 25 October)

| ID | Task | Owner | Priority | Depends on | Due |
| --- | --- | --- | --- | --- | --- |
| S1-01 | Confirm the data contract (topics, payloads, field names, MAC format) | All | Must | - | 14 Oct |
| S1-02 | GitHub repository, branch protection, PR template | Abdulrahman (SCM) | Must | - | 14 Oct |
| S1-03 | Trello board with owners and due dates | Abdulmalik (PM) | Must | - | 14 Oct |
| S1-03a | Frontend, backend and database projects with README and `.env.example` | All | Must | S1-02 | 14 Oct |
| S1-03b | Every member clones and runs all projects locally | All | Must | S1-03a | 14 Oct |
| S1-03c | First deployment: database, backend, broker, frontend | All | Must | S1-03a | 14 Oct |
| S1-04 | Mosquitto on Railway with per-device credentials | Abdulrahman | Must | S1-02 | 16 Oct |
| S1-05 | ESP32 reads the TGS2610-D00 and prints readings and MAC | Abdulmalik | Must | - | 22 Oct |
| S1-06 | PostgreSQL schema v1: users, devices, readings, alerts | Abdulmalik | Must | S1-01 | 18 Oct |
| S1-07 | ESP32 Wi-Fi + MQTT over TLS (QoS 1, Last Will, status) | Abdulmalik | Must | S1-01, S1-04, S1-05 | 30 Oct |
| S1-07b | Wi-Fi setup page (WiFiManager) | Abdulmalik | Should | S1-07 | 1 Nov |
| S1-08 | Sensor baseline and concentration conversion method | Abdulmalik | Must | S1-05 | 25 Oct |
| S1-09 | Express skeleton, database connection, `GET /health` | Abdulrahman | Must | S1-02 | 17 Oct |
| S1-10 | Subscribe to MQTT, validate, store readings, connection state | Abdulrahman | Must | S1-04, S1-06, S1-09 | 24 Oct |
| S1-11 | `GET /devices/:mac/readings/latest` and `/readings` | Abdulrahman | Must | S1-10 | 25 Oct |
| S1-12 | Frontend setup, layout and navigation from Figma | Khalid | Must | - | 17 Oct |
| S1-13 | Figma: Add Sensor, offline state, Estimated label | Khalid | Must | - | 18 Oct |
| S1-14 | Dashboard with mock data | Khalid | Must | S1-12 | 21 Oct |
| S1-15 | Dashboard connected to real endpoints | Khalid | Must | S1-11, S1-14 | 23 Oct |
| S1-16 | End-to-end test: device vs database vs dashboard (O1) | All (QA) | Must | S1-07, S1-15 | 24 Oct |

### 1.2 Sprint 2 plan (26 October - 8 November)

| ID | Task | Owner | Priority | Depends on | Due |
| --- | --- | --- | --- | --- | --- |
| S2-01 | Alarm threshold(s), based on SASO GSO 1611 and the datasheet | Abdulmalik (team vote) | Must | S1-08 | 27 Oct |
| S2-02 | Database constraints (unique MAC, foreign keys) and the `(device_id, reading_time)` index | Abdulmalik | Must | S1-06 | 28 Oct |
| S2-03 | ESP32 local alarm (buzzer + LED) that keeps running offline | Abdulmalik | Must | S2-01 | 31 Oct |
| S2-04 | ESP32 publishes `alarm_on` and `alarm_off` | Abdulmalik | Must | S2-03 | 1 Nov |
| S2-05 | Register, login, `/auth/me`, password hashing, JWT | Abdulrahman | Must | S1-09 | 30 Oct |
| S2-06 | Device endpoints with pairing code, filtered by account (O3) | Abdulrahman | Must | S2-02, S2-05 | 3 Nov |
| S2-07 | Alarm events stored as alerts; `GET /alerts` and `/devices/:mac/alerts` | Abdulrahman | Must | S2-02, S2-04 | 4 Nov |
| S2-08 | Socket.IO with JWT and per-user rooms | Abdulrahman | Should | S1-10, S2-05 | 5 Nov |
| S2-09 | Register and Login screens, token handling, protected pages | Khalid | Must | S2-05 | 31 Oct |
| S2-10 | Add Sensor screen and device selector | Khalid | Must | S2-06 | 4 Nov |
| S2-11 | Alert banner and live updates on the Dashboard | Khalid | Must | S2-07, S2-08 | 6 Nov |
| S2-12 | Backend tests: validation, auth, access isolation | Abdulrahman | Must | S2-06 | 6 Nov |
| S2-13 | Alarm tests below, at and above the threshold (software trigger) | Abdulmalik (QA: Khalid) | Must | S2-04 | 7 Nov |
| S2-14 | Multi-device test: two devices on one account, a second account refused (O3) | All (QA) | Must | S2-06, S2-10 | 7 Nov |

### 1.3 Sprint 3 plan (9 - 21 November)

| ID | Task | Owner | Priority | Depends on | Due |
| --- | --- | --- | --- | --- | --- |
| S3-01 | Daily aggregation and summary endpoint | Abdulrahman | Should | S2-07 | 11 Nov |
| S3-02 | Offline state on the Dashboard | Khalid | Should | S2-11 | 12 Nov |
| S3-03 | History and Alerts page | Khalid | Should | S3-01 | 14 Nov |
| S3-04 | Outage test: local alarm without internet, offline then reconnect (O2) | Abdulmalik (QA: Abdulrahman) | Must | S2-03, S3-02 | 13 Nov |
| S3-05 | Physical sensor reference test, results and limitations | Abdulmalik | Must | S2-03 | 16 Nov |
| S3-06 | Production hardening: TLS, final settings, deployed demo checked | Abdulrahman | Should | S1-03c, S2-08 | 16 Nov |
| S3-07 | Could Have: rename a device, filter alerts by date | Khalid, Abdulrahman | Could | S2-10 | 17 Nov |
| S3-08 | Final acceptance tests for O1, O2, O3; collect evidence | All (QA) | Must | S3-04, S3-05 | 18 Nov |
| S3-09 | Fix defects found in acceptance testing | All | Must | S3-08 | 20 Nov |
| S3-10 | Final documentation: README, setup guide, test results | All | Must | S3-09 | 21 Nov |

**Added during Sprint 3** (from mentor meeting requirements, QA findings and code review): single domain (S3-11), account settings (S3-12), real devices replace the demo data (S3-13), firmware and dashboard fixes from issues #41-#44 (S3-14 to S3-17), input validation (S3-18), session rules (S3-19), admin dashboard (S3-20), mail service and password reset (S3-21), email verification (S3-22), sign-in limits and gas alert emails (S3-23), CI (S3-24), unit tests (S3-25), defect fixes B1, B2, F2 (S3-26 to S3-28), code cleanup (S3-29), sign-up activated by an emailed code (S3-30), and the review fixes R2 to R5 (S3-31 to S3-33). Issues #42 to #44 (S3-15 to S3-17) were fixed on the last day; #41 (S3-14) is carried over. Bugs not tied to a card are tracked as GitHub issues (Section 5).

---

## 2. Execution, SCM and Progress Metrics

### 2.1 How work moved

1. The owner creates a branch from the latest `develop` (`feature/...` or `fix/...`).
2. Small commits with clear messages, then a pull request into `develop` with the PR template (what it does, related task, how to test, checklist).
3. GitHub Actions runs on every pull request (Section 6.2); the reviewer merges only when every check is green.
4. One other member reviews and approves; the approver merges and deletes the branch.
5. `develop` deploys to Railway automatically; migrations run before the new version starts.
6. The card moves to Testing (QA), then to Done.

For bug fixes the team used a test-first rule from Sprint 3: a test that reproduces the bug is written first and must fail on the old code, then the fix makes it pass. For the riskiest fixes the code was also broken on purpose (mutation testing) to confirm the tests catch each change.

### 2.2 Metrics

| Metric | Sprint 1 | Sprint 2 | Sprint 3 |
| --- | --- | --- | --- |
| Planned cards | 20 | 14 | 10 |
| Planned cards completed | 20 (100%) | 14 (100%) | 8 (80%) |
| Cards added during the sprint and completed | 0 | 0 | 22 of 23 |
| Velocity (cards completed) | 20 | 14 | 30 |
| Pull requests merged | 22 | 20 | 44 |

Totals: 86 pull requests merged between 6 October and 21 November (including two releases from `develop` into `main` and one sync back), 206 commits on `develop`.

Sprint 3 had the most work because the weekly mentor meetings added requirements (admin dashboard, OTP, third-party email) and acceptance testing found defects that had to be fixed before the end of the stage. Two planned cards were not completed: S3-01 was descoped (Section 3.3) and S3-05 is carried over to Stage 5 (Section 8).

**Bugs:** 62 recorded, 24 fixed (39%), 38 open; critical and high: 9 of 12 fixed (Section 5).

---

## 3. Sprint Reviews

Each sprint was reviewed in the weekly meetings with the mentor, where the team demoed the working system against that week's required deliverables.

### 3.1 Sprint 1 review (11 - 25 October)

**Mentor requirements:** frontend, backend and database projects created; Git and GitHub set up; every project runs for every member; all systems deployed; a project management tool with one owner per task (week of 12 October). Authentication and the home page working end to end (meeting of 21 October).

**Demoed:** the backend on Railway with `GET /health` reporting the database; sign-up, sign-in and sign-out through the API and database; the readings endpoints; the Mosquitto broker with per-device accounts; the ESP32 reading the sensor; and on 24 October the first end-to-end test, with the same reading seen in the Serial Monitor, the database and the dashboard (S1-16, O1).

**Feedback and decisions:**
- All backend endpoints worked; the frontend was behind. Abdulrahman helped on the frontend for a few days so the pages caught up.
- Railway is for hosting only: the database schema must be created by the team's code. The team moved the schema to Prisma migrations (PRs #13, #15, #25).
- Trello chosen as the PM tool; the team rule for pull requests (the approver merges and deletes the branch) was agreed.

### 3.2 Sprint 2 review (26 October - 8 November)

**Mentor requirement:** 50% of the main feature complete (meeting of 28 October).

**Demoed:** the local alarm (buzzer and LED) decided on the device and working without internet; `alarm_on`/`alarm_off` events stored as alerts with start, end and peak; device pairing with a MAC address and pairing code, with a second account refused (O3); live updates on the dashboard through Socket.IO; MQTT over TLS on the production broker; the Wi-Fi setup page.

**Feedback and decisions:**
- Serve the frontend and backend from one domain. Done on 1 November: the backend builds and serves the React app, so the site, API and Socket.IO share one URL (S3-11).
- The mentor noted Socket.IO is not strictly needed because the device alarms locally. The team kept it (approved by the PM): it costs little, and the REST path still works without it.
- CI was added at the end of the sprint (PR #49).

### 3.3 Sprint 3 review (9 - 21 November)

**Mentor requirements:** all secondary features complete and third-party integrations (meeting of 11 November); QA with unit and integration tests, and optional features (meeting of 17 November). The mentor also required an admin dashboard with full permissions and OTP.

**Demoed:** the admin dashboard (users, devices, readings, alerts, action log); password reset and email verification with 6-digit codes sent through Resend from the team's own domain; gas alert emails when an alarm starts and ends, tested with the real device on production; sign-in attempt limits; the History page with date filters and CSV export; 271 automated tests passing in CI at the 17 November meeting.

**Feedback and decisions:**
- 11 November: no remarks.
- 17 November: most remarks were on the frontend. Large files (some over 400 lines) must be split into components and modules, and functions should stay within 25 lines. On 21 November every file was split to 400 lines or fewer and the limit became a lint error (PR #148); 17 frontend functions were still over 25 lines and were split in Stage 5 (Section 8).
- New account sign-up must use an emailed code and activate the account in one step (no separate confirmation afterwards). Built and deployed on 21 November (PR #82).
- Last day: the dashboard says when it does not know the alert status instead of "all normal" (F3, PR #151).
- Last day: the dashboard shows a **Warming up** state for the first 2 minutes after the device powers up, when readings are not accurate yet and the device does not alarm (the reading counter `seq` starts again at every power-up).
- **Descoped:** S3-01 (daily aggregation). The History page meets the need with the alerts list and the readings table filtered by 24 hours, 7 days or 30 days, plus CSV export.

---

## 4. Retrospectives

### 4.1 Sprint 1

| What worked well | What was hard | What we changed |
| --- | --- | --- |
| Agreeing the data contract first (S1-01) let the firmware, backend and frontend be built in parallel against the same topics and fields. | The database was first set up by hand on Railway, which the mentor did not accept. | Schema and changes go through Prisma migrations in the repository, applied automatically on deploy. |
| Deploying in the first week meant every later feature was tested on the real environment. | Two Railway projects were created by mistake, and variables pointed to the wrong one. | One production project; the old one deleted; settings written in the README. |
| | The frontend started later than the backend. | Daily check-ins on the frontend cards; backend help offered when a page was blocked. |

### 4.2 Sprint 2

| What worked well | What was hard | What we changed |
| --- | --- | --- |
| Deciding the alarm on the device made O2 independent of the network and the server. | Two domains (Vercel and Railway) meant CORS and two deployments to keep in sync. | One domain served by the backend (Sprint 3 start). |
| Pairing codes stored as hashes made device linking safe without extra hardware. | TLS on the broker and per-device credentials took longer than planned. | The broker setup was scripted (`mosquitto/docker-entrypoint.sh`) and checked by CI. |
| | Tests ran only on one machine. | GitHub Actions on every pull request (#49). |

### 4.3 Sprint 3

| What worked well | What was hard | What we changed |
| --- | --- | --- |
| Automated tests found real defects before users did: B1 (MQTT messages acknowledged before they were saved, so a database outage could lose readings) and the review findings R1-R5. | Many requirements arrived during the sprint (admin dashboard, OTP, email), so the board fell behind the work. | Each new requirement gets a card the same day; the board was brought up to date on 21 November. |
| Test-first fixes and mutation testing showed each fix is covered: a test fails on the old code and passes on the new one. | A local folder with old files was copied over newer ones and reverted a fix on two branches. CI caught it before merging. | Files are prepared in a new, empty folder, and each pushed branch is compared with the reviewed copy before merging. |
| Real-device tests on production (alarm, both emails, reconnect) gave evidence for O1 and O2. | One branch was created from an old copy of `develop` and conflicted with a squashed merge. | Always `git pull` on `develop` before creating a branch. |
| | Several frontend pages grew beyond 400 lines. | Split them into components on 21 November (PR #148); the 25-line function limit was finished in Stage 5. |

---

## 5. Bug Tracking

Every bug is a [GitHub issue](https://github.com/abdularhman2341/air-quality-monitoring-system/issues?q=is%3Aissue+label%3Abug) with an area label (`firmware`, `backend`, `frontend`) and a severity label; a fixed issue is closed with a link to its pull request, and an open one carries the `stage-5` label. IDs: **W** firmware, **B** backend, **F** frontend from the full bug sweep of 7 November (46 findings on `b36fcd0`); **V**, **M**, **S**, **P**, **R**, **C** from later validation, session and production tests, code review and code cleanup; `#` numbers were reported as issues directly. From 11 November every fix starts with a test that fails on the old code.

**Summary:** 62 bugs recorded, 24 fixed (39%), 38 open and carried over to Stage 5. Critical and high: 9 of 12 fixed. The three open high-severity bugs are listed first in 5.2.

| Area | Fixed | Open |
| --- | --- | --- |
| Firmware | 2 | 12 |
| Backend | 14 | 10 |
| Frontend | 8 | 16 |

### 5.1 Fixed

| ID | Area | Severity | Bug | Found by | Fix |
| --- | --- | --- | --- | --- | --- |
| W1 | firmware | Critical | Local alarm can freeze 30-120 s while the device retries a broker that does not answer | Bug sweep, 7 Nov | Verified on production: Retested on production with the real device: the alarm keeps running |
| B1 | backend | High | MQTT messages acknowledged before they are saved; a database outage loses readings and alarms | Bug sweep, 7 Nov | [#71](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/71) |
| B2 | backend | High | Any device can use the backend's MQTT client id and disconnect it | Bug sweep, 7 Nov | [#68](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/68) |
| M1 | backend | High | A password reset code was written to the log when the email failed | Code review, 10 Nov | [#61](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/61) |
| P1 | backend | High | A device removed from one account could not be linked to another (production) | Production test, 11 Nov | Verified on production: Fixed and checked on production, 16 Nov |
| R1 | backend | High | Sign-up had no limit per address; each sign-up sends an email from the quota shared with gas alert emails | Code review, 19 Nov | [#82](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/82) |
| F1 | frontend | High | An old tab shows account A but reads and writes account B's data | Bug sweep, 7 Nov | [#51](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/51) |
| F2 | frontend | High | Any temporary server error signs the user out | Bug sweep, 7 Nov | [#66](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/66) |
| F3 | frontend | High | The dashboard says all is normal when the alerts request fails or is still loading | Bug sweep, 7 Nov | [#151](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/151) |
| [#42](https://github.com/abdularhman2341/air-quality-monitoring-system/issues/42) | backend | Medium | An alert stays open after a power loss during an alarm (also W5) | Outage test | [#86](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/86) (the first reading without the alarm closes the open alert) |
| B3 | backend | Medium | Pairing codes were 6 digits and could be guessed | Bug sweep, 7 Nov | [#55](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/55) (8-character codes, about 10^12 combinations) |
| B6 | backend | Medium | Readings and alarms of a device with no owner are shown to its next owner (also R4) | Bug sweep, 7 Nov | [#84](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/84) |
| B12 | backend | Medium | A reading older than 10 minutes is saved with the arrival time (also R2, W8) | Bug sweep, 7 Nov | [#83](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/83) |
| R3 | backend | Medium | A late message delivered twice is saved twice | Code review, 19 Nov | [#83](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/83) |
| V1 | backend | Medium | The 72 password limit counted characters, not bytes (bcrypt cuts at 72 bytes) | Validation review, 7 Nov | [#50](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/50) |
| V2 | backend | Medium | Spaces at the start or end of a password were removed | Validation review, 7 Nov | [#50](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/50) |
| R5 | backend | Medium | After an admin moves a device to a new owner, the new owner can miss the first alert email | Code review, 19 Nov | [#85](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/85) |
| F4 | frontend | Medium | A late 401 from an old session signs out the new user | Bug sweep, 7 Nov | [#51](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/51) |
| S1 | frontend | Medium | Clearing the browser storage did not sign out the open tab | Session tests, 9 Nov | [#52](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/52) |
| S2 | frontend | Medium | The token check timer was removed by mistake in #54 | Session tests, 10 Nov | [#57](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/57) |
| V3 | backend | Low | Token and session expiry were computed one second apart | Validation review, 7 Nov | [#50](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/50) |
| [#43](https://github.com/abdularhman2341/air-quality-monitoring-system/issues/43) | firmware | Low | Wrong NTP comment and old start-up banner in the firmware | Code review | [#86](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/86) |
| F9 | frontend | Low | Account created but automatic sign-in failed; retrying said the email is taken | Bug sweep, 7 Nov | [#82](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/82) (sign-up rebuilt with the activation code) |
| [#44](https://github.com/abdularhman2341/air-quality-monitoring-system/issues/44) | frontend | Low | Gauge ends at the danger level; header runs off a phone screen | Manual QA | [#86](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/86) |

### 5.2 Open (carried over to Stage 5)

**Update, 23 November (Stage 5):** every backend and frontend bug in this table was fixed in Stage 5 ([#158](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/158), [#159](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/159), [#161](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/161), [#162](https://github.com/abdularhman2341/air-quality-monitoring-system/pull/162); B9 in the pull request that corrected this report) and its issue was closed with a link to the fix. The 12 firmware bugs (W2-W14 and #41) remain open as known limitations. The table keeps the state at the end of Stage 4.

| ID | Area | Severity | Bug | Found by |
| --- | --- | --- | --- | --- |
| W2 | firmware | High | A disconnected sensor or cut wire reads as clean air (about 11 ppm) | Bug sweep, 7 Nov |
| W3 | firmware | High | The 2-minute warm-up comes back every ~49.7 days when millis() wraps | Bug sweep, 7 Nov |
| [#41](https://github.com/abdularhman2341/air-quality-monitoring-system/issues/41) | firmware | High | A leak that starts and ends while the device is offline is missing from the web history | Outage test |
| B4 | backend | Medium | A repeated alarm_on that arrives after alarm_off opens an alert that never closes | Bug sweep, 7 Nov |
| B5 | backend | Medium | One optional field out of range rejects the whole reading | Bug sweep, 7 Nov |
| W4 | firmware | Medium | Any restart (including the 3-second BOOT press) restarts the warm-up while the sensor is hot | Bug sweep, 7 Nov |
| W6 | firmware | Medium | A saturated reading (2500 mV or more) is treated as no signal and ignored | Bug sweep, 7 Nov |
| W7 | firmware | Medium | On a network that blocks NTP the device never connects to the broker | Bug sweep, 7 Nov |
| W9 | firmware | Medium | Firmware README and config.example.h describe the broker credentials format inconsistently | Bug sweep, 7 Nov |
| F5 | frontend | Medium | CSV export stops at the newest 1000 rows and still reports success | Bug sweep, 7 Nov |
| F6 | frontend | Medium | Alarm and offline state on the device buttons is shown by color only | Bug sweep, 7 Nov |
| F7 | frontend | Medium | A MAC typed with spaces or dots is sent as typed and refused by the server | Bug sweep, 7 Nov |
| F8 | frontend | Medium | A device that goes offline during a leak shows grey Offline instead of the alert | Bug sweep, 7 Nov |
| B7 | backend | Low | A date outside PostgreSQL's range returns 500 instead of 400 | Bug sweep, 7 Nov |
| B8 | backend | Low | A second alarm_on with a higher value does not raise the peak | Bug sweep, 7 Nov |
| B10 | backend | Low | A reading does not mark the device online | Bug sweep, 7 Nov |
| B11 | backend | Low | The seedDevices script has no production guard | Bug sweep, 7 Nov |
| B13 | backend | Low | prisma/README.md names src/index.js instead of src/server.js | Bug sweep, 7 Nov |
| B9 | backend | Low | Alerts with the same start second can repeat or disappear between pages (#55 fixed the admin list; the user's History still sorted by start time only) | Bug sweep, 7 Nov |
| C1 | backend | Low | The pairing code is case-sensitive | Code cleanup, 17 Nov |
| C2 | backend | Low | Email subjects use two product names (AQMS and Gas Monitor) | Code cleanup, 17 Nov |
| W10 | firmware | Low | The Wi-Fi setup page pauses the alarm for about 22 s when saving | Bug sweep, 7 Nov |
| W11 | firmware | Low | After a power cut, a slow router leaves the device without Wi-Fi for 3.5 minutes | Bug sweep, 7 Nov |
| W12 | firmware | Low | One setup-page password for every device, with a public default | Bug sweep, 7 Nov |
| W13 | firmware | Low | Rounding sends 999.6 ppm as 1000 with alarm_active false | Bug sweep, 7 Nov |
| W14 | firmware | Low | Firmware README: folder contents, danger-level table and pause length out of date | Bug sweep, 7 Nov |
| F10 | frontend | Low | Every live event reloads everything (3 requests per reading per tab) | Bug sweep, 7 Nov |
| F11 | frontend | Low | Overlapping requests: an older response can overwrite a newer one | Bug sweep, 7 Nov |
| F12 | frontend | Low | History says to link a sensor when the devices request failed | Bug sweep, 7 Nov |
| F13 | frontend | Low | Alert start and chart axis show the time without the date | Bug sweep, 7 Nov |
| F14 | frontend | Low | An open alert that started before the chosen range disappears from History | Bug sweep, 7 Nov |
| F15 | frontend | Low | The toast is created with its text, so screen readers may miss it | Bug sweep, 7 Nov |
| F16 | frontend | Low | Page title is 'frontend' and the direction flips after load | Bug sweep, 7 Nov |
| F17 | frontend | Low | History tabs miss tabpanel and arrow-key support | Bug sweep, 7 Nov |
| F18 | frontend | Low | Sign out waits for the server; if it hangs the button does nothing | Bug sweep, 7 Nov |
| F19 | frontend | Low | Some error codes have no Arabic text | Bug sweep, 7 Nov |
| F20 | frontend | Low | A device name starting with = runs as a formula in Excel after CSV export | Bug sweep, 7 Nov |
| C3 | frontend | Low | The profile password fields limit 72 characters; the backend limit is 72 bytes | Code cleanup, 17 Nov |

The open high-severity bugs never stop the local alarm from sounding in a leak it can detect: W2 and W3 are firmware cases where the device cannot detect gas (a disconnected sensor, a warm-up every ~49.7 days), and #41 affects only the web record of a leak. They are the first Stage 5 tasks for the firmware.

---

## 6. Final Integration and QA Testing

### 6.1 Test plan by objective

| Objective | How it is tested | Result |
| --- | --- | --- |
| **O1** Readings reach the dashboard | Automated ingestion tests (MQTT message to database); end-to-end test with the real device, comparing the Serial Monitor, the database and the dashboard (S1-16); two real devices and the simulator on production (S3-13) | Pass |
| **O2** Local alarm without internet | Software-trigger tests below, at and above the threshold (S2-13); physical lighter test with no internet (buzzer and LED on); unplugging shows Offline after about 45 s (Last Will); after reconnecting the dashboard and alerts catch up (S3-04). Production test with the real device on 11 November: the alarm started and ended and both alert emails arrived | Pass |
| **O3** Each account sees only its own data | Integration tests as a second account: another user's device, readings and alerts return 404; a device linked to one account is refused to another (409); after unlinking, the next owner starts with an empty history; multi-device test with two devices on one account (S2-14) | Pass |

### 6.2 Continuous integration

GitHub Actions runs on every pull request and every push to `develop` ([runs](https://github.com/abdularhman2341/air-quality-monitoring-system/actions)):

| Job | What it runs |
| --- | --- |
| Backend | Starts PostgreSQL, applies the migrations, runs all Jest tests |
| Frontend | `npm run lint`, `npm test` (Vitest), `npm run build` |
| Firmware | Compiles the ESP32 sketch with the pinned libraries (`arduino-cli compile`) |
| Broker | `shellcheck` on the Mosquitto start script |

### 6.3 Automated test results (21 November 2026, end of the stage)

**Backend:** 268 tests in 18 files, all passing. 67 unit tests, 187 integration tests (Supertest against the real Express app and a real PostgreSQL test database) and 14 characterization tests.

**Coverage** (measured at the end of the stage): 94.2% of lines, 93.0% of statements, 92.5% of functions, 81.8% of branches.

| File | Tests | Type | What it proves |
| --- | --- | --- | --- |
| `auth.test.js` | 13 | Integration | Password and duplicate-email rules, the hash is never returned, logout ends the session, account deletion |
| `signup-code.test.js` | 23 | Integration | A new account works only after its emailed code; wrong, expired and reused codes refused; limits per address |
| `email-verification.test.js` | 23 | Integration | Email change confirmed by a code; admin email change; codes stored as hashes |
| `password-reset.test.js` | 29 | Integration | Reset with an emailed code; one answer for every email; limits; sessions end after a reset |
| `login-limits.test.js` | 15 | Integration | Sign-in lock after 5 wrong passwords per email; limit per address |
| `session-idle.test.js` | 5 | Integration | Session ends after 15 minutes without a request |
| `logout-all.test.js` | 6 | Integration | Sign out of all devices with the current password |
| `devices.test.js` | 6 | Integration | Pairing, wrong code, already linked, isolation between accounts (O3), the latest reading in the device list |
| `ingestion.test.js` | 16 | Integration | MQTT messages: duplicates saved once, late readings keep their time, alerts open and close (also after a power cut), Last Will, devices with no owner (O1, O2, O3) |
| `alert-emails.test.js` | 16 | Integration | Alert emails start and end, at most one per device every 10 minutes, the owner's switch |
| `admin-api.test.js` | 22 | Integration | Admin access only, edits logged with old values, owner change deletes history |
| `admin-roles.test.js` | 13 | Integration | Promote and demote, the last admin cannot be removed |
| `validate.test.js` | 33 | Unit | Every input check, including the 72-byte password limit |
| `mail.test.js` | 18 | Unit | Mail drivers, email texts, the code never written to the log |
| `deviceTime.test.js` | 7 | Unit | Which device times are trusted |
| `mqtt-ack.test.js` | 4 | Unit | A message is acknowledged only after it is saved (B1) |
| `client-ip-config.test.js` | 5 | Unit | Reading the visitor address from the proxy header |
| `refactor-safety.test.js` | 14 | Characterization | Records what code with no direct test did before it was split into shorter functions (PR #148); passes unchanged before and after |

**Frontend:** 115 tests (Vitest) in 11 files. Unit tests: password rules, number and time formatting, the sensor warm-up check, CSV export, the API client, and a check that every translation key used in the code exists in Arabic and English. Page tests (React Testing Library): the dashboard, sign-in and sign-up, the profile, the session rules, and the data-loading hook.

**Mutation testing** on the Sprint 3 fixes: B1 5/5, sign-up code 7/7, R2/R3 8/8, R4 5/5, R5 5/5, #42 2/2 changes caught.

**How to reproduce:** see [Running the Tests](../README.md#running-the-tests) in the README.

### 6.4 Manual and end-to-end tests on production

| Date | Test | Result |
| --- | --- | --- |
| 24 Oct | Real device to database to dashboard, values compared at each step (O1) | Pass |
| 7 Nov | Two devices on one account; a second account refused (O3) | Pass |
| 21 Nov | Phone layout at 390 px in Arabic and English: header fits, gauge shows readings above 1500 ppm | Pass |
| 10 Nov | Password reset and email verification emails received from the team's domain | Pass |
| 11 Nov | Real device alarm: buzzer and LED, alert opened and closed, "started" and "ended" emails received | Pass |
| After #64 | Sign-in lock after 5 wrong passwords | Pass |
| 16 Nov | After the B1 fix: real device readings reach the dashboard; `/health` reports database and MQTT connected | Pass |
| 21 Nov | New account with a real email: code received, wrong code refused, right code opens Add Sensor | Pass |
| Throughout | Browser tests in Arabic and English, desktop and mobile (Playwright scripts for the account, admin and sensor flows) | Pass |

---

## 7. Production Environment

| Item | Value |
| --- | --- |
| Live app | <https://air-quality-monitoring-system-production-534c.up.railway.app> |
| Health check | [`/api/v1/health`](https://air-quality-monitoring-system-production-534c.up.railway.app/api/v1/health) returns `{"status":"ok","database":"connected","mqtt":"connected"}` |
| API documentation | [OpenAPI specification](../backend/docs/openapi.yaml) |
| Hosting | Railway: backend (serves the React app, API and Socket.IO on one domain), Mosquitto broker (TLS on 8883 through a TCP proxy, private network to the backend), PostgreSQL (private network only) |
| Deploys | Every merge into `develop` deploys automatically; Prisma migrations run before the new version starts |
| Email | Resend, sending from the team's verified domain |
| Devices | Two real ESP32 devices with their own broker accounts, plus the simulator |

---

## 8. Carried Over to Stage 5

| Item | Reason |
| --- | --- |
| Finish the 25-line function limit in the frontend (mentor feedback, 17 Nov) | Every file was already 400 lines or fewer (PR #148); 17 frontend functions were still longer than 25 lines |
| S3-05 physical reference test | No reference gas instrument was available, so the sensor is not calibrated; the dashboard labels every value as estimated |
| The open bugs in Section 5.2, starting with the three high-severity ones (W2, W3, #41) | Most open firmware bugs need a change on the real device and a physical test |
| Merge `develop` into `main` for the final submission | Planned in the SCM strategy |
