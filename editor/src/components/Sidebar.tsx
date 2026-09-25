import type { Dispatch } from "react";

import { stateAt } from "../show/playback";
import { MAX_DURATION_MS, MAX_OUTPUTS, type Show } from "../show/types";
import { setShowFields, setTrigger, type Action } from "../state";
import { NumField } from "./NumField";

const INPUT_NAMES = ["Button", "Radar", "Input 3", "Input 4"];

interface Props {
  show: Show;
  time: number;
  playing: boolean;
  sounds: Map<string, string>;
  onLoadSounds: (files: FileList) => void;
  dispatch: Dispatch<Action>;
}

export function Sidebar({ show, time, playing, sounds, onLoadSounds, dispatch }: Props) {
  const box = stateAt(show, time);
  const usedFiles = new Set(
    show.tracks.flatMap((t) => (t.type === "audio" ? t.cues.flatMap((c) => (c.kind === "play" ? [c.file] : [])) : [])),
  );
  const missing = [...usedFiles].filter((f) => f && !sounds.has(f));
  const dmxChannels = [...box.dmx.keys()].sort((a, b) => a - b);

  return (
    <aside className="sidebar">
      <section className="panel">
        <h2>Show</h2>
        <div className="form">
          <label>
            <span>Name</span>
            <input
              className="grow"
              value={show.name}
              onChange={(e) =>
                dispatch({ type: "edit", key: "name", recipe: setShowFields({ name: e.target.value }) })
              }
            />
          </label>
          <label>
            <span>Length</span>
            <NumField
              ariaLabel="Show length in seconds"
              value={show.durationMs}
              scale={1000}
              decimals={1}
              step={0.5}
              min={100}
              max={MAX_DURATION_MS}
              suffix="s"
              onChange={(durationMs) =>
                dispatch({ type: "edit", key: "duration", recipe: setShowFields({ durationMs }) })
              }
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <h2>Trigger</h2>
        <div className="inputs">
          {INPUT_NAMES.map((name, i) => {
            const n = i + 1;
            const on = show.trigger.inputs.includes(n);
            return (
              <button
                key={n}
                className={`input-toggle${on ? " is-on" : ""}`}
                aria-pressed={on}
                onClick={() =>
                  dispatch({
                    type: "edit",
                    recipe: setTrigger({
                      inputs: on ? show.trigger.inputs.filter((x) => x !== n) : [...show.trigger.inputs, n].sort(),
                    }),
                  })
                }
              >
                <b>{n}</b> {name}
              </button>
            );
          })}
        </div>
        <div className="form">
          <label>
            <span>Pre-delay</span>
            <NumField
              ariaLabel="Pre-delay in seconds"
              value={show.trigger.preDelayMs}
              scale={1000}
              decimals={2}
              step={0.05}
              min={0}
              max={MAX_DURATION_MS}
              suffix="s"
              onChange={(preDelayMs) =>
                dispatch({ type: "edit", key: "predelay", recipe: setTrigger({ preDelayMs }) })
              }
            />
          </label>
          <label>
            <span>Cooldown</span>
            <NumField
              ariaLabel="Cooldown in seconds"
              value={show.trigger.cooldownMs}
              scale={1000}
              decimals={1}
              step={0.5}
              min={0}
              max={MAX_DURATION_MS}
              suffix="s"
              onChange={(cooldownMs) =>
                dispatch({ type: "edit", key: "cooldown", recipe: setTrigger({ cooldownMs }) })
              }
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <h2>Sounds</h2>
        <p className="muted small">
          Load your MP3s to hear them in the preview. Copy the same files to the SD card next to show.json.
        </p>
        <label className="file-button">
          Load sound files…
          <input
            type="file"
            accept="audio/*,.mp3"
            multiple
            onChange={(e) => {
              if (e.target.files?.length) onLoadSounds(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {sounds.size > 0 && (
          <ul className="sound-list">
            {[...sounds.keys()].sort().map((name) => (
              <li key={name}>
                {name} {usedFiles.has(name) && <span className="tag">used</span>}
              </li>
            ))}
          </ul>
        )}
        {missing.length > 0 && (
          <p className="small warn">Not loaded: {missing.join(", ")}</p>
        )}
      </section>

      <section className="panel box">
        <h2>
          Box preview <span className={`run-led${playing ? " is-on" : ""}`} title="Show running" />
        </h2>
        <div className="leds">
          {Array.from({ length: MAX_OUTPUTS }, (_, i) => {
            const v = box.outputs.get(i + 1) ?? 0;
            return (
              <div key={i} className="led-cell">
                <div className="led" style={{ opacity: 0.15 + (v / 255) * 0.85, boxShadow: v ? `0 0 ${4 + v / 16}px var(--amber)` : "none" }} />
                <span>{i + 1}</span>
              </div>
            );
          })}
        </div>
        <div className="box-line">
          <span>Audio</span>
          <b>{box.audio ? `♪ ${box.audio.file}` : "—"}</b>
        </div>
        <div className="box-line">
          <span>DMX</span>
          <b>
            {dmxChannels.length === 0
              ? "—"
              : dmxChannels.map((ch) => `${ch}: ${box.dmx.get(ch)}`).join("  ·  ")}
          </b>
        </div>
      </section>
    </aside>
  );
}
