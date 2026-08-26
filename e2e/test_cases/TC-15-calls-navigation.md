# TC-15 — Row click and customer/agent links navigate

| | |
|---|---|
| **Suite** | C — Calls list |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; row for `004860b1ab2e4c88` visible (search the sid first if needed) |
| **Anchors** | table row (hover effect); Customer link; Agent link |

## Steps

1. **Open `/calls`** — search `004860b1ab2e4c88` so the target row is the only one.

2. **Hover the row** — move the pointer over the row.
   - Expected: row background shifts (hover class), cursor is a pointer.

3. **Click the row body** — click on the Intent cell (any cell except the two links).
   - Expected: URL becomes `/calls/004860b1ab2e4c88`; the call detail page renders with
     h1 `Mary Smith with Robert`.

4. **Go back to `/calls`** — navigate back (click `Calls` back-link or browser back).
   - Expected: search/filters were reset (page reload), so re-search the sid.

5. **Click the Customer link** — click `Mary Smith` in the Customer cell.
   - Expected: navigates to `/customers/1`; profile heading `Mary Smith` with
     `{n} calls in total`.

6. **Click the Agent link** — go back, re-search, click `Robert` in the Agent cell.
   - Expected: navigates to `/agents/1`; heading `Robert` with `{n} calls handled`.

## Assertions to encode

- Row click → `/calls/{sid}` (and NOT when clicking nested links).
- Customer link → `/customers/{customer_id}`; Agent link → `/agents/{agent_id}`.