# UI & Product Upgrade Plan — v2

## Gap analysis (what forces rejection today)

| Area | Current | Required for a credible product |
|---|---|---|
| Navigation | State-based tabs; opening a call **traps you** (tab clicks stop working); no URLs | Real router: deep-linkable pages, working back/breadcrumbs, sidebar nav |
| Audio intake | None in UI | Upload page: drag-drop, progress, metadata form, result link |
| People | Read-only names from dataset | Register/manage **users** (manager/agent/admin roles), **customers**, **agents** |
| Ratings | Buried survey numbers in JSON | Visible customer-survey stars + per-call **QA review by manager** (stars + note), averages everywhere |
| Professionalism | One flat page, 3 tables | Login, role-aware shell, KPI dashboard w/ charts, sortable/paginated tables, modals, toasts, empty/loading states |
| Auth | None | Login, sessions, roles gating pages & actions |

## Roles & permissions

| Role | Access |
|---|---|
| `admin` | Everything + Users page (register managers/agents/admins) |
| `manager` | All analytics, upload, QA reviews, register customers/agents |
| `agent` | Dashboard scoped to own calls; transcripts read-only; no upload/user mgmt |
| Seeded login | `admin` / `admin123` (README instructs changing it) |

## Backend additions (needed before UI)

1. `users` table (name, username, unique, password hash=scrypt, role, active) + `AUTH_SECRET`-signed HMAC tokens (`pipeline/auth.py`).
2. `POST /auth/login` → `{token,user}`; `GET /auth/me`; seed admin on startup.
3. `call_reviews` table (sid, user_id, stars 1–5, note, created_at) + `POST/GET /calls/{sid}/reviews`.
4. `POST /customers` `{name}`, `POST /agents` `{name}` (staff-only registration).
5. `GET /users`, `POST /users`, `PATCH /users/{id}` (admin-only).
6. `GET /kpis` — headline metrics + calls-over-time series + mood distribution + resolution split.
7. Role-gating dependency; existing analytics endpoints stay token-readable (any active role).

## Frontend rebuild (react-router + layout system)

```
/login                      auth page
/                           Dashboard: KPI cards, calls-over-time chart, resolution donut,
                            mood mix, top attention list, trending issues
/calls                      all calls: search, filter (status/score), sort, paginate
/calls/:sid                 call detail: player + synced transcript, mood timeline,
                            cited evidence, survey stars, QA review widget
/customers                  list + register modal
/customers/:id              profile: KPIs, rating averages, full history table
/agents                     leaderboard table + add-agent modal
/agents/:id                 agent profile: stats, ratings, their calls
/upload                     drag-drop ingest with live progress + metadata form
/users                      admin-only user management
```

Shared components: `Layout` (sidebar + topbar + user menu), `DataTable` (sort/paginate),
`Modal`, `StarRating`, `Toasts`, `ScoreBadge/ResBadge`, `Empty`, `Spinner`, `KpiCard`.
Design: dark admin theme kept, refined spacing/typography, icon set (lucide), consistent cards.

## Build order

1. Backend: schema v2 + auth + new endpoints + seed admin → smoke-test via curl.
2. Frontend: router shell + auth flow → dashboard → calls/call-detail (+reviews) →
   customers → agents → upload → users.
3. Browser-test every route & action (screenshots), fix, update README.
