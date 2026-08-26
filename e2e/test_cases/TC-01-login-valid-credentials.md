# TC-01 — Login with valid credentials

| | |
|---|---|
| **Suite** | A — Authentication |
| **Priority** | High (gateway to every other test) |
| **Preconditions** | App + API + DB running; `localStorage.radar_token` cleared (fresh session) |
| **Test data** | username `admin`, password `admin123` |
| **Anchors** | input placeholders `admin`, `••••••••`; button `Sign in`; h1 `Operations dashboard` |

## Steps

1. **Open the login page** — navigate to `http://localhost:8081/login`.
   - Expected: page shows the "Call-Centre Radar" card; heading `Sign in` (browser tab title);
     a `Username` field (autofocused) with placeholder `admin`, a `Password` field with
     placeholder `••••••••`, a `Sign in` button, and the hint
     `Default credentials: admin / admin123`.

2. **Enter credentials** — type `admin` into the Username field, `admin123` into the
   Password field.

3. **Submit** — click the `Sign in` button.
   - Expected: button briefly reads `Signing in…`; the URL changes to `/` and the
     dashboard renders with heading `Operations dashboard`.

4. **Verify identity in the topbar** — check the top-right of the header.
   - Expected: header shows the user's name `Administrator` and a role pill `admin`;
     the sidebar footer shows the role badge `admin`.

## Assertions to encode

- URL becomes `/` after submit.
- h1 `Operations dashboard` is visible.
- Topbar contains `Administrator` and `admin`.
- `localStorage.getItem("radar_token")` is non-empty.