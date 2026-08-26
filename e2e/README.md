# Call-Centre Radar — Playwright E2E suite

Playwright specs written 1:1 from the test cases in `test_cases/` (each `.md` maps to
`tests/<suite>/TC-XX-*.spec.ts`).

## Run

```bash
# the stack must be up: docker compose up -d --build   (dashboard at :8081, API :8100)
cd e2e
npm install          # first time only (browsers: npx playwright install chromium)
npx playwright test                          # full suite (47 tests, serial, 1 worker)
npx playwright test tests/auth               # one suite
npx playwright test tests/calls/TC-12-calls-search.spec.ts   # one case
```

## Design notes

- **Serial + 1 worker** (`playwright.config.ts`): tests share the seeded Postgres DB
  and some mutate it (QA reviews, uploads, users, customers/agents), so isolation is
  by design, not parallelism.
- **Deterministic fixtures**: registration and upload tests use timestamped names;
  QA-review tests reset their own review state through the API before starting;
  TC-37 uploads under a unique filename (the API derives the call id from the file
  name, so re-uploading a dataset-named file would overwrite that call).
- **Live-data assertions**: many specs compare rendered values against the API
  (`/kpis`, `/calls`, `/customers/1`, …) instead of hard-coding counts.
- **Helpers** (`tests/helpers.ts`): `login`, `attemptLogin`, `logoutViaMenu`,
  `apiGet`/`ensureUser`/`apiDeleteAllReviews`, `waitForTableIdle`,
  `seekAudio`/`audioState`, fixtures.

## Known app quirks covered by the tests

- `CallsView.syncSp()` reads filter state set in the same handler, so the URL never
  reflects the latest search/filter/sort change (table data is still correct).
- `POST /ingest` uses the uploaded file name as the call id (`api/main.py:268`) —
  uploading a file named like an existing call silently overwrites that call.