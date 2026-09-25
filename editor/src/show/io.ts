// Reading, validating and writing show.json. The rules here must match the
// firmware parser (firmware/lib/ShowEngine/src/show_parser.cpp).

import {
  FORMAT,
  MAX_DMX_CHANNEL,
  MAX_DURATION_MS,
  MAX_OUTPUTS,
  MAX_TRIGGER_INPUTS,
  VERSION,
  newId,
  type AudioCue,
  type Issue,
  type LevelCue,
  type Show,
  type Track,
} from "./types";

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

// ---------------------------------------------------------------- import

export type ParseResult = { ok: true; show: Show } | { ok: false; error: string };

// Turns JSON text into an editor Show. Only rejects things the editor can't
// represent at all; range problems are left for validateShow() so the user
// can open a broken file and fix it.
export function parseShowJson(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `Not valid JSON: ${(e as Error).message}` };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "A show file must contain a JSON object." };
  }
  const r = raw as Record<string, unknown>;
  if (r.format !== FORMAT) {
    return { ok: false, error: `This is not a show file ("format" must be "${FORMAT}").` };
  }
  if (r.version !== VERSION) {
    return {
      ok: false,
      error: `Unsupported show version ${String(r.version)}. This editor reads version ${VERSION}.`,
    };
  }

  const trig = (typeof r.trigger === "object" && r.trigger !== null ? r.trigger : {}) as Record<
    string,
    unknown
  >;
  const tracksRaw = Array.isArray(r.tracks) ? r.tracks : [];
  const tracks: Track[] = [];

  for (const [i, t] of tracksRaw.entries()) {
    if (typeof t !== "object" || t === null) {
      return { ok: false, error: `tracks[${i}] is not an object.` };
    }
    const tr = t as Record<string, unknown>;
    const cuesRaw = (Array.isArray(tr.cues) ? tr.cues : []) as Record<string, unknown>[];
    const label = typeof tr.label === "string" ? tr.label : "";

    if (tr.type === "audio") {
      const cues: AudioCue[] = cuesRaw.map((c) =>
        c.stop === true
          ? { id: newId("c"), at: num(c.at), kind: "stop" }
          : {
              id: newId("c"),
              at: num(c.at),
              kind: "play",
              file: typeof c.play === "string" ? c.play : "",
              volume: c.volume === undefined ? 100 : num(c.volume),
            },
      );
      tracks.push({ id: newId("t"), type: "audio", label, cues });
    } else if (tr.type === "output" || tr.type === "dmx") {
      const cues: LevelCue[] = cuesRaw.map((c) => ({
        id: newId("c"),
        at: num(c.at),
        value: num(c.value),
      }));
      tracks.push({ id: newId("t"), type: tr.type, channel: num(tr.channel), label, cues });
    } else {
      return { ok: false, error: `tracks[${i}] has unknown type "${String(tr.type)}".` };
    }
  }

  return {
    ok: true,
    show: {
      name: typeof r.name === "string" ? r.name : "",
      durationMs: num(r.durationMs),
      trigger: {
        inputs: Array.isArray(trig.inputs) ? trig.inputs.map(num) : [],
        preDelayMs: trig.preDelayMs === undefined ? 0 : num(trig.preDelayMs),
        cooldownMs: trig.cooldownMs === undefined ? 0 : num(trig.cooldownMs),
      },
      tracks,
    },
  };
}

// Non-numbers become NaN so validation reports them instead of hiding them.
function num(v: unknown): number {
  return typeof v === "number" ? v : Number.NaN;
}

// ---------------------------------------------------------------- validate

