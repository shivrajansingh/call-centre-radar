# TC-38 — Users page is admin-only

| | |
|---|---|
| **Suite** | H — Users (admin) |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; a manager-role user exists (e.g. `e2emanager`) |
| **Anchors** | sidebar nav `Users`; route `/users`; redirect to `/`; h1 `Users & roles` |

## Part 1 — admin access

1. **Log in as `admin`** — open the sidebar.
   - Expected: nav contains `Users` (bottom item, ShieldCheck icon).

2. **Open `/users`**.
   - Expected: h1 `Users & roles` with the subtitle `admin · manager · agent — manage
     access to the system`; the `New user` button is visible.

## Part 2 — manager blocked

3. **Sign out; sign in as `e2emanager`** — the sidebar must show `Upload` but **not**
   `Users`.

4. **Try `/users` directly**.
   - Expected: redirected to `/` (Guard roles `["admin"]`); the dashboard renders.

5. **Confirm via API (optional)** — `GET /users` with the manager token.
   - Expected: HTTP 403 `admin required`.

## Assertions to encode

- Admin sees the `Users` nav item and page.
- Manager/agent get redirected from `/users` to `/`.