# TC-16 — Dashboard deep-links land on the filtered calls page

| | |
|---|---|
| **Suite** | C — Calls list |
| **Priority** | Medium |
| **Preconditions** | Logged in as `admin` |
| **Anchors** | dashboard links `All calls →` (header) and `View all →` (attention section) |

## Steps

1. **Open the dashboard** — navigate to `/`.

2. **Click `All calls →`** — the link in the page header (top-right).
   - Expected: lands on `/calls`; sort select shows `Newest first`; 25 rows shown.

3. **Return to the dashboard** — navigate back to `/`.

4. **Click `View all →`** — the link in the "Needs a manager's attention" card.
   - Expected: lands on `/calls?sort=attention`; the sort select reads
     `Highest attention`; the table is sorted by attention (Score column non-increasing);
     subtitle `sorted by attention score`.

## Assertions to encode

- `All calls →` → `/calls` with default sort.
- `View all →` → `/calls?sort=attention` with attention sort applied.