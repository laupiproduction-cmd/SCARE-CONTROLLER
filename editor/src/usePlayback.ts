// Preview playback: moves a playhead in real time and plays the sound files
// the user loaded, so a show can be checked without the box.

import { useCallback, useEffect, useRef, useState } from "react";

import { stateAt } from "./show/playback";
import type { Show } from "./show/types";

export function usePlayback(show: Show, sounds: Map<string, string>) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  const showRef = useRef(show);
  const soundsRef = useRef(sounds);
  showRef.current = show;
  soundsRef.current = sounds;

  const clock = useRef({ wallStart: 0, showStart: 0 });
  const audio = useRef<{ key: string; el: HTMLAudioElement } | null>(null);

  const stopAudio = useCallback(() => {
    audio.current?.el.pause();
    audio.current = null;
  }, []);

  // Keep the preview audio in step with what the box would be playing at t.
  const syncAudio = useCallback(
    (t: number) => {
      const want = stateAt(showRef.current, t).audio;
      const key = want ? `${want.file}@${want.since}` : "";
      if (audio.current?.key === key) return;
      stopAudio();
      if (!want) return;
      const url = soundsRef.current.get(want.file);
      if (!url) return;
      const el = new Audio(url);
      el.volume = Math.min(1, Math.max(0, want.volume / 100));
      el.currentTime = Math.max(0, (t - want.since) / 1000);
      void el.play().catch(() => {});
      audio.current = { key, el };
    },
    [stopAudio],
  );

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const t = clock.current.showStart + (performance.now() - clock.current.wallStart);
      const end = showRef.current.durationMs;
      if (t >= end) {
        setTime(end);
        setPlaying(false);
        stopAudio();
        return;
      }
      setTime(t);
      syncAudio(t);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, stopAudio, syncAudio]);

  useEffect(() => stopAudio, [stopAudio]);

  // Keep the playhead inside the show when it gets shorter.
  useEffect(() => {
    if (time > show.durationMs) setTime(show.durationMs);
  }, [show.durationMs, time]);

  const play = useCallback(() => {
    const start = time >= showRef.current.durationMs ? 0 : time;
    clock.current = { wallStart: performance.now(), showStart: start };
    setTime(start);
    setPlaying(true);
  }, [time]);

  const pause = useCallback(() => {
    setPlaying(false);
    stopAudio();
  }, [stopAudio]);

  const seek = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(t, showRef.current.durationMs));
      clock.current = { wallStart: performance.now(), showStart: clamped };
      setTime(clamped);
      stopAudio();
    },
    [stopAudio],
  );

  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play]);

  return { time, playing, play, pause, seek, toggle };
}
