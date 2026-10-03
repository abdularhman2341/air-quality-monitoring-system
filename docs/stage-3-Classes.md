## Key Class Definitions

### A. `MqttSubscriberService`
Handles active connections and message ingestion from the MQTT Broker.

* **Attributes:**
  * `client` (`MQTTClient`): Active connection client listening to the MQTT broker.
* **Methods:**
  * `connect()`: Establishes a secure connection to the MQTT broker.
  * `subscribe(topic)`: Listens to incoming telemetry channels (e.g., `sensors/lpg/data`).
  * `handleMessage(topic, message)`: Parses incoming JSON packets and forwards them to `ReadingService`.

---

### B. `AuthController` & `AuthService`
Manages user authentication and JWT session protection (`US-01`, `US-06`).

* **Attributes:**
  * `jwtSecret` (`String`): Secret key used to sign JSON Web Tokens.
  * `tokenExpiry` (`String`): Session duration limit (e.g., `24h`).
* **Methods:**
  * `login(email, password)`: Verifies user credentials using bcrypt and returns a JWT token (`US-01`).
  * `verifyToken(req, res, next)`: Express middleware enforcing user-to-device ownership boundaries (`US-06`).

---

### C. `DeviceService`
Manages ESP32 registration and monitors hardware network heartbeats (`US-05`, `US-08`).

* **Attributes:**
  * `dbClient` (`DBPool`): Connection pool connected to PostgreSQL.
* **Methods:**
  * `getUserDevices(userId)`: Fetches all registered ESP32 units belonging to an authenticated account (`US-05`).
  * `updateDeviceStatus(deviceId, status)`: Sets connectivity state (`online`/`offline`) based on incoming message intervals (`US-08`).

---

### D. `ReadingService`
Converts raw signals from the Figaro TGS2610 gas sensor and logs telemetry readings.

* **Attributes:**
  * `alarmThresholdPPM` (`Float`): System safety threshold limit (e.g., `1000.0 PPM`).
* **Methods:**
  * `processReading(deviceId, rawAdc, lpgPpm)`: Inserts telemetry entries into the `sensor_readings` table (`US-02`, `US-07`).
  * `calculateEstimatedPpm(rawAdc)`: Converts 12-bit ADC inputs (0–4095) into estimated LPG concentration values ($PPM$).

---

### E. `AlertService`
Logs safety violations when gas concentration exceeds configured safety limits (`US-04`).

* **Attributes:**
  * `activeAlerts` (`Map`): Tracks active gas leak events per device ID.
* **Methods:**
  * `triggerAlert(deviceId, lpgPpm)`: Inserts incident details into `alert_events` when $PPM \ge \text{Threshold}$ (`US-04`).
  * `getAlertHistory(userId, filters)`: Retrieves past safety breach logs for user reporting (`US-09`).
