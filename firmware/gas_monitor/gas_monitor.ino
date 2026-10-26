// gas_monitor.ino
// Sprint 1 - S1-05: read the TGS2610-D00 and print readings and the device MAC
// to the Serial Monitor. No Wi-Fi, MQTT, or alarm yet (S1-07 and S2-03).
//
// Board: ESP32 Dev Module    Serial Monitor: 115200 baud

#include <Arduino.h>
#include <esp_mac.h>

// ---------------------------------------------------------------------------
// Pins
// The sensor uses an ADC1 pin (GPIO 32-39): ADC2 pins stop working while
// Wi-Fi is on, and Wi-Fi is added in S1-07.
// ---------------------------------------------------------------------------
const int SENSOR_PIN = 34;   // divider midpoint (row 15 on the breadboard)
const int BUZZER_PIN = 25;   // active piezo buzzer, used in S2-03
const int LED_PIN    = 26;   // LED (with 220-330 ohm resistor), used in S2-03

// ---------------------------------------------------------------------------
// Sensor circuit (current breadboard: all resistors are 10k)
//   5V -> sensor pin 3 (+) -> sensor pin 2 (-) = Vout -> RL 10k -> GND
//   Vout -> R1 10k -> ADC pin -> R2 10k -> GND
// ---------------------------------------------------------------------------
const float VC_VOLTS      = 5.0;     // circuit voltage. Measure VIN later and update.
const float RL_OHMS       = 6667.0;  // 10k RL in parallel with the 20k divider
const float DIVIDER_RATIO = 2.0;     // Vout / Vpin = (10k + 10k) / 10k

// ---------------------------------------------------------------------------
// ppm estimate (NOT calibrated)
// Typical values from the Figaro TGS2610-D00 datasheet. Replace RO_OHMS and
// CURVE_B with measured values after the reference test (S1-08 / S3-05).
// ---------------------------------------------------------------------------
const float RO_OHMS = 3800.0;   // Rs at 1800 ppm iso-butane (datasheet range 1.2k-12k)
const float CURVE_B = -0.67;    // log-log slope (datasheet range about -0.46 to -0.91)
const float REF_PPM = 1800.0;   // Figaro reference concentration

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------
const unsigned long READ_INTERVAL_MS = 5000;  // one reading every 5 s (data contract)
const int SAMPLES = 16;                       // ADC samples averaged per reading

// Near the top of the ADC range: the pin is close to its maximum voltage.
// On first power-up this usually means the heater and the sensor electrodes
// are swapped (the circuit is measuring the ~59 ohm heater instead of Rs).
const int ADC_NEAR_MAX = 4000;

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

// Average of several raw ADC readings (0-4095).
int readRawAverage() {
  long total = 0;
  for (int i = 0; i < SAMPLES; i++) {
    total += analogRead(SENSOR_PIN);
    delay(2);
  }
  return total / SAMPLES;
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

// Converts sensor resistance to an estimated iso-butane-equivalent ppm.
float estimatePpm(float rs) {
  float ratio = rs / RO_OHMS;
  return REF_PPM * pow(ratio, 1.0 / CURVE_B);
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
  Serial.println("Note: let the sensor heater warm up before trusting the readings.");
  Serial.println("      ppm values are uncalibrated estimates.");
  Serial.println();
}

void loop() {
  unsigned long now = millis();
  if (now - lastReadMs < READ_INTERVAL_MS) {
    return;   // non-blocking: the loop stays free for the alarm in S2-03
  }
  lastReadMs = now;
  seq++;

  int raw = readRawAverage();
  float pinVolts = readPinMillivolts() / 1000.0;
  float vout = pinVolts * DIVIDER_RATIO;   // voltage across RL

  Serial.print("seq=");          Serial.print(seq);
  Serial.print("  raw_adc=");    Serial.print(raw);
  Serial.print("  pin=");        Serial.print(pinVolts, 3);
  Serial.print(" V  vout=");     Serial.print(vout, 3);
  Serial.print(" V");

  if (vout > 0.01 && vout < VC_VOLTS) {
    // Sensor resistance from the voltage divider formed by Rs and RL.
    float rs = RL_OHMS * (VC_VOLTS - vout) / vout;
    Serial.print("  rs=");       Serial.print(rs, 0);
    Serial.print(" ohm  rs_ro="); Serial.print(rs / RO_OHMS, 3);
    Serial.print("  lpg_ppm_est="); Serial.print(estimatePpm(rs), 0);
  } else {
    Serial.print("  (no signal - check wiring)");
  }

  if (raw >= ADC_NEAR_MAX) {
    Serial.print("  <-- ADC near max: check heater/electrode pins");
  }
  Serial.println();
}
