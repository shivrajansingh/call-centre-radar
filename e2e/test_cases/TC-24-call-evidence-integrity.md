# TC-24 — Evidence integrity footer reflects verified citations

| | |
|---|---|
| **Suite** | D — Call detail |
| **Priority** | Medium |
| **Preconditions** | Logged in as `admin`; pick one call with `citations_verified = 1.0` and one with `< 0.9` if available |
| **Anchors** | footer bar with `CheckCircle2` (green) or `ShieldAlert` (red); text `Evidence integrity: {n}% of citations verified verbatim against the transcript` |

## Steps

1. **Open a fully-verified call** — navigate to `/calls/004860b1ab2e4c88`
   (`citations_verified = 1.0`).
   - Expected: at the bottom of the page a green-bordered bar with a checkmark icon and
     `Evidence integrity: 100% of citations verified verbatim against the transcript ·
     model {model}`.

2. **Check the percentage** — compare rendered % with the API value.
   - Expected: `Math.round(citations_verified * 100)%` matches.

3. **Open a partially-verified call (conditional)** — if any call has
   `citations_verified < 0.9` (query `GET /calls` for `citations_verified`).
   - Expected: red-bordered bar with ShieldAlert icon and the same sentence with the
     lower percentage; its citations render in red.

## Assertions to encode

- Green bar + check icon when ≥ 0.9; red bar + shield icon otherwise.
- Percentage text matches `round(citations_verified*100)%`.