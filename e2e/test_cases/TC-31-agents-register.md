# TC-31 — Register an agent (manager/admin)

| | |
|---|---|
| **Suite** | F — Agents |
| **Priority** | High |
| **Preconditions** | Logged in as `admin`; no agent named `E2E Test Agent` yet |
| **Anchors** | button `Register agent`; modal `Register an agent`; input placeholder `e.g. Sam Carter`; buttons `Cancel` / `Register`; toast `Agent registered`; h1 `E2E Test Agent` |

## Steps

1. **Open `/agents`** — click `Register agent`.
   - Expected: modal `Register an agent` opens with a `Full name` input (autofocused,
     placeholder `e.g. Sam Carter`), `Cancel`, and a disabled `Register` button.

2. **Empty name** — confirm `Register` is disabled while the name is empty.

3. **Enter a name** — type `E2E Test Agent`.
   - Expected: `Register` becomes enabled.

4. **Register** — click `Register`.
   - Expected: toast `Agent registered`; modal closes; navigates to `/agents/{new-id}`
     with heading `E2E Test Agent` and `0 calls handled`.

5. **Verify in the leaderboard** — navigate back to `/agents`, search
   `E2E Test Agent`.
   - Expected: row present with `0` volume, `–` handle time, `–` resolution rate,
     `–` attention, `0` mood shifts.

## Assertions to encode

- Register disabled until a non-empty name.
- Toast `Agent registered` + redirect to `/agents/{id}`.
- New agent visible in the leaderboard.