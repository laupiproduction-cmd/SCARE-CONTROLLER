// Show parser + engine tests. Run on the PC with:  pio test -e native

#include <unity.h>

#include <string>
#include <vector>

#include "show_engine.h"
#include "show_parser.h"

using namespace scare;

void setUp() {}
void tearDown() {}

// Same show as docs/examples/closet-scare.json
static const char* kExampleShow = R"json(
{
  "format": "scare-show",
  "version": 1,
  "name": "Screaming closet",
  "durationMs": 6000,
  "trigger": { "inputs": [1, 2], "preDelayMs": 250, "cooldownMs": 3000 },
  "tracks": [
    { "type": "audio", "cues": [
        { "at": 0, "play": "scream.mp3", "volume": 90 },
        { "at": 5500, "stop": true } ] },
    { "type": "output", "channel": 1, "label": "Strobe", "cues": [
        { "at": 0, "value": 255 }, { "at": 1500, "value": 0 } ] },
    { "type": "output", "channel": 2, "label": "Red wash (dimmed)", "cues": [
        { "at": 200, "value": 128 }, { "at": 4000, "value": 0 } ] },
    { "type": "dmx", "channel": 1, "label": "Fogger", "cues": [
        { "at": 500, "value": 255 }, { "at": 2500, "value": 0 } ] }
  ]
}
)json";

// Records every hardware call as a readable string.
class FakeHardware : public ShowHardware {
 public:
  std::vector<std::string> log;
  bool running = false;

  void setOutput(uint8_t ch, uint8_t v) override {
    log.push_back("out" + std::to_string(ch) + "=" + std::to_string(v));
  }
  void setDmx(uint16_t ch, uint8_t v) override {
    log.push_back("dmx" + std::to_string(ch) + "=" + std::to_string(v));
  }
  void playAudio(const std::string& f, uint8_t vol) override {
    log.push_back("play " + f + " " + std::to_string(vol));
  }
  void stopAudio() override { log.push_back("stop"); }
  void setShowRunning(bool r) override { running = r; }

  bool has(const std::string& entry) const {
    for (const auto& e : log) {
      if (e == entry) return true;
    }
    return false;
  }
  void clear() { log.clear(); }
};

static Show parseOrFail(const char* json) {
  Show show;
  std::string error;
  bool ok = parseShow(json, show, error);
  TEST_ASSERT_TRUE_MESSAGE(ok, error.c_str());
  return show;
}

static std::string parseError(const std::string& json) {
  Show show;
  std::string error;
  TEST_ASSERT_FALSE_MESSAGE(parseShow(json.c_str(), show, error), "expected parse failure");
  return error;
}

// A minimal valid show with one output track, for building bad variants.
static std::string minimalShow(const std::string& trigger, const std::string& tracks,
                               const std::string& top = "\"durationMs\": 1000") {
  return "{\"format\":\"scare-show\",\"version\":1," + top + ",\"trigger\":" + trigger +
         ",\"tracks\":" + tracks + "}";
}

// ---------------------------------------------------------------- parser

void test_parses_example_show() {
  Show show = parseOrFail(kExampleShow);
  TEST_ASSERT_EQUAL_STRING("Screaming closet", show.name.c_str());
  TEST_ASSERT_EQUAL_UINT32(6000, show.durationMs);
  TEST_ASSERT_EQUAL_UINT32(250, show.preDelayMs);
  TEST_ASSERT_EQUAL_UINT32(3000, show.cooldownMs);
  TEST_ASSERT_EQUAL(2, show.triggerInputs.size());
  TEST_ASSERT_EQUAL(8, show.cues.size());
}

void test_cues_sorted_by_time_keeping_file_order() {
  Show show = parseOrFail(kExampleShow);
  for (size_t i = 1; i < show.cues.size(); ++i) {
    TEST_ASSERT_TRUE(show.cues[i - 1].atMs <= show.cues[i].atMs);
  }
  // Both t=0 cues keep file order: audio first, then output 1.
  TEST_ASSERT_EQUAL(CueType::AudioPlay, show.cues[0].type);
  TEST_ASSERT_EQUAL(CueType::Output, show.cues[1].type);
}

void test_rejects_bad_json() {
  TEST_ASSERT_TRUE(parseError("{ not json").find("invalid JSON") == 0);
}

void test_rejects_wrong_format_and_version() {
  parseError("{\"format\":\"other\",\"version\":1}");
  std::string err = parseError(
      "{\"format\":\"scare-show\",\"version\":2,\"durationMs\":1000,"
      "\"trigger\":{\"inputs\":[1]},\"tracks\":[]}");
  TEST_ASSERT_TRUE(err.find("unsupported version 2") != std::string::npos);
}

