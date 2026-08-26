# TC-08 — Trending issues render with counts and open rates

| | |
|---|---|
| **Suite** | B — Dashboard |
| **Priority** | Medium |
| **Preconditions** | Logged in as `admin`; `GET /trending` returns issues |
| **Anchors** | section h2 `Trending issues`; per-row: label, count, `% open` |

## Steps

1. **Open the dashboard** — navigate to `/`.
   - Expected: section heading `Trending issues` with the hint `clustered by intent`.

2. **Verify the rows** — the section lists up to 10 issues; each row shows:
   - the issue label (truncated, e.g. `Replace lost credit card`),
   - a proportional progress bar (width relative to the top issue's count),
   - the call count (bold number),
   - `{n}% open` (e.g. `34% open`; rendered amber when `unresolved_rate > 0.3`).

3. **Cross-check ordering** — compare rows against `GET /trending`.
   - Expected: rows are ordered by descending count; the top issue's bar is ~100% wide.

4. **Check the empty state (conditional)** — if no issues exist.
   - Expected: an `Empty` placeholder (`No data yet`).

## Assertions to encode

- Section heading visible; 1–10 rows rendered.
- Each row has a label, count, and `% open` text; open rate matches
  `round(unresolved_rate * 100)%`.