# TC-17 — Call detail verdicts: summary, intent, resolution, mood with citations

| | |
|---|---|
| **Suite** | D — Call detail |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; call `004860b1ab2e4c88` analyzed (11 turns, 106 words) |
| **Anchors** | h1 `Mary Smith with Robert`; card `Summary`; meta rows `Intent`, `Resolution`, `Mood`; citation buttons `@{n}s “…”` |

## Steps

1. **Open the call** — navigate to `/calls/004860b1ab2e4c88`.
   - Expected: page loads; h1 `Mary Smith with Robert` with both names linked
     (`/customers/1`, `/agents/1`); meta line below: `{date} · {duration}s · 004860b1ab2e4c88`.
   - Expected: top-right shows an attention ScoreBadge (`5`) and a ResBadge (`resolved`).

2. **Summary card** — the `Summary` card shows:
   - a paragraph with the AI summary (≤ 40 words) — e.g. starting
     `Caller Mary Smith reported a lost credit card…`;
   - an `Intent` row: label `Replace lost credit card` + a citation button
     `@{t}s “{quote}”` (accent-blue, dotted underline, truncated);
   - a `Resolution` row: badge `resolved` + a citation button;
   - a `Mood` row: `neutral` → `positive` mood badges.
   - Expected: all rows present; each citation button has a tooltip
     `“{quote}” @ {t}s`.

3. **Cross-check citations** — hover each citation button (or read its `title`).
   - Expected: the quote text appears verbatim in the transcript section further down
     (same words, same timestamp ±3 s).

4. **Unverified citation variant (conditional)** — for a call with an unverified quote.
   - Expected: the citation renders in **red** (text-bad) and its tooltip ends with
     `— quote not verified against transcript`.

## Assertions to encode

- h1 + meta line contain the sid and both names.
- `Intent`/`Resolution`/`Mood` rows exist with citation buttons.
- Citation tooltip text matches transcript words near the cited time.