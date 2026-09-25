# Show file format (v1)

A show is one JSON file, `show.json`, stored in the root of the SD card next to its sound files. The desktop editor writes it and the controller reads it at boot. Both sides build against this document, so change it here first.

## Example

```json
{
  "format": "scare-show",
  "version": 1,
  "name": "Screaming closet",
  "durationMs": 6000,
  "trigger": {
    "inputs": [1, 2],
    "preDelayMs": 250,
    "cooldownMs": 3000
  },
  "tracks": [
    {
      "type": "audio",
      "cues": [
        { "at": 0, "play": "scream.mp3", "volume": 90 },
        { "at": 5500, "stop": true }
      ]
    },
    {
      "type": "output",
      "channel": 1,
      "label": "Strobe",
      "cues": [
        { "at": 0, "value": 255 },
        { "at": 1500, "value": 0 }
      ]
    },
    {
      "type": "output",
      "channel": 2,
      "label": "Red wash (dimmed)",
      "cues": [
        { "at": 200, "value": 128 },
        { "at": 4000, "value": 0 }
      ]
    },
    {
      "type": "dmx",
      "channel": 1,
      "label": "Fogger",
      "cues": [
        { "at": 500, "value": 255 },
        { "at": 2500, "value": 0 }
      ]
    }
  ]
}
```

The same file lives in [`examples/closet-scare.json`](examples/closet-scare.json).

## Top level

| Field | Type | Required | Meaning |
|---|---|---|---|
| `format` | string | yes | Always `"scare-show"`. |
| `version` | integer | yes | Format version. This document describes `1`. |
| `name` | string | no | Display name. |
| `durationMs` | integer | yes | Length of the show in milliseconds, 1 to 3,600,000. When it ends, every output and DMX channel the show touched goes back to 0 and audio stops. |
| `trigger` | object | yes | See below. |
| `tracks` | array | yes | Timeline tracks, see below. |

## `trigger`

| Field | Type | Default | Meaning |
|---|---|---|---|
| `inputs` | array of integers | — | Which trigger inputs start the show (1 to 4). At least one. |
| `preDelayMs` | integer | 0 | Wait this long after the trigger before the show starts. |
| `cooldownMs` | integer | 0 | After the show ends, ignore triggers for this long so it doesn't re-fire on the same guest. |

Triggers are ignored while a show is waiting, running or cooling down.

## Tracks

Every track has a `type` and a list of `cues`. Each cue has `at`, its time in milliseconds from the start of the show, which must be between 0 and `durationMs`. Cues within a track don't have to be sorted; the controller sorts them. Cues at the same time fire in file order.

### `audio`
Plays MP3 files from the SD card. Starting a new file stops the one playing.

- `{ "at": 0, "play": "scream.mp3", "volume": 90 }` plays a file. `volume` is 0–100 and defaults to 100. File names are relative to the SD card root.
- `{ "at": 5500, "stop": true }` stops playback.

### `output`
A solid-state output (lamp, valve, motor), `channel` 1 to 8.

- `{ "at": 0, "value": 255 }` sets the level: 0 is off, 255 is fully on, anything between dims the output with PWM. The matching status LED on the box is lit while the value is above 0.

### `dmx`
A DMX channel, `channel` 1 to 512. `{ "at": 500, "value": 255 }` sets it to 0–255.

`label` is optional on every track and is only used by the editor.

## Validation

The controller refuses to run a show that breaks any rule above and reports the reason over the USB serial port. Unknown fields are ignored, so newer editors can add data without breaking older firmware.
