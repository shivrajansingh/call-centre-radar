# TC-26 — Customer directory renders and search filters it

| | |
|---|---|
| **Suite** | E — Customers |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; seeded customers exist (e.g. `Mary Smith` id 1) |
| **Anchors** | h1 `Customers`; subtitle `{n} customers · {m} shown`; search placeholder `Search customers…`; table headers `Customer Calls Unresolved Avg attention Avg QA stars Last call` |

## Steps

1. **Open `/customers`** — the directory page.
   - Expected: h1 `Customers`; subtitle `{total} customers · {total} shown`;
     a search input; a `Register customer` button (admin/manager only).

2. **Check the table headers** — in order: `Customer`, `Calls`, `Unresolved`,
   `Avg attention`, `Avg QA stars`, `Last call`.
   - Expected: header row present.

3. **Inspect a customer row** — find `Mary Smith`:
   - `Customer` — bold link `Mary Smith`,
   - `Calls` — bold count (e.g. `3`),
   - `Unresolved` — amber number when > 0, dim `0` otherwise,
   - `Avg attention` — score badge,
   - `Avg QA stars` — star rating or `–`,
   - `Last call` — a date or `–` (dataset calls → `–`).
   - Expected: all cells populated per the API payload.

4. **Search** — type `Mary` into the search input.
   - Expected: client-side filter narrows to rows containing `Mary`
     (`1 customer · 1 shown`); no refetch (instant).

5. **No-match search** — type `zzz`.
   - Expected: subtitle shows `0 shown`; placeholder `No customers`.

6. **Clear search** — empty the input.
   - Expected: full list returns.

## Assertions to encode

- Headers in order; subtitle updates with search.
- Search is client-side (no network refetch needed).
- `Mary Smith` row shows all six cells.