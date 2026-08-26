# TC-32 — Agent profile shows stats and calls handled

| | |
|---|---|
| **Suite** | F — Agents |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; agent `Robert` (id 1) has calls |
| **Anchors** | back link `Agents`; h1 `Robert`; subtitle `{n} calls handled`; KPI labels `Calls handled Avg handle time Resolution rate Mood-shift rate`; section `Calls handled` |

## Steps

1. **Open the profile** — navigate to `/agents/1`.
   - Expected: back link `Agents` → `/agents`; h1 `Robert`; subtitle `{n} calls handled`.

2. **Check the KPI cards**:
   - `Calls handled` — count.
   - `Avg handle time` — `{n}s` or `–`.
   - `Resolution rate` — `{pct}%` with sub `{r} resolved · {u} unresolved`.
   - `Mood-shift rate` — `{pct}%` with sub `{m} calls turned negative`.
   - Expected: values match `GET /agents/1` → `stats`; the mood-shift card tone is
     green/amber/red based on the rate (25%/10% thresholds).

3. **Calls handled table** — section `Calls handled` with hint
   `avg attention {n} · avg QA {n.n}`; headers: `Date`, `Customer`, `Intent`, `Mood`,
   `Status`, `Score`, `Summary`.
   - Expected: one row per call handled; customer cell links to `/customers/{id}`;
     intent/summary truncated with tooltips.

4. **Click a row** — click the row containing sid `004860b1ab2e4c88`.
   - Expected: navigates to `/calls/004860b1ab2e4c88`.

5. **Customer link from the table** — go back; click the customer name.
   - Expected: `/customers/{id}` profile opens.

## Assertions to encode

- KPI values match `/agents/{id}` stats payload.
- Rows == `calls` array; row click → `/calls/{sid}`; customer link → `/customers/{id}`.