void test_rejects_output_channel_out_of_range() {
  std::string err = parseError(minimalShow(
      "{\"inputs\":[1]}",
      "[{\"type\":\"output\",\"channel\":9,\"cues\":[{\"at\":0,\"value\":255}]}]"));
  TEST_ASSERT_TRUE(err.find("channel") != std::string::npos);
}

void test_rejects_cue_after_end_of_show() {
  std::string err = parseError(minimalShow(
      "{\"inputs\":[1]}",
      "[{\"type\":\"output\",\"channel\":1,\"cues\":[{\"at\":1001,\"value\":255}]}]"));
  TEST_ASSERT_TRUE(err.find("tracks[0].cues[0]") == 0);
}

void test_rejects_bad_trigger_inputs() {
  parseError(minimalShow("{\"inputs\":[]}", "[]"));
  parseError(minimalShow("{\"inputs\":[5]}", "[]"));
}

void test_rejects_value_above_255_and_fractions() {
  parseError(minimalShow(
      "{\"inputs\":[1]}",
      "[{\"type\":\"dmx\",\"channel\":1,\"cues\":[{\"at\":0,\"value\":256}]}]"));
  parseError(minimalShow(
      "{\"inputs\":[1]}",
      "[{\"type\":\"output\",\"channel\":1,\"cues\":[{\"at\":1.5,\"value\":255}]}]"));
}

void test_rejects_audio_cue_without_file() {
  parseError(minimalShow("{\"inputs\":[1]}",
                         "[{\"type\":\"audio\",\"cues\":[{\"at\":0}]}]"));
}

void test_audio_volume_defaults_to_100() {
  Show show = parseOrFail(minimalShow(
      "{\"inputs\":[1]}",
      "[{\"type\":\"audio\",\"cues\":[{\"at\":0,\"play\":\"a.mp3\"}]}]").c_str());
  TEST_ASSERT_EQUAL_UINT8(100, show.cues[0].value);
}

// ---------------------------------------------------------------- engine

void test_ignores_trigger_from_unlisted_input() {
  FakeHardware hw;
  ShowEngine engine(hw);
  Show show = parseOrFail(minimalShow("{\"inputs\":[2]}", "[]").c_str());
  engine.load(show, 0);
  TEST_ASSERT_FALSE(engine.trigger(1, 100));
  TEST_ASSERT_EQUAL(EngineState::Idle, engine.state());
}

void test_nothing_fires_during_pre_delay() {
  FakeHardware hw;
  ShowEngine engine(hw);
  engine.load(parseOrFail(kExampleShow), 0);

  TEST_ASSERT_TRUE(engine.trigger(1, 1000));
  TEST_ASSERT_TRUE(hw.running);
  engine.update(1249);
  TEST_ASSERT_EQUAL(EngineState::PreDelay, engine.state());
  TEST_ASSERT_EQUAL(0, hw.log.size());

  engine.update(1250);  // 1000 + 250 pre-delay = show time 0
  TEST_ASSERT_EQUAL(EngineState::Running, engine.state());
  TEST_ASSERT_TRUE(hw.has("play scream.mp3 90"));
  TEST_ASSERT_TRUE(hw.has("out1=255"));
  TEST_ASSERT_FALSE(hw.has("out2=128"));  // due at 200
}

void test_cues_fire_on_time() {
  FakeHardware hw;
  ShowEngine engine(hw);
  engine.load(parseOrFail(kExampleShow), 0);
  engine.trigger(1, 0);  // show time = now - 250

  engine.update(250 + 199);
  TEST_ASSERT_FALSE(hw.has("out2=128"));
  engine.update(250 + 200);
  TEST_ASSERT_TRUE(hw.has("out2=128"));

  engine.update(250 + 1499);
  TEST_ASSERT_FALSE(hw.has("out1=0"));
  engine.update(250 + 1500);
  TEST_ASSERT_TRUE(hw.has("out1=0"));
  TEST_ASSERT_EQUAL_UINT32(1500, engine.elapsedMs(250 + 1500));
}

void test_late_update_fires_all_due_cues_in_order() {
  FakeHardware hw;
  ShowEngine engine(hw);
  engine.load(parseOrFail(kExampleShow), 0);
  engine.trigger(1, 0);
  engine.update(250 + 2600);  // one big jump

  std::vector<std::string> expected = {"play scream.mp3 90", "out1=255", "out2=128",
                                       "dmx1=255", "out1=0", "dmx1=0"};
  TEST_ASSERT_EQUAL(expected.size(), hw.log.size());
  for (size_t i = 0; i < expected.size(); ++i) {
    TEST_ASSERT_EQUAL_STRING(expected[i].c_str(), hw.log[i].c_str());
  }
}

