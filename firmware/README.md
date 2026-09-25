# Firmware

ESP32-S3 controller firmware, built with PlatformIO. v1 scope: trigger inputs, MP3 audio from SD, DMX out, solid-state outputs, status LEDs. No Wi-Fi.

- `lib/ShowEngine/` – show parser and engine (hardware-free, unit-tested)
- `src/main.cpp` – board glue (pins, SD card, triggers, outputs)
- `include/pins.h` – pin map
- `test/test_show/` – unit tests

Run the tests on your PC with `pio test -e native`, build for the board with `pio run -e esp32s3`.

To try a show: copy `docs/examples/closet-scare.json` to the SD card root as `show.json`.
