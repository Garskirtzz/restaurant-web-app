# AI Handoff Progress

Last updated: 2026-06-04, Asia/Jakarta

This document is a handoff note for continuing the restaurant web app with another AI model or another developer. It summarizes what has been completed, what is currently deployed, how the project is structured, how to verify it, and what is still pending.

Do not put production secrets, database passwords, Vercel tokens, Supabase service keys, or real admin passwords in this file.

## Current Project Snapshot

- Project type: restaurant digital menu, customer checkout, admin dashboard.
- Frontend: static HTML/CSS/JavaScript.
- Backend: Python HTTP API in `server/app.py`, exposed on Vercel through `api/index.py`.
- Local database: SQLite when no Postgres env vars are configured.
- Production database: Supabase Postgres, schema `restaurant_app`.
- Production URLs (one Vercel project `project-hqcx7`, all live):
  `https://warkop-kentjana.vercel.app`, `https://warkop-balap.vercel.app`,
  `https://warkop-laporan.vercel.app` (owner report site). `project-hqcx7.vercel.app` also works.
- Git remote: `https://github.com/Garskirtzz/restaurant-web-app.git`.
- Current branch: `main`.
- Production schema version: **4** (orders have a `brand` column). `/api/health` returns
  `schemaVersion: 4`, `database: postgres:restaurant_app`, `storageMode: persistent`.
- Admin login: username `admin`, password lives only in the DB (not auto-seeded from env
  anymore). Reset/rotate via `OPERATIONS.md` section 2B.
- Current Git status after latest work: only `.codex/` is untracked and should not be committed.

## Important Files

