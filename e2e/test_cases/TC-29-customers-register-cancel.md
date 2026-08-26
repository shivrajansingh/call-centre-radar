# TC-29 — Register-customer modal cancel paths

| | |
|---|---|
| **Suite** | E — Customers |
| **Priority** | Low |
| **Preconditions** | Logged in as `admin`; on `/customers` |
| **Anchors** | modal `Register a customer`; buttons `Cancel`; ✕ close button; Escape key; backdrop click |

## Steps

1. **Open `/customers`** — click `Register customer` to open the modal.

2. **Cancel via button** — click `Cancel`.
   - Expected: modal closes; no toast; directory unchanged.

3. **Reopen and close via ✕** — reopen, click the ✕ button (top-right of the modal).
   - Expected: modal closes.

4. **Reopen and close via Escape** — reopen, press `Escape`.
   - Expected: modal closes (Modal registers a keydown listener).

5. **Reopen and close via backdrop** — reopen, click the dark overlay *outside* the
   modal panel.
   - Expected: modal closes (backdrop `onMouseDown` handler fires only when the target
     is the backdrop itself).

6. **Confirm nothing was created** — search `e.g. Jane Doe`-style name if typed.
   - Expected: no new customer in the directory (unless previously registered).

## Assertions to encode

- All four close paths dismiss the modal.
- No customer is created on cancel.