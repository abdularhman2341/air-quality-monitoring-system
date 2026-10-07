# Section 2.1: Backend Class Design (UML)

The backend follows a layered design: **Controllers → Services → Repositories → PostgreSQL**.
Every method called in the [Sequence Diagrams](stage-3-Sequence-Diagrams.md) is defined here, and every entity mirrors a table in the [ER Diagram](stage-3-ER-Diagram.md).

The design is shown in four small diagrams so each one stays readable:

| Diagram | Shows |
| --- | --- |
| 1.1 Overview | All classes and how the layers connect (no members) |
| 1.2 REST API Layer | Middleware, controllers, and `AuthService` |
| 1.3 Telemetry and Real-time Layer | MQTT ingestion, device, reading, and alert services, Socket.IO gateway |
| 1.4 Data Layer | Repositories and the entities they return |

---

## 1. Mermaid UML Class Diagrams

### 1.1 Overview

```mermaid
classDiagram
    direction LR

    class AuthMiddleware
    class AuthController
    class DeviceController
    class ReadingController
    class AlertController

    class AuthService
    class DeviceService
    class ReadingService
    class AlertService
    class MqttSubscriberService
    class RealtimeGateway

    class UserRepository
    class DeviceRepository
    class ReadingRepository
    class AlertRepository

    AuthMiddleware --> AuthService
    AuthController --> AuthService
    DeviceController --> DeviceService
    ReadingController --> ReadingService
    AlertController --> AlertService

    MqttSubscriberService --> DeviceService
    MqttSubscriberService --> ReadingService
    ReadingService --> AlertService
    ReadingService --> DeviceService

    DeviceService --> RealtimeGateway
    ReadingService --> RealtimeGateway
    AlertService --> RealtimeGateway

    AuthService --> UserRepository
    DeviceService --> DeviceRepository
    ReadingService --> ReadingRepository
    AlertService --> AlertRepository
```

---

### 1.2 REST API Layer

```mermaid
classDiagram
    direction TB

    class AuthMiddleware {
        -AuthService authService
        +requireAuth(req, res, next) void
    }

    class AuthController {
        -AuthService authService
        +register(req: Request, res: Response) Promise~void~
        +login(req: Request, res: Response) Promise~void~
        +getProfile(req: Request, res: Response) Promise~void~
    }

    class DeviceController {
        -DeviceService deviceService
        +getDevices(req: Request, res: Response) Promise~void~
        +registerDevice(req: Request, res: Response) Promise~void~
        +getDeviceDetails(req: Request, res: Response) Promise~void~
    }

    class ReadingController {
        -ReadingService readingService
        +getHistoricalReadings(req: Request, res: Response) Promise~void~
        +getLatestReading(req: Request, res: Response) Promise~void~
    }

    class AlertController {
        -AlertService alertService
        +getAlertHistory(req: Request, res: Response) Promise~void~
    }

    class AuthService {
        -String jwtSecret
        -String tokenExpiry
        -UserRepository userRepository
        +register(email: String, password: String) Promise~User~
        +login(email: String, password: String) Promise~String~
        +generateToken(userId: String) String
        +verifyToken(token: String) Object
        +hashPassword(password: String) Promise~String~
        +comparePassword(raw: String, hashed: String) Promise~Boolean~
    }

    class DeviceService
    class ReadingService
    class AlertService

    AuthMiddleware --> AuthService : verifyToken()
    AuthController --> AuthService : uses
    DeviceController --> DeviceService : uses
    ReadingController --> ReadingService : uses
    AlertController --> AlertService : uses
```

`DeviceService`, `ReadingService`, and `AlertService` are shown here by name only; their attributes and methods are defined in 1.3. Every route except `register` and `login` passes through `AuthMiddleware` first.

---

### 1.3 Telemetry and Real-time Layer

```mermaid
classDiagram
    direction TB

    class MqttSubscriberService {
        -MQTTClient client
        -ReadingService readingService
        -DeviceService deviceService
        +connect() void
        +subscribe(topic: String) void
        +handleMessage(topic: String, payload: Buffer) void
    }

    class DeviceService {
        -DeviceRepository deviceRepository
        -RealtimeGateway realtime
        +getUserDevices(userId: String) Promise~List~Device~~
        +registerDevice(userId: String, deviceData: Object) Promise~Device~
        +updateDeviceStatus(deviceId: String, status: String) Promise~void~
        +validateOwnership(userId: String, deviceId: String) Promise~Boolean~
        +checkOfflineDevices(timeoutSec: Integer) Promise~void~
    }

    class ReadingService {
        -Float alarmThresholdPPM
        -ReadingRepository readingRepository
        -AlertService alertService
        -DeviceService deviceService
        -RealtimeGateway realtime
        +processTelemetry(deviceId: String, rawAdc: Integer, lpgPpm: Float, capturedAt: Date) Promise~Reading~
        +getHistoricalReadings(deviceId: String, dateRange: Object) Promise~List~Reading~~
        +getLatestReading(deviceId: String) Promise~Reading~
    }

    class AlertService {
        -AlertRepository alertRepository
        -RealtimeGateway realtime
        -Map activeAlerts
        +triggerAlert(deviceId: String, lpgPpm: Float, threshold: Float) Promise~Alert~
        +clearAlert(deviceId: String) void
        +getAlertHistory(userId: String, filters: Object) Promise~List~Alert~~
    }

    class RealtimeGateway {
        -SocketIOServer io
        -AuthService authService
        +authenticateSocket(socket, next) void
        +emitToOwner(userId: String, event: String, data: Object) void
    }

    MqttSubscriberService --> ReadingService : forwards telemetry
    MqttSubscriberService --> DeviceService : updates last_seen/status
    ReadingService --> AlertService : triggers if PPM >= Threshold
    ReadingService --> DeviceService : validates device state
    ReadingService --> RealtimeGateway : emits reading
    AlertService --> RealtimeGateway : emits alert
    DeviceService --> RealtimeGateway : emits status
```

