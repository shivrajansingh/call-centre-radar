# TC-28 — Customer profile shows KPIs and full call history

| | |
|---|---|
| **Suite** | E — Customers |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; customer `Mary Smith` (id 1) has calls |
| **Anchors** | back link `Customers`; h1 `Mary Smith`; subtitle `{n} calls in total`; KPI labels `Total calls Resolution rate Avg attention Avg QA stars`; section `Call history` |

## Steps

1. **Open the profile** — navigate to `/customers/1`.
   - Expected: back link `Customers` → `/customers`; h1 `Mary Smith`; subtitle
     `{n} calls in total`.

2. **Check the KPI cards**:
   - `Total calls` — equals the directory count.
   - `Resolution rate` — `{pct}%` with sub `{r} resolved · {u} unresolved`.
   - `Avg attention` — score badge (value from API) with sub `across all calls`.
   - `Avg QA stars` — `{n.n}` or `–`.
   - Expected: values match `GET /customers/1` → `stats`.

3. **Call history table** — section `Call history` with hint `newest first`; headers:
   `Date`, `Agent`, `Intent`, `Mood`, `Status`, `Score`, `Summary`.
   - Expected: one row per call of this customer; each row shows the agent link
     (`/agents/{id}`), intent label (truncated, title tooltip), mood badge, resolution
     badge, score badge and truncated summary (title tooltip).

4. **Click a history row** — click the row for sid `004860b1ab2e4c88`.
   - Expected: navigates to `/calls/004860b1ab2e4c88`.

5. **Agent link from history** — go back and click the agent name.
   - Expected: `/agents/{agent_id}` profile opens.

## Assertions to encode

- KPI values match `/customers/{id}` stats payload.
- History rows == `calls` array; row click → `/calls/{sid}`.