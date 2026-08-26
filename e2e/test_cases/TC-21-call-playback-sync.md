# TC-21 — Playback drives playing indicator, active-turn and word highlight

| | |
|---|---|
| **Suite** | D — Call detail |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; call `004860b1ab2e4c88` (duration ≥ 60 s recommended) |
| **Anchors** | `Playing`/`Paused` pill; `.transcript .active` turn; word-wrapped `«…»` markers; clock `{m:ss} / {m:ss}` |

## Steps

1. **Open the call** — navigate to `/calls/004860b1ab2e4c88`.

2. **Start playback** — click the audio element's native play control.
   - Expected: the pill flips to `Playing` (green pulse dot); the clock advances
     (`0:01`, `0:02`, …).

3. **Verify active-turn highlight** — watch the transcript during playback.
   - Expected: the turn containing the current time gets the `.active` class (border
     highlight); the active turn auto-scrolls into view when the list is long.

4. **Verify word-level highlight** — pause playback briefly and inspect the active turn.
   - Expected: the current word is wrapped in `«»` markers (e.g.
     `«card» lost its card`) — driven by a binary search over the words array.

5. **Advance the clock programmatically** — set `audio.currentTime = 41` via
   evaluate, then wait ~500 ms.
   - Expected: the active turn changes to the turn containing 41 s (the one after the
     mood shift at 40.16 s); word highlight moves accordingly; the clock reads `0:41`.

6. **Pause** — click pause.
   - Expected: pill reads `Paused`; clock freezes.

## Assertions to encode

- Pill text flips `Paused` → `Playing` and back.
- Setting `currentTime` moves the active turn + `«…»` word marker.
- Clock reflects `currentTime`.