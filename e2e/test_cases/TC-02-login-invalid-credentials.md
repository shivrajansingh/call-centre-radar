# TC-02 — Login with invalid credentials shows an error

| | |
|---|---|
| **Suite** | A — Authentication |
| **Priority** | High |
| **Preconditions** | App running; `radar_token` cleared; stay on `/login` |
| **Test data** | username `admin`, password `wrongpass` (also cover an unknown username) |
| **Anchors** | error box `ErrorBox` (red, AlertTriangle icon) containing `wrong username or password` |

## Steps

1. **Open `/login`** — navigate to `http://localhost:8081/login`.
   - Expected: login card is visible.

2. **Enter wrong password** — type `admin` / `wrongpass`, click `Sign in`.
   - Expected: an inline red error box appears under the Password field containing
     `wrong username or password`; the page stays on `/login` (no redirect).

3. **Enter unknown username** — clear the fields; type `nobody` / `admin123`, click `Sign in`.
   - Expected: same red error box `wrong username or password` appears again.

4. **Confirm no session was created** — evaluate `localStorage.getItem("radar_token")`.
   - Expected: `null` — a failed login must never persist a token.

## Assertions to encode

- Error text `wrong username or password` visible after each attempt.
- URL stays `/login`.
- Token remains absent from localStorage.