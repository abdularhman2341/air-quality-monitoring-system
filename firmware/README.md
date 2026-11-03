# Firmware

ESP32 firmware for the LPG Leak Detection MVP.
Owner: Abdulmalik Alaqeel (Hardware Developer).

## What it does

| Task | Feature |
|---|---|
| S1-05 | Reads the Figaro TGS2610-D00 every 5 s and estimates LPG ppm (uncalibrated) |
| S1-07 | Wi-Fi setup page, NTP time sync, readings published over MQTT with TLS (QoS 1), online status and Last Will |
| S2-03 | Local alarm on the buzzer and LED, decided on the device, so it works without internet |
| Status LEDs | Green Power LED (hardware) and green Wi-Fi LED showing the connection state |

How a reading becomes a ppm value: [`docs/ppm-conversion.md`](docs/ppm-conversion.md).

## Hardware

| Part | Notes |
|---|---|
| ESP32 Dev Module (CP2102 USB) | Powered from USB |
| Figaro TGS2610-D00 | LPG sensor, heater and circuit on 5 V |
| RL, R1, R2 | 10 kΩ each |
| 100 nF capacitor | Across R2 (ADC pin to GND), reduces noise |
| 100 µF capacitor | Across the 5 V and GND rails |
| Buzzer SFM-27 | Active piezo, 3–24 V, no transistor needed |
| Red LED + 330 Ω | Alarm LED on GPIO 26 |
| Green LED + 220 Ω | Power LED, wired to 3V3 (no code) |
| Green LED + 220 Ω | Wi-Fi LED on GPIO 27 |

### Wiring

```
Sensor heater:   pin 1 -> 5V      pin 4 -> GND      (no polarity)
Sensor circuit:  5V -> pin 3 (+) -> pin 2 (-) = Vout -> RL -> GND
Divider:         Vout -> R1 -> GPIO 34 -> R2 -> GND
Buzzer:          red -> GPIO 25        black -> GND
Alarm LED (red): GPIO 26 -> 330 ohm -> long leg      short leg -> GND
Power LED:       3V3 -> 220 ohm -> long leg           short leg -> GND
Wi-Fi LED:       GPIO 27 -> 220 ohm -> long leg       short leg -> GND
ESP32 power:     5V (VIN) -> 5V rail   GND -> GND rail
```

| Signal | ESP32 pin |
|---|---|
| Sensor (divider midpoint) | GPIO 34 |
| Buzzer | GPIO 25 |
| Alarm LED | GPIO 26 |
| Wi-Fi LED | GPIO 27 |
| Power LED | 3V3 (not a GPIO) |
| BOOT button (on the board) | GPIO 0 |

> **Warning:** ESP32 pins accept at most 3.3 V. The sensor output can approach 5 V, so the R1/R2 divider halves it (maximum 2.5 V at the pin). Never connect the sensor output to the ESP32 directly.

> **Use an ADC1 pin (GPIO 32–39) for the sensor.** ADC2 pins stop working while Wi-Fi is on.

> **The 3V3 wire for the Power LED goes to its own breadboard row, never to the red rail.** The red rail carries 5 V; joining 3V3 to 5V can damage the board's voltage regulator.

> **Do not connect the CMD, SD0–SD3, or CLK pins.** They are used by the board's flash memory.

> **Unplug USB before changing any wiring.**

## Setup

