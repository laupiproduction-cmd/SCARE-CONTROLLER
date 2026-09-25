import type { Dispatch } from "react";

import { fmtTime, trackTitle } from "../show/io";
import type { Issue, Show } from "../show/types";
import { removeCue, setAudioCueKind, updateCue, type Action, type Selection } from "../state";
import { NumField } from "./NumField";

interface Props {
  show: Show;
  selection: Selection | null;
  issues: Issue[];
  soundNames: string[];
  defaultSound: string;
  dispatch: Dispatch<Action>;
}

export function Inspector({ show, selection, issues, soundNames, defaultSound, dispatch }: Props) {
  const track = selection ? show.tracks.find((t) => t.id === selection.trackId) : undefined;
  const cue = track && selection?.cueId ? track.cues.find((c) => c.id === selection.cueId) : undefined;

  return (
    <aside className="inspector">
      <section className="panel">
        <h2>Cue</h2>
        {!track && <Help />}
        {track && !cue && (
          <p className="muted">
            <strong>{trackTitle(track)}</strong>
            <br />
            Click on its lane to add a cue, or click a dot to edit one.
          </p>
        )}
        {track && cue && (
          <div className="form">
            <div className="form-title">{trackTitle(track)}</div>

            <label>
              <span>Time</span>
              <NumField
                ariaLabel="Cue time in seconds"
                value={cue.at}
                scale={1000}
                decimals={2}
                step={0.05}
                min={0}
                max={show.durationMs}
                suffix="s"
                onChange={(at) =>
                  dispatch({ type: "edit", key: `at:${cue.id}`, recipe: updateCue(track.id, cue.id, { at }) })
                }
              />
            </label>

            {"value" in cue && (
              <>
                <label>
                  <span>Level</span>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={cue.value}
                    onChange={(e) =>
                      dispatch({
                        type: "edit",
                        key: `value:${cue.id}`,
                        recipe: updateCue(track.id, cue.id, { value: Number(e.target.value) }),
                      })
                    }
                  />
                  <NumField
                    ariaLabel="Level 0 to 255"
                    value={cue.value}
                    min={0}
                    max={255}
                    width={44}
                    onChange={(value) =>
                      dispatch({ type: "edit", key: `value:${cue.id}`, recipe: updateCue(track.id, cue.id, { value }) })
                    }
                  />
                </label>
                <div className="quick">
                  {[
                    ["Off", 0],
                    ["25%", 64],
                    ["50%", 128],
                    ["Full", 255],
                  ].map(([name, v]) => (
                    <button
                      key={name}
                      className={cue.value === v ? "is-on" : ""}
                      onClick={() =>
                        dispatch({ type: "edit", recipe: updateCue(track.id, cue.id, { value: v as number }) })
                      }
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </>
            )}

            {"kind" in cue && (
              <>
                <div className="quick">
                  <button
                    className={cue.kind === "play" ? "is-on" : ""}
                    onClick={() =>
                      cue.kind !== "play" &&
                      dispatch({ type: "edit", recipe: setAudioCueKind(track.id, cue.id, "play", defaultSound) })
                    }
                  >
                    ▶ Play sound
                  </button>
                  <button
                    className={cue.kind === "stop" ? "is-on" : ""}
                    onClick={() =>
                      cue.kind !== "stop" && dispatch({ type: "edit", recipe: setAudioCueKind(track.id, cue.id, "stop") })
                    }
                  >
                    ■ Stop
                  </button>
                </div>
                {cue.kind === "play" && (
                  <>
                    <label>
                      <span>File</span>
                      <input
                        className="grow"
                        list="sound-files"
                        value={cue.file}
                        placeholder="scream.mp3"
                        onChange={(e) =>
                          dispatch({
                            type: "edit",
                            key: `file:${cue.id}`,
                            recipe: updateCue(track.id, cue.id, { file: e.target.value }),
                          })
                        }
                      />
                    </label>
                    <datalist id="sound-files">
                      {soundNames.map((n) => (
                        <option key={n} value={n} />
                      ))}
                    </datalist>
                    <label>
                      <span>Volume</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={cue.volume}
                        onChange={(e) =>
                          dispatch({
                            type: "edit",
                            key: `vol:${cue.id}`,
                            recipe: updateCue(track.id, cue.id, { volume: Number(e.target.value) }),
                          })
                        }
                      />
                      <span className="value">{cue.volume}%</span>
                    </label>
                  </>
                )}
              </>
            )}

            <button
              className="danger"
              onClick={() => dispatch({ type: "edit", recipe: removeCue(track.id, cue.id), select: { trackId: track.id } })}
            >
              Delete cue
            </button>
          </div>
        )}
      </section>

      <section className="panel issues">
        <h2>
          Issues <span className={`badge ${issues.length ? "badge-bad" : "badge-ok"}`}>{issues.length || "✓"}</span>
        </h2>
        {issues.length === 0 ? (
          <p className="muted">No problems. The box will accept this show.</p>
        ) : (
          <ul>
            {issues.map((issue, i) => (
              <li key={i}>
                <button
                  disabled={!issue.trackId}
                  onClick={() =>
                    issue.trackId &&
                    dispatch({ type: "select", selection: { trackId: issue.trackId, cueId: issue.cueId } })
                  }
                >
                  <strong>{issue.path}</strong> {issue.message}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

function Help() {
  return (
    <div className="help">
      <p className="muted">Select a cue on the timeline to edit it.</p>
      <ul>
        <li>
          <b>Click</b> a lane to add a cue
        </li>
        <li>
          <b>Drag</b> a dot sideways to move it, up/down to change the level
        </li>
        <li>
          <kbd>Alt</kbd> while dragging turns off snapping
        </li>
        <li>
          <kbd>Space</kbd> play / pause · <kbd>Del</kbd> delete cue
        </li>
        <li>
          <kbd>←</kbd>/<kbd>→</kbd> nudge cue ({fmtTime(50)}, <kbd>Shift</kbd> {fmtTime(500)})
        </li>
        <li>
          <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo · <kbd>Ctrl</kbd>+<kbd>S</kbd> save
        </li>
      </ul>
    </div>
  );
}
