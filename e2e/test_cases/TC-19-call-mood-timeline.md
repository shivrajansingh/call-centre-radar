# TC-19 — Mood timeline renders shift marker and seeks on click

| | |
|---|---|
| **Suite** | D — Call detail |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; call `004860b1ab2e4c88` (mood shift `neutral → positive` @ 40.16 s) |
| **Anchors** | card `Mood timeline`; `.timeline` with dots; `.tl-shift` ⚡ marker; text `Shift to {mood} at {n}s` |

## Steps

1. **Open the call** — navigate to `/calls/004860b1ab2e4c88`.
   - Expected: `Mood timeline` card shows `neutral` → `positive` mood badges at its top.

2. **Inspect the timeline bar** — the horizontal bar contains:
   - mood dots for each `mood_timeline` point (tooltip `{mood} @ {t}s — click to hear`),
   - a ⚡ shift marker positioned at `mood_shift_t / max * 100`% width (40.16 s →
     roughly mid-bar).
   - Expected: shift marker is present and sits between the start and end of the bar.

3. **Read the shift caption** — below the bar.
   - Expected: text `Shift to positive at 40s` plus a citation button
     `@40s “{quote}”` citing the moment the mood shifted.

4. **Click the shift marker** — click the ⚡ marker.
   - Expected: `audio.currentTime ≈ 40.16`; audio starts playing; `Playing` pill visible.

5. **Click a mood dot** — click the first timeline dot.
   - Expected: audio seeks to that dot's timestamp and plays.

## Assertions to encode

- Shift marker exists for calls with `mood_shift_t != null`.
- Clicking marker/dot seeks audio to the announced timestamp.