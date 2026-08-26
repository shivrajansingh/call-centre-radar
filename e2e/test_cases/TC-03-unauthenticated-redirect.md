# TC-03 — Unauthenticated user is redirected to /login

| | |
|---|---|
| **Suite** | A — Authentication |
| **Priority** | High |
| **Preconditions** | App running; `radar_token` cleared (signed out) |
| **Anchors** | heading `Call-Centre Radar`; login card |

## Steps

1. **Clear session** — ensure `localStorage` has no `radar_token` (fresh browser context
   or `localStorage.clear()` first).

2. **Hit a protected route directly** — navigate to `http://localhost:8081/calls`.
   - Expected: the app does **not** render the Calls page; it redirects to `/login` and
     the login card (`Call-Centre Radar`) is shown.

3. **Repeat for other protected routes** — navigate directly to
   `http://localhost:8081/customers`, `/agents`, `/upload`, `/users`, and `/`.
   - Expected: every route redirects to `/login` while unauthenticated.

## Assertions to encode

- Visiting `/calls`, `/customers`, `/agents`, `/upload`, `/users`, `/` while logged out
  lands on `/login`.
- The login card is visible in each case.