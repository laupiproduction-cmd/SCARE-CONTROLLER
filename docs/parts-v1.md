# Parts list – test controller v1 (breadboard prototype)

Matches the pin map in `firmware/include/pins.h`: 4 outputs, 4 output LEDs + "show running" LED, 2 trigger inputs, SD card, I2S audio and DMX. Prices are rough estimates for Germany (2026) and vary by shop.

## Electronics

| ✓ | Part | Qty | ~€ | Notes |
|---|---|---|---|---|
| ☐ | ESP32-S3-DevKitC-1-**N8R8** | 2 | 30 | One spare. [BerryBase](https://www.berrybase.de/espressif-esp32-s3-devkitc-1-n8r8-development-kit-8mb-psram-8mb-flash). N16R8 also works. |
| ☐ | MAX98357A I2S amp module | 2 | 12 | One spare. [AZ-Delivery](https://www.az-delivery.de/products/i2s-3w-class-d-amplifier-breakout-max98357a) |
| ☐ | Speaker 4 Ω, 3 W | 1 | 4 | Any small 4 Ω speaker. |
| ☐ | microSD card module (SPI) | 1 | 3 | Search "micro SD card module SPI". Most run on 5 V: power it from the ESP32's 5V pin. |
| ☐ | microSD card, 8–32 GB | 1 | 5 | Format as FAT32. |
| ☐ | D4184 MOSFET module | 5 | 12 | 4 outputs + 1 spare. [vipitec](https://www.vipitec.de/produkt/mosfet-treibermodul-d4184-5-36-v-15-a-400-w-0-20-khz-pwm-40-85-c_06-0007-00001). Needs at least ~6 V on the load side (12 V is fine). |
| ☐ | RS-485 module, 3.3 V (MAX3485 or SP3485) | 2 | 5 | For DMX. Pick one with separate **DI, DE, RE, RO** pins (not the "auto direction" type). Avoid 5 V MAX485 modules. |
| ☐ | XLR panel jack, 3-pin female | 1 | 3 | DMX out. |
| ☐ | LD2410**C** radar sensor | 1 | 5 | [Paradisetronic](https://paradisetronic.com/products/ld2410c-24ghz-human-presence-sensor-mmwave-radar-erkennt-bewegung-anwesenheit-bis-5m-reichweite-uart-gpio-ble). The C version has normal 2.54 mm pins; the plain LD2410 has tiny 1.27 mm pins. |
| ☐ | Push button (arcade button is nice) | 1–2 | 4 | Trigger input 1. |
| ☐ | 5 mm LEDs: 4× yellow/amber, 1× red | 5+ | 2 | Output status + "show running". An assortment is cheaper. |
| ☐ | Resistors 330 Ω | 5+ | 1 | One per LED. An assortment kit is handy. |
| ☐ | Diodes 1N4007 | 10 | 2 | Flyback diodes for valves and motors. |

## Power

| ✓ | Part | Qty | ~€ | Notes |
|---|---|---|---|---|
| ☐ | 12 V power supply, 3 A, barrel plug | 1 | 12 | Powers the outputs and test loads. |
| ☐ | DC barrel jack to screw terminal (female) | 2 | 3 | Connects the supply to the breadboard. |
| ☐ | Buck converter 12 V → 5 V (LM2596 or MP1584 module) | 1 | 3 | For running without the USB cable later. While testing, power the ESP32 from USB only; never connect both at once. |

## Prototyping

| ✓ | Part | Qty | ~€ | Notes |
|---|---|---|---|---|
| ☐ | Breadboard, 830 points | 2 | 8 | The ESP32-S3 board is wide: put it across two boards. |
| ☐ | Jumper wires (male-male, male-female) | 1 set | 7 | |
| ☐ | Hook-up wire, 22 AWG | 1 set | 8 | For the 12 V side. |
| ☐ | Wago clamps or screw terminals | 1 set | 5 | Safer 12 V connections than breadboard rows. |
| ☐ | USB-C cable (data, not charge-only) | 1 | 5 | To flash the board. |

## Test loads

| ✓ | Part | Qty | ~€ | Notes |
|---|---|---|---|---|
| ☐ | 12 V LED strip, ~1 m | 1 | 5 | Stand-in for lamps; shows dimming. |
| ☐ | DMX light (small DMX PAR) | 1 | 30 | Optional until the DMX milestone. |
| ☐ | 12 V solenoid valve or motor | 1 | 10 | Optional; needs a 1N4007 across it. |

## Tools (if you don't have them)

Soldering iron + solder (several modules come with loose pin headers), multimeter, wire stripper, side cutter. Roughly €40–60 for a basic set.

## Totals

- Electronics + power + prototyping + LED strip: **about €135** (includes spares)
- Optional DMX light and valve: about €40 more
- Tools: €40–60 if needed

## Not needed for v1

Wi-Fi antennas, servos, WS2812 addressable LEDs, larger amplifiers. The v1 firmware doesn't use them.

## Wiring reminders

- ESP32 GND must be connected to the 12 V supply's GND, or the outputs won't switch.
- Put a 1N4007 across every valve or motor (stripe towards +12 V).
- Never put 12 V on an ESP32 pin. Only the MOSFET modules' load side sees 12 V.
