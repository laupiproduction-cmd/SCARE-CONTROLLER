# Scare Controller

A standalone haunt/prop scare controller: triggers, MP3 audio from SD card, DMX output, solid-state outputs for lamps/valves/motors, and status LEDs. Shows are designed in a desktop editor and copied to the SD card (or sent over USB).

## Structure
- `firmware/` – ESP32-S3 controller firmware (PlatformIO)
- `editor/` – desktop show editor (Tauri + React)
- `docs/` – show-format spec and design notes
