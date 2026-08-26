# TC-25 — Customer survey card renders when data exists

| | |
|---|---|
| **Suite** | D — Call detail |
| **Priority** | Low |
| **Preconditions** | Logged in as `admin`; find a call with survey fields via `GET /calls` (dataset calls have `null`; uploaded calls with metadata may carry values) |
| **Anchors** | card label `Customer survey`; rows `Ease of connection {n}/10`, `Partner rating {n}/10`, `MOS {n}` |

## Steps

1. **Find a call with survey data** — call the API:
   `GET /calls?limit=200` and locate a row where `survey_ease`, `survey_partner` or
   `caller_mos` is non-null. If none exists, skip (data-dependent test) or seed one via
   upload with `{"labels":{"caller_mos":…}}` metadata.

2. **Open that call** — navigate to `/calls/{sid}`.
   - Expected: a `Customer survey` card appears (only when at least one of the three
     fields is non-null) showing:
     - `Ease of connection {n}/10` (star icon, amber),
     - `Partner rating {n}/10`,
     - `MOS {n}`.
   - Expected: fields with null values render `–/10` or `–`.

3. **Contrast with a dataset call** — open `/calls/004860b1ab2e4c88`.
   - Expected: **no** survey card at all (all three fields null).

## Assertions to encode

- Survey card visible iff any survey field is non-null.
- Values match the API payload; missing fields render `–`.