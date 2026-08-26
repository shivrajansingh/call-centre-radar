# TC-30 — Agent leaderboard renders and search filters it

| | |
|---|---|
| **Suite** | F — Agents |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; seeded agents exist (e.g. `Robert` id 1, `Elizabeth` id 7) |
| **Anchors** | h1 `Agents`; subtitle `{n} agents · ranked by volume`; search placeholder `Search agents…`; table headers `Agent Volume Handle time Resolution rate Avg attention Mood shifts Avg QA stars` |

## Steps

1. **Open `/agents`** — the leaderboard page.
   - Expected: h1 `Agents`; subtitle `{n} agents · ranked by volume`; search input;
     `Register agent` button (admin/manager only).

2. **Check the table headers** — in order: `Agent`, `Volume`, `Handle time`,
   `Resolution rate`, `Avg attention`, `Mood shifts`, `Avg QA stars`.
   - Expected: header row present.

3. **Inspect a row** — find `Robert`:
   - `Agent` — bold name,
   - `Volume` — a horizontal bar (width proportional to the top agent's count) + count,
   - `Handle time` — `{n}s` or `–`,
   - `Resolution rate` — `{pct}%` or `–`,
   - `Avg attention` — score badge,
   - `Mood shifts` — count,
   - `Avg QA stars` — star rating or `–`.
   - Expected: all cells populated per `GET /agents`.

4. **Check ranking** — the top row has the highest `Volume` count.
   - Expected: volumes are non-increasing top-to-bottom.

5. **Search** — type `Eliz`.
   - Expected: instant client-side filter; only `Elizabeth` remains.

6. **No-match search** — type `zzz`.
   - Expected: `Empty` placeholder (`No data yet`).

## Assertions to encode

- Headers in order; volumes non-increasing.
- Client-side search filtering.
- Row values match the `/agents` payload.