- `index.html`: public customer menu page.
- `admin.html`: login, admin dashboard, customer/admin panels.
- `laporan.html` + `assets/js/laporan.js`: owner report site (both brands' daily/monthly revenue); served at `warkop-laporan.vercel.app`.
- `assets/css/index.css`: public page styling.
- `assets/css/admin.css`: admin page styling.
- `assets/js/index.js`: public page state, auth modal, cart, checkout, history.
- `assets/js/admin.js`: admin login/session/page state.
- `assets/js/admin-state.js`: shared admin-side state helpers and API hydration.
- `assets/js/admin-orders.js`: dashboard order status tabs, order updates, notifications.
- `assets/js/admin-reports.js`: reporting and best-seller chart rendering.
- `assets/js/admin-menu.js`: menu management.
- `assets/js/admin-tables.js`: table management.
- `assets/js/admin-settings.js`: restaurant settings.
- `assets/js/admin-customer.js`: customer panel in admin page.
- `assets/js/api-client.js`: browser API wrapper.
- `assets/js/shared-utils.js`: escaping, formatting, storage helpers, `delegateActions` (data-action event delegation), `applyBranding`.
- `assets/js/brand-config.js`: per-domain branding map for the "2 brands, shared data" setup.
- `server/app.py`: backend API, auth, session, database abstraction, migrations/seeding.
- `api/index.py`: Vercel serverless adapter that imports `server/app.py`.
- `vercel.json`: Vercel routing and Python function config.
- `requirements.txt`: Python dependency list, includes `psycopg2-binary`.
- `package.json`: Playwright test scripts.
- `tests/smoke.spec.js`: core smoke/API tests.
- `tests/responsive.spec.js`: responsive layout tests added for mobile/desktop QA.
- `README.md`, `DEPLOYMENT.md`, `RELEASE_CHECKLIST.md`: existing project docs.
- `OPERATIONS.md`: day-to-day operations (admin password reset, create admin, check orders, Supabase/Postgres backup, Vercel rollback, env/password rotation, connection recovery).
- `.env.example`: env var template. Do not put real secrets here.

## Architecture Summary

The app currently uses a backend-only Supabase architecture.

Browser:
- Loads static `index.html` and `admin.html`.
- Talks only to same-origin `/api/...` endpoints.
- Stores short client session flags and API tokens in `localStorage`.
- Does not connect directly to Supabase.

Backend:
- `server/app.py` uses a small custom HTTP router.
- Uses SQLite locally if Postgres env vars are absent.
- Uses Supabase Postgres in production through `psycopg2`.
- Owns auth, sessions, user roles, menu, tables, orders, settings, reports.

Database:
- Supabase schema: `restaurant_app`.
- RLS is enabled on all app tables.
- No public Supabase policies are created intentionally.
- `anon`, `authenticated`, and `public` grants for `restaurant_app` are revoked.
- This is intentional because all data access goes through the Python API, not browser Supabase clients.

## Completed Progress By Phase

### 1. Initial Transaction Flow

Completed:
- Connected customer checkout from `index.html` to persistent order storage.
- Orders contain table number, order number, cart items, total price, status, payment method, and timestamp.
- Admin dashboard can read incoming orders and change order status.
- LocalStorage-only flow was replaced by API-backed production flow later.

Current state:
- Checkout requires customer sign in.
- Customer order history is available through modal/panel, not a raw bottom-page block.
- Admin can update order status to `processing` and `completed`.

### 2. Public UI Rework

Completed:
- Header was redesigned into a minimal sticky navbar.
- Removed early header display of `No. Pesanan`, `Nama`, and `Meja`.
- Customer name and table number are collected only during checkout.
- Category selector/dropdown was replaced with horizontal pill buttons.
- Menu list became responsive product cards/grid.
- Fixed mobile header overflow and product image distortion caused by hard `display: block/flex` changes during filtering.
- Cart access and history access require sign in.
- Removed floating `Panel Admin` button from public page.
- Added navbar actions for:
  - Order History
  - Sign In
  - Cart
- Added auth modal with Customer and Admin tabs.

Current state:
- `index.html` is usable on mobile and desktop.
- Responsive QA confirms there is no body-level horizontal overflow.

### 3. Admin UI Rework

Completed:
- Fixed the critical visual bug where login and admin dashboard overlapped.
- Login container became a full-screen fixed overlay when logged out.
- Dashboard is hidden when not authenticated.
- Sidebar order management page was removed from main sidebar and order monitoring was moved into Dashboard.
- Dashboard has segmented status tabs:
  - Pesanan Masuk
  - Diproses
  - Selesai
- Status tabs have small notification badges.
- Clicking a status tab clears that status notification as "read".
- Tables no longer use heavy hover/timbul effects.
- Reduced unnecessary horizontal scroll where content does not exceed width.
- Reports section has an elegant best-seller visualization/pie-style chart.
- Label "Menu Paling Laku" was changed to "Best Seller".
- Login/admin color polish was aligned with Grey Aesthetic:
  - Dark/grey primary buttons.
  - Error color uses a separate danger token.

Current state:
- Admin login and dashboard are separated on mobile and desktop.
- Responsive QA confirms no body-level horizontal overflow.

### 4. JavaScript/CSS Organization

Completed:
- Logic was split into modular JS files under `assets/js`.
- Styling was moved into `assets/css/index.css` and `assets/css/admin.css`.
- Shared helper functions live in `assets/js/shared-utils.js`.
- API wrapper lives in `assets/js/api-client.js`.
- A number of inline style/AI-generated rigid UI patterns were replaced or reduced.

Completed later (2026-06-04):
- All inline `on*` handlers in `index.html` and `admin.html` were removed and replaced with `data-action` + `data-*` attributes.
- A single delegated listener per page (`RestaurantUtils.delegateActions`) dispatches by nearest `data-action`, which also removed the need for inline `event.stopPropagation()`.
- JS-generated rows/cards now emit `data-action` instead of inline `onclick`.

Still worth improving:
- Some rendering still uses `innerHTML`, although user-controlled values are escaped. A future cleanup could render more DOM with `createElement`.
- `style-src` still allows `'unsafe-inline'` because some inline `style=` attributes remain; removing those would let `style-src` be tightened too.

### 5. Backend API

Completed:
- Created Python backend in `server/app.py`.
- Added API routes for:
  - Health
  - Customer register/login
  - Admin login
  - Logout
  - Current user
  - Settings
  - Menu CRUD
  - Table CRUD
  - Orders
  - Order status updates
  - Best-seller report (brand-scoped)
  - Revenue report (`GET /api/reports/revenue?group=day|month&brand=`) — server-computed daily/monthly totals
  - Admin audit log (`GET /api/audit-log`)
- Orders and reports are brand-scoped via `request_brand()` (host/`?brand=`); see the Deployment Target section.
- Added API-backed authentication and sessions.
- Added password hashing with PBKDF2 SHA-256.
- Added payload validation and oversized JSON rejection.
- Added request IDs and no-store API responses.
- Added backend self-test mode.

Current local backend commands:

```powershell
python server/app.py --host 127.0.0.1 --port 8000
python server/app.py --self-test
python -m py_compile .\server\app.py .\api\index.py
```

### 6. Vercel Deployment

Completed:
- Added Vercel support through `api/index.py` and `vercel.json`.
- Pushed project to GitHub and connected Vercel to `main`.
- Production deploy is live at `https://project-hqcx7.vercel.app`.
- Vercel env vars are configured for Supabase Postgres.
- Vercel production health returns persistent storage.

Important Vercel env var names:

```text
DATABASE_URL
RESTAURANT_DB_HOST
RESTAURANT_DB_PORT
RESTAURANT_DB_NAME
RESTAURANT_DB_USER
RESTAURANT_DB_PASSWORD
RESTAURANT_DB_SCHEMA
RESTAURANT_DB_SSLMODE
RESTAURANT_ADMIN_USERNAME
RESTAURANT_ADMIN_PASSWORD
RESTAURANT_ALLOWED_ORIGINS
RESTAURANT_APP_VERSION
```

Notes:
- Split DB env vars are preferred over `DATABASE_URL` if password/URL encoding causes problems.
- If env vars are edited in Vercel, redeploy production.
- Never commit real env values.

### 7. Supabase

Completed:
- Supabase MCP was connected and authenticated.
- Supabase project ref used during setup: `ohpvmiiveccazalsuvbr`.
- Schema `restaurant_app` was created.
- Data is persistent in Supabase Postgres.
- RLS is enabled for all app tables.
- Public grants are revoked for app schema/tables/sequences/functions.

Supabase migrations currently recorded:

```text
20260603145742 create_restaurant_app_schema
20260603150341 revoke_public_rls_auto_enable_execute
20260603150407 revoke_public_rls_auto_enable_public_execute
20260603213640 enable_restaurant_app_rls
(2026-06)     enable_admin_audit_log_rls
(2026-06)     create_revenue_report_views
(2026-06)     update_revenue_views_per_brand
```

App schema_migrations (in `restaurant_app.schema_migrations`): v1 bootstrap, v2 session
expiry + indexes, v3 admin_audit_log, v4 orders `brand` column.

Current app tables (RLS enabled on all):

```text
restaurant_app.users                users + admin (shared across brands)
restaurant_app.sessions
restaurant_app.menu_items           shared across brands
restaurant_app.restaurant_tables    shared across brands
restaurant_app.restaurant_settings
restaurant_app.orders               has `brand` column (per-brand)
restaurant_app.order_items
restaurant_app.schema_migrations
restaurant_app.admin_audit_log      RLS enabled (migration enable_admin_audit_log_rls)
```

Views: `restaurant_app.laporan_harian`, `restaurant_app.laporan_bulanan` (per-brand revenue;
not exposed via PostgREST, only read in SQL/Table Editor).

Security advisor note:
- Supabase advisor reports `RLS Enabled No Policy` at INFO level for all app tables.
- This is expected in the current backend-only design (the app connects as the owner role,
  which bypasses RLS; anon/authenticated grants are revoked).
- Do not add broad policies for `anon` or `authenticated` unless the frontend is changed to use Supabase client directly.
- `admin_audit_log` RLS is now ENABLED (done 2026-06-13), so the earlier critical advisory is resolved.

### 8. Security Hardening

Completed:
- API routes require tokens for protected operations.
- Admin write routes require admin token.
- Customer order creation/history requires customer token.
- Logout revokes active token.
- Stale `localStorage` admin flag without token is rejected.
- Added HTTP security headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
  - `Content-Security-Policy`
  - `Strict-Transport-Security` on Vercel
- CORS from unknown external origin was verified not to open `Access-Control-Allow-Origin`.
- Cart item rendering was hardened so item names are escaped before being inserted into HTML.

Added later (2026-06-04):
- In-process rate limiting for register (per IP) and order creation (per user) via `SlidingWindowCounter`.
- Failed-login lockout keyed by (IP, role, username); returns HTTP 429 with `Retry-After`. Successful login resets the counter.
- Tunable via `RESTAURANT_LOGIN_MAX_FAILURES`, `RESTAURANT_LOGIN_FAILURE_WINDOW_SECONDS`, `RESTAURANT_RATE_LIMIT_MAX`, `RESTAURANT_RATE_LIMIT_WINDOW_SECONDS`.
- Server-side admin audit log (`admin_audit_log` table, schema v3). Records settings update, menu/table CRUD, and order status changes with admin username, IP, and timestamp. Readable via `GET /api/audit-log` (admin only, `?limit=` up to 500).
- Self-test covers limiter logic and audit table/index; Playwright covers the 429 lockout path and audit log recording.

Security caveats:
- Tokens are still stored in `localStorage`; acceptable for this prototype but not ideal for high-risk production.
- CSP `script-src` is now strict (`'self'`, no `'unsafe-inline'`). `style-src` still allows `'unsafe-inline'` because inline `style=` attributes remain.
- IMPORTANT (Vercel): static pages are served by Vercel's CDN, not the Python server, so `server/app.py` security headers only apply to `/api/*` in production. The page-level security headers (CSP, X-Frame-Options, HSTS, etc.) are therefore also configured in `vercel.json` `headers` for all non-API routes. Keep the two in sync. Locally the Python server still serves headers for everything.
- `admin - Copy.html` is a tracked but unreferenced backup that still contains inline handlers; it is not part of the app and will not work under the strict CSP. Recommend deleting it.
- Rate limiting/lockout state is in-memory and per-process, so on Vercel it is best-effort per warm instance, not shared across scaled instances. A shared store (DB/Redis) is needed for strict guarantees.
- No formal password reset flow yet.

Schema migrations / admin password (updated 2026-06-13):
- `SCHEMA_VERSION` is now **4** (v3 = `admin_audit_log`, v4 = orders `brand` column). A schema bump makes `postgres_bootstrap_ready` re-run the idempotent bootstrap (creates new tables/columns).
- Seeding NO LONGER force-resets the admin password. `seed_user` for admin now only inserts when the admin is absent; an existing admin password is never overwritten by a deploy. (Previously `force_password=ADMIN_PASSWORD_FROM_ENV` reset it on every schema bump, which locked out login — fixed.)
- Therefore the admin password lives in the DB only. Set/rotate it via `OPERATIONS.md` section 2B (generate a PBKDF2 hash and UPDATE the row). `RESTAURANT_ADMIN_PASSWORD` now only matters for a brand-new/empty database.

### 9. Testing and QA

Completed:
- Playwright installed and configured.
- Smoke tests cover:
  - Public menu page rendering
  - Sign in modal customer/admin tabs
  - Admin login visibility separation
  - Stale admin localStorage rejection
  - API logout token revocation
  - Invalid menu payload rejection
  - Security headers and oversized payload rejection
  - Admin settings save through API
- Responsive tests cover:
  - Public page mobile and desktop containment
  - Admin login/dashboard mobile and desktop containment
  - No body-level horizontal overflow
- Last full local test run:

```text
npm test
20 passed
```

Newer Playwright coverage also includes: strict CSP / no inline handlers, delegated
buttons, lockout 429, audit log, revenue report (brand-scoped), and cross-brand order
status rejection (403).

Production end-to-end QA completed:
- Temporary customer registered.
- Temporary order created.
- Temporary admin logged in.
- Admin saw the order.
- Admin changed status `pending -> processing -> completed`.
- Customer history saw final status `completed`.
- All QA users/orders/sessions were cleaned up.

## Git Progress Summary

Recent important commits:

```text
8e88361 Add responsive layout QA coverage
f0a78a8 Harden production security headers
cb7015f Optimize Vercel database bootstrap
d6e7fb5 Support separate Supabase database env vars
56cc493 Add Supabase Postgres deployment support
acb48ef Prepare Vercel deployment and release readiness
b9e2194 Harden HTTP security defaults
751b587 Harden API session handling and validation
ebbac8b Require API-backed frontend authentication
0cb1e0d Harden backend authentication
```

Before committing more work:

```powershell
git status --short
npm test
python -m py_compile .\server\app.py .\api\index.py
python .\server\app.py --self-test
```

Current status note:
- `.codex/` is untracked and should usually stay uncommitted.
- `node_modules/`, local DB files, pycache, test results, and env files are ignored or should not be committed.

## Remaining Work

### Deployment Target: Two Brands, One Server (Per-Brand Orders/Reports) — DONE (2026-06-13)

Two brands — **Warkop Kentjana** and **Warkop Balap** — live on one Vercel project
`project-hqcx7`, one API, one Supabase database. **Users, menu, and tables are shared;
orders and reports are per-brand.** Three live domains (all `.vercel.app`):

```text
warkop-kentjana.vercel.app   storefront + admin, brand=kentjana
warkop-balap.vercel.app      storefront + admin, brand=balap
warkop-laporan.vercel.app    owner report site (redirects "/" -> /laporan.html)
```

How brand is determined:
- Frontend display: `assets/js/brand-config.js` + `applyBranding`/`resolveBrand` (exact
  `byHost`, then substring `matchers` for `kentjana`/`balap`, then `DEFAULT`).
- Backend data: `RestaurantHandler.request_brand()` resolves brand from an explicit
  `?brand=` query (used by the report site), else the request Host header, else a payload
  hint. Orders are tagged with `brand` (schema v4); admin order lists, customer history,
  best-seller and revenue reports are filtered by brand; `update_order_status` rejects
  changing another brand's order (403) — this fixed the cross-brand completion bug.

Owner report site:
- `laporan.html` + `assets/js/laporan.js`: admin-login page showing daily & monthly
  revenue for BOTH brands (calls `/api/reports/revenue?brand=...`). `vercel.json` has a
  host-scoped redirect so `warkop-laporan.vercel.app/` lands on `laporan.html`.
- Supabase views `restaurant_app.laporan_harian` / `laporan_bulanan` now include a
  `brand` column (migration `update_revenue_views_per_brand`).

Notes:
- `RESTAURANT_ALLOWED_ORIGINS` is not required for brand domains because each brand calls
  its own same-origin `/api`. The report site uses explicit `?brand=` so it is host-agnostic.
- Admin password is NOT re-seeded on deploy anymore (see Priority 4); set/rotate it via SQL
  per `OPERATIONS.md`. Current admin password lives only in the DB.

### Priority 1: Final Branding and Real Restaurant Content

Needed:
- Decide real restaurant name.
- Decide logo/brand wording.
- Decide real address, phone, opening hours.
- Decide real menu names, prices, categories, descriptions, and images.
- Replace placeholder/generic menu images if needed.
- Verify image URLs are stable or move images into local assets.

Why this matters:
- The app is functionally deployable, but still feels like a template until real restaurant content is finalized.

### Priority 2: Custom Domain

Needed:
- Buy or choose domain.
- Add domain in Vercel.
- Configure DNS.
- Update `RESTAURANT_ALLOWED_ORIGINS` if using a custom domain or multiple domains.
- Redeploy and verify health and login.

Checklist:

```text
https://custom-domain.example/api/health
Customer login/register
Cart checkout
Admin login
Admin order status update
```

### Priority 3: Operational Documentation — DONE (2026-06-04)

Completed in `OPERATIONS.md`:
- How to reset/change admin password safely (incl. the production caveat that env-only changes do not re-seed an already-bootstrapped Postgres DB; use SQL update with an app-generated PBKDF2 hash).
- How to create an admin account.
- How to check orders in admin panel.
- How to backup Supabase/Postgres (pg_dump via session pooler) and SQLite locally.
- How to rollback a Vercel deployment.
- How to rotate database password and Vercel env vars.
- How to force-logout sessions.
- How to recover if Supabase connection fails.
- How to run production QA safely with cleanup.

### Priority 4: Production Hardening — PARTIAL (2026-06-04)

Done:
- Rate limiting for register (per IP) and order creation (per user).
- Account lockout / cooldown after failed login attempts (per IP+role+username), returns 429 + Retry-After.
- Server-side audit log for admin actions (`admin_audit_log`, schema v3, `GET /api/audit-log`).
- Structured error logging via the `restaurant` logger (`RESTAURANT_LOG_LEVEL`); 500s log a full traceback with request_id/method/path/client, client disconnects are quiet warnings. Error handling centralized in `RestaurantHandler.run_method`/`dispatch` and reused by the Vercel adapter.
- Removed all inline `on*` handlers (data-action delegation) and tightened CSP `script-src` to `'self'` (no `'unsafe-inline'`). Playwright asserts the strict CSP, the absence of inline handlers, and that delegated dynamic buttons work.

Still recommended:
- HTTP-only cookies: DEFERRED. The deployment target is two brands on two domains sharing one server/DB; HttpOnly cookies are not practical across separate domains, so token-in-localStorage is kept for this prototype.
- Remove remaining inline `style=` attributes so `style-src 'unsafe-inline'` can also be dropped.
- Add backup automation beyond manual Supabase backups.
- Consider a shared-store (DB/Redis) limiter if strict cross-instance limits are needed (current limiter is in-memory per process).

### Priority 5: UI/UX Polish

Done (2026-06-04): subtle storefront polish in the existing Grey Aesthetic — added a brand logo mark (coffee-cup badge) in the navbar and a hero section (kicker + headline + tagline) on `index.html`. Palette unchanged; per-domain branding fills the hero kicker too.

Recommended:
- Continue premium visual pass using `ui-architecture.md`.
- Consider making a Figma design only if you want a very specific luxury visual direction. It is not required to continue coding, but it helps if the target is "website mahal" with exact spacing, visual hierarchy, and component behavior.
- Improve admin mobile sidebar/navigation if you expect admin usage on phones.
- Improve report charts further if real sales data grows.
- Add empty/loading/skeleton states that match the Grey Aesthetic.

### Priority 6: Database Reproducibility

Current state:
- Supabase migrations are recorded in Supabase migration history.
- The repo may not contain local SQL migration files for every Supabase change.

Recommended:
- Export/pull Supabase schema migrations into repo if you want a fully reproducible database setup.
- Keep `restaurant_app` schema as the app schema.
- Keep public grants revoked unless a future frontend uses Supabase client directly.

### Priority 7: Full Release Review

Before public launch:
- Run `npm test`.
- Run backend compile/self-test.
- Verify production `/api/health`.
- Test one real customer checkout.
- Test admin sees the order.
- Test status changes.
- Check mobile screenshots.
- Confirm no secrets in Git.
- Confirm Vercel env vars are production values.
- Confirm Supabase RLS remains enabled.

## Known Safe Commands

Local development:

```powershell
python server/app.py --host 127.0.0.1 --port 8000
```

Run all tests:

```powershell
npm test
```

Backend validation:

```powershell
python -m py_compile .\server\app.py .\api\index.py
python .\server\app.py --self-test
```

Check production health:

```powershell
Invoke-RestMethod -Uri "https://project-hqcx7.vercel.app/api/health" | ConvertTo-Json -Depth 6
```

Git status:

```powershell
git status --short
```

## Warnings For The Next AI Model

Follow these rules:
- Do not commit `.codex/`.
- Do not commit `.env` or real secrets.
- Do not expose Supabase service role keys in frontend code.
- Do not disable RLS to "fix" access errors.
- Do not add broad Supabase `anon` policies unless the architecture changes intentionally.
- Do not use destructive Git commands like `git reset --hard` unless the user explicitly asks.
- If production data is touched for QA, create uniquely named QA records and clean them up immediately.
- If changing Vercel env vars, redeploy and verify `/api/health`.
- If touching UI, run responsive tests and inspect mobile layout.

## Suggested Prompt For A New AI Model

Use this prompt when moving the project to another AI model:

```text
You are taking over a restaurant web app project.

First read AI_HANDOFF_PROGRESS.md, README.md, DEPLOYMENT.md, RELEASE_CHECKLIST.md, server/app.py, api/index.py, index.html, admin.html, assets/js, assets/css, and tests.

Do not commit secrets. Do not commit .codex/. Do not disable Supabase RLS. The frontend must talk to the Python API only, not directly to Supabase.

Current production URL is https://project-hqcx7.vercel.app. Supabase schema is restaurant_app. Vercel uses Supabase Postgres through environment variables.

Before making changes, run:
- git status --short
- npm test
- python -m py_compile .\server\app.py .\api\index.py
- python .\server\app.py --self-test

Continue from the remaining work section:
1. Final branding and real restaurant content.
2. Custom domain setup.
3. Operations documentation.
4. Production hardening.
5. UI/UX polish.

When making changes, keep the Grey Aesthetic from ui-architecture.md, maintain responsive behavior, and verify with Playwright.
```

## Best Next Step

Core features are live (two brands, per-brand orders/reports, owner report site, hardening,
audit log, revenue reports). The main remaining owner-decision item is Priority 1 (real menu
content/images for each brand). Optional code work: remove inline `style=` to drop
`style-src 'unsafe-inline'`, add export/charts to the report site, or per-brand admin theming.
