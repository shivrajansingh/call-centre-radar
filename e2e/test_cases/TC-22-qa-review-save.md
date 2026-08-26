# TC-22 — QA review: save a rating with note

| | |
|---|---|
| **Suite** | D — Call detail |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; open a call WITHOUT an existing review by this user (e.g. `01f7ec3700424bc0`) |
| **Anchors** | card `QA review`; star row labelled `Your rating`; textarea `Notes for the agent (optional)…`; buttons `Save review` / `Update review`; toast `Review saved` |

## Steps

1. **Open a clean call** — navigate to `/calls/01f7ec3700424bc0` (no reviews by admin).
   - Expected: `QA review` card shows `Your rating` + 5 star buttons, the notes
     textarea, and the button `Save review`; the right side shows
     `No QA reviews yet`.

2. **Try saving without rating (pre-flight)** — click `Save review` with no stars.
   - Expected: error toast `Pick a star rating` appears; nothing is saved.

3. **Rate the call** — click the 4th star.
   - Expected: the star row shows `4/5`; stars 1–4 are amber/highlighted.

4. **Add a note** — type `Great de-escalation.` into the notes textarea.

5. **Save** — click `Save review`.
   - Expected: button briefly reads `Saving…`; toast `Review saved` appears; the page
     re-fetches the call (list refreshes).

6. **Verify the saved review** — the review list on the right now shows:
   - reviewer name `Administrator`, a 4-star rating, the note `Great de-escalation.`,
   - a timestamp,
   - a trash (delete) button because it's the current user's review.
   - Expected: all present; the button text now reads `Update review` (upsert mode).

## Assertions to encode

- Toast `Review saved` appears.
- New review row appears with name, stars, note, delete button.
- Zero-star submit shows toast `Pick a star rating`.