# TC-27 — Register a customer (manager/admin)

| | |
|---|---|
| **Suite** | E — Customers |
| **Priority** | High |
| **Preconditions** | Logged in as `admin` (manager works too); no customer named `E2E Test Customer` yet |
| **Anchors** | button `Register customer`; modal `Register a customer`; input placeholder `e.g. Jane Doe`; buttons `Cancel` / `Register`; toast `Customer registered`; h1 `E2E Test Customer` |

## Steps

1. **Open `/customers`** — click `Register customer`.
   - Expected: modal `Register a customer` opens with a `Full name` input
     (autofocused, placeholder `e.g. Jane Doe`), a `Cancel` button and a disabled
     `Register` button.

2. **Check the disabled state** — with an empty name.
   - Expected: `Register` is disabled.

3. **Enter a name** — type `E2E Test Customer`.
   - Expected: `Register` becomes enabled.

4. **Register** — click `Register`.
   - Expected: toast `Customer registered`; modal closes; the app navigates to
     `/customers/{new-id}` and the profile heading reads `E2E Test Customer`.

5. **Verify in the directory** — navigate back to `/customers` and search
   `E2E Test Customer`.
   - Expected: the new customer appears with `0` calls, `0` unresolved, `–` attention,
     `–` QA stars.

## Assertions to encode

- Register disabled until a non-empty name.
- Toast `Customer registered` + redirect to `/customers/{id}`.
- New customer visible in the directory.