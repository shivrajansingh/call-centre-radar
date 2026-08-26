# TC-09 — Charts and quick stats render

| | |
|---|---|
| **Suite** | B — Dashboard |
| **Priority** | Medium |
| **Preconditions** | Logged in as `admin`; analyzed data present so charts are non-empty |
| **Anchors** | h2 `Calls over time`, `Resolution split`, `Customer mood mix`, `Quick stats` |

## Steps

1. **Open the dashboard** — navigate to `/`.
   - Expected: the chart row renders two cards side by side.

2. **Calls over time chart** — the card `Calls over time` shows the hint
   `last 14 days · unresolved overlay` and an SVG area chart with an x-axis of dates.
   - Expected: chart elements render (svg paths); hover a point if possible — a tooltip
     with the date appears (tooltip styling: `var(--panel2)` background).

3. **Resolution split donut** — the card `Resolution split` shows a donut (inner radius
   ~52, outer ~82) plus a legend.
   - Expected: legend entries match the non-zero split (`Resolved`, `Partial`,
     `Unresolved`) with counts; colors green/amber/red respectively.
   - Conditional: if all three are 0 the card shows `No analyzed calls yet`.

4. **Customer mood mix** — the card `Customer mood mix` shows vertical bars labelled
   with mood badges (`positive`, `neutral`, `concerned`, `frustrated`, `angry`,
   `anxious`) and counts.
   - Expected: bars render; each mood has its own color per the `MOOD_FILL` map.

5. **Quick stats grid** — the card `Quick stats` shows a 2-column grid of
   `Avg attention score`, `Critical calls (≥70)`, `QA reviews filed`, `Avg QA stars`,
   `Survey (ease of connection)`, `Processing errors`.
   - Expected: six cells, each with a label and a value; `Processing errors` renders
     amber when > 0.

## Assertions to encode

- All four card headings visible.
- SVG elements exist inside the chart cards.
- `Quick stats` shows the six expected labels.