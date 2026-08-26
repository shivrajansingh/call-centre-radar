# TC-05 — Sign out via avatar menu

| | |
|---|---|
| **Suite** | A — Authentication |
| **Priority** | High |
| **Preconditions** | App running; logged in as `admin` / `admin123` |
| **Anchors** | topbar avatar button (initials `AD`); menu item `Sign out`; heading `Call-Centre Radar` |

## Steps

1. **Log in** — sign in as `admin` / `admin123`; land on the dashboard.

2. **Open the avatar menu** — click the circular avatar button (initials `AD`) in the
   top-right corner.
   - Expected: a dropdown opens showing the user's name `Administrator`, username
     `admin`, and a red `Sign out` item.

3. **Sign out** — click `Sign out`.
   - Expected: the app navigates to `/login` and the login card is shown.

4. **Verify token removed** — evaluate `localStorage.getItem("radar_token")`.
   - Expected: `null`.

5. **Verify the route is guarded again** — try navigating to `/calls`.
   - Expected: redirect back to `/login`.

## Assertions to encode

- Clicking `Sign out` lands on `/login`.
- Token is removed from localStorage.
- Protected routes redirect to `/login` after logout.