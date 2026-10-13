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
4. Set the circuit values at the top of the file: `VC_VOLTS`, `RL_OHMS`, `DIVIDER_RATIO`.
5. Select the board **ESP32 Dev Module** and the right port.
6. Click **Upload**.
7. Open **Tools → Serial Monitor** at **115200** baud.

## Expected output

```
=== Gas Monitor - S1-05 sensor test ===
Device MAC (device_id): A4CF123B9E01

seq=1  raw_adc=1834  vout=2.956 V  rs=6914 ohm
seq=2  raw_adc=1829  vout=2.948 V  rs=6961 ohm
```

Copy the MAC into the database seed (`database/seeds/001_dev_seed.sql`) and the broker credentials.

## Next steps

- **S1-07:** Wi-Fi, NTP time sync, and publishing readings over MQTT. Copy `gas_monitor/config.example.h` to `gas_monitor/config.h` and fill in the real values. `config.h` is in `.gitignore` and must never be committed.
- **S1-08:** measure `RO_OHMS` in clean air and document the ppm conversion method.
- **S2-03:** local alarm on the buzzer and LED, working without internet.
