# Scare Controller

A standalone controller for haunted-house props and scares, meant to compete with the BooBox Flex at a much lower price. A trigger (button, radar, pressure mat) starts a timed show: MP3 audio from the SD card, solid-state outputs for lamps/valves/motors, and DMX. Shows are designed in a desktop editor and copied to the SD card (later also sent over USB).

**v1 has no Wi-Fi or Bluetooth.** That's deliberate: it keeps the product out of the EU Radio Equipment Directive and makes CE certification much cheaper. Do not enable or add radio features unless asked.

## Repo layout
- `firmware/` – ESP32-S3 firmware, PlatformIO + Arduino framework
  - `lib/ShowEngine/` – show model, JSON parser and engine. **Plain C++17, no Arduino includes**, so it also builds on the PC for tests. Hardware access goes only through the `ShowHardware` interface.
  - `src/main.cpp` – board glue: pins, SD loading, triggers, `BoardHardware`
  - `include/pins.h` – pin map (single source of truth)
  - `test/test_show/` – Unity tests for parser + engine
- `editor/` – show editor, Vite + React + TypeScript (runs in the browser now; Tauri wrapper later)
  - `src/show/` – model, import/export, validation (must match the firmware parser rules), preview state; unit-tested with Vitest
  - `src/state.ts` – editor state + undo/redo; `src/components/` – timeline, sidebar, inspector
- `docs/show-format.md` – the show.json spec. Firmware and editor both follow it; change the spec first, then the code.

## Commands
Editor (inside `editor/`): `npm install`, `npm run dev`, `npm test`, `npm run build`.

Firmware (inside `firmware/`):
- `pio test -e native` – run unit tests on the PC (needs a host C++ compiler)
- `pio run -e esp32s3` – build firmware
- `pio run -e esp32s3 -t upload` then `pio device monitor` – flash and watch the serial log

## Hardware (breadboard prototype)
- ESP32-S3-DevKitC-1-N8R8 (8 MB flash, 8 MB octal PSRAM)
- 4× D4184 MOSFET modules for outputs (12 V loads, PWM dimming). No flyback diode on board: add a 1N4007 across inductive loads (valves, motors).
- MAX98357A I2S amp + 4 Ω speaker
- microSD breakout (SPI)
- 3.3 V RS-485 module (MAX3485/SP3485) + XLR jack for DMX
- LD2410C mmWave radar (OUT pin used as trigger input 2)
- Status LED per output + "show running" LED
- 12 V supply; ESP32 GND must be tied to the 12 V GND.

## Pin map (see `firmware/include/pins.h`)
| Function | GPIO |
|---|---|
| Outputs 1–4 (MOSFET, PWM) | 4, 5, 6, 7 |
| Output status LEDs 1–4 | 15, 16, 18, 47 |
| Show running LED | 21 |
| Trigger 1 – button to GND (pull-up) | 1 |
| Trigger 2 – radar OUT (active high) | 2 |
| SD CS / MOSI / SCK / MISO | 10 / 11 / 12 / 13 |
| I2S BCLK / LRC / DOUT | 39 / 40 / 41 |
| DMX TX / driver enable | 17 / 42 |

Avoid GPIO 0, 3, 45, 46 (strapping), 19/20 (USB) and 26–37 (flash/PSRAM on N8R8).

## Status
- Done: show format v1, parser with validation, engine (pre-delay, cues, cooldown, emergency stop, millis rollover), 20 unit tests, main loop with SD loading, triggers, PWM outputs and status LEDs.
- Stubbed in `main.cpp` (log to serial only): audio playback and DMX output.
- `main.cpp` has not been compiled or run on real hardware yet.
- Editor v0.1: timeline with audio/output/DMX tracks, click-to-add and drag cues, inspector, trigger settings, preview playback with loaded MP3s and virtual LEDs, undo/redo, open/save show.json, live validation. 11 Vitest tests.

## Next milestones
1. Flash the board and confirm triggers, outputs and LEDs with the example show.
2. Audio: play MP3 from SD through the MAX98357A (ESP32-audioI2S library).
3. DMX: send the universe continuously via the RS-485 module (esp_dmx library).
4. Editor: wrap in Tauri (native open/save dialogs, remember last folder), then USB "send to box" once the firmware can receive shows.

## Conventions
- Engine code stays hardware-free and gets a unit test for every behaviour change.
- Any change to the show format touches three places: `docs/show-format.md`, the firmware parser, and `editor/src/show/io.ts` (plus tests on both sides).
- Times are `uint32_t` milliseconds; compare with unsigned subtraction (`now - start >= x`) so millis() rollover is safe.
- Keep this file, `pins.h` and `docs/show-format.md` in sync with the code.
- One milestone per session; run the tests before committing.
