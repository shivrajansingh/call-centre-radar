# TC-42 — Reset a user's password

| | |
|---|---|
| **Suite** | H — Users (admin) |
| **Priority** | Medium |
| **Preconditions** | Logged in as `admin`; user `e2euser` exists and is active |
| **Anchors** | key button `title="Reset password"`; `window.prompt` dialog; toast `Password updated` |

## Steps

1. **Open `/users`** — the `e2euser` row has a key icon button titled `Reset password`.

2. **Trigger the reset** — click the key button.
   - Expected: a native `prompt` dialog appears asking `New password for e2euser:`.

3. **Dismiss the dialog first (cancel path)** — press Cancel/Escape.
   - Expected: no toast; nothing changes (the handler returns early on empty input).

4. **Reset with a new password** — click the key button again; type `newpass123` and
   accept.
   - Expected: toast `Password updated`.

5. **Verify the new password works** — sign out; sign in as `e2euser` / `newpass123`.
   - Expected: login succeeds (dashboard renders).

6. **Verify the old password no longer works** — sign out; try `e2euser123`.
   - Expected: red error `wrong username or password`.

## Assertions to encode

- Prompt cancel → no change.
- Accept → toast `Password updated`; new password authenticates; old one does not.