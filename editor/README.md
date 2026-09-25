# Editor

Desktop show editor for the scare controller. It builds a `show.json` for the SD card in the format described in [`docs/show-format.md`](../docs/show-format.md).

Right now it runs in the browser (Vite + React + TypeScript). Wrapping it in Tauri for a real desktop app comes later; the code won't need to change much.

## Run it

Needs Node.js (LTS). In this folder:

```
npm install      # once
npm run dev      # opens at http://localhost:5173
```

Other commands:

- `npm test` – unit tests for reading, validating and writing show files
- `npm run build` – production build into `dist/`
- `npm run typecheck` – TypeScript check

## Using it

- **Click** a lane to add a cue. On an output or DMX lane it toggles the level (off → full, on → off); on the audio lane it adds "play" or "stop".
- **Drag** a cue sideways to move it in time, or up/down to change the level. Hold `Alt` to turn off snapping.
- The **inspector** on the right edits the selected cue exactly (time, level, sound file, volume).
- **Load sound files** in the sidebar to hear your MP3s during preview. They are not uploaded anywhere; copy the same files to the SD card.
- **Save show.json** downloads the file. Copy it to the SD card root.
- The **Issues** panel uses the same rules as the firmware, so if it says "Ready for the box", the controller will accept the show.

Shortcuts: `Space` play/pause, `Home` back to start, `Delete` remove cue, `←`/`→` nudge cue (`Shift` for bigger steps), `Ctrl+Z`/`Ctrl+Y` undo/redo, `Ctrl+S` save, `Ctrl+O` open, `Esc` deselect.

## Code map

- `src/show/` – show model, JSON import/export, validation, preview state (no React; unit-tested)
- `src/state.ts` – editor state with undo/redo
- `src/usePlayback.ts` – preview clock and audio
- `src/components/` – timeline, sidebar, inspector
