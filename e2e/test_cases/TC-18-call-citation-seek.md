# TC-18 — Citation buttons seek the audio and play

| | |
|---|---|
| **Suite** | D — Call detail |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; call `004860b1ab2e4c88`; audio file present and servable |
| **Anchors** | citation buttons `@{n}s “…”`; native `<audio>` element |

## Steps

1. **Open the call** — navigate to `/calls/004860b1ab2e4c88`; wait for the audio element
   to load (`loadedmetadata`).

2. **Read the pre-click state** — note the audio `currentTime` (0) and the clock
   `0:00 / {duration}`.
   - Expected: `0:00 / {m:ss}` where `{m:ss}` matches the call duration.

3. **Click the Intent citation** — click the citation button next to `Replace lost
   credit card` (tooltip shows its `@t` timestamp).
   - Expected:
     - `audio.currentTime` jumps to ≈ the cited `t_start` (within ~1 s),
     - `audio.paused` becomes `false` (playback starts),
     - the `Playing` pill (green, pulsing dot) appears next to the transcript header,
     - the clock now reads `{t}:xx / {duration}`.

4. **Click the Resolution citation** — click the second citation button.
   - Expected: currentTime seeks to that citation's `t_start`; audio keeps playing.

5. **Pause** — click the audio's native pause control.
   - Expected: the pill reads `Paused`; `audio.paused` is `true`.

## Assertions to encode

- After citation click: `currentTime ≈ cite.t_start`, `paused == false`.
- Playing/Paused pill flips accordingly.