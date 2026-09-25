#include "show_parser.h"

#include <ArduinoJson.h>

#include <algorithm>

namespace scare {

namespace {

bool fail(std::string& error, const std::string& msg) {
  error = msg;
  return false;
}

std::string trackName(size_t index) {
  return "tracks[" + std::to_string(index) + "]";
}

// Reads a non-negative integer field. Missing -> fallback (if allowed).
bool readUint(JsonVariantConst v, const char* key, uint32_t max, bool required,
              uint32_t fallback, uint32_t& out, std::string& error,
              const std::string& where) {
  JsonVariantConst field = v[key];
  if (field.isNull()) {
    if (required) return fail(error, where + ": missing \"" + key + "\"");
    out = fallback;
    return true;
  }
  if (!field.is<long long>()) {
    return fail(error, where + ": \"" + key + "\" must be a whole number");
  }
  long long n = field.as<long long>();
  if (n < 0 || static_cast<unsigned long long>(n) > max) {
    return fail(error, where + ": \"" + key + "\" must be between 0 and " +
                           std::to_string(max));
  }
  out = static_cast<uint32_t>(n);
  return true;
}

}  // namespace

bool parseShow(const char* json, Show& out, std::string& error) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, json);
  if (err) return fail(error, std::string("invalid JSON: ") + err.c_str());

  JsonObjectConst root = doc.as<JsonObjectConst>();
  if (root.isNull()) return fail(error, "show must be a JSON object");

  const char* format = root["format"] | "";
  if (std::string(format) != "scare-show") {
    return fail(error, "\"format\" must be \"scare-show\"");
  }
  uint32_t version = 0;
  if (!readUint(root, "version", 1000, true, 0, version, error, "show")) return false;
  if (version != 1) {
    return fail(error, "unsupported version " + std::to_string(version) +
                           " (this firmware reads version 1)");
  }

  Show show;
  show.name = root["name"] | "";
  if (!readUint(root, "durationMs", kMaxDurationMs, true, 0, show.durationMs,
                error, "show")) {
    return false;
  }
  if (show.durationMs == 0) return fail(error, "show: \"durationMs\" must be above 0");

  // Trigger
  JsonObjectConst trigger = root["trigger"];
  if (trigger.isNull()) return fail(error, "show: missing \"trigger\"");
  if (!readUint(trigger, "preDelayMs", kMaxDurationMs, false, 0, show.preDelayMs,
                error, "trigger")) {
    return false;
  }
  if (!readUint(trigger, "cooldownMs", kMaxDurationMs, false, 0, show.cooldownMs,
                error, "trigger")) {
    return false;
  }
  JsonArrayConst inputs = trigger["inputs"];
  if (inputs.isNull() || inputs.size() == 0) {
    return fail(error, "trigger: \"inputs\" needs at least one input");
  }
  for (JsonVariantConst in : inputs) {
    if (!in.is<long long>() || in.as<long long>() < 1 ||
        in.as<long long>() > kMaxTriggerInputs) {
      return fail(error, "trigger: inputs must be numbers from 1 to " +
                             std::to_string(kMaxTriggerInputs));
    }
    show.triggerInputs.push_back(static_cast<uint8_t>(in.as<long long>()));
  }

  // Tracks
  JsonArrayConst tracks = root["tracks"];
  if (tracks.isNull()) return fail(error, "show: missing \"tracks\"");

  size_t trackIndex = 0;
  for (JsonObjectConst track : tracks) {
    const std::string where = trackName(trackIndex++);
    std::string type = track["type"] | "";

    uint32_t channel = 0;
    if (type == "output") {
      if (!readUint(track, "channel", kMaxOutputs, true, 0, channel, error, where)) return false;
      if (channel < 1) return fail(error, where + ": \"channel\" must be 1 to 8");
    } else if (type == "dmx") {
      if (!readUint(track, "channel", kMaxDmxChannel, true, 0, channel, error, where)) return false;
      if (channel < 1) return fail(error, where + ": \"channel\" must be 1 to 512");
    } else if (type != "audio") {
      return fail(error, where + ": unknown type \"" + type + "\"");
    }

    JsonArrayConst cues = track["cues"];
    if (cues.isNull()) return fail(error, where + ": missing \"cues\"");

    size_t cueIndex = 0;
    for (JsonObjectConst c : cues) {
      const std::string cueWhere = where + ".cues[" + std::to_string(cueIndex++) + "]";
      Cue cue;
      if (!readUint(c, "at", show.durationMs, true, 0, cue.atMs, error, cueWhere)) {
        return false;
      }

      if (type == "audio") {
        if (c["stop"] | false) {
          cue.type = CueType::AudioStop;
        } else {
          const char* file = c["play"] | "";
          if (file[0] == '\0') {
            return fail(error, cueWhere + ": needs \"play\" (a file name) or \"stop\": true");
          }
          cue.type = CueType::AudioPlay;
          cue.file = file;
          uint32_t volume = 100;
          if (!readUint(c, "volume", 100, false, 100, volume, error, cueWhere)) return false;
          cue.value = static_cast<uint8_t>(volume);
        }
      } else {
        cue.type = (type == "output") ? CueType::Output : CueType::Dmx;
        cue.target = static_cast<uint16_t>(channel);
        uint32_t value = 0;
        if (!readUint(c, "value", 255, true, 0, value, error, cueWhere)) return false;
        cue.value = static_cast<uint8_t>(value);
      }
      show.cues.push_back(cue);
    }
  }

  std::stable_sort(show.cues.begin(), show.cues.end(),
                   [](const Cue& a, const Cue& b) { return a.atMs < b.atMs; });

  out = std::move(show);
  error.clear();
  return true;
}

}  // namespace scare
