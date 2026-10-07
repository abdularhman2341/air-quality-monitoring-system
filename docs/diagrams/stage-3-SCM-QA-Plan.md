# Task 5: Plan SCM and QA Strategies

## 5.1 SCM Strategy

**Tool:** Git for version control, with GitHub to host the shared repository.

**Branching strategy:**
- `main`: stable, working version. No one commits directly to it.
- `develop`: integration branch. Each member merges finished work here for testing.
- `feature/<task-name>`: one branch per task (e.g., `feature/esp32-alarm`).

**Commits:** Small, frequent commits after each small change, with clear messages describing what was done (e.g., "add gas threshold check").

**Pull requests & code review:**
- Feature branches are merged into `develop` only through a pull request.
- Each PR is reviewed and approved by one other team member before merging. One reviewer keeps the process fast for a three-person team.
- `develop` is merged into `main` through a PR once it is stable and tested, for example after a feature is complete or before a demo.

## 5.2 QA Strategy

**Types of tests (mapped to the project objectives):**
- **O1 – Readings reach the dashboard:** End-to-end test from the device to the dashboard, comparing values at each step. Supported by integration tests for backend message ingestion and storage.
- **O2 – Local alarm without internet:** Physical (manual) test on the real device, including an internet outage. Supported by unit tests for the threshold-check logic. Software-trigger tests are recorded separately from physical sensor-response tests.
- **O3 – Access control:** Integration tests that send API requests as a second account and verify that access to another user's devices is rejected. Multi-device support is also tested manually with two physical devices.

**Tools:**
- **Backend:** Jest and Supertest for automated tests; Postman for manual API testing.
- **Frontend:** React Testing Library for component tests; manual testing in the browser against the Figma designs.
- **ESP32:** Serial Monitor to check readings and alarm behavior during manual tests.

**Deployment pipeline:**
- Pull requests trigger GitHub Actions to run automated tests; failing tests block merging.
- `develop` is deployed to a staging environment for end-to-end and manual testing.
- After staging tests pass, `develop` is merged into `main` and deployed to production.
