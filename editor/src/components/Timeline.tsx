import { useRef, type Dispatch, type PointerEvent as ReactPointerEvent } from "react";

import { fmtTime, trackTitle } from "../show/io";
import { levelSteps } from "../show/playback";
import { newId, type AudioCue, type Cue, type LevelTrack, type Show, type Track } from "../show/types";
import {
  addCue,
  addTrack,
  makeTrack,
  moveTrack,
  removeTrack,
  updateCue,
  updateTrack,
  type Action,
  type Selection,
} from "../state";
import { NumField } from "./NumField";

export const HEADER_W = 232;
const LANE_H = 64;
const RULER_H = 30;
const PAD = 10; // vertical padding inside a lane for the level graph
const ORIGIN = 14; // gap between the track headers and time 0

interface Props {
  show: Show;
  selection: Selection | null;
  pxPerMs: number;
  time: number;
  issueCueIds: Set<string>;
  issueTrackIds: Set<string>;
  defaultSound: string;
  dispatch: Dispatch<Action>;
  onSeek: (t: number) => void;
}

const TICK_STEPS = [50, 100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000, 300000];

export function Timeline(props: Props) {
  const { show, pxPerMs, time, dispatch, onSeek } = props;
  // The timeline reaches at least to the last cue, so cues left behind after
  // shortening the show stay visible (in the shaded area) and can be fixed.
  const lastCue = Math.max(0, ...show.tracks.flatMap((t) => t.cues.map((c) => (Number.isFinite(c.at) ? c.at : 0))));
  const extent = Math.max(show.durationMs, lastCue);
  const laneW = Math.max(200, extent * pxPerMs);
  const tickStep = TICK_STEPS.find((s) => s * pxPerMs >= 70) ?? 300000;
  const ticks: number[] = [];
  for (let t = 0; t <= extent; t += tickStep) ticks.push(t);

  const scrub = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const toTime = (x: number) => (x - rect.left) / pxPerMs;
    onSeek(toTime(e.clientX));
    const move = (ev: PointerEvent) => onSeek(toTime(ev.clientX));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="timeline">
      <div className="tl-inner" style={{ width: HEADER_W + ORIGIN + laneW + 40 }}>
        <div className="tl-ruler-row" style={{ height: RULER_H }}>
          <div className="tl-corner" style={{ width: HEADER_W }}>
            {show.tracks.length} track{show.tracks.length === 1 ? "" : "s"}
          </div>
          <div className="tl-ruler" style={{ width: laneW, marginLeft: ORIGIN }} onPointerDown={scrub}>
            {ticks.map((t) => (
              <div key={t} className="tl-tick" style={{ left: t * pxPerMs }}>
                <span>{fmtTime(t)}</span>
              </div>
            ))}
          </div>
        </div>

        {show.tracks.map((track, index) => (
          <div key={track.id} className="tl-row" style={{ height: LANE_H }}>
            <TrackHeader
              track={track}
              first={index === 0}
              last={index === show.tracks.length - 1}
              hasIssue={props.issueTrackIds.has(track.id)}
              selected={props.selection?.trackId === track.id}
              dispatch={dispatch}
            />
            <Lane {...props} track={track} laneW={laneW} ticks={ticks} extent={extent} />
          </div>
        ))}

        <div className="tl-add-row" style={{ width: HEADER_W }}>
          <span>Add track</span>
          {(["audio", "output", "dmx"] as const).map((type) => (
            <button
              key={type}
              className={`chip chip-${type}`}
              onClick={() => {
                const track = makeTrack(show, type);
                dispatch({ type: "edit", recipe: addTrack(track), select: { trackId: track.id } });
              }}
            >
              + {type === "dmx" ? "DMX" : type[0].toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        <div
          className="tl-end"
          style={{ left: HEADER_W + ORIGIN + show.durationMs * pxPerMs, width: (extent - show.durationMs) * pxPerMs + 40 }}
          title="After the end of the show"
          aria-hidden
        />

        <div
          className="tl-playhead"
          style={{ left: HEADER_W + ORIGIN + time * pxPerMs, top: 0, bottom: 0 }}
          aria-hidden
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- header

function TrackHeader({
  track,
  first,
  last,
  hasIssue,
  selected,
  dispatch,
}: {
  track: Track;
  first: boolean;
  last: boolean;
  hasIssue: boolean;
  selected: boolean;
  dispatch: Dispatch<Action>;
}) {
  const kind = track.type === "audio" ? "Audio" : track.type === "output" ? "Output" : "DMX";
  return (
    <div
      className={`tl-header tl-header-${track.type}${selected ? " is-selected" : ""}`}
      style={{ width: HEADER_W }}
      onPointerDown={() => dispatch({ type: "select", selection: { trackId: track.id } })}
    >
      <div className="tl-header-top">
        <span className={`type-dot dot-${track.type}`} />
        <span className="tl-kind">{kind}</span>
        {track.type !== "audio" && (
          <NumField
            ariaLabel={`${kind} channel`}
            value={track.channel}
            min={1}
            max={track.type === "output" ? 8 : 512}
            width={track.type === "dmx" ? 44 : 30}
            onChange={(channel) =>
              dispatch({ type: "edit", key: `ch:${track.id}`, recipe: updateTrack(track.id, { channel }) })
            }
          />
        )}
        {hasIssue && <span className="warn-dot" title="This track has a problem - see Issues" />}
        <span className="tl-header-actions">
          <button title="Move up" disabled={first} onClick={() => dispatch({ type: "edit", recipe: moveTrack(track.id, -1) })}>
            ↑
          </button>
          <button title="Move down" disabled={last} onClick={() => dispatch({ type: "edit", recipe: moveTrack(track.id, 1) })}>
            ↓
          </button>
          <button
            title="Delete track"
            onClick={() => dispatch({ type: "edit", recipe: removeTrack(track.id), select: null })}
          >
            ✕
          </button>
        </span>
      </div>
      <input
        className="tl-label"
        placeholder={track.type === "audio" ? "Name (e.g. Screams)" : "Name (e.g. Strobe)"}
        value={track.label}
        onChange={(e) =>
          dispatch({ type: "edit", key: `label:${track.id}`, recipe: updateTrack(track.id, { label: e.target.value }) })
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------- lane

function Lane({
  show,
  track,
  laneW,
  ticks,
  pxPerMs,
  selection,
  issueCueIds,
  defaultSound,
  dispatch,
  extent,
}: Props & { track: Track; laneW: number; ticks: number[]; extent: number }) {
  const laneRef = useRef<HTMLDivElement>(null);
  const snapMs = pxPerMs >= 0.25 ? 10 : pxPerMs >= 0.06 ? 50 : 100;
  const valueToY = (v: number) => PAD + (1 - v / 255) * (LANE_H - 2 * PAD);

  const clampTime = (t: number, free: boolean) => {
    const snapped = free ? Math.round(t) : Math.round(t / snapMs) * snapMs;
    return Math.max(0, Math.min(show.durationMs, snapped));
  };

  // Drag a cue: horizontal = time, vertical = level (level tracks only).
  // The first few pixels decide the axis, so small wobbles don't change both.
  const startDrag = (e: { clientX: number; clientY: number }, cue: Cue, key: string) => {
    const origin = { x: e.clientX, y: e.clientY, at: cue.at, value: "value" in cue ? cue.value : 0 };
    let axis: "x" | "y" | null = null;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - origin.x;
      const dy = ev.clientY - origin.y;
      if (!axis) {
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        axis = track.type === "audio" || Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      }
      if (axis === "x") {
        const at = clampTime(origin.at + dx / pxPerMs, ev.altKey);
        dispatch({ type: "edit", key, recipe: updateCue(track.id, cue.id, { at }) });
      } else {
        let value = Math.round(origin.value - (dy * 255) / (LANE_H - 2 * PAD));
        value = Math.max(0, Math.min(255, value));
        if (value < 8) value = 0;
        if (value > 247) value = 255;
        dispatch({ type: "edit", key, recipe: updateCue(track.id, cue.id, { value }) });
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Click on empty lane space: add a cue there, and keep dragging it.
  const onLaneDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as Element).closest(".cue")) return;
    const rect = laneRef.current!.getBoundingClientRect();
    const at = clampTime((e.clientX - rect.left) / pxPerMs, e.altKey);
    const key = `add:${newId("k")}`;
    let cue: Cue;

    if (track.type === "audio") {
      const before = [...track.cues].filter((c) => c.at <= at).sort((a, b) => a.at - b.at).pop();
      cue =
        before && before.kind === "play"
          ? ({ id: newId("c"), at, kind: "stop" } satisfies AudioCue)
          : ({ id: newId("c"), at, kind: "play", file: defaultSound, volume: 100 } satisfies AudioCue);
    } else {
      const level = levelSteps(track.cues, show.durationMs).find((s) => at >= s.from && at < s.to)?.value ?? 0;
      cue = { id: newId("c"), at, value: level > 0 ? 0 : 255 };
    }
    dispatch({ type: "edit", key, recipe: addCue(track.id, cue), select: { trackId: track.id, cueId: cue.id } });
    startDrag(e, cue, key);
  };

  const selectedCue = selection?.trackId === track.id ? selection.cueId : undefined;

  return (
    <div ref={laneRef} className={`lane lane-${track.type}`} style={{ width: laneW, marginLeft: ORIGIN }} onPointerDown={onLaneDown}>
      <svg className="lane-bg" width={laneW} height={LANE_H}>
        {ticks.map((t) => (
          <line key={t} x1={t * pxPerMs} x2={t * pxPerMs} y1={0} y2={LANE_H} className="grid" />
        ))}
        {track.type !== "audio" && <LevelGraph track={track} pxPerMs={pxPerMs} duration={extent} valueToY={valueToY} />}
      </svg>

      {track.type === "audio" && <AudioBlocks track={track} pxPerMs={pxPerMs} duration={extent} />}

      {track.cues.map((cue) => {
        const x = cue.at * pxPerMs;
        const y = "value" in cue ? valueToY(cue.value) : LANE_H / 2;
        const isStop = "kind" in cue && cue.kind === "stop";
        const cls = [
          "cue",
          `cue-${track.type}`,
          isStop ? "cue-stop" : "",
          cue.id === selectedCue ? "is-selected" : "",
          issueCueIds.has(cue.id) ? "has-issue" : "",
        ].join(" ");
        return (
          <div
            key={cue.id}
            className={cls}
            style={{ left: x, top: y }}
            title={cueTooltip(track, cue)}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (e.button !== 0) return;
              dispatch({ type: "select", selection: { trackId: track.id, cueId: cue.id } });
              startDrag(e, cue, `drag:${newId("k")}`);
            }}
          />
        );
      })}
    </div>
  );
}

function LevelGraph({
  track,
  pxPerMs,
  duration,
  valueToY,
}: {
  track: LevelTrack;
  pxPerMs: number;
  duration: number;
  valueToY: (v: number) => number;
}) {
  const steps = levelSteps(track.cues, duration);
  if (steps.length === 0) return null;
  const base = valueToY(0);
  let d = `M 0 ${base}`;
  for (const s of steps) {
    d += ` L ${s.from * pxPerMs} ${valueToY(s.value)} L ${s.to * pxPerMs} ${valueToY(s.value)}`;
  }
  d += ` L ${duration * pxPerMs} ${base} Z`;
  return (
    <>
      <path d={d} className={`level-fill fill-${track.type}`} />
      <line x1={0} x2={duration * pxPerMs} y1={base} y2={base} className="baseline" />
    </>
  );
}

function AudioBlocks({ track, pxPerMs, duration }: { track: Extract<Track, { type: "audio" }>; pxPerMs: number; duration: number }) {
  const sorted = [...track.cues].sort((a, b) => a.at - b.at);
  return (
    <>
      {sorted.map((c, i) => {
        if (c.kind !== "play") return null;
        const end = sorted[i + 1]?.at ?? duration;
        return (
          <div
            key={c.id}
            className="audio-block"
            style={{ left: c.at * pxPerMs, width: Math.max(2, (end - c.at) * pxPerMs) }}
          >
            <span>{c.file || "no file"}</span>
            {c.volume !== 100 && <em>{c.volume}%</em>}
          </div>
        );
      })}
    </>
  );
}

function cueTooltip(track: Track, cue: Cue): string {
  const when = fmtTime(cue.at);
  if ("value" in cue) return `${trackTitle(track)} → ${Math.round((cue.value / 255) * 100)}% at ${when}`;
  return cue.kind === "stop" ? `Stop audio at ${when}` : `Play ${cue.file} at ${when}`;
}
