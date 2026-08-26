# TC-06 — Dashboard KPI cards render with correct values

| | |
|---|---|
| **Suite** | B — Dashboard |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; DB seeded with the 1,441-call dataset |
| **Anchors** | h1 `Operations dashboard`; KPI labels `Total calls`, `Resolution rate`, `Avg handle time`, `Avg survey rating` |

## Steps

1. **Open the dashboard** — navigate to `/`.
   - Expected: h1 `Operations dashboard` and the subtitle `Live view across {N} recorded
     calls` (N = `total_calls` from `/kpis`, 1,441 on the seeded DB).

2. **Check the four KPI cards** — locate the cards by label:
   - `Total calls` — value is an integer (1,441); sub-line reads
     `{transcribed} transcribed · {analyzed} analyzed`.
   - `Resolution rate` — value is a percentage; sub-line `{resolved} resolved · {unresolved} unresolved`.
   - `Avg handle time` — value like `345s` (or `–` if null).
   - `Avg survey rating` — value like `7.2` (or `–`); optional sub `partner {n}`.
   - Expected: all four cards render side by side (2-col on small, 4-col on xl).

3. **Cross-check against the API** — fetch `GET /kpis` and compare the rendered values.
   - Expected: `Total calls` == `kpis.total_calls`; `Resolution rate` ==
     `round(resolved/analyzed*100)%`; handle time == rounded `avg_handle_time_s` + `s`.

4. **Check the critical indicator (conditional)** — if `kpis.avg_attention.critical > 0`.
   - Expected: a pulsing red dot + `{critical} critical` badge next to `All calls →`.

## Assertions to encode

- All four KPI labels are visible; values match the `/kpis` payload.
- Sub-line of `Total calls` contains the transcribed/analyzed split.