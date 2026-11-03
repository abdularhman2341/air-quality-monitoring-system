// gas_monitor.ino
// Sprint 1
//   S1-05: read the TGS2610-D00 and estimate LPG ppm.
//   S1-07: connect to Wi-Fi, sync the clock (NTP), and publish readings to the
//          MQTT broker over TLS (QoS 1), with a retained status message and a
//          Last Will (LWT) that reports the device as offline.
//   Wi-Fi setup page (WiFiManager): the user enters the home Wi-Fi from a phone,
//          no Wi-Fi password in the code.
//   S2-03: local alarm (buzzer + LED), decided on the device so it keeps
//          working offline. Events are published to aqms/devices/{mac}/alarms.
//   Status LEDs (green): Power LED wired to 3V3 (hardware only, no code), and a
//          Wi-Fi LED on GPIO 27 that shows the connection state.
//
// Board: ESP32 Dev Module    Serial Monitor: 115200 baud
// Libraries:
//   espMqttClient by Bert Melis
//   WiFiManager by tzapu

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <esp_mac.h>
#include <time.h>
#include <espMqttClient.h>

#if __has_include("config.h")
#include "config.h"
#else
#error "config.h not found: copy config.example.h to config.h and fill in the real values."
#endif

// ---------------------------------------------------------------------------
// Pins
// The sensor uses an ADC1 pin (GPIO 32-39): ADC2 pins stop working while
// Wi-Fi is on.
// ---------------------------------------------------------------------------
const int SENSOR_PIN = 34;   // divider midpoint (row 15 on the breadboard)
const int BUZZER_PIN = 25;   // active piezo buzzer: + to GPIO 25, - to GND
const int LED_PIN    = 26;   // red alarm LED: GPIO 26 -> 330 ohm -> LED long leg; short leg to GND
const int RESET_BUTTON_PIN = 0;   // the BOOT button on the board: hold 3 s to forget Wi-Fi
const int WIFI_LED_PIN = 27;      // green Wi-Fi LED: GPIO 27 -> 220 ohm -> LED long leg; short leg to GND
// Power LED (green): 3V3 pin -> 220 ohm -> LED long leg; short leg to GND.
// It is not controlled by the code: it stays on whenever the board has power.

// ---------------------------------------------------------------------------
// Sensor circuit (current breadboard: all resistors are 10k)
//   5V -> sensor pin 3 (+) -> sensor pin 2 (-) = Vout -> RL 10k -> GND
//   Vout -> R1 10k -> ADC pin -> R2 10k -> GND
// See firmware/docs/ppm-conversion.md
// ---------------------------------------------------------------------------
const float VC_VOLTS      = 5.0;     // circuit voltage. Measure VIN later and update.
const float RL_OHMS       = 6667.0;  // 10k RL in parallel with the 20k divider
const float DIVIDER_RATIO = 2.0;     // Vout / Vpin = (10k + 10k) / 10k

// ---------------------------------------------------------------------------
// ppm estimate (NOT calibrated)
// Typical values from the Figaro TGS2610-D00 datasheet. Replace RO_OHMS and
// CURVE_B with measured values after the reference test.
// ---------------------------------------------------------------------------
const float RO_OHMS = 3800.0;   // Rs at 1800 ppm iso-butane (datasheet range 1.2k-12k)
const float CURVE_B = -0.67;    // log-log slope (datasheet range about -0.46 to -0.91)
const float REF_PPM = 1800.0;   // Figaro reference concentration

// ---------------------------------------------------------------------------
// Local alarm (S2-03)
// The decision is made here, on the device, so the buzzer and LED work
// without Wi-Fi or internet. Must match the thresholds in the dashboard.
// ---------------------------------------------------------------------------
const float ALARM_ON_PPM     = 1000.0;  // warning: alarm turns on (intermittent beep)
const float ALARM_DANGER_PPM = 1500.0;  // danger: continuous beep
const float ALARM_OFF_PPM    = 800.0;   // alarm turns off only below this (hysteresis)
const unsigned long WARMUP_MS      = 120000;  // no alarm for 2 min after power-up (sensor not stable)
const unsigned long BEEP_PERIOD_MS = 1000;    // warning beep: 0.5 s on, 0.5 s off
const unsigned long SELF_TEST_MS   = 2000;    // short BOOT press: beep + LED for 2 s

