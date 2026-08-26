# TC-12 — Search filters the calls table

| | |
|---|---|
| **Suite** | C — Calls list |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; seeded data present |
| **Anchors** | search input placeholder `Search customer, agent, intent, call ID…`; Enter key; subtitle `{n} shown` |

## Steps

1. **Open `/calls`** — the search input is at the top-left of the card with a magnifier
   icon.

2. **Search by customer name** — type `Mary Smith` into the search input, press **Enter**.
   - Expected: table refetches; every visible row's Customer cell contains `Mary Smith`;
     subtitle reflects the filtered count; URL contains `q=Mary%20Smith`.

3. **Search by intent** — clear and search `credit card`.
   - Expected: rows' Intent cells contain `credit card`; count > 0 on the seeded dataset.

4. **Search by call ID** — search the exact sid `004860b1ab2e4c88`.
   - Expected: exactly 1 row; its Customer cell is `Mary Smith`.

5. **Search with no matches** — search `zzz-no-such-call-xyz`.
   - Expected: an `Empty` placeholder `No calls match`; no table rows.

6. **Clear the search** — clear the input, press **Enter**.
   - Expected: full 25-row first page returns; `q` removed from URL.

## Assertions to encode

- Enter (not just typing) triggers the refetch; URL syncs to `q=…`.
- Filtered results respect the query on Customer / Intent / sid.
- No-match query shows `No calls match`.