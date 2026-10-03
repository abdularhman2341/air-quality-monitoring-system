# Section 1: High-Level System Architecture

![System Architecture](diagrams/architecture.png)

Editable source: [architecture.drawio](diagrams/architecture.drawio)

| # | Flow | Description |
| --- | --- | --- |
| ① | Sensor → ESP32 | Analog voltage read by the 12-bit ADC |
| ② | ESP32 → Buzzer + LED | Local alarm when ppm ≥ threshold, works without internet |
| ③ | ESP32 → MQTT Broker | Publish `sensors/lpg/data` over MQTT/TLS |
| ④ | Broker → MQTT Ingestion | `MqttSubscriberService` subscribes and validates messages |
| ⑤ | Ingestion → Reading Service | Telemetry processing |
| ⑥ | Reading Service → Alert Service | Triggered when ppm ≥ threshold |
| ⑦ | Services → Socket.IO | Live readings and alerts |
| ⑧ | Socket.IO → Dashboard | Live updates to the owner's room only |
| ⑨ | Dashboard ↔ REST API | HTTPS + JWT (`/api/v1`) |
| ⑩ | Services → PostgreSQL | Save readings, alerts, and device status |
| ⑪ | REST API ↔ PostgreSQL | Historical queries |
| ⑫ | User ↔ Dashboard | Web browser |
| ⑬ | NTP → ESP32 | Time sync for TLS certificates |