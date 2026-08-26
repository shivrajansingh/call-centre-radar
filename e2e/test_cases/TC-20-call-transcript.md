# TC-20 — Transcript turns render with speakers and timestamps

| | |
|---|---|
| **Suite** | D — Call detail |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; call `004860b1ab2e4c88` |
| **Anchors** | card `Recording & transcript`; turn rows with `{t}s` timestamp, `Agent`/`Caller` label, text |

## Steps

1. **Open the call** — navigate to `/calls/004860b1ab2e4c88`.
   - Expected: the `Recording & transcript` card contains the native `<audio controls>`
     element and a transcript list.

2. **Verify turn structure** — the transcript shows **11 turns** (dataset call); each
   turn row contains:
   - a leading timestamp `{t.toFixed(1)}s` (e.g. `3.6s`),
   - a speaker label `Agent` (accent blue) or `Caller` (green),
   - the spoken text.
   - Expected: speaker labels alternate sensibly (first turn `Agent`:
     `Hello, this is Hubbard Valley National Bank…`); timestamps are non-decreasing.

3. **Verify the first turn** — the first row reads `3.6s Agent` + the greeting text.
   - Expected: matches the API payload `GET /calls/004860b1ab2e4c88` → `turns[0]`.

4. **Click a turn row** — click the third turn.
   - Expected: `audio.currentTime` jumps to that turn's `start`; audio plays.

5. **Cross-check with the API** — compare turn count and timestamps.
   - Expected: rendered turns == API `turns` array (same count, same start/end/text).

## Assertions to encode

- Turn count matches API; first turn shows `3.6s Agent` + greeting.
- Row click seeks audio to `turn.start`.