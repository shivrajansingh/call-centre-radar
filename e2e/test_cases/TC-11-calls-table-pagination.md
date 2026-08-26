# TC-11 — Calls table renders rows and paginates

| | |
|---|---|
| **Suite** | C — Calls list |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; ≥ 50 analyzed calls in the DB |
| **Anchors** | h1 `Calls`; subtitle `{n} shown · sorted by …`; table headers `Date Customer Agent Intent Status Score Mood QA Handle`; buttons `Prev` / `Next`; text `page 1` |

## Steps

1. **Open the calls page** — navigate to `/calls`.
   - Expected: h1 `Calls`; subtitle `25 shown · sorted by recency` (default sort).

2. **Check the table headers** — the table must show columns in order:
   `Date`, `Customer`, `Agent`, `Intent`, `Status`, `Score`, `Mood`, `QA`, `Handle`.
   - Expected: header row is visible inside the card.

3. **Check one data row** — inspect the first row:
   - `Date` — a date string or `–` (dataset calls have `started_at = null` → `–`);
     tooltip on the cell shows the full timestamp when present.
   - `Customer` — a blue link, e.g. `Mary Smith`.
   - `Agent` — a dim link, e.g. `Robert`.
   - `Intent` — truncated label with `title` tooltip, e.g. `Replace lost credit card`
     (or a status chip if unanalyzed).
   - `Status` — a resolution badge (`resolved` green / `partial` amber / `unresolved` red).
   - `Score` — a score badge (number, colored by severity).
   - `Mood` — a mood badge (e.g. `positive`).
   - `QA` — star rating or `–`.
   - `Handle` — duration like `123s`.
   - Expected: exactly **25 rows** on page 1.

4. **Go to page 2** — click `Next`.
   - Expected: subtitle still reads `25 shown`; the page indicator reads `page 2`;
     the first row's content differs from page 1.

5. **Return to page 1** — click `Prev`.
   - Expected: `page 1` indicator; same first row as step 3.

6. **Check `Prev` disabled state** — on page 1.
   - Expected: `Prev` button is disabled (opacity + `disabled` attribute); `Next` is
     enabled.

## Assertions to encode

- 25 `tr` rows on first page.
- Headers in the exact order listed.
- `Prev` disabled on page 1; page indicator toggles 1 ↔ 2.