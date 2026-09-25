// What the box would be doing at a given moment of the show. Same rules as the
// firmware engine: cues at or before `t` apply in time order, later cues at
// the same time win.

import type { Show } from "./types";

export interface BoxState {
  outputs: Map<number, number>; // channel -> 0..255
  dmx: Map<number, number>; // channel -> 0..255
  audio: { file: string; volume: number; since: number } | null;
}

export function stateAt(show: Show, t: number): BoxState {
  const outputs = new Map<number, number>();
  const dmx = new Map<number, number>();
  let audio: BoxState["audio"] = null;
  let audioAt = -1;

  for (const track of show.tracks) {
    if (track.type === "audio") {
      for (const c of track.cues) {
        if (c.at > t || c.at < audioAt) continue;
        audioAt = c.at;
        audio = c.kind === "play" ? { file: c.file, volume: c.volume, since: c.at } : null;
      }
    } else {
      const target = track.type === "output" ? outputs : dmx;
      let best = -1;
      let value = 0;
      for (const c of track.cues) {
        if (c.at <= t && c.at >= best) {
          best = c.at;
          value = c.value;
        }
      }
      target.set(track.channel, Math.max(target.get(track.channel) ?? 0, value));
    }
  }
  return { outputs, dmx, audio };
}

// Level of one track over time, as steps [{from, to, value}] for drawing.
export function levelSteps(
  cues: { at: number; value: number }[],
  durationMs: number,
): { from: number; to: number; value: number }[] {
  const sorted = [...cues].sort((a, b) => a.at - b.at);
  const steps: { from: number; to: number; value: number }[] = [];
  let from = 0;
  let value = 0;
  for (const c of sorted) {
    if (c.at > from) steps.push({ from, to: c.at, value });
    from = Math.max(from, c.at);
    value = c.value;
  }
  if (durationMs > from) steps.push({ from, to: durationMs, value });
  return steps;
}
