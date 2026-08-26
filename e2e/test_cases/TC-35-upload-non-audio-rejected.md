# TC-35 — Non-audio files are rejected with a toast

| | |
|---|---|
| **Suite** | G — Upload |
| **Priority** | Medium |
| **Preconditions** | Logged in as `admin`; a temp text file e.g. `/tmp/notes.txt` |
| **Anchors** | toast `Only audio files are supported`; file row list |

## Steps

1. **Open `/upload`** — click the dropzone and select `/tmp/notes.txt`
   (or `setInputFiles` the hidden input with a `.txt` fixture).
   - Expected: **no** file row appears; an error toast (red left border)
     `Only audio files are supported` appears bottom-right and auto-dismisses in ~4 s.

2. **Verify the queue is empty** — the file area under the dropzone shows nothing; the
   submit button reads `Upload` and is disabled.

3. **Mixed selection (conditional)** — select both a `.mp3` and a `.txt` in one
   `setInputFiles` call.
   - Expected: only the `.mp3` is added (the filter drops non-audio); the toast fires
     for the rejected file; button reads `Upload (1 file)`.

## Assertions to encode

- Non-audio selection → toast `Only audio files are supported`, no queue entry.
- Mixed selection keeps only audio files.