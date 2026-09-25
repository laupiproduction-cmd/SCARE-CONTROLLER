// Parses and validates a show.json (see docs/show-format.md).
#pragma once

#include <string>

#include "show.h"

namespace scare {

// Returns true and fills `out` if the JSON is a valid v1 show. On failure
// returns false and puts a human-readable reason in `error`.
bool parseShow(const char* json, Show& out, std::string& error);

}  // namespace scare
