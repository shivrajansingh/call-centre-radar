# TC-07 — "Needs a manager's attention" queue renders ranked calls

| | |
|---|---|
| **Suite** | B — Dashboard |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; dataset analyzed (attention queue non-empty) |
| **Anchors** | section h2 `Needs a manager's attention`; link `View all →`; per-item: score badge, customer name, agent name, intent, reason chips, mood badge |

## Steps

1. **Open the dashboard** — navigate to `/`.
   - Expected: section heading `Needs a manager's attention` with an AlertTriangle icon
     and a `View all →` link to `/calls?sort=attention`.

2. **Verify the queue is ranked** — the section shows up to 8 call items. Compare the
   first item's score badge against the second item's.
   - Expected: scores are non-increasing top-to-bottom (matches `recency_weighted_score`
     order from `GET /attention`).

3. **Inspect one queue item** — each item must show:
   - a score badge (0–100),
   - customer name (bold) `· agent name`,
   - a resolution badge (`resolved` / `partial` / `unresolved`),
   - the intent label (e.g. `Replace lost credit card`),
   - up to 2 attention-reason chips (accent pills, e.g. `caller expressed frustration`),
   - a mood badge (the shift-to mood) and a date (dataset calls show `–`).

4. **Verify item links to the call** — click the first item.
   - Expected: navigates to `/calls/{sid}` and the call detail page renders
     (heading `{Customer} with {Agent}`).

5. **Return and use `View all →`** — go back to `/`, click `View all →`.
   - Expected: lands on `/calls?sort=attention`; the select shows `Highest attention`
     and the table is sorted by attention score.

## Assertions to encode

- Queue renders 1–8 items; items are links to `/calls/{sid}`.
- Each item contains score badge, customer name, agent name, resolution badge, intent,
  reason chip(s).
- `View all →` navigates to `/calls?sort=attention`.