# TC-23 — QA review: zero stars blocked; own review deletable

| | |
|---|---|
| **Suite** | D — Call detail |
| **Priority** | Medium |
| **Preconditions** | Logged in as `admin`; continue from TC-22 (admin has a review on `01f7ec3700424bc0`) |
| **Anchors** | star row; toast `Pick a star rating`; trash button `title="Delete review"`; toast `Review deleted` |

## Part 1 — validation

1. **Open the call** — navigate to `/calls/01f7ec3700424bc0`.

2. **Set stars to 0 then submit** — click the currently-filled 4th star **once more**
   (with `StarRating`, the value stays 4 — instead verify via a call with `unrated`
   state): open a fresh call (e.g. `004860b1ab2e4c88` has no admin review) and click
   `Save review` with 0 stars.
   - Expected: toast `Pick a star rating`; no review created; list unchanged.

## Part 2 — delete own review

3. **Open the call with admin's review** — navigate to `/calls/01f7ec3700424bc0`
   (or whichever call TC-22 used).
   - Expected: review row shows `Administrator` + its stars + note + trash button.

4. **Delete it** — click the trash button (`title="Delete review"`).
   - Expected: toast `Review deleted`; the review row disappears; right side returns to
     `No QA reviews yet`; the button reverts to `Save review`.

5. **Confirm via API (optional)** — `GET /calls/{sid}/reviews`.
   - Expected: admin's review id no longer present.

## Assertions to encode

- 0 stars → toast `Pick a star rating`, list unchanged.
- Delete only possible on the current user's own review (no trash on others').
- Delete → toast `Review deleted` + row removed.