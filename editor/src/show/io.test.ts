import { describe, expect, it } from "vitest";

import example from "../../../docs/examples/closet-scare.json";
import { emptyShow, parseShowJson, serializeShow, validateShow } from "./io";
import { levelSteps, stateAt } from "./playback";
import type { LevelTrack, Show } from "./types";

const exampleText = JSON.stringify(example);

function load(text = exampleText): Show {
  const r = parseShowJson(text);
  if (!r.ok) throw new Error(r.error);
  return r.show;
}

describe("parseShowJson", () => {
  it("reads the example show from docs/", () => {
    const show = load();
    expect(show.name).toBe("Screaming closet");
    expect(show.durationMs).toBe(6000);
    expect(show.trigger).toEqual({ inputs: [1, 2], preDelayMs: 250, cooldownMs: 3000 });
    expect(show.tracks.map((t) => t.type)).toEqual(["audio", "output", "output", "dmx"]);
    expect(validateShow(show)).toEqual([]);
  });

  it("rejects non-show files with a readable message", () => {
    expect(parseShowJson("{oops")).toMatchObject({ ok: false });
    expect(parseShowJson('{"format":"other","version":1}')).toMatchObject({ ok: false });
    const r = parseShowJson('{"format":"scare-show","version":2}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("version 2");
  });

  it("defaults volume, pre-delay and cooldown like the firmware", () => {
    const show = load(
      JSON.stringify({
        format: "scare-show",
        version: 1,
        durationMs: 1000,
        trigger: { inputs: [1] },
        tracks: [{ type: "audio", cues: [{ at: 0, play: "a.mp3" }] }],
      }),
    );
    expect(show.trigger.preDelayMs).toBe(0);
    expect(show.trigger.cooldownMs).toBe(0);
    const cue = show.tracks[0].cues[0];
    expect(cue).toMatchObject({ kind: "play", file: "a.mp3", volume: 100 });
  });
});

describe("serializeShow", () => {
  it("round-trips the example exactly (ignoring key order of labels)", () => {
    const out = JSON.parse(serializeShow(load()));
    expect(out).toEqual(example);
  });

  it("sorts cues by time and leaves out editor ids and empty labels", () => {
    const show = emptyShow();
    const out1 = show.tracks[1] as LevelTrack;
    out1.cues = [
      { id: "b", at: 900, value: 0 },
      { id: "a", at: 100, value: 255 },
    ];
    const json = serializeShow(show);
    expect(json).not.toContain('"id"');
    expect(json).not.toContain('"label"');
    const parsed = JSON.parse(json);
    expect(parsed.tracks[1].cues).toEqual([
      { at: 100, value: 255 },
      { at: 900, value: 0 },
    ]);
  });
});

describe("validateShow", () => {
  it("flags the same problems the firmware refuses", () => {
    const show = load();
    show.durationMs = 1000; // now many cues are past the end
    (show.tracks[1] as LevelTrack).channel = 9;
    show.trigger.inputs = [];
    const messages = validateShow(show).map((i) => i.message);
    expect(messages).toContain("pick at least one trigger input");
    expect(messages).toContain("channel must be 1–8");
    expect(messages).toContain("cue is outside the show");
  });

  it("points issues at the offending cue", () => {
    const show = load();
    const track = show.tracks[1] as LevelTrack;
    track.cues[0].value = 300;
    const issue = validateShow(show).find((i) => i.message === "level must be 0–255");
    expect(issue?.cueId).toBe(track.cues[0].id);
  });

  it("warns about two tracks on the same channel", () => {
    const show = load();
    (show.tracks[2] as LevelTrack).channel = 1;
    expect(validateShow(show).some((i) => i.message.includes("same channel"))).toBe(true);
  });

  it("rejects fractional times", () => {
    const show = load();
    show.tracks[1].cues[0].at = 1.5;
    expect(validateShow(show).some((i) => i.message === "time must be whole milliseconds")).toBe(
      true,
    );
  });
});

describe("preview playback", () => {
  it("matches what the box does at each moment", () => {
    const show = load();
    expect(stateAt(show, 100).outputs.get(1)).toBe(255);
    expect(stateAt(show, 100).outputs.get(2)).toBe(0);
    expect(stateAt(show, 200).outputs.get(2)).toBe(128);
    expect(stateAt(show, 1500).outputs.get(1)).toBe(0);
    expect(stateAt(show, 600).dmx.get(1)).toBe(255);
    expect(stateAt(show, 0).audio?.file).toBe("scream.mp3");
    expect(stateAt(show, 5500).audio).toBeNull();
  });

  it("builds level steps for drawing", () => {
    expect(
      levelSteps(
        [
          { at: 1500, value: 0 },
          { at: 0, value: 255 },
        ],
        6000,
      ),
    ).toEqual([
      { from: 0, to: 1500, value: 255 },
      { from: 1500, to: 6000, value: 0 },
    ]);
  });
});
