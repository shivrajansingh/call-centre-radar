# TC-36 — Invalid metadata JSON blocks upload

| | |
|---|---|
| **Suite** | G — Upload |
| **Priority** | Medium |
| **Preconditions** | Logged in as `admin`; fixture `data/audio/004860b1ab2e4c88.mp3` |
| **Anchors** | textarea `Metadata JSON (optional)`; red `ErrorBox` `metadata must be valid JSON`; disabled `Upload (1 file)` button |

## Steps

1. **Open `/upload`** — add the mp3 fixture so the button reads `Upload (1 file)` and is
   enabled.

2. **Enter malformed JSON** — type `{"session": oops` into the metadata textarea.
   - Expected: a red error box `metadata must be valid JSON` appears under the textarea;
     the submit button becomes **disabled**.

3. **Fix the JSON** — replace with valid JSON, e.g.
   `{"session": "e2e", "labels": {"caller_mos": 4}}`.
   - Expected: the error box disappears; the button is enabled again.

4. **Submit with valid JSON** — click `Upload (1 file)`.
   - Expected: upload proceeds (see TC-37 for the success flow).

## Assertions to encode

- Malformed JSON → error box shown + submit disabled.
- Valid JSON → error gone + submit enabled.