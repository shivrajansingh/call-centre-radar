# TC-39 — Create a user with validation

| | |
|---|---|
| **Suite** | H — Users (admin) |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; username `e2euser` does not exist yet |
| **Anchors** | button `New user`; modal `Create a user`; inputs `Full name` / `Username` / `Password`; select `Role`; buttons `Cancel` / `Create user`; toast `User created` |

## Steps

1. **Open `/users`** — click `New user`.
   - Expected: modal `Create a user` opens with fields `Full name`, `Username`,
     `Password` (placeholder `min 6 characters`), a `Role` select (default
     `manager`), `Cancel`, and a **disabled** `Create user`.

2. **Check validation rules** — with all fields empty:
   - Expected: `Create user` disabled. It must stay disabled while:
     - name empty, username empty, or
     - password shorter than 6 chars (`password.length < 6`).

3. **Type a short password** — name `E2E User`, username `e2euser`, password `abc`.
   - Expected: button remains disabled.

4. **Type a valid password** — change password to `e2euser123`.
   - Expected: button becomes enabled.

5. **Choose a role** — set `Role` to `agent`.
   - Expected: select shows `agent`.

6. **Create** — click `Create user`.
   - Expected: button briefly reads `Creating…`; toast `User created`; modal closes;
     the table refreshes and the new row appears: `E2E User`, `e2euser`, role select
     `agent`, status pill `active`.

7. **Duplicate username (optional)** — reopen the modal and repeat with username
   `e2euser` again.
   - Expected: error toast from the API (409) is shown; modal stays open.

## Assertions to encode

- Button gating: name+username required, password ≥ 6 chars.
- Toast `User created` + row appears with chosen role.
- Duplicate username surfaces the 409 error toast.