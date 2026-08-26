# TC-41 — Enable / disable a user

| | |
|---|---|
| **Suite** | H — Users (admin) |
| **Priority** | Medium |
| **Preconditions** | Logged in as `admin`; user `e2euser` exists and is `active`; it must NOT be the admin's own account |
| **Anchors** | status pill `active` / `disabled`; ShieldCheck toggle button (title `Disable` / `Enable`); toast `{name} disabled` / `{name} enabled` |

## Steps

1. **Open `/users`** — the `e2euser` row shows the green pill `active` and a button
   titled `Disable` (ShieldCheck icon).

2. **Disable the user** — click `Disable`.
   - Expected: toast `E2E User disabled`; the pill flips to the red `disabled` state;
     the button title becomes `Enable`.

3. **Verify login is blocked** — sign out; try signing in as `e2euser` / `e2euser123`.
   - Expected: login fails with the red error `wrong username or password`
     (the API ignores disabled users); the token is never stored.

4. **Re-enable** — sign back in as `admin`, navigate to `/users`, click `Enable`.
   - Expected: toast `E2E User enabled`; pill back to `active`; login works again.

5. **Verify own-account protection** — check the `Administrator` row's action buttons.
   - Expected: no `Disable`/trash buttons on the admin's own row (only password
     reset remains).

## Assertions to encode

- Disable → pill `disabled`, toast, login rejected.
- Enable → pill `active`, login accepted.
- Admin's own row has no disable/delete actions.