// ---------------------------------------------------------------------------
// Wi-Fi LED
//   on          Wi-Fi and broker connected: readings are being sent
//   slow blink  Wi-Fi connected, broker not connected (or clock not synced yet)
//   fast blink  Wi-Fi setup page (AQMS-Setup-XXXX) is open and waiting
//   off         no Wi-Fi
// ---------------------------------------------------------------------------
const unsigned long WIFI_LED_SLOW_MS = 1000;  // slow blink: 0.5 s on, 0.5 s off
const unsigned long WIFI_LED_FAST_MS = 200;   // fast blink: 0.1 s on, 0.1 s off

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------
const unsigned long READ_INTERVAL_MS     = 5000;   // one reading every 5 s (data contract)
const unsigned long MQTT_RETRY_MS        = 5000;   // wait between broker connection attempts
const unsigned long WIFI_REPORT_MS       = 10000;  // how often to print "waiting for Wi-Fi"
const unsigned long RESET_HOLD_MS        = 3000;   // hold BOOT this long to forget Wi-Fi
const uint16_t      PORTAL_TIMEOUT_S     = 180;    // setup page closes after 3 min without use
const unsigned long WIFI_RETRY_MS        = 30000;  // retry the saved Wi-Fi this often while offline
const uint16_t      WIFI_CONNECT_TIMEOUT_S = 20;   // time to try the saved Wi-Fi at startup
const unsigned long NTP_RETRY_MS         = 30000;  // restart NTP if the clock is still not set
const char*         NTP_SERVER_BACKUP    = "time.google.com";
const uint16_t      MQTT_KEEPALIVE_S     = 30;     // broker sends the LWT ~45 s after a silent drop
const int           SAMPLES              = 16;     // ADC samples averaged per reading
const int           ADC_NEAR_MAX         = 4000;   // pin close to max: heater/electrode pins swapped?
const time_t        VALID_TIME_AFTER     = 1704067200;  // 2024-01-01: clock is synced after this

// ---------------------------------------------------------------------------
// MQTT client
// UseInternalTask::NO: the client runs inside loop() (mqttClient.loop()), so
// all callbacks run in the same task as the rest of the sketch.
// ---------------------------------------------------------------------------
espMqttClientSecure mqttClient(espMqttClientTypes::UseInternalTask::NO);

// Wi-Fi setup page. Runs in non-blocking mode: readings continue while it is open.
WiFiManager wifiManager;
char portalName[20];         // Wi-Fi name of the setup page, e.g. AQMS-Setup-9E01
unsigned long resetPressedMs = 0;   // when the BOOT button was pressed (0 = not pressed)

// espMqttClient keeps pointers to the client ID and the will topic/payload,
// so these buffers must stay alive for the whole program (global, not local).
char deviceMac[13];          // 12 uppercase hex characters, e.g. A4CF123B9E01
char clientId[20];           // "aqms-" + MAC
char topicReadings[48];      // aqms/devices/{mac}/readings
char topicStatus[48];        // aqms/devices/{mac}/status
char topicAlarms[48];        // aqms/devices/{mac}/alarms
char willPayload[96];        // offline status, published by the broker if the device drops

unsigned long seq = 0;              // reading counter (data contract field "seq")
unsigned long lastReadMs = 0;
unsigned long lastMqttAttemptMs = 0;
unsigned long lastWifiReportMs = 0;
unsigned long lastWifiRetryMs = 0;
bool wifiWasConnected = false;
bool timeSynced = false;
unsigned long lastNtpStartMs = 0;   // when NTP was last started (0 = not yet)

// Alarm state
enum AlarmLevel { ALARM_NONE, ALARM_WARNING, ALARM_DANGER };
AlarmLevel alarmLevel = ALARM_NONE;
bool alarmActive = false;           // true from alarm_on until alarm_off
unsigned long selfTestUntilMs = 0;  // self-test running until this time (0 = off)

// Last alarm event not yet delivered to the broker (sent when back online).
// Only the latest event is kept: the web system needs the current state.
bool alarmEventPending = false;
bool pendingEventOn = false;        // true = alarm_on, false = alarm_off
float pendingEventPpm = 0;
char pendingEventTs[25] = "";       // device time of the event ("" if the clock was not set)

