# Dashboard (React SPA)

Stack: React 19 + TypeScript, react-router-dom v7, recharts, lucide-react, **Tailwind CSS v4**
(`@tailwindcss/vite`; theme tokens in `index.css` map to dark/light CSS variables).
Built by Vite, served by nginx.

## Routes

| Route | Page | Notes |
|---|---|---|
| `/login` | Sign-in | Redirects to `/` when authenticated |
| `/` | Operations dashboard | KPI cards, calls-over-time area chart (+ unresolved overlay), resolution donut, mood mix, attention queue, trending issues, quick stats |
| `/calls` | Call list | Search, resolution filter, sort (recent/attention), pagination, status chips |
| `/calls/:sid` | Call detail | Player + word-synced transcript, mood timeline, cited verdicts, survey, QA reviews, evidence integrity |
| `/customers` | Customer directory | Search + register modal |
| `/customers/:id` | Customer profile | KPI row + full call history |
| `/agents` | Agent leaderboard | Volume bars, handle times, resolution rates + register modal |
| `/agents/:id` | Agent profile | Stats + calls handled |
| `/upload` | Upload (manager+) | Drag-and-drop queue, metadata form, next-steps |
| `/users` | Users (admin) | CRUD roles, enable/disable, password reset |

Protected routes wrap everything except `/login`; role gating is per-route
(`Guard roles={[...]}` in `main.tsx`).

## Component map

```
main.tsx            BrowserRouter + AuthProvider + routes/guards
auth.tsx            AuthContext: me, login, logout; 401 → auto-logout event
theme.tsx           useTheme (data-theme attr + localStorage) · usePageTitle
api.ts              typed API client (token injection, 401 handling, form helpers)
components/
  Layout.tsx        sidebar nav + topbar (theme toggle, avatar menu) + <Outlet/>
  ui.tsx            Spinner, Empty, ErrorBox, badges, MoodBadge, KpiCard,
                    Modal, StarRating, useToasts
views/              one file per route (see table above)
```

## State & data conventions

- **Server state** is fetched per-page (`useEffect` + `useCallback` reload), not held in
  a global store — simple and fine for this scale. `CallView` re-fetches via a `reload`
  callback shared by the QA-review widget and the status-box "Refresh" button.
- **Auth**: token in `localStorage("radar_token")`; `api.ts` attaches it and dispatches
  a `radar:logout` window event on 401 so the AuthContext can drop the session.
- **Toasts**: `useToasts()` returns `{ok, err, node}` — render `node` inside the page.
- **Citations** (`components/ui.tsx` + `CallView.Cite`): clicking seeks the audio player
  to `t_start`; unverified citations render red with a warning tooltip.

## Call detail internals

- `TranscriptPlayer`: an `<audio>` element; `timeupdate` drives both the active-turn
  highlight (auto-scroll into view) and the active **word** highlight (binary search in
  the words array; the active word is wrapped in `«»`).
- `MoodTimeline`: dots for `mood_timeline` points + a ⚡ marker at `mood_shift_t`;
  clicking seeks audio.
- QA review widget: `StarRating` + note; upserts via `POST /calls/{sid}/reviews`; the
  list shows all reviews with the current user's deletable.
- Evidence footer: `citations_verified` % with green/red state.

## Theming & styling

- Tailwind v4 `@theme` tokens (`bg-surface`, `text-ink`, `border-line`, `bg-accent`,
  `text-dim`, …) resolve to CSS variables that flip between dark (default) and
  `[data-theme="light"]`. A no-flash inline script in `index.html` applies the saved
  theme before first paint; the topbar toggle persists in `localStorage("radar_theme")`.
- Only bespoke pieces live outside Tailwind: mood timeline markers, transcript
  scrollbars/audio chrome, pulse animations.
- Charts use fixed mood/resolution colors that read well on both themes.

## Layout & responsiveness

- Fixed sidebar (232 px, icon-only ≤800 px) + sticky topbar; content fills the full
  available width (no max-width cap).
- KPI grid uses `auto-fit, minmax(230px, 1fr)` so cards wrap instead of stretching.
- **Tables**: every table sits in an `overflow-x-auto` wrapper with a `min-w` so columns
  keep comfortable sizing; on narrow screens the table scrolls *inside its card* — the
  page itself never scrolls horizontally. Long cells (intent, summary) truncate with a
  `title` tooltip; short cells (dates, badges, durations) stay `whitespace-nowrap` with
  consistent 12px padding — no column gaps.

## Adding a page

1. Add the route + guard in `main.tsx`.
2. Create `views/YourView.tsx`; call `usePageTitle("Your page")`.
3. Add API methods to `api.ts` (typed interfaces mirror the FastAPI responses).
4. Reuse `page` / `page-head` / `card` / `tbl` classes and the shared components.

## Build & dev

```bash
npm --prefix ui run dev      # :5173, proxies /api → localhost:8100 (vite.config.ts)
npm --prefix ui run build    # tsc -b + vite build → dist/ (what nginx serves)
npm --prefix ui run lint     # oxlint
```

In Docker, `Dockerfile.ui` builds the bundle and nginx serves it on :80, proxying
`/api/*` to the `api` service (`ui/nginx.conf`; `proxy_buffering off` so audio Range
requests stream).