export function validateShow(show: Show): Issue[] {
  const issues: Issue[] = [];
  const range = (v: number, min: number, max: number) => isInt(v) && v >= min && v <= max;

  if (!range(show.durationMs, 1, MAX_DURATION_MS)) {
    issues.push({ path: "Show length", message: "must be between 1 ms and 1 hour" });
  }
  if (show.trigger.inputs.length === 0) {
    issues.push({ path: "Trigger", message: "pick at least one trigger input" });
  }
  for (const i of show.trigger.inputs) {
    if (!range(i, 1, MAX_TRIGGER_INPUTS)) {
      issues.push({ path: "Trigger", message: `input ${i} doesn't exist (1–${MAX_TRIGGER_INPUTS})` });
    }
  }
  if (!range(show.trigger.preDelayMs, 0, MAX_DURATION_MS)) {
    issues.push({ path: "Trigger", message: "pre-delay must be 0 ms to 1 hour" });
  }
  if (!range(show.trigger.cooldownMs, 0, MAX_DURATION_MS)) {
    issues.push({ path: "Trigger", message: "cooldown must be 0 ms to 1 hour" });
  }

  const seen = new Set<string>();
  for (const t of show.tracks) {
    const name = trackTitle(t);
    if (t.type !== "audio") {
      const max = t.type === "output" ? MAX_OUTPUTS : MAX_DMX_CHANNEL;
      if (!range(t.channel, 1, max)) {
        issues.push({ path: name, message: `channel must be 1–${max}`, trackId: t.id });
      } else {
        const key = `${t.type}:${t.channel}`;
        if (seen.has(key)) {
          // Allowed by the firmware, but almost always a mistake.
          issues.push({
            path: name,
            message: "another track uses the same channel; they will fight each other",
            trackId: t.id,
          });
        }
        seen.add(key);
      }
    }
    for (const c of t.cues) {
      const at = `${name} @ ${fmtTime(c.at)}`;
      if (!isInt(c.at)) {
        issues.push({ path: at, message: "time must be whole milliseconds", trackId: t.id, cueId: c.id });
      } else if (!range(c.at, 0, Number.isFinite(show.durationMs) ? show.durationMs : 0)) {
        issues.push({ path: at, message: "cue is outside the show", trackId: t.id, cueId: c.id });
      }
      if ("value" in c && !range(c.value, 0, 255)) {
        issues.push({ path: at, message: "level must be 0–255", trackId: t.id, cueId: c.id });
      }
      if ("kind" in c && c.kind === "play") {
        if (c.file.trim() === "") {
          issues.push({ path: at, message: "choose a sound file", trackId: t.id, cueId: c.id });
        }
        if (!range(c.volume, 0, 100)) {
          issues.push({ path: at, message: "volume must be 0–100", trackId: t.id, cueId: c.id });
        }
      }
    }
  }
  return issues;
}

// ---------------------------------------------------------------- export

export function serializeShow(show: Show): string {
  const byTime = <T extends { at: number }>(cues: T[]) =>
    [...cues].sort((a, b) => a.at - b.at);

  const out = {
    format: FORMAT,
    version: VERSION,
    name: show.name,
    durationMs: show.durationMs,
    trigger: {
      inputs: [...show.trigger.inputs].sort((a, b) => a - b),
      preDelayMs: show.trigger.preDelayMs,
      cooldownMs: show.trigger.cooldownMs,
    },
    tracks: show.tracks.map((t) => {
      const label = t.label.trim() ? { label: t.label.trim() } : {};
      if (t.type === "audio") {
        return {
          type: "audio",
          ...label,
          cues: byTime(t.cues).map((c) =>
            c.kind === "stop"
              ? { at: c.at, stop: true }
              : { at: c.at, play: c.file.trim(), volume: c.volume },
          ),
        };
      }
      return {
        type: t.type,
        channel: t.channel,
        ...label,
        cues: byTime(t.cues).map((c) => ({ at: c.at, value: c.value })),
      };
    }),
  };
  return JSON.stringify(out, null, 2) + "\n";
}

// ---------------------------------------------------------------- helpers

export function trackTitle(t: Track): string {
  const base =
    t.type === "audio" ? "Audio" : t.type === "output" ? `Output ${t.channel}` : `DMX ${t.channel}`;
  return t.label.trim() ? `${base} · ${t.label.trim()}` : base;
}

export function fmtTime(ms: number): string {
  if (!Number.isFinite(ms)) return "?";
  const s = ms / 1000;
  return s >= 60 ? `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}` : `${s.toFixed(2)}s`;
}

export function emptyShow(): Show {
  return {
    name: "New show",
    durationMs: 5000,
    trigger: { inputs: [1], preDelayMs: 0, cooldownMs: 2000 },
    tracks: [
      { id: newId("t"), type: "audio", label: "", cues: [] },
      { id: newId("t"), type: "output", channel: 1, label: "", cues: [] },
    ],
  };
}
