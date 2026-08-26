# TC-14 — Sort by attention score

| | |
|---|---|
| **Suite** | C — Calls list |
| **Priority** | Medium |
| **Preconditions** | Logged in as `admin`; calls with differing attention scores |
| **Anchors** | select with options `Newest first` / `Highest attention`; subtitle `sorted by attention score` |

## Steps

1. **Open `/calls`** — the sort select defaults to `Newest first`.

2. **Switch to `Highest attention`** — select it.
   - Expected: subtitle reads `{n} shown · sorted by attention score`; the Score column
     values are non-increasing down the page; URL contains `sort=attention`.

3. **Verify against the API** — fetch `GET /calls?sort=attention&limit=25&offset=0`.
   - Expected: the rendered first-row sid matches the API's first result.

4. **Switch back to `Newest first`** — select it.
   - Expected: subtitle reads `sorted by recency`; `sort=attention` removed from URL.

## Assertions to encode

- Subtitle text flips between `recency` and `attention score`.
- Score badges are non-increasing when sorted by attention.