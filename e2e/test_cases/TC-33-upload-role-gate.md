# TC-33 — Upload is role-gated (agent blocked, manager allowed)

| | |
|---|---|
| **Suite** | G — Upload |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; an `agent`-role user exists (create via `POST /users` or the Users page if needed, e.g. `e2eagent` / `e2eagent123`) |
| **Anchors** | sidebar nav `Upload`; route `/upload`; redirect to `/` |

## Part 1 — admin sees Upload

1. **Log in as `admin`** — open the sidebar.
   - Expected: nav contains `Upload` (between `Agents` and `Users`).

2. **Open `/upload`**.
   - Expected: h1 `Upload recordings` renders.

## Part 2 — agent is blocked

3. **Log out and log in as the agent user** — sign out via avatar → sign in as
   `e2eagent` / `e2eagent123`.
   - Expected: sidebar shows only `Dashboard`, `Calls`, `Customers`, `Agents` — **no**
     `Upload` and **no** `Users` links.

4. **Try `/upload` directly** — navigate to `http://localhost:8081/upload`.
   - Expected: redirected to `/` (the `Guard roles=["admin","manager"]` rejects the
     agent); the dashboard renders.

## Part 3 — manager is allowed

5. **Log in as a manager-role user** (create one via admin if needed, e.g.
   `e2emanager` / `e2emanager123`).
   - Expected: sidebar has `Upload` but **not** `Users`; `/upload` renders the upload
     page.

## Assertions to encode

- Agent: no `Upload` nav item; direct `/upload` → redirect `/`.
- Manager: `Upload` nav item present; page accessible.