---

### 1.4 Data Layer

```mermaid
classDiagram
    direction LR

    class UserRepository {
        -Pool db
        +findByEmail(email: String) Promise~User~
        +findById(id: String) Promise~User~
        +create(user: Object) Promise~User~
    }

    class DeviceRepository {
        -Pool db
        +findById(id: String) Promise~Device~
        +findByUser(userId: String) Promise~List~Device~~
        +findByIdAndUser(id: String, userId: String) Promise~Device~
        +create(device: Object) Promise~Device~
        +updateStatus(id: String, status: String) Promise~void~
        +findStale(timeoutSec: Integer) Promise~List~Device~~
    }

    class ReadingRepository {
        -Pool db
        +insert(reading: Object) Promise~Reading~
        +findByDeviceAndRange(deviceId: String, from: Date, to: Date) Promise~List~Reading~~
        +findLatest(deviceId: String) Promise~Reading~
    }

    class AlertRepository {
        -Pool db
        +insert(alert: Object) Promise~Alert~
        +findByUser(userId: String, filters: Object) Promise~List~Alert~~
    }

    class User {
        +UUID id
        +String email
        +String passwordHash
        +Date createdAt
    }

    class Device {
        +String id
        +UUID userId
        +String name
        +String status
        +Date lastSeen
    }

    class Reading {
        +BigInt id
        +String deviceId
        +Integer rawAdc
        +Float lpgPpm
        +Date capturedAt
        +Date recordedAt
    }

    class Alert {
        +Integer id
        +String deviceId
        +Float lpgPpm
        +Float thresholdLimit
        +Date triggeredAt
    }

    UserRepository ..> User : returns
    DeviceRepository ..> Device : returns
    ReadingRepository ..> Reading : returns
    AlertRepository ..> Alert : returns

    User "1" --> "0..*" Device : owns
    Device "1" --> "0..*" Reading : generates
    Device "1" --> "0..*" Alert : triggers
```

---

## 2. Structural UML Class Relationships

### 1. `MqttSubscriberService` → `ReadingService` & `DeviceService` (Association)
Upon receiving a new MQTT packet from the ESP32 hardware via the telemetry or heartbeat topic, `MqttSubscriberService` parses the JSON payload and forwards the data to:
* **`ReadingService`**: To persist the raw 12-bit ADC value and the estimated LPG gas concentration ($PPM$) calculated on the ESP32 into the time-series database. The backend does not recalculate PPM, so the local alarm and the web alert always use the same value.
* **`DeviceService`**: To update the device's `last_seen` timestamp and set its operational network connectivity status to `online`.

---

### 2. `ReadingService` → `AlertService` (Dependency / Conditional Trigger)
`ReadingService` evaluates each ingested gas reading against configured safety limits. If the calculated gas level meets or exceeds the safety boundary ($PPM \ge \text{Threshold}$), `ReadingService` invokes `AlertService.triggerAlert()` to immediately create a persistent safety incident log within the `alert_events` audit table. `AlertService` records one alert per leak episode using `activeAlerts`; when a normal reading arrives, `ReadingService` calls `clearAlert()` to end the episode.

---

### 3. `Controllers` → `Services` (Direct Dependency)
To enforce strict **Separation of Concerns (SoC)** and multi-tenant data safety (`US-06`), HTTP REST API Controllers (`AuthController`, `DeviceController`, `ReadingController`, `AlertController`) delegate all core application processing, JWT validation, and database operations directly to their corresponding domain Service layers.

---

### 4. `Services` → `Repositories` (Data Access)
Each Service uses exactly one Repository, and Repositories are the only classes that execute SQL through the `pg` connection pool. This keeps business logic (Backend Developer) separate from data-access code (Database Developer), as defined in the Project Charter, and lets services be unit-tested with mock repositories.

---

### 5. `Services` → `RealtimeGateway` (Live Delivery)
`DeviceService`, `ReadingService`, and `AlertService` publish live events (`device:status`, `reading:new`, `alert:new`) through `RealtimeGateway.emitToOwner()`. The gateway authenticates each Socket.IO connection with the user's JWT and sends events only to the owner's room `user:{userId}`, so the data-isolation rule (`US-06`) is enforced in one place.

---

### 6. Offline Detection (`DeviceService.checkOfflineDevices()`)
A periodic check finds devices whose `last_seen` is older than the timeout, sets them to `offline` through `updateDeviceStatus()`, and emits `device:status` to the owner (`US-08`, Sequence 2 steps 17–20).
