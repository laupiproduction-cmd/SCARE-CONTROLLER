// Runs a Show: waits for a trigger, fires cues on time, cleans up at the end.
// Knows nothing about pins or libraries; it talks to the box through
// ShowHardware, so the same code runs on the ESP32 and in PC unit tests.
#pragma once

#include <cstdint>
#include <string>
#include <vector>

#include "show.h"

namespace scare {

class ShowHardware {
 public:
  virtual ~ShowHardware() = default;
  virtual void setOutput(uint8_t channel, uint8_t value) = 0;  // 1..8, 0..255
  virtual void setDmx(uint16_t channel, uint8_t value) = 0;    // 1..512, 0..255
  virtual void playAudio(const std::string& file, uint8_t volume) = 0;
  virtual void stopAudio() = 0;
  virtual void setShowRunning(bool running) = 0;  // "show running" LED
};

enum class EngineState : uint8_t { Idle, PreDelay, Running, Cooldown };

const char* toString(EngineState state);

class ShowEngine {
 public:
  explicit ShowEngine(ShowHardware& hw) : hw_(hw) {}

  // Loads a show and resets to Idle. Any running show is stopped first.
  void load(const Show& show, uint32_t nowMs);
  bool hasShow() const { return loaded_; }

  // Call when a trigger input fires. Returns true if the trigger started
  // the show, false if it was ignored (wrong input, busy or cooling down).
  bool trigger(uint8_t input, uint32_t nowMs);

  // Call as often as possible from the main loop. Uses unsigned time
  // differences, so the ~49-day millis() rollover is harmless.
  void update(uint32_t nowMs);

  // Emergency stop: everything off right now, then normal cooldown.
  void stop(uint32_t nowMs);

  EngineState state() const { return state_; }
  // Milliseconds since the show started (0 when not running).
  uint32_t elapsedMs(uint32_t nowMs) const;

 private:
  void startRunning(uint32_t startMs);
  void fireCue(const Cue& cue);
  void finish(uint32_t endMs);
  void allOff();

  ShowHardware& hw_;
  Show show_;
  bool loaded_ = false;
  EngineState state_ = EngineState::Idle;
  uint32_t phaseStartMs_ = 0;  // when the current state began
  size_t nextCue_ = 0;
  std::vector<uint16_t> touchedDmx_;  // DMX channels this show uses
};

}  // namespace scare
