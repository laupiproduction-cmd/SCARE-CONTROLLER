// Scare controller firmware - prototype main loop.
//
// Working now: loads show.json from the SD card, trigger inputs, outputs with
// PWM dimming, status LEDs, serial log.
// Stubbed (logs to serial until the parts arrive): MP3 audio and DMX.

#include <Arduino.h>
#include <SD.h>
#include <SPI.h>

#include "pins.h"
#include "show_engine.h"
#include "show_parser.h"

namespace {

constexpr uint32_t kDebounceMs = 30;
constexpr uint32_t kPwmFreqHz = 1000;
constexpr uint8_t kPwmBits = 8;
constexpr uint8_t kNumOutputs = sizeof(pins::kOutputs);

class BoardHardware : public scare::ShowHardware {
 public:
  void begin() {
    for (uint8_t i = 0; i < kNumOutputs; ++i) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
      ledcAttach(pins::kOutputs[i], kPwmFreqHz, kPwmBits);
#else
      ledcSetup(i, kPwmFreqHz, kPwmBits);  // LEDC channel i drives output i
      ledcAttachPin(pins::kOutputs[i], i);
#endif
      pwmWrite(i, 0);
      pinMode(pins::kOutputLeds[i], OUTPUT);
      digitalWrite(pins::kOutputLeds[i], LOW);
    }
    pinMode(pins::kShowRunningLed, OUTPUT);
    digitalWrite(pins::kShowRunningLed, LOW);
  }

  void setOutput(uint8_t channel, uint8_t value) override {
    if (channel < 1 || channel > kNumOutputs) return;  // show may use 5-8 on bigger boards
    const uint8_t i = channel - 1;
    pwmWrite(i, value);
    digitalWrite(pins::kOutputLeds[i], value > 0 ? HIGH : LOW);
    Serial.printf("[out] %u = %u\n", channel, value);
  }

  void setDmx(uint16_t channel, uint8_t value) override {
    // TODO(dmx): send via esp_dmx once the RS-485 module is wired.
    Serial.printf("[dmx] %u = %u\n", channel, value);
  }

  void playAudio(const std::string& file, uint8_t volume) override {
    // TODO(audio): play from SD through the MAX98357A (ESP32-audioI2S).
    Serial.printf("[audio] play %s at %u%%\n", file.c_str(), volume);
  }

  void stopAudio() override { Serial.println("[audio] stop"); }

  void setShowRunning(bool running) override {
    digitalWrite(pins::kShowRunningLed, running ? HIGH : LOW);
  }

 private:
  // Arduino-ESP32 3.x addresses PWM by pin, 2.x by LEDC channel.
  static void pwmWrite(uint8_t outputIndex, uint8_t value) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
    ledcWrite(pins::kOutputs[outputIndex], value);
#else
    ledcWrite(outputIndex, value);
#endif
  }
};

// Edge detector with debounce for one trigger input.
struct TriggerInput {
  uint8_t pin;
  bool activeLow;
  bool stable = false;
  bool lastRaw = false;
  uint32_t changedAt = 0;

  // Returns true once on each debounced rising (active) edge.
  bool poll(uint32_t now) {
    bool raw = digitalRead(pin) == (activeLow ? LOW : HIGH);
    if (raw != lastRaw) {
      lastRaw = raw;
      changedAt = now;
    }
    if (raw != stable && now - changedAt >= kDebounceMs) {
      stable = raw;
      return stable;
    }
    return false;
  }
};

BoardHardware hw;
scare::ShowEngine engine(hw);
TriggerInput triggers[] = {
    {pins::kTriggerButton, true},  // input 1
    {pins::kTriggerRadar, false},  // input 2
};
scare::EngineState lastState = scare::EngineState::Idle;

bool loadShowFromSd() {
  SPI.begin(pins::kSdSck, pins::kSdMiso, pins::kSdMosi, pins::kSdCs);
  if (!SD.begin(pins::kSdCs)) {
    Serial.println("[sd] no card found");
    return false;
  }
  File f = SD.open("/show.json");
  if (!f) {
    Serial.println("[sd] /show.json not found");
    return false;
  }
  String json = f.readString();
  f.close();

  scare::Show show;
  std::string error;
  if (!scare::parseShow(json.c_str(), show, error)) {
    Serial.printf("[show] invalid show.json: %s\n", error.c_str());
    return false;
  }
  engine.load(show, millis());
  Serial.printf("[show] loaded \"%s\": %u ms, %u cues\n", show.name.c_str(),
                static_cast<unsigned>(show.durationMs),
                static_cast<unsigned>(show.cues.size()));
  return true;
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\nScare controller starting");

  hw.begin();
  pinMode(pins::kTriggerButton, INPUT_PULLUP);
  pinMode(pins::kTriggerRadar, INPUT_PULLDOWN);

  if (!loadShowFromSd()) {
    Serial.println("[show] no show loaded - triggers are ignored");
  }
}

void loop() {
  const uint32_t now = millis();

  for (uint8_t i = 0; i < sizeof(triggers) / sizeof(triggers[0]); ++i) {
    if (triggers[i].poll(now)) {
      bool started = engine.trigger(i + 1, now);
      Serial.printf("[trigger] input %u %s\n", i + 1, started ? "-> show" : "(ignored)");
    }
  }

  engine.update(now);

  if (engine.state() != lastState) {
    lastState = engine.state();
    Serial.printf("[show] %s\n", scare::toString(lastState));
  }
}
