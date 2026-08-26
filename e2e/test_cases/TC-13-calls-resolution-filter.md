# TC-13 — Resolution filter narrows the table

| | |
|---|---|
| **Suite** | C — Calls list |
| **Priority** | Medium |
| **Preconditions** | Logged in as `admin`; DB contains resolved, partial and unresolved calls |
| **Anchors** | select with options `All resolutions` / `Resolved` / `Partial` / `Unresolved`; Status column badges |

## Steps

1. **Open `/calls`** — the resolution select sits next to the search input and defaults
   to `All resolutions`.

2. **Filter `Unresolved`** — select `Unresolved`.
   - Expected: the table refetches immediately (no Enter needed); every row's Status
     badge reads `unresolved`; URL contains `resolution=unresolved`; subtitle shows the
     filtered count.

3. **Filter `Resolved`** — select `Resolved`.
   - Expected: every Status badge reads `resolved`; URL `resolution=resolved`.

4. **Filter `Partial`** — select `Partial`.
   - Expected: every Status badge reads `partial` (or `No calls match` if none exist —
     treat as a valid state).

5. **Reset** — select `All resolutions`.
   - Expected: mixed statuses return; `resolution` removed from the URL.

## Assertions to encode

- Selecting an option refetches without page reload.
- All rendered Status badges match the chosen filter.
- URL reflects `resolution=`.