# TC-04 — Session persists across reload

| | |
|---|---|
| **Suite** | A — Authentication |
| **Priority** | Medium |
| **Preconditions** | App running; logged in once as `admin` / `admin123` |
| **Anchors** | h1 `Operations dashboard`; topbar user name `Administrator` |

## Steps

1. **Log in** — sign in as `admin` / `admin123`; land on the dashboard.

2. **Verify token stored** — evaluate `localStorage.getItem("radar_token")`.
   - Expected: a non-empty HMAC token string.

3. **Reload the page** — press Cmd+R / call `page.reload()`.
   - Expected: no redirect to `/login`; the dashboard renders again (the AuthProvider
     re-fetches `/auth/me` with the stored token).

4. **Navigate and reload again** — go to `/calls`, reload.
   - Expected: Calls page renders; still authenticated; topbar still shows `Administrator · admin`.

## Assertions to encode

- After reload, URL stays on the same route and the app shell (sidebar + topbar) renders.
- Token survives `page.reload()`.