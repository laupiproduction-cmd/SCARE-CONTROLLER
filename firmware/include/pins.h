// Pin map for the breadboard prototype on an ESP32-S3-DevKitC-1 (N8R8).
// Avoided: GPIO 0/3/45/46 (strapping), 19/20 (USB), 26-37 (flash/PSRAM).
// Keep CLAUDE.md in sync when this changes.
#pragma once

#include <cstdint>

namespace pins {

// Solid-state outputs 1-4 -> D4184 MOSFET modules (PWM capable)
constexpr uint8_t kOutputs[] = {4, 5, 6, 7};

// Status LEDs, one per output (330 ohm resistor to GND)
constexpr uint8_t kOutputLeds[] = {15, 16, 18, 47};
constexpr uint8_t kShowRunningLed = 21;

// Trigger inputs 1-2: button to GND (internal pull-up) / radar OUT (active high)
constexpr uint8_t kTriggerButton = 1;  // input 1
constexpr uint8_t kTriggerRadar = 2;   // input 2 (LD2410C OUT pin)

// microSD card (SPI)
constexpr uint8_t kSdCs = 10;
constexpr uint8_t kSdMosi = 11;
constexpr uint8_t kSdSck = 12;
constexpr uint8_t kSdMiso = 13;

// MAX98357A I2S amp
constexpr uint8_t kI2sBclk = 39;
constexpr uint8_t kI2sLrc = 40;
constexpr uint8_t kI2sDout = 41;

// DMX via 3.3 V RS-485 module (MAX3485 / SP3485)
constexpr uint8_t kDmxTx = 17;
constexpr uint8_t kDmxEnable = 42;  // DE + RE tied together, high = transmit

}  // namespace pins
