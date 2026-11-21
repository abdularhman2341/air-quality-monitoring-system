# From sensor reading to ppm (S1-08)

How the firmware turns the TGS2610-D00 signal into an estimated LPG concentration,
which values it relies on, and how accurate the result is.

> **Summary:** the sensor is a resistor whose value drops when LPG is present.
> The ESP32 measures a voltage, the firmware calculates the sensor resistance `Rs`
> with Ohm's law, then converts `Rs` to ppm using the curve from the Figaro datasheet.
> **The ppm value is an uncalibrated estimate.**

## 1. The circuit

```
5V ── sensor pin 3 (+) ── sensor pin 2 (−) ── row 10 (Vout) ── RL 10k ── GND
                                                   │
                                                  R1 10k
                                                   │
                                          row 15 (Vpin) ── GPIO 34
                                                   │
                                                  R2 10k
                                                   │
                                                  GND
```

The heater (pins 1 and 4) is powered separately from the 5V rail and is not part of the measurement.

| Part | Role |
|---|---|
| `Rs` | Resistance of the sensing layer (tin dioxide) inside the sensor, between pins 2 and 3. Lower `Rs` means more gas. |
| `RL` | Load resistor. Forms a voltage divider with `Rs`, so a change in `Rs` becomes a change in voltage. |
| `R1`, `R2` | Divide `Vout` by 2, so the ESP32 pin never exceeds 2.5 V (the pin is rated for 3.3 V maximum). |

## 2. The calculation, step by step

### Step 1 — voltage at the pin
The firmware averages 16 readings with `analogReadMilliVolts()`, which uses the ESP32's
factory ADC calibration.

```
Vpin = measured millivolts / 1000
```

### Step 2 — voltage across RL
`R1` and `R2` are equal, so the pin sees half of `Vout`:

```
DIVIDER_RATIO = (R1 + R2) / R2 = (10k + 10k) / 10k = 2.0
Vout = Vpin × DIVIDER_RATIO
```

### Step 3 — effective load resistance
`R1 + R2` (20k) also connect row 10 to GND, in parallel with `RL`.
The resistance below the sensor is therefore:

```
RL_OHMS = (RL × (R1 + R2)) / (RL + R1 + R2) = (10k × 20k) / 30k = 6667 Ω
```

### Step 4 — sensor resistance (Ohm's law)
The sensor and the load are in series, so the same current flows through both.

```
Current through the load:   I  = Vout / RL_OHMS
Voltage across the sensor:  VC − Vout
Sensor resistance:          Rs = (VC − Vout) / I
                               = RL_OHMS × (VC − Vout) / Vout
```

In the code:
```cpp
float rs = RL_OHMS * (VC_VOLTS - vout) / vout;
```

The calculation only runs when `0.01 V < Vout < VC`. Outside that range the result would be
a division by zero or a negative resistance, so the firmware prints
`(no signal - check wiring)` instead.

### Step 5 — resistance ratio
Figaro describes the sensor relative to `Ro`, the resistance at **1800 ppm iso-butane**:

```
ratio = Rs / Ro
```

### Step 6 — ppm estimate
On a log-log scale the datasheet curve is close to a straight line:

```
Rs / Ro = (ppm / 1800) ^ b
```

Solving for ppm:

```
ppm = 1800 × (Rs / Ro) ^ (1 / b)
```

In the code:
```cpp
return REF_PPM * pow(ratio, 1.0 / CURVE_B);
```

## 3. Constants

| Constant | Value | Source |
|---|---|---|
| `VC_VOLTS` | 5.0 | Nominal 5V rail. Should be replaced by the measured voltage. |
| `RL_OHMS` | 6667 | 10k in parallel with 20k (step 3) |
| `DIVIDER_RATIO` | 2.0 | Step 2 |
| `RO_OHMS` | 3800 | **Typical value**, not measured. Datasheet range: 1.2k–12k. |
| `CURVE_B` | −0.67 | **Typical value**, not measured. Datasheet: Rs(3000 ppm) / Rs(1000 ppm) = 0.37–0.60, which gives b between about −0.46 and −0.91. |
| `REF_PPM` | 1800 | Figaro reference concentration |

