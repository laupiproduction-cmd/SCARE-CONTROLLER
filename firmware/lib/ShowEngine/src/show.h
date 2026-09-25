// Show data model. Plain C++ with no Arduino dependency, so it builds on the
// ESP32 and on a PC (for unit tests). See docs/show-format.md.
#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace scare {

constexpr uint8_t kMaxOutputs = 8;
constexpr uint8_t kMaxTriggerInputs = 4;
constexpr uint16_t kMaxDmxChannel = 512;
constexpr uint32_t kMaxDurationMs = 3600000;  // one hour

enum class CueType : uint8_t {
  Output,     // target = output channel (1..8), value = level 0..255
  Dmx,        // target = DMX channel (1..512), value = 0..255
  AudioPlay,  // file = MP3 on the SD card, value = volume 0..100
  AudioStop,
};

struct Cue {
  uint32_t atMs = 0;
  CueType type = CueType::Output;
  uint16_t target = 0;
  uint8_t value = 0;
  std::string file;
};

struct Show {
  std::string name;
  uint32_t durationMs = 0;
  uint32_t preDelayMs = 0;
  uint32_t cooldownMs = 0;
  std::vector<uint8_t> triggerInputs;
  // All cues from all tracks, sorted by time (stable, so file order is kept
  // for cues at the same time).
  std::vector<Cue> cues;

  bool acceptsInput(uint8_t input) const {
    for (uint8_t i : triggerInputs) {
      if (i == input) return true;
    }
    return false;
  }
};

}  // namespace scare