1. Install the [Arduino IDE](https://www.arduino.cc/en/software).
2. Add the ESP32 board package: **Boards Manager** → search `esp32` by Espressif → **Install**.
3. Install the libraries (Library Manager, or **Sketch → Include Library → Add .ZIP Library** from GitHub):

   | Library | Author | Link |
   |---|---|---|
   | espMqttClient | Bert Melis | https://github.com/bertmelis/espMqttClient |
   | AsyncTCP | ESP32Async | https://github.com/ESP32Async/AsyncTCP |
   | WiFiManager | tzapu | https://github.com/tzapu/WiFiManager |

   AsyncTCP is not used by the sketch, but espMqttClient needs it to compile.
   Do **not** install `EspMQTTClient` (plapointe6): Windows does not tell the two names apart, and the wrong one is picked.

4. Copy `gas_monitor/config.example.h` to `gas_monitor/config.h` and fill in the real values (see below).
5. Check the circuit values at the top of `gas_monitor.ino`. They must match the breadboard:

   | Constant | Current value | Meaning |
   |---|---|---|
   | `VC_VOLTS` | `5.0` | Circuit voltage on the 5 V rail. Replace with the measured value if available. |
   | `RL_OHMS` | `6667` | RL (10k) in parallel with the divider (10k + 10k = 20k) |
   | `DIVIDER_RATIO` | `2.0` | (R1 + R2) / R2 = (10k + 10k) / 10k |

   If you change any resistor, recalculate `RL_OHMS` and `DIVIDER_RATIO`.
6. Select the board **ESP32 Dev Module** and the right port.
7. Click **Upload**.
8. Open **Tools → Serial Monitor** at **115200** baud.

The sketch folder must be named `gas_monitor` and contain only `gas_monitor.ino` and `config.h`.

### config.h

| Setting | Value | Source |
|---|---|---|
| `PORTAL_PASSWORD` | Password of the Wi-Fi setup network, at least 8 characters | Choose one |
| `MQTT_HOST`, `MQTT_PORT` | Broker address and port | Railway TCP proxy (the port is often not 8883) |
| `MQTT_USERNAME` | `aqms-` + the device MAC | Serial Monitor |
| `MQTT_PASSWORD` | The device's broker password | Broker admin |
| `MQTT_CA_CERT` | Full content of `ca.crt` | Broker admin |
| `PAIRING_CODE` | Code entered on the Add Sensor screen | Choose one per device |

`config.h` holds real passwords. It is in `.gitignore` and must **never** be committed. Send broker credentials privately, not through GitHub.

## First start: connect to Wi-Fi

The home Wi-Fi is not in the code. It is entered from a phone:

1. Power the device. With no saved Wi-Fi, it opens its own network: `AQMS-Setup-XXXX` (last 4 characters of the MAC).
2. On a phone, join that network with `PORTAL_PASSWORD`.
3. The setup page opens. If not, browse to `http://192.168.4.1`.
4. Tap **Configure WiFi**, choose the home Wi-Fi (**2.4 GHz only**), enter its password, and **Save**.

The Wi-Fi stays saved after power loss. If the saved Wi-Fi is not available, the device keeps retrying every 30 s. The sensor and the alarm keep working meanwhile.

## BOOT button

| Action | Result |
|---|---|
| Short press | Alarm self-test: buzzer and LED on for 2 s. Nothing is sent. |
| Hold 3 s | Forget the saved Wi-Fi and restart into the setup page |

## Local alarm

| Level | Condition | LED | Buzzer |
|---|---|---|---|
| Normal | below 1000 ppm | off | off |
| Warning | ≥ 1000 ppm | on | intermittent (0.5 s on / 0.5 s off) |
| Danger | ≥ 1500 ppm | on | continuous |
| Back to normal | below 800 ppm | off | off |

- The alarm is decided on the device, so it works without Wi-Fi or internet.
- 800 ppm is the turn-off level (hysteresis), so the alarm does not flicker when the reading hovers around 1000.
- The alarm is disabled for the first **2 minutes** after power-up, while the sensor warms up.
- The thresholds are `ALARM_ON_PPM`, `ALARM_DANGER_PPM`, and `ALARM_OFF_PPM` in `gas_monitor.ino`. They must match the dashboard.
- ppm values are uncalibrated estimates. See [`docs/ppm-conversion.md`](docs/ppm-conversion.md).

## Status LEDs

**Power LED:** on whenever the board has power. It is wired directly to 3V3, so it stays on even if the code stops.

**Wi-Fi LED:**

| LED | Meaning |
|---|---|
| On | Wi-Fi and broker connected: readings are being sent |
| Slow blink (1 s) | Wi-Fi connected, but the broker is not (or the clock is not synced yet) |
| Fast blink | Wi-Fi setup page `AQMS-Setup-XXXX` is open and waiting |
| Off | No Wi-Fi |

The blink can pause for 2–3 s while the device connects to the broker (TLS handshake). The local alarm is not affected.

## MQTT messages

| Topic | QoS | Retained | Sent when |
|---|---|---|---|
| `aqms/devices/{mac}/readings` | 1 | No | Every 5 s, once the clock is synced and the broker is connected |
| `aqms/devices/{mac}/alarms` | 1 | No | Alarm turns on or off. An event that happens offline is sent after reconnecting (latest event only). |
| `aqms/devices/{mac}/status` | 1 | Yes | `online` on connect. The broker publishes `offline` (Last Will) about 45 s after the device drops. |

Payloads follow `docs/04-api-specifications.md`. The Last Will payload has no `ts`, so the backend uses its own receive time.

Readings are not stored on the device while offline. `seq` keeps counting, so gaps in `seq` show how many readings were lost.

## Expected output

```
=== Gas Monitor - S1-07 Wi-Fi + MQTT ===
Device MAC (device_id): XXXXXXXXXXXX
...
[wifi] connected to "home-wifi", IP 192.168.1.23
[ntp] clock synced: 2026-11-02T17:00:00Z
[mqtt] connecting to xxx.proxy.rlwy.net:PORT as aqms-XXXXXXXXXXXX...
[mqtt] connected to broker
[mqtt] status online -> queued (packet 1)
[mqtt] PUBACK packet 1
seq=329  raw_adc=296  pin=0.380 V  vout=0.760 V  rs=37195 ohm  rs_ro=9.788  lpg_ppm_est=60  -> published (packet 326)
[mqtt] PUBACK packet 326
```

- In clean air the reading settles after about 20–30 minutes. With the current sensor, `rs` is about 37 kΩ.
- Values below 500 ppm are outside the sensor's optimal range (500–10,000 ppm) and mean "no LPG detected".
- `[warm-up]` on a reading line means the alarm is not active yet.
- If `ADC near max` appears and the sensor stays cold, the heater and electrode pins are swapped.
- `PUBACK` confirms that the broker received the message, not that the backend stored it.

## Register the device in the backend

The backend rejects readings from devices that are not in the `devices` table.

- **Local database:** set `TEST_DEVICE_MAC` in `backend/.env`, then run `npm run db:seed`.
- **Railway:** ask the backend owner. Never run the development seed against production.

The same MAC is used for the broker username (`aqms-<MAC>`).

## Tests

| Test | Steps | Expected |
|---|---|---|
| Self-test | Short press on BOOT | Buzzer and LED on for 2 s |
| Gas response | After warm-up, an **unlit** lighter about 10 cm from the sensor for 1–2 s | `[alarm] ON`, `alarm_on` published; `[alarm] OFF` below 800 ppm |
| Offline alarm | Connect through a phone hotspot, turn the hotspot off, repeat the gas test | Buzzer works; `alarm_on` is sent after turning the hotspot back on |
| Last Will | Unplug USB | Status becomes `offline` after about 45 s |
| Wi-Fi reset | Hold BOOT for 3 s | Setup page opens again; Wi-Fi LED blinks fast |
| Power LED | Plug in USB | Power LED on immediately |
| Wi-Fi LED: connected | Wait for `[mqtt] connected to broker` | Wi-Fi LED steady on |
| Wi-Fi LED: no broker | Wrong `MQTT_PASSWORD` in `config.h` | Wi-Fi LED blinks slowly |
| Wi-Fi LED: no Wi-Fi | Turn the hotspot or router off | Wi-Fi LED off |

> **Gas tests:** only with supervisor approval, in a ventilated area, with no flames or sparks nearby.

## Known limits

- ppm values are not calibrated (`RO_OHMS` and `CURVE_B` are typical datasheet values).
- Wi-Fi and broker passwords are stored unencrypted in the ESP32 flash. Acceptable for the MVP; a product would enable flash encryption.
- Readings taken while offline are not sent later. Alarm events are (latest event only).
- While connecting to the broker (TLS handshake), the warning beep rhythm can pause for a few seconds. The alarm itself stays on.