// One sensor reading.
struct Reading {
  int raw;          // average raw ADC value (0-4095)
  float pinVolts;   // voltage at GPIO 34
  float vout;       // voltage across RL
  bool valid;       // false when vout is outside (0, VC): no usable signal
  float rs;         // sensor resistance (ohm)
  float rsRo;       // Rs / Ro
  float ppm;        // estimated iso-butane-equivalent ppm
};

// ---------------------------------------------------------------------------
// Device identity
// ---------------------------------------------------------------------------

// Reads the factory Wi-Fi station MAC from eFuse. Works before Wi-Fi starts.
void readDeviceMac() {
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  snprintf(deviceMac, sizeof(deviceMac), "%02X%02X%02X%02X%02X%02X",
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

// Current UTC time as ISO 8601, e.g. 2026-11-01T15:30:00Z.
void currentIsoTime(char* buf, size_t len) {
  time_t now = time(nullptr);
  struct tm t;
  gmtime_r(&now, &t);
  strftime(buf, len, "%Y-%m-%dT%H:%M:%SZ", &t);
}

bool clockIsValid() {
  return time(nullptr) > VALID_TIME_AFTER;
}

// ---------------------------------------------------------------------------
// Sensor
// ---------------------------------------------------------------------------

int readRawAverage() {
  long total = 0;
  for (int i = 0; i < SAMPLES; i++) {
    total += analogRead(SENSOR_PIN);
    delay(2);
  }
  return total / SAMPLES;
}

uint32_t readPinMillivolts() {
  uint32_t total = 0;
  for (int i = 0; i < SAMPLES; i++) {
    total += analogReadMilliVolts(SENSOR_PIN);
    delay(2);
  }
  return total / SAMPLES;
}

float estimatePpm(float rs) {
  float ratio = rs / RO_OHMS;
  return REF_PPM * pow(ratio, 1.0 / CURVE_B);
}

Reading takeReading() {
  Reading r = {};
  r.raw = readRawAverage();
  r.pinVolts = readPinMillivolts() / 1000.0;
  r.vout = r.pinVolts * DIVIDER_RATIO;
  r.valid = (r.vout > 0.01 && r.vout < VC_VOLTS);
  if (r.valid) {
    r.rs = RL_OHMS * (VC_VOLTS - r.vout) / r.vout;   // Ohm's law, see docs
    r.rsRo = r.rs / RO_OHMS;
    r.ppm = estimatePpm(r.rs);
  }
  return r;
}

void printReading(const Reading& r) {
  Serial.printf("seq=%lu  raw_adc=%d  pin=%.3f V  vout=%.3f V",
                seq, r.raw, r.pinVolts, r.vout);
  if (r.valid) {
    Serial.printf("  rs=%.0f ohm  rs_ro=%.3f  lpg_ppm_est=%.0f", r.rs, r.rsRo, r.ppm);
  } else {
    Serial.print("  (no signal - check wiring)");
  }
  if (millis() < WARMUP_MS) {
    Serial.print("  [warm-up]");
  } else if (alarmLevel == ALARM_DANGER) {
    Serial.print("  [ALARM: DANGER]");
  } else if (alarmLevel == ALARM_WARNING) {
    Serial.print("  [ALARM: WARNING]");
  }
  if (r.raw >= ADC_NEAR_MAX) {
    Serial.print("  <-- ADC near max: check heater/electrode pins");
  }
}

// ---------------------------------------------------------------------------
// MQTT
// ---------------------------------------------------------------------------

// Retained "online" status, sent right after connecting.
void publishOnlineStatus() {
  char ts[25];
  currentIsoTime(ts, sizeof(ts));
  char payload[160];
  snprintf(payload, sizeof(payload),
           "{\"device_id\":\"%s\",\"state\":\"online\",\"ip\":\"%s\",\"ts\":\"%s\"}",
           deviceMac, WiFi.localIP().toString().c_str(), ts);
  uint16_t id = mqttClient.publish(topicStatus, 1, true, payload);
  Serial.printf("[mqtt] status online -> %s (packet %u)\n", id ? "queued" : "FAILED", id);
}

// Reading payload as defined in docs/04-api-specifications.md.
void publishReading(const Reading& r) {
  char ts[25];
  currentIsoTime(ts, sizeof(ts));
  char payload[256];
  snprintf(payload, sizeof(payload),
           "{\"device_id\":\"%s\",\"seq\":%lu,\"sensor_raw_adc\":%d,"
           "\"sensor_voltage\":%.3f,\"rs_ro_ratio\":%.3f,\"lpg_ppm_est\":%.0f,"
           "\"alarm_active\":%s,\"ts\":\"%s\"}",
           deviceMac, seq, r.raw, r.vout, r.rsRo, r.ppm,
           alarmActive ? "true" : "false", ts);
  uint16_t id = mqttClient.publish(topicReadings, 1, false, payload);
  if (id) {
    Serial.printf("  -> published (packet %u)", id);
  } else {
    Serial.print("  -> publish FAILED");
  }
}

// Alarm event payload as defined in docs/04-api-specifications.md.
// Sends the pending event if the broker is connected and the clock is set.
void sendPendingAlarmEvent() {
  if (!alarmEventPending || !mqttClient.connected() || !timeSynced) {
    return;
  }
  // An event that happened before the clock was set gets the current time.
  if (pendingEventTs[0] == '\0') {
    currentIsoTime(pendingEventTs, sizeof(pendingEventTs));
  }
  char payload[192];
  snprintf(payload, sizeof(payload),
           "{\"device_id\":\"%s\",\"event\":\"%s\",\"lpg_ppm_est\":%.0f,"
           "\"threshold_ppm\":%.0f,\"ts\":\"%s\"}",
           deviceMac, pendingEventOn ? "alarm_on" : "alarm_off",
           pendingEventPpm, ALARM_ON_PPM, pendingEventTs);
  uint16_t id = mqttClient.publish(topicAlarms, 1, false, payload);
  if (id) {
    Serial.printf("[mqtt] %s -> queued (packet %u)\n",
                  pendingEventOn ? "alarm_on" : "alarm_off", id);
    alarmEventPending = false;
  }
}

void onMqttConnect(bool sessionPresent) {
  Serial.println("[mqtt] connected to broker");
  publishOnlineStatus();
  sendPendingAlarmEvent();   // an alarm that changed while offline
}

void onMqttDisconnect(espMqttClientTypes::DisconnectReason reason) {
  Serial.printf("[mqtt] disconnected (reason %u). Retrying in %lu s.\n",
                static_cast<uint8_t>(reason), MQTT_RETRY_MS / 1000);
  lastMqttAttemptMs = millis();
}

// Called when the broker acknowledges a QoS 1 message (PUBACK).
void onMqttPublish(uint16_t packetId) {
  Serial.printf("[mqtt] PUBACK packet %u\n", packetId);
}

void setupMqtt() {
  snprintf(clientId, sizeof(clientId), "aqms-%s", deviceMac);
  snprintf(topicReadings, sizeof(topicReadings), "aqms/devices/%s/readings", deviceMac);
  snprintf(topicStatus, sizeof(topicStatus), "aqms/devices/%s/status", deviceMac);
  snprintf(topicAlarms, sizeof(topicAlarms), "aqms/devices/%s/alarms", deviceMac);

  // The broker publishes this (retained) if the device disconnects without
  // saying goodbye: power loss, Wi-Fi loss, crash. It has no "ts" because it
  // is written at connect time; the backend uses its own receive time.
  snprintf(willPayload, sizeof(willPayload),
           "{\"device_id\":\"%s\",\"state\":\"offline\"}", deviceMac);

  mqttClient.setCACert(MQTT_CA_CERT);
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCredentials(MQTT_USERNAME, MQTT_PASSWORD);
  mqttClient.setClientId(clientId);
  mqttClient.setKeepAlive(MQTT_KEEPALIVE_S);
  mqttClient.setCleanSession(true);
  mqttClient.setWill(topicStatus, 1, true, willPayload);

  mqttClient.onConnect(onMqttConnect);
  mqttClient.onDisconnect(onMqttDisconnect);
  mqttClient.onPublish(onMqttPublish);

  if (strcmp(MQTT_USERNAME, clientId) != 0) {
    Serial.printf("WARNING: MQTT_USERNAME in config.h is \"%s\", expected \"%s\".\n",
                  MQTT_USERNAME, clientId);
  }
}

// ---------------------------------------------------------------------------
// Wi-Fi setup page (WiFiManager)
//
// At startup the device tries the Wi-Fi saved in its memory. If there is none,
// or it cannot connect, it opens its own Wi-Fi network (AQMS-Setup-XXXX).
// The user joins it from a phone, a page opens, and they choose the home Wi-Fi
// and enter its password. The device saves it and connects.
// ---------------------------------------------------------------------------

void onPortalStarted(WiFiManager* wm) {
  Serial.println();
  Serial.println("[wifi] setup page is open:");
  Serial.printf("       1. On your phone, join the Wi-Fi \"%s\" (password in config.h: PORTAL_PASSWORD)\n",
                portalName);
  Serial.println("       2. The setup page opens. If not, browse to http://192.168.4.1");
  Serial.println("       3. Choose your home Wi-Fi (2.4 GHz) and enter its password");
  Serial.println();
}

// Nobody used the setup page in time (for example, the router was off when the
// device started). The device does NOT restart, because a restart would also
// restart the sensor warm-up and pause the local alarm. maintainConnections()
// keeps retrying the saved Wi-Fi, or reopens the setup page if none is saved.
void onPortalTimeout() {
  Serial.println("[wifi] setup page closed (timeout)");
  lastWifiRetryMs = millis();
}

void setupWifi() {
  // Last 4 MAC characters, so several devices in one place have different names.
  snprintf(portalName, sizeof(portalName), "AQMS-Setup-%s", deviceMac + 8);

  static const char* menu[] = {"wifi", "info", "exit"};

  WiFi.mode(WIFI_STA);
  wifiManager.setHostname(clientId);              // name shown in the router's device list
  wifiManager.setTitle("Gas Monitor");
  wifiManager.setMenu(menu, 3);
  wifiManager.setConfigPortalBlocking(false);     // keep reading the sensor while it is open
  wifiManager.setConfigPortalTimeout(PORTAL_TIMEOUT_S);
  wifiManager.setConnectTimeout(WIFI_CONNECT_TIMEOUT_S);
  wifiManager.setWiFiAutoReconnect(true);         // reconnect on its own after a drop
  wifiManager.setAPCallback(onPortalStarted);
  wifiManager.setConfigPortalTimeoutCallback(onPortalTimeout);

  Serial.println("[wifi] connecting to the saved Wi-Fi...");
  if (wifiManager.autoConnect(portalName, PORTAL_PASSWORD)) {
    Serial.println("[wifi] connected with the saved Wi-Fi");
  }
}

// BOOT button:
//   short press  -> alarm self-test (buzzer + LED for 2 s), nothing is sent
//   hold for 3 s -> forget the saved Wi-Fi and restart into the setup page
//                   (moving to another home, or the router password changed)
void checkResetButton() {
  bool pressed = (digitalRead(RESET_BUTTON_PIN) == LOW);
  if (!pressed) {
    if (resetPressedMs != 0 && millis() - resetPressedMs >= 50) {   // 50 ms: ignore contact bounce
      Serial.println("[alarm] self-test: buzzer and LED on for 2 s");
      selfTestUntilMs = millis() + SELF_TEST_MS;
    }
    resetPressedMs = 0;
    return;
  }
  if (resetPressedMs == 0) {
    resetPressedMs = millis();
    return;
  }
  if (millis() - resetPressedMs >= RESET_HOLD_MS) {
    Serial.println("[wifi] BOOT held: forgetting the saved Wi-Fi and restarting...");
    wifiManager.resetSettings();
    delay(200);
    ESP.restart();
  }
}

// ---------------------------------------------------------------------------
// Connection management (non-blocking: the loop never waits for the network,
// so the local alarm in S2-03 keeps working without internet)
// ---------------------------------------------------------------------------
void maintainConnections() {
  unsigned long now = millis();
  bool wifiUp = (WiFi.status() == WL_CONNECTED);

  // Wi-Fi: the ESP32 reconnects on its own. Only report changes.
  if (wifiUp && !wifiWasConnected) {
    Serial.printf("[wifi] connected to \"%s\", IP %s\n",
                  WiFi.SSID().c_str(), WiFi.localIP().toString().c_str());
  } else if (!wifiUp && wifiWasConnected) {
    Serial.println("[wifi] disconnected, reconnecting...");
  } else if (!wifiUp && !wifiManager.getConfigPortalActive()
             && now - lastWifiReportMs >= WIFI_REPORT_MS) {
    Serial.println("[wifi] waiting for Wi-Fi...");
    lastWifiReportMs = now;
  }
  wifiWasConnected = wifiUp;

  // No Wi-Fi and no setup page: retry the saved Wi-Fi, or reopen the setup page
  // if nothing is saved yet. The sensor and the local alarm keep running.
  if (!wifiUp && !wifiManager.getConfigPortalActive()
      && now - lastWifiRetryMs >= WIFI_RETRY_MS) {
    lastWifiRetryMs = now;
    if (wifiManager.getWiFiIsSaved()) {
      Serial.println("[wifi] retrying the saved Wi-Fi...");
      WiFi.mode(WIFI_STA);
      WiFi.begin();                     // uses the Wi-Fi saved by the setup page
    } else {
      wifiManager.startConfigPortal(portalName, PORTAL_PASSWORD);
    }
  }
  if (!wifiUp) {
    return;
  }

  // Clock: needed for "ts" and for checking the broker's TLS certificate dates.
  // NTP is (re)started once Wi-Fi is up, then every NTP_RETRY_MS until it answers.
  if (!timeSynced) {
    if (!clockIsValid()) {
      if (lastNtpStartMs == 0 || now - lastNtpStartMs >= NTP_RETRY_MS) {
        if (lastNtpStartMs != 0) {
          Serial.println("[ntp] no answer yet, retrying (the network may block NTP, UDP port 123)");
        }
        configTime(0, 0, NTP_SERVER, NTP_SERVER_BACKUP);   // UTC
        lastNtpStartMs = now;
      }
      return;
    }
    timeSynced = true;
    char ts[25];
    currentIsoTime(ts, sizeof(ts));
    Serial.printf("[ntp] clock synced: %s\n", ts);
  }

  // Broker: try again every MQTT_RETRY_MS while disconnected.
  if (mqttClient.disconnected() && now - lastMqttAttemptMs >= MQTT_RETRY_MS) {
    lastMqttAttemptMs = now;
    Serial.printf("[mqtt] connecting to %s:%d as %s...\n", MQTT_HOST, MQTT_PORT, clientId);
    mqttClient.connect();
  }
}

// ---------------------------------------------------------------------------
// Local alarm (S2-03)
// ---------------------------------------------------------------------------

// Remembers an alarm_on / alarm_off event so it reaches the broker, now or
// when the device is back online.
void queueAlarmEvent(bool on, float ppm) {
  alarmEventPending = true;
  pendingEventOn = on;
  pendingEventPpm = ppm;
  if (timeSynced) {
    currentIsoTime(pendingEventTs, sizeof(pendingEventTs));
  } else {
    pendingEventTs[0] = '\0';
  }
  sendPendingAlarmEvent();
}

// Decides the alarm level from one reading. Called every READ_INTERVAL_MS.
//   on:     ppm >= ALARM_ON_PPM
//   danger: ppm >= ALARM_DANGER_PPM
//   off:    ppm <  ALARM_OFF_PPM (the gap stops the alarm flickering
//           when the reading hovers around the threshold)
// A reading without a valid signal does not change the alarm.
void evaluateAlarm(const Reading& r) {
  if (!r.valid || millis() < WARMUP_MS) {
    return;
  }

  bool wasActive = alarmActive;
  if (!alarmActive && r.ppm >= ALARM_ON_PPM) {
    alarmActive = true;
  } else if (alarmActive && r.ppm < ALARM_OFF_PPM) {
    alarmActive = false;
  }

  if (!alarmActive) {
    alarmLevel = ALARM_NONE;
  } else if (r.ppm >= ALARM_DANGER_PPM) {
    alarmLevel = ALARM_DANGER;
  } else if (alarmLevel == ALARM_NONE || r.ppm < ALARM_ON_PPM) {
    alarmLevel = ALARM_WARNING;   // danger drops back to warning below ALARM_ON_PPM
  }

  if (alarmActive && !wasActive) {
    Serial.printf("[alarm] ON  (%.0f ppm >= %.0f)\n", r.ppm, ALARM_ON_PPM);
    queueAlarmEvent(true, r.ppm);
  } else if (!alarmActive && wasActive) {
    Serial.printf("[alarm] OFF (%.0f ppm < %.0f)\n", r.ppm, ALARM_OFF_PPM);
    queueAlarmEvent(false, r.ppm);
  }
}

// Drives the buzzer and LED. Called on every loop pass, so the beep keeps its
// rhythm between readings.
//   warning: LED on, buzzer beeps (0.5 s on / 0.5 s off)
//   danger:  LED on, buzzer continuous
void updateAlarmOutputs() {
  unsigned long now = millis();
  bool selfTest = (selfTestUntilMs != 0);
  if (selfTest && (long)(now - selfTestUntilMs) >= 0) {
    selfTestUntilMs = 0;
    selfTest = false;
  }

  bool led = false;
  bool buzzer = false;
  if (selfTest || alarmLevel == ALARM_DANGER) {
    led = true;
    buzzer = true;
  } else if (alarmLevel == ALARM_WARNING) {
    led = true;
    buzzer = (now % BEEP_PERIOD_MS) < (BEEP_PERIOD_MS / 2);
  }
  digitalWrite(LED_PIN, led ? HIGH : LOW);
  digitalWrite(BUZZER_PIN, buzzer ? HIGH : LOW);
}

// ---------------------------------------------------------------------------
// Wi-Fi LED
// Called on every loop pass, so the blink keeps its rhythm. It only reads the
// connection state and never waits, so it cannot delay the local alarm.
// ---------------------------------------------------------------------------
void updateWifiLed() {
  unsigned long now = millis();
  bool led;
  if (wifiManager.getConfigPortalActive()) {
    led = (now % WIFI_LED_FAST_MS) < (WIFI_LED_FAST_MS / 2);   // setup page open
  } else if (WiFi.status() != WL_CONNECTED) {
    led = false;                                                // no Wi-Fi
  } else if (mqttClient.connected()) {
    led = true;                                                 // all connected
  } else {
    led = (now % WIFI_LED_SLOW_MS) < (WIFI_LED_SLOW_MS / 2);   // Wi-Fi only
  }
  digitalWrite(WIFI_LED_PIN, led ? HIGH : LOW);
}

// ---------------------------------------------------------------------------
// Arduino entry points
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(WIFI_LED_PIN, OUTPUT);
  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(WIFI_LED_PIN, LOW);

  analogReadResolution(12);         // raw values 0-4095
  analogSetAttenuation(ADC_11db);   // pin range up to about 3.1 V

  readDeviceMac();

  Serial.println();
  Serial.println("=== Gas Monitor - S1-07 Wi-Fi + MQTT ===");
  Serial.printf("Device MAC (device_id): %s\n", deviceMac);
  Serial.println("Note: let the sensor heater warm up before trusting the readings.");
  Serial.println("      ppm values are uncalibrated estimates.");
  Serial.println("      BOOT button: short press = alarm self-test, hold 3 s = change the Wi-Fi.");
  Serial.printf("      Alarm: on at %.0f ppm, danger at %.0f ppm, off below %.0f ppm.\n",
                ALARM_ON_PPM, ALARM_DANGER_PPM, ALARM_OFF_PPM);
  Serial.printf("      Alarm disabled for the first %lu s (sensor warm-up).\n", WARMUP_MS / 1000);
  Serial.println("      Wi-Fi LED: on = sending, slow blink = no broker, fast blink = setup page, off = no Wi-Fi.");
  Serial.println();

  setupMqtt();                     // builds clientId, used as the Wi-Fi hostname
  setupWifi();
}

void loop() {
  updateAlarmOutputs();             // first, so the buzzer and LED never wait for the network
  updateWifiLed();
  wifiManager.process();            // serves the setup page while it is open
  checkResetButton();
  mqttClient.loop();
  maintainConnections();
  sendPendingAlarmEvent();          // alarm event from while the broker or clock was not ready

  unsigned long now = millis();
  if (now - lastReadMs < READ_INTERVAL_MS) {
    return;
  }
  lastReadMs = now;
  seq++;   // counts every reading, so gaps in "seq" show readings lost while offline

  Reading r = takeReading();
  evaluateAlarm(r);          // local decision: works without Wi-Fi or internet
  printReading(r);

  if (!r.valid) {
    Serial.print("  -> not published (no signal)");
  } else if (!timeSynced) {
    Serial.print("  -> not published (clock not synced)");
  } else if (!mqttClient.connected()) {
    Serial.print("  -> not published (broker offline)");
  } else {
    publishReading(r);
  }
  Serial.println();
}
