// gas_monitor.ino
// Sprint 1 - S1-05: read the TGS2610-D00 and print readings and the device MAC
// to the Serial Monitor. No Wi-Fi, MQTT, or alarm yet (S1-07 and S2-03).
//
// Board: ESP32 DevKit V1    Serial Monitor: 115200 baud

#include <Arduino.h>
#include <esp_mac.h>

// ---------------------------------------------------------------------------
// Pins (proposed - change to match your wiring)
// Use an ADC1 pin (GPIO 32-39) for the sensor: ADC2 pins stop working
// while Wi-Fi is on, and Wi-Fi is added in S1-07.
// ---------------------------------------------------------------------------
const int SENSOR_PIN = 34;   // sensor output (after the voltage divider)
const int BUZZER_PIN = 25;   // reserved for S2-03
const int LED_PIN    = 26;   // reserved for S2-03

// ---------------------------------------------------------------------------
// Sensor circuit (set these to your real values)
// ---------------------------------------------------------------------------
const float VC_VOLTS      = 5.0;     // circuit voltage across sensor + RL
const float RL_OHMS       = 10000.0; // load resistor RL
const float DIVIDER_RATIO = 2.0;     // Vout / Vpin. 2.0 = two equal resistors.
                                     // Set 1.0 if no divider (only if Vout never exceeds 3.3 V).
const float RO_OHMS       = 0.0;     // sensor resistance in clean air, measured in S1-08.
                                     // 0 = not calibrated yet, ratio is not printed.

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------
const unsigned long READ_INTERVAL_MS = 5000;  // one reading every 5 s (data contract)
const int SAMPLES = 16;                       // ADC samples averaged per reading

String deviceMac;            // 12 uppercase hex characters, e.g. A4CF123B9E01
unsigned long seq = 0;       // message counter (data contract field "seq")
unsigned long lastReadMs = 0;

// Reads the factory Wi-Fi station MAC from eFuse. Works before Wi-Fi starts.
String readDeviceMac() {
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  char buf[13];
  snprintf(buf, sizeof(buf), "%02X%02X%02X%02X%02X%02X",
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(buf);
}

// Average of several calibrated ADC readings, in millivolts at the pin.
uint32_t readPinMillivolts() {
  uint32_t total = 0;
  for (int i = 0; i < SAMPLES; i++) {
    total += analogReadMilliVolts(SENSOR_PIN);
    delay(2);
  }
  return total / SAMPLES;
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  analogReadResolution(12);         // raw values 0-4095
  analogSetAttenuation(ADC_11db);   // pin range up to about 3.1 V

  deviceMac = readDeviceMac();

  Serial.println();
  Serial.println("=== Gas Monitor - S1-05 sensor test ===");
  Serial.print("Device MAC (device_id): ");
  Serial.println(deviceMac);
  Serial.println("Note: let the sensor heater warm up as the datasheet specifies");
  Serial.println("      before trusting the readings.");
  Serial.println();
}

void loop() {
  unsigned long now = millis();
  if (now - lastReadMs < READ_INTERVAL_MS) {
    return;   // non-blocking: the loop stays free for the alarm in S2-03
  }
  lastReadMs = now;
  seq++;

  int raw = analogRead(SENSOR_PIN);
  float pinVolts = readPinMillivolts() / 1000.0;
  float vout = pinVolts * DIVIDER_RATIO;   // voltage across RL

  Serial.print("seq=");          Serial.print(seq);
  Serial.print("  raw_adc=");    Serial.print(raw);
  Serial.print("  vout=");       Serial.print(vout, 3);
  Serial.print(" V");

  if (vout > 0.01) {
    // Sensor resistance from the voltage divider formed by Rs and RL.
    float rs = RL_OHMS * (VC_VOLTS - vout) / vout;
    Serial.print("  rs=");       Serial.print(rs, 0);
    Serial.print(" ohm");
    if (RO_OHMS > 0) {
      Serial.print("  rs_ro=");  Serial.print(rs / RO_OHMS, 4);
    }
  } else {
    Serial.print("  (no signal - check wiring)");
  }
  Serial.println();
}
