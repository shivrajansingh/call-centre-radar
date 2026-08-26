# E2E Test Cases — Call-Centre Radar

Manual Playwright test-case specifications for the dashboard UI. One markdown file
per test case; each file lists the exact steps and expected results that will later
be translated into a Playwright spec.

## How the app runs (test target)

| Service | URL |
|---|---|
| Dashboard (Docker) | http://localhost:8081 |
| Dashboard (dev, `npm --prefix ui run dev`) | http://localhost:5173 |
| API | http://localhost:8100 |
| Seeded login | `admin` / `admin123` |

Roles: `admin` (everything), `manager` (analytics, upload, QA, register customer/agent),
`agent` (read-only). Session is a token in `localStorage("radar_token")`.

## Conventions used in the case files

- **Anchors** — each step names the element to target (label, placeholder, heading,
  button text) so the step maps 1:1 to a Playwright locator later.
- **Live data** — steps reference seeded dataset values (e.g. call sid
  `004860b1ab2e4c88`, customer "Mary Smith", agent "Robert"). These exist in the
  seeded DB; treat exact counts as data-dependent and assert structure unless stated.
- **Toasts** — transient notifications bottom-right, ~4 s. They carry exact texts
  (e.g. `Review saved`).
- Dataset calls have `started_at = null`, so Date cells render `–`.

## Index

### A — Authentication
| ID | Case | File |
|---|---|---|
| TC-01 | Login with valid credentials | `TC-01-login-valid-credentials.md` |
| TC-02 | Login with invalid credentials shows error | `TC-02-login-invalid-credentials.md` |
| TC-03 | Unauthenticated user is redirected to /login | `TC-03-unauthenticated-redirect.md` |
| TC-04 | Session persists across reload | `TC-04-session-persists-reload.md` |
| TC-05 | Sign out via avatar menu | `TC-05-sign-out.md` |

### B — Dashboard
| ID | Case | File |
|---|---|---|
| TC-06 | KPI cards render with correct values | `TC-06-dashboard-kpi-cards.md` |
| TC-07 | "Needs a manager's attention" queue renders ranked calls | `TC-07-dashboard-attention-queue.md` |
| TC-08 | Trending issues render with counts and open rates | `TC-08-dashboard-trending-issues.md` |
| TC-09 | Charts and quick stats render | `TC-09-dashboard-charts.md` |
| TC-10 | Theme toggle switches dark ↔ light and persists | `TC-10-theme-toggle.md` |

### C — Calls list
| ID | Case | File |
|---|---|---|
| TC-11 | Calls table renders rows and paginates | `TC-11-calls-table-pagination.md` |
| TC-12 | Search filters the calls table | `TC-12-calls-search.md` |
| TC-13 | Resolution filter narrows the table | `TC-13-calls-resolution-filter.md` |
| TC-14 | Sort by attention score | `TC-14-calls-sort-attention.md` |
| TC-15 | Row click and customer/agent links navigate | `TC-15-calls-navigation.md` |
| TC-16 | Dashboard deep-links land on the filtered calls page | `TC-16-calls-deep-links.md` |

### D — Call detail
| ID | Case | File |
|---|---|---|
| TC-17 | Verdicts card shows summary, intent, resolution, mood with citations | `TC-17-call-verdicts.md` |
| TC-18 | Citation buttons seek the audio and play | `TC-18-call-citation-seek.md` |
| TC-19 | Mood timeline renders shift marker and seeks on click | `TC-19-call-mood-timeline.md` |
| TC-20 | Transcript turns render with speakers and timestamps | `TC-20-call-transcript.md` |
| TC-21 | Playback drives playing indicator, active-turn and word highlight | `TC-21-call-playback-sync.md` |
| TC-22 | QA review: save a rating with note | `TC-22-qa-review-save.md` |
| TC-23 | QA review: zero stars blocked; own review deletable | `TC-23-qa-review-validate-delete.md` |
| TC-24 | Evidence integrity footer reflects verified citations | `TC-24-call-evidence-integrity.md` |
| TC-25 | Customer survey card renders when data exists | `TC-25-call-survey-card.md` |

### E — Customers
| ID | Case | File |
|---|---|---|
| TC-26 | Customer directory renders and search filters it | `TC-26-customers-directory-search.md` |
| TC-27 | Register a customer (manager/admin) | `TC-27-customers-register.md` |
| TC-28 | Customer profile shows KPIs and full call history | `TC-28-customer-profile.md` |
| TC-29 | Register-customer modal cancel paths | `TC-29-customers-register-cancel.md` |

### F — Agents
| ID | Case | File |
|---|---|---|
| TC-30 | Agent leaderboard renders and search filters it | `TC-30-agents-leaderboard-search.md` |
| TC-31 | Register an agent (manager/admin) | `TC-31-agents-register.md` |
| TC-32 | Agent profile shows stats and calls handled | `TC-32-agent-profile.md` |

### G — Upload
| ID | Case | File |
|---|---|---|
| TC-33 | Upload is role-gated (agent blocked, manager allowed) | `TC-33-upload-role-gate.md` |
| TC-34 | Files added to the queue with size and remove | `TC-34-upload-file-queue.md` |
| TC-35 | Non-audio files are rejected with a toast | `TC-35-upload-non-audio-rejected.md` |
| TC-36 | Invalid metadata JSON blocks upload | `TC-36-upload-invalid-metadata.md` |
| TC-37 | Successful upload queues the call | `TC-37-upload-success.md` |

### H — Users (admin)
| ID | Case | File |
|---|---|---|
| TC-38 | Users page is admin-only | `TC-38-users-admin-only.md` |
| TC-39 | Create a user with validation | `TC-39-users-create.md` |
| TC-40 | Change a user's role | `TC-40-users-change-role.md` |
| TC-41 | Enable / disable a user | `TC-41-users-enable-disable.md` |
| TC-42 | Reset a user's password | `TC-42-users-reset-password.md` |

## Common fixture data

```text
admin user     : admin / admin123            (Administrator, role admin)
example call   : 004860b1ab2e4c88            (Mary Smith ↔ Robert, 11 turns, mood shift @ 40.16s)
example cust.  : Mary Smith (id 1), Robert Jones (id 10)
example agent  : Robert (id 1), Elizabeth (id 7)
sample audio   : data/audio/004860b1ab2e4c88.mp3
```

## Later: Playwright implementation

The `.md` files in this directory are the source of truth for steps. The Playwright
suite itself will live in `e2e/tests/` (specs), with shared helpers (login, seeded
data) — not started yet by design.