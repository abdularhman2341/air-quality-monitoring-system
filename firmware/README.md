# Firmware

ESP32 firmware for the LPG Leak Detection MVP.
Owner: Abdulmalik Alaqeel (Hardware Developer).

## Current stage: S1-05

The sketch reads the TGS2610-D00 and prints the device MAC and each reading to the Serial Monitor every 5 seconds. Wi-Fi and MQTT come in S1-07, and the local alarm in S2-03.

## Hardware

| Part | Notes |
|---|---|
| ESP32 DevKit V1 | |
| Figaro TGS2610-D00 | LPG sensor |
| Load resistor RL | Value set in `RL_OHMS` |
| Voltage divider | Needed if the sensor circuit runs at 5 V |
| Buzzer, LED | Wired now, used in S2-03 |

### Wiring (proposed — update to the real wiring)

| Signal | ESP32 pin |
|---|---|
| Sensor output (after divider) | GPIO 34 |
| Buzzer | GPIO 25 |
| LED | GPIO 26 |

> **Warning:** ESP32 pins accept at most 3.3 V. If the sensor circuit runs at 5 V, the output across RL can exceed 3.3 V and damage the board. Put a voltage divider between RL and the ESP32 pin, and set `DIVIDER_RATIO` to match it.

> **Use an ADC1 pin (GPIO 32–39) for the sensor.** ADC2 pins stop working while Wi-Fi is on.

## Setup

1. Install the [Arduino IDE](https://www.arduino.cc/en/software).
2. Add the ESP32 board package: **Boards Manager** → search `esp32` by Espressif → **Install**.
3. Open `gas_monitor/gas_monitor.ino`.
4. Check the circuit values at the top of the file. They must match the resistors on the breadboard:

   | Constant | Current value | Meaning |
   |---|---|---|
   | `VC_VOLTS` | `5.0` | Circuit voltage on the 5V rail. Replace with the measured value if available. |
   | `RL_OHMS` | `6667` | RL (10k) in parallel with the divider (10k + 10k = 20k) |
   | `DIVIDER_RATIO` | `2.0` | (R1 + R2) / R2 = (10k + 10k) / 10k |

   If you change any resistor, recalculate `RL_OHMS` and `DIVIDER_RATIO`.
5. Select the board **ESP32 Dev Module** and the right port.
6. Click **Upload**.
7. Open **Tools → Serial Monitor** at **115200** baud.

## Expected output

Real reading in clean air, about 5 minutes after power-up:

```
=== Gas Monitor - S1-05 sensor test ===
Device MAC (device_id): XXXXXXXXXXXX
Note: let the sensor heater warm up before trusting the readings.
ppm values are uncalibrated estimates.

seq=63 raw_adc=695 pin=0.706 V vout=1.412 V rs=16941 ohm rs_ro=4.458 lpg_ppm_est=193
```

- `pin` should stay well below 3.3 V (maximum 2.5 V with the current divider).
- If `ADC near max` appears and the sensor stays cold, the heater and electrode pins are swapped.
- Values below 500 ppm are outside the sensor's optimal range (500–10,000 ppm) and mean "below detection".

Use the MAC as the test device in the backend seed: set `TEST_DEVICE_MAC` in `backend/.env`, then run `npm run db:seed`. The same MAC is used for the device's MQTT credentials.

## Next steps

- **S1-07:** Wi-Fi, NTP time sync, and publishing readings over MQTT. Copy `gas_monitor/config.example.h` to `gas_monitor/config.h` and fill in the real values. `config.h` is in `.gitignore` and must never be committed.
- **S1-08:** record the sensor resistance in clean air (`R_air`) after warm-up, and document the ppm conversion method. `RO_OHMS` (resistance at 1800 ppm) can only be measured with a known gas concentration, e.g. the static dilution test.
- **S2-03:** local alarm on the buzzer and LED, working without internet.