The slope comes from two points on the curve:

```
b = log(Rs at 3000 ppm / Rs at 1000 ppm) / log(3000 / 1000)
```

## 4. Worked examples

**Real reading, clean air, about 5 minutes after power-up:**

| Step | Calculation | Result |
|---|---|---|
| Pin voltage | measured | 0.706 V |
| Vout | 0.706 × 2.0 | 1.412 V |
| Rs | 6667 × (5.0 − 1.412) / 1.412 | 16,941 Ω |
| Rs / Ro | 16,941 / 3800 | 4.458 |
| ppm | 1800 × 4.458 ^ (1 / −0.67) | **193** |

Serial Monitor output:
```
seq=63  raw_adc=695  pin=0.706 V  vout=1.412 V  rs=16941 ohm  rs_ro=4.458  lpg_ppm_est=193
```

193 ppm is below the sensor's optimal range (500–10,000 ppm), so it means
**"no LPG detected"**, not "193 ppm of LPG in the room".

**Expected reading at 1800 ppm** (if the sensor matched the typical values exactly):

| Step | Result |
|---|---|
| Rs | 3800 Ω (= Ro) |
| Vout | 5.0 × 6667 / (3800 + 6667) = 3.185 V |
| Pin voltage | 1.592 V |
| ppm | 1800 |

## 5. Limits of the estimate

- **Sensor-to-sensor variation.** The datasheet allows `Ro` from 1.2k to 12k. With typical values,
  the estimate for a given sensor can be off by a large factor. Only a reference test fixes this.
- **Range.** The curve is only meaningful between about 500 and 10,000 ppm.
  Below 500 ppm the firmware's number should be read as "below detection".
- **Gas mix.** The curve is for iso-butane. LPG is a mix of propane and butane,
  so the result is an iso-butane-equivalent value.
- **Temperature and humidity.** `Rs` changes with both. The firmware does not compensate for them.
- **Warm-up.** Readings drift until the heater is stable. Ignore readings from the first minutes
  after power-up. A sensor that was stored unpowered for a long time needs a longer warm-up.
- **Supply voltage.** `VC_VOLTS` is assumed to be exactly 5.0 V. USB supplies are often 4.7–5.1 V,
  which shifts `Rs` by a few percent.

For these reasons the alarm threshold is set with a safety margin, and the dashboard labels the
value as an estimate.

## 6. Improving the values

### Clean-air resistance (`R_air`)
After warm-up in clean, ventilated air, record `rs` for several minutes and note the average.
This is **not** `Ro`. It is useful for detecting a faulty or disconnected sensor and for
checking that the sensor is stable over time.

Current value: about 16,900 Ω (about 5 minutes after power-up, one sensor).

### Reference test (`Ro` and `b`)
Measured with a known concentration, using static dilution in a closed container:

| Container | Butane injected | Concentration |
|---|---|---|
| 10 L | 10 mL | 1000 ppm |
| 10 L | 18 mL | 1800 ppm |
| 10 L | 30 mL | 3000 ppm |

1. Warm the sensor up inside the container in clean air.
2. Inject the gas with a syringe, wait for the reading to settle, and record `rs`.
3. Air the container out completely between concentrations.
4. Set `RO_OHMS` to `rs` at 1800 ppm.
5. Set `CURVE_B` with the formula in section 3, using `rs` at 1000 and 3000 ppm.

**Safety:** only with supervisor approval, in a ventilated area, with no flames or sparks nearby,
and with small quantities only. The concentrations above are far below butane's lower explosive
limit (about 18,000 ppm), but the gas source (a lighter refill can) is not.

Lighter gas is usually a mix of butane, iso-butane and propane, so even this test gives an
approximate calibration, not a certified one.
