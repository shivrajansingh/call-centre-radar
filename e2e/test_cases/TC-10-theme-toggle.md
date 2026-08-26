# TC-10 — Theme toggle switches dark ↔ light and persists

| | |
|---|---|
| **Suite** | B — Dashboard |
| **Priority** | Low |
| **Preconditions** | Logged in as `admin` |
| **Anchors** | topbar theme button (title `Switch to light mode` / `Switch to dark mode`); `<html data-theme>` attr; `localStorage("radar_theme")` |

## Steps

1. **Log in and note the theme** — default theme is **dark**.
   - Expected: `<html>` element has `data-theme="dark"` (or no light attr); the topbar
     button's title is `Switch to light mode` and shows a Moon icon.

2. **Switch to light** — click the theme button.
   - Expected: the button now shows a Sun icon with title `Switch to dark mode`;
     `localStorage.getItem("radar_theme")` == `"light"`; the page background/colors
     visibly change (light background).

3. **Persist across reload** — reload the page.
   - Expected: light theme still applied (`data-theme="light"`), no flash of dark.

4. **Switch back to dark** — click the button again.
   - Expected: `radar_theme` == `"dark"`; Moon icon returns.

5. **Verify theme is app-wide** — navigate to `/calls`, then `/customers`.
   - Expected: theme persists across routes (no reset).

## Assertions to encode

- Clicking toggles button title/icon and `radar_theme` value.
- After reload the saved theme applies.