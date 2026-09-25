// Editor state: the show plus undo/redo history and the current selection.

import { newId, type AudioCue, type LevelCue, type Show, type Track, type TrackType } from "./show/types";

export interface Selection {
  trackId: string;
  cueId?: string;
}

export interface EditorState {
  show: Show;
  past: Show[];
  future: Show[];
  // Edits with the same key in a row (a drag, typing in one field) become a
  // single undo step.
  lastKey: string | null;
  selection: Selection | null;
  dirty: boolean;
}

type CuePatch = Partial<Omit<LevelCue, "id">> | Partial<Omit<Extract<AudioCue, { kind: "play" }>, "id">>;

export type Action =
  | { type: "load"; show: Show }
  | { type: "markSaved" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "select"; selection: Selection | null }
  | { type: "edit"; key?: string; recipe: (show: Show) => Show; select?: Selection | null };

const HISTORY_LIMIT = 200;

export function initState(show: Show): EditorState {
  return { show, past: [], future: [], lastKey: null, selection: null, dirty: false };
}

export function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case "load":
      return initState(action.show);
    case "markSaved":
      return { ...state, dirty: false, lastKey: null };
    case "select":
      return { ...state, selection: action.selection, lastKey: null };
    case "undo": {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      return {
        ...state,
        show: prev,
        past: state.past.slice(0, -1),
        future: [state.show, ...state.future],
        lastKey: null,
        selection: keepSelection(prev, state.selection),
        dirty: true,
      };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        show: next,
        past: [...state.past, state.show],
        future: state.future.slice(1),
        lastKey: null,
        selection: keepSelection(next, state.selection),
        dirty: true,
      };
    }
    case "edit": {
      const show = action.recipe(state.show);
      if (show === state.show) return state;
      const coalesce = action.key !== undefined && action.key === state.lastKey;
      return {
        show,
        past: coalesce ? state.past : [...state.past, state.show].slice(-HISTORY_LIMIT),
        future: [],
        lastKey: action.key ?? null,
        selection:
          action.select !== undefined ? action.select : keepSelection(show, state.selection),
        dirty: true,
      };
    }
  }
}

function keepSelection(show: Show, sel: Selection | null): Selection | null {
  if (!sel) return null;
  const track = show.tracks.find((t) => t.id === sel.trackId);
  if (!track) return null;
  if (sel.cueId && !track.cues.some((c) => c.id === sel.cueId)) return { trackId: track.id };
  return sel;
}

// ---------------------------------------------------------------- recipes
// Small pure helpers that return a new Show. Used with the "edit" action.

export const setShowFields =
  (patch: Partial<Pick<Show, "name" | "durationMs">>) =>
  (show: Show): Show => ({ ...show, ...patch });

export const setTrigger =
  (patch: Partial<Show["trigger"]>) =>
  (show: Show): Show => ({ ...show, trigger: { ...show.trigger, ...patch } });

export function makeTrack(show: Show, type: TrackType): Track {
  if (type === "audio") return { id: newId("t"), type, label: "", cues: [] };
  const used = new Set(show.tracks.filter((t) => t.type === type).map((t) => (t as { channel: number }).channel));
  let channel = 1;
  while (used.has(channel)) channel++;
  return { id: newId("t"), type, channel, label: "", cues: [] };
}

export const addTrack =
  (track: Track) =>
  (show: Show): Show => ({ ...show, tracks: [...show.tracks, track] });

export const removeTrack =
  (trackId: string) =>
  (show: Show): Show => ({ ...show, tracks: show.tracks.filter((t) => t.id !== trackId) });

export const moveTrack =
  (trackId: string, delta: number) =>
  (show: Show): Show => {
    const i = show.tracks.findIndex((t) => t.id === trackId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= show.tracks.length) return show;
    const tracks = [...show.tracks];
    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    return { ...show, tracks };
  };

export const updateTrack =
  (trackId: string, patch: { label?: string; channel?: number }) =>
  (show: Show): Show => ({
    ...show,
    tracks: show.tracks.map((t) => (t.id === trackId ? ({ ...t, ...patch } as Track) : t)),
  });

export const addCue =
  (trackId: string, cue: LevelCue | AudioCue) =>
  (show: Show): Show => ({
    ...show,
    tracks: show.tracks.map((t) =>
      t.id === trackId ? ({ ...t, cues: [...t.cues, cue] } as Track) : t,
    ),
  });

export const updateCue =
  (trackId: string, cueId: string, patch: CuePatch) =>
  (show: Show): Show => ({
    ...show,
    tracks: show.tracks.map((t) =>
      t.id === trackId
        ? ({ ...t, cues: t.cues.map((c) => (c.id === cueId ? { ...c, ...patch } : c)) } as Track)
        : t,
    ),
  });

// Switches an audio cue between "play" and "stop", keeping its time.
export const setAudioCueKind =
  (trackId: string, cueId: string, kind: "play" | "stop", file = "") =>
  (show: Show): Show => ({
    ...show,
    tracks: show.tracks.map((t) =>
      t.id === trackId && t.type === "audio"
        ? {
            ...t,
            cues: t.cues.map((c): AudioCue =>
              c.id !== cueId
                ? c
                : kind === "stop"
                  ? { id: c.id, at: c.at, kind: "stop" }
                  : { id: c.id, at: c.at, kind: "play", file, volume: 100 },
            ),
          }
        : t,
    ),
  });

export const removeCue =
  (trackId: string, cueId: string) =>
  (show: Show): Show => ({
    ...show,
    tracks: show.tracks.map((t) =>
      t.id === trackId ? ({ ...t, cues: t.cues.filter((c) => c.id !== cueId) } as Track) : t,
    ),
  });
