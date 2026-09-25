// Editor-side show model. Mirrors docs/show-format.md, plus an `id` on every
// track and cue so React can track them. Ids are never written to show.json.

export const FORMAT = "scare-show";
export const VERSION = 1;

export const MAX_OUTPUTS = 8;
export const MAX_TRIGGER_INPUTS = 4;
export const MAX_DMX_CHANNEL = 512;
export const MAX_DURATION_MS = 3_600_000;

export type TrackType = "audio" | "output" | "dmx";

export interface LevelCue {
  id: string;
  at: number;
  value: number; // 0..255
}

export type AudioCue =
  | { id: string; at: number; kind: "play"; file: string; volume: number }
  | { id: string; at: number; kind: "stop" };

export interface AudioTrack {
  id: string;
  type: "audio";
  label: string;
  cues: AudioCue[];
}

export interface LevelTrack {
  id: string;
  type: "output" | "dmx";
  channel: number;
  label: string;
  cues: LevelCue[];
}

export type Track = AudioTrack | LevelTrack;
export type Cue = AudioCue | LevelCue;

export interface Show {
  name: string;
  durationMs: number;
  trigger: {
    inputs: number[];
    preDelayMs: number;
    cooldownMs: number;
  };
  tracks: Track[];
}

export interface Issue {
  path: string;
  message: string;
  trackId?: string;
  cueId?: string;
}

let nextId = 1;
export const newId = (prefix: string) => `${prefix}${nextId++}`;

export const isLevelTrack = (t: Track): t is LevelTrack => t.type !== "audio";
