import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import example from "../../docs/examples/closet-scare.json";
import { Inspector } from "./components/Inspector";
import { Sidebar } from "./components/Sidebar";
import { Timeline } from "./components/Timeline";
import { emptyShow, fmtTime, parseShowJson, serializeShow, validateShow } from "./show/io";
import type { Show } from "./show/types";
import { initState, reducer, removeCue, updateCue } from "./state";
import { usePlayback } from "./usePlayback";

function exampleShow(): Show {
  const r = parseShowJson(JSON.stringify(example));
  return r.ok ? r.show : emptyShow();
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initState(exampleShow()));
  const { show, selection } = state;
  const [zoom, setZoom] = useState(0.15); // pixels per millisecond
  const [sounds, setSounds] = useState<Map<string, string>>(new Map());
  const [notice, setNotice] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const playback = usePlayback(show, sounds);
  const issues = useMemo(() => validateShow(show), [show]);
  const issueCueIds = useMemo(() => new Set(issues.flatMap((i) => (i.cueId ? [i.cueId] : []))), [issues]);
  const issueTrackIds = useMemo(() => new Set(issues.flatMap((i) => (i.trackId ? [i.trackId] : []))), [issues]);

  const soundNames = useMemo(() => [...sounds.keys()].sort(), [sounds]);
  const defaultSound = useMemo(() => {
    for (const t of show.tracks) {
      if (t.type !== "audio") continue;
      const last = [...t.cues].reverse().find((c) => c.kind === "play" && c.file);
      if (last && last.kind === "play") return last.file;
    }
    return soundNames[0] ?? "sound.mp3";
  }, [show, soundNames]);

  // ------------------------------------------------------------ files

  const confirmDiscard = () => !state.dirty || window.confirm("Discard unsaved changes to this show?");

  const newShow = () => {
    if (!confirmDiscard()) return;
    playback.pause();
    playback.seek(0);
    dispatch({ type: "load", show: emptyShow() });
    setNotice(null);
  };

  const openFile = async (file: File) => {
    const result = parseShowJson(await file.text());
    if (!result.ok) {
      setNotice({ kind: "error", text: `Couldn't open ${file.name}: ${result.error}` });
      return;
    }
    playback.pause();
    playback.seek(0);
    dispatch({ type: "load", show: result.show });
    setNotice({ kind: "info", text: `Opened ${file.name}` });
  };

  const save = useCallback(() => {
    const blob = new Blob([serializeShow(show)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "show.json";
    a.click();
    URL.revokeObjectURL(url);
    dispatch({ type: "markSaved" });
    setNotice(
      issues.length
        ? { kind: "error", text: `Saved show.json, but it has ${issues.length} issue(s) - the box will refuse it until they're fixed.` }
        : { kind: "info", text: "Saved show.json. Copy it to the SD card root together with its sound files." },
    );
  }, [show, issues.length]);

  const loadSounds = (files: FileList) => {
    setSounds((prev) => {
      const next = new Map(prev);
      for (const f of Array.from(files)) {
        const old = next.get(f.name);
        if (old) URL.revokeObjectURL(old);
        next.set(f.name, URL.createObjectURL(f));
      }
      return next;
    });
  };

  // Warn before closing the window with unsaved changes.
  useEffect(() => {
    if (!state.dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.dirty]);

  // ------------------------------------------------------------ keyboard

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest("input, textarea, select");
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
        return;
      }
      if (mod && e.key.toLowerCase() === "o") {
        e.preventDefault();
        fileInput.current?.click();
        return;
      }
      if (typing) return;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      } else if (e.key === " ") {
        e.preventDefault();
        playback.toggle();
      } else if (e.key === "Home") {
        playback.seek(0);
      } else if (selection?.cueId && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        dispatch({ type: "edit", recipe: removeCue(selection.trackId, selection.cueId), select: { trackId: selection.trackId } });
      } else if (selection?.cueId && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const track = show.tracks.find((t) => t.id === selection.trackId);
        const cue = track?.cues.find((c) => c.id === selection.cueId);
        if (!cue) return;
        const step = (e.shiftKey ? 500 : 50) * (e.key === "ArrowLeft" ? -1 : 1);
        const at = Math.max(0, Math.min(show.durationMs, cue.at + step));
        dispatch({ type: "edit", key: `nudge:${cue.id}`, recipe: updateCue(selection.trackId, cue.id, { at }) });
      } else if (e.key === "Escape") {
        dispatch({ type: "select", selection: null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, playback, selection, show]);

  // ------------------------------------------------------------ render

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand">
          <span className="brand-mark">◉</span> Scare Show Editor
        </div>

        <div className="group">
          <button onClick={newShow}>New</button>
          <button onClick={() => confirmDiscard() && fileInput.current?.click()}>Open…</button>
          <button className="primary" onClick={save}>
            Save show.json{state.dirty && <span className="dirty-dot" title="Unsaved changes" />}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void openFile(f);
              e.target.value = "";
            }}
          />
        </div>

        <div className="group">
          <button title="Undo (Ctrl+Z)" disabled={!state.past.length} onClick={() => dispatch({ type: "undo" })}>
            ↶
          </button>
          <button title="Redo (Ctrl+Y)" disabled={!state.future.length} onClick={() => dispatch({ type: "redo" })}>
            ↷
          </button>
        </div>

        <div className="group transport">
          <button title="Back to start (Home)" onClick={() => playback.seek(0)}>
            ⏮
          </button>
          <button className="play" title="Play / pause (Space)" onClick={playback.toggle}>
            {playback.playing ? "⏸" : "▶"}
          </button>
          <span className="clock">
            {fmtTime(playback.time)} <small>/ {fmtTime(show.durationMs)}</small>
          </span>
        </div>

        <div className="group zoom">
          <span>Zoom</span>
          <input
            type="range"
            min={-4.5}
            max={0}
            step={0.01}
            value={Math.log(zoom)}
            onChange={(e) => setZoom(Math.exp(Number(e.target.value)))}
            aria-label="Timeline zoom"
          />
        </div>

        <div className="spacer" />
        <div className={`status ${issues.length ? "status-bad" : "status-ok"}`}>
          {issues.length ? `${issues.length} issue${issues.length > 1 ? "s" : ""}` : "Ready for the box"}
        </div>
      </header>

      {notice && (
        <div className={`notice notice-${notice.kind}`}>
          {notice.text}
          <button onClick={() => setNotice(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      <main className="workspace">
        <Sidebar
          show={show}
          time={playback.time}
          playing={playback.playing}
          sounds={sounds}
          onLoadSounds={loadSounds}
          dispatch={dispatch}
        />
        <Timeline
          show={show}
          selection={selection}
          pxPerMs={zoom}
          time={playback.time}
          issueCueIds={issueCueIds}
          issueTrackIds={issueTrackIds}
          defaultSound={defaultSound}
          dispatch={dispatch}
          onSeek={playback.seek}
        />
        <Inspector
          show={show}
          selection={selection}
          issues={issues}
          soundNames={soundNames}
          defaultSound={defaultSound}
          dispatch={dispatch}
        />
      </main>
    </div>
  );
}