void test_show_end_turns_everything_off_then_cools_down() {
  FakeHardware hw;
  ShowEngine engine(hw);
  engine.load(parseOrFail(kExampleShow), 0);
  engine.trigger(1, 0);
  engine.update(250 + 1000);
  hw.clear();

  engine.update(250 + 6000);  // end of show
  TEST_ASSERT_EQUAL(EngineState::Cooldown, engine.state());
  TEST_ASSERT_FALSE(hw.running);
  for (int ch = 1; ch <= kMaxOutputs; ++ch) {
    TEST_ASSERT_TRUE(hw.has("out" + std::to_string(ch) + "=0"));
  }
  TEST_ASSERT_TRUE(hw.has("dmx1=0"));
  TEST_ASSERT_TRUE(hw.has("stop"));

  TEST_ASSERT_FALSE(engine.trigger(1, 250 + 6000 + 2999));  // still cooling down
  engine.update(250 + 6000 + 3000);
  TEST_ASSERT_EQUAL(EngineState::Idle, engine.state());
  TEST_ASSERT_TRUE(engine.trigger(1, 250 + 6000 + 3001));
}

void test_retrigger_ignored_while_running() {
  FakeHardware hw;
  ShowEngine engine(hw);
  engine.load(parseOrFail(kExampleShow), 0);
  TEST_ASSERT_TRUE(engine.trigger(1, 0));
  TEST_ASSERT_FALSE(engine.trigger(2, 100));  // pre-delay
  engine.update(1000);
  TEST_ASSERT_FALSE(engine.trigger(1, 1000));  // running
}

void test_emergency_stop() {
  FakeHardware hw;
  ShowEngine engine(hw);
  engine.load(parseOrFail(kExampleShow), 0);
  engine.trigger(1, 0);
  engine.update(250 + 600);
  hw.clear();

  engine.stop(900);
  TEST_ASSERT_EQUAL(EngineState::Cooldown, engine.state());
  TEST_ASSERT_TRUE(hw.has("out1=0"));
  TEST_ASSERT_TRUE(hw.has("dmx1=0"));
  TEST_ASSERT_TRUE(hw.has("stop"));
  TEST_ASSERT_FALSE(hw.running);

  hw.clear();
  engine.update(250 + 5000);  // later cues must not fire after a stop
  TEST_ASSERT_EQUAL(0, hw.log.size());
}

void test_zero_pre_delay_fires_immediately_on_trigger() {
  FakeHardware hw;
  ShowEngine engine(hw);
  engine.load(parseOrFail(minimalShow(
                  "{\"inputs\":[1]}",
                  "[{\"type\":\"output\",\"channel\":3,\"cues\":[{\"at\":0,\"value\":255}]}]")
                  .c_str()),
              0);
  engine.trigger(1, 42);
  TEST_ASSERT_TRUE(hw.has("out3=255"));
}

void test_survives_millis_rollover() {
  FakeHardware hw;
  ShowEngine engine(hw);
  engine.load(parseOrFail(kExampleShow), 0);
  const uint32_t nearWrap = 0xFFFFFFFFu - 100;  // millis() wraps after ~49.7 days
  engine.trigger(1, nearWrap);
  engine.update(nearWrap + 250 + 200);  // wraps past zero
  TEST_ASSERT_TRUE(hw.has("out2=128"));
  TEST_ASSERT_FALSE(hw.has("out1=0"));
  TEST_ASSERT_EQUAL(EngineState::Running, engine.state());
}

void test_no_show_loaded_ignores_triggers() {
  FakeHardware hw;
  ShowEngine engine(hw);
  TEST_ASSERT_FALSE(engine.trigger(1, 0));
  engine.update(1000);
  TEST_ASSERT_EQUAL(0, hw.log.size());
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_parses_example_show);
  RUN_TEST(test_cues_sorted_by_time_keeping_file_order);
  RUN_TEST(test_rejects_bad_json);
  RUN_TEST(test_rejects_wrong_format_and_version);
  RUN_TEST(test_rejects_output_channel_out_of_range);
  RUN_TEST(test_rejects_cue_after_end_of_show);
  RUN_TEST(test_rejects_bad_trigger_inputs);
  RUN_TEST(test_rejects_value_above_255_and_fractions);
  RUN_TEST(test_rejects_audio_cue_without_file);
  RUN_TEST(test_audio_volume_defaults_to_100);
  RUN_TEST(test_ignores_trigger_from_unlisted_input);
  RUN_TEST(test_nothing_fires_during_pre_delay);
  RUN_TEST(test_cues_fire_on_time);
  RUN_TEST(test_late_update_fires_all_due_cues_in_order);
  RUN_TEST(test_show_end_turns_everything_off_then_cools_down);
  RUN_TEST(test_retrigger_ignored_while_running);
  RUN_TEST(test_emergency_stop);
  RUN_TEST(test_zero_pre_delay_fires_immediately_on_trigger);
  RUN_TEST(test_survives_millis_rollover);
  RUN_TEST(test_no_show_loaded_ignores_triggers);
  return UNITY_END();
}
