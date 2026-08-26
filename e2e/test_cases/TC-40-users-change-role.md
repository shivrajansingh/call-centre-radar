# TC-40 — Change a user's role

| | |
|---|---|
| **Suite** | H — Users (admin) |
| **Priority** | Medium |
| **Preconditions** | Logged in as `admin`; user `e2euser` exists (from TC-39); admin's own row must stay untouched |
| **Anchors** | per-row role `<select>`; toast `{name} is now {role}`; status pill |

## Steps

1. **Open `/users`** — locate the row for `e2euser` (role `agent` from TC-39).

2. **Check the admin row's select** — the `Administrator` row.
   - Expected: its role select is **disabled** (`disabled` attribute) — a user cannot
     change their own role.

3. **Change `e2euser` to manager** — open the row's role select, pick `manager`.
   - Expected: toast `E2E User is now manager`; the select now shows `manager`.

4. **Verify persistence** — reload the page.
   - Expected: the select still shows `manager` (persisted via `PATCH /users/{id}`).

5. **Verify the effect** — sign out; sign in as `e2euser` / `e2euser123`.
   - Expected: topbar role pill reads `manager`; the sidebar now includes `Upload`.

## Assertions to encode

- Own-role select is disabled.
- Role change → toast + persisted after reload; login reflects the new role.