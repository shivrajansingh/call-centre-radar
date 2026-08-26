# TC-34 — Files added to the queue with size and remove

| | |
|---|---|
| **Suite** | G — Upload |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; fixture file `data/audio/004860b1ab2e4c88.mp3` exists; nothing uploaded yet in this test |
| **Anchors** | dropzone `Drop call recordings here`; hidden `input[type=file]`; file rows with name + `{n} KB` + ✕ remove button; button `Upload (N files)` |

## Steps

1. **Open `/upload`** — the dropzone is visible: `Drop call recordings here` +
   `or click to browse · MP3, stereo (agent left, caller right)`.

2. **Add a file via the file chooser** — click the dropzone and select
   `data/audio/004860b1ab2e4c88.mp3` (or use Playwright's `setInputFiles` on the hidden
   input).
   - Expected: a file row appears under the dropzone showing the file name, its size in
     KB (e.g. `118 KB`), and a ✕ remove button; the submit button reads
     `Upload (1 file)` and is enabled.

3. **Add a second file** — repeat with `data/audio/ff0296d00e5e4184.mp3`.
   - Expected: two file rows; button reads `Upload (2 files)`.

4. **Remove the first file** — click the ✕ on the first row.
   - Expected: first row disappears; the second remains; button reads `Upload (1 file)`.

5. **Remove the last file** — click the ✕.
   - Expected: file area empties; button returns to `Upload` and is **disabled**.

6. **Verify the drag state (optional)** — trigger a drag-over on the dropzone.
   - Expected: the dropzone highlights (accent border + tint); it clears on drag-leave.

## Assertions to encode

- File rows list name, size, remove button.
- Button label reflects count; disabled with 0 files.