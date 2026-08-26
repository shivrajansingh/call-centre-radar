# TC-37 — Successful upload queues the call

| | |
|---|---|
| **Suite** | G — Upload |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; fixture `data/audio/004860b1ab2e4c88.mp3`; the recording is not already re-uploaded (each upload creates a new call record) |
| **Anchors** | form inputs `Caller name (optional)` / `Agent name (optional)`; toast `{name} queued ({sid})`; green panel `1 call queued`; link `view call →` |

## Steps

1. **Open `/upload`** — add the fixture file; the button reads `Upload (1 file)`.

2. **Fill the optional fields** — `Caller name (optional)` = `E2E Caller`;
   `Agent name (optional)` = `E2E Agent`.
   - Expected: fields accept input; the button stays enabled.

3. **Upload** — click `Upload (1 file)`.
   - Expected: button briefly reads `Uploading…`; an OK toast appears:
     `004860b1ab2e4c88.mp3 queued ({sid})` where `{sid}` is the new 16-hex call id.

4. **Check the "What happens next" panel** — the green panel appears:
   `1 call queued` + the new sid + a `view call →` link.
   - Expected: exactly one entry; sid matches the toast.

5. **Open the queued call** — click `view call →`.
   - Expected: navigates to `/calls/{new-sid}`; the detail page renders the
     "Awaiting transcription" status box (the pipeline has not run yet), with the
     customer `E2E Caller` and agent `E2E Agent` in the h1.

6. **Verify the queue state via API** — `GET /calls/{new-sid}`.
   - Expected: `source: "upload"`, `transcribed_at: null`, `analyzed_at: null`.

7. **Cleanup note** — the uploaded record can be left in place; it will be transcribed
   by the next `scripts/backfill.py --uploads` run (not part of this test).

## Assertions to encode

- Toast text `{filename} queued ({sid})`.
- Done panel shows `1 call queued` + link → `/calls/{sid}`.
- New call detail shows the awaiting-pipeline status and provided names.