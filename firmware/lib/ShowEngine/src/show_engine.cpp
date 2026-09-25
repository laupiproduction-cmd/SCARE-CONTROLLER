#include "show_engine.h"

#include <algorithm>

namespace scare {

const char* toString(EngineState state) {
  switch (state) {
    case EngineState::Idle: return "idle";
    case EngineState::PreDelay: return "pre-delay";
    case EngineState::Running: return "running";
    case EngineState::Cooldown: return "cooldown";
  }
  return "?";
}

void ShowEngine::load(const Show& show, uint32_t nowMs) {
  if (state_ == EngineState::PreDelay || state_ == EngineState::Running) {
    allOff();
  }
  show_ = show;
  loaded_ = true;
  state_ = EngineState::Idle;
  phaseStartMs_ = nowMs;
  nextCue_ = 0;

  touchedDmx_.clear();
  for (const Cue& c : show_.cues) {
    if (c.type == CueType::Dmx &&
        std::find(touchedDmx_.begin(), touchedDmx_.end(), c.target) == touchedDmx_.end()) {
      touchedDmx_.push_back(c.target);
    }
  }
}

bool ShowEngine::trigger(uint8_t input, uint32_t nowMs) {
  if (!loaded_ || state_ != EngineState::Idle || !show_.acceptsInput(input)) {
    return false;
  }
  state_ = EngineState::PreDelay;
  phaseStartMs_ = nowMs;
  hw_.setShowRunning(true);
  update(nowMs);  // a zero pre-delay starts (and fires t=0 cues) immediately
  return true;
}

void ShowEngine::update(uint32_t nowMs) {
  if (state_ == EngineState::PreDelay) {
    if (nowMs - phaseStartMs_ < show_.preDelayMs) return;
    startRunning(phaseStartMs_ + show_.preDelayMs);
  }

  if (state_ == EngineState::Running) {
    const uint32_t elapsed = nowMs - phaseStartMs_;
    // Fire everything that is due, in order, even if update() was late.
    while (nextCue_ < show_.cues.size() && show_.cues[nextCue_].atMs <= elapsed) {
      fireCue(show_.cues[nextCue_++]);
    }
    if (elapsed >= show_.durationMs) {
      finish(phaseStartMs_ + show_.durationMs);
    }
  }

  if (state_ == EngineState::Cooldown) {
    if (nowMs - phaseStartMs_ >= show_.cooldownMs) {
      state_ = EngineState::Idle;
      phaseStartMs_ = nowMs;
    }
  }
}

void ShowEngine::stop(uint32_t nowMs) {
  if (state_ != EngineState::PreDelay && state_ != EngineState::Running) return;
  finish(nowMs);
  update(nowMs);  // a zero cooldown goes straight back to Idle
}

uint32_t ShowEngine::elapsedMs(uint32_t nowMs) const {
  return state_ == EngineState::Running ? nowMs - phaseStartMs_ : 0;
}

void ShowEngine::startRunning(uint32_t startMs) {
  state_ = EngineState::Running;
  phaseStartMs_ = startMs;
  nextCue_ = 0;
}

void ShowEngine::fireCue(const Cue& cue) {
  switch (cue.type) {
    case CueType::Output: hw_.setOutput(static_cast<uint8_t>(cue.target), cue.value); break;
    case CueType::Dmx: hw_.setDmx(cue.target, cue.value); break;
    case CueType::AudioPlay: hw_.playAudio(cue.file, cue.value); break;
    case CueType::AudioStop: hw_.stopAudio(); break;
  }
}

void ShowEngine::finish(uint32_t endMs) {
  allOff();
  state_ = EngineState::Cooldown;
  phaseStartMs_ = endMs;
  nextCue_ = 0;
}

void ShowEngine::allOff() {
  for (uint8_t ch = 1; ch <= kMaxOutputs; ++ch) hw_.setOutput(ch, 0);
  for (uint16_t ch : touchedDmx_) hw_.setDmx(ch, 0);
  hw_.stopAudio();
  hw_.setShowRunning(false);
}

}  // namespace scare
