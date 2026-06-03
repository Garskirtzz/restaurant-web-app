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
- Production URL: `https://project-hqcx7.vercel.app`.
- Git remote: `https://github.com/Garskirtzz/restaurant-web-app.git`.
- Current branch: `main`.
- Latest known commit: `8e88361 Add responsive layout QA coverage`.
- Current Git status after latest work: only `.codex/` is untracked and should not be committed.

Production health was last verified with:

```json
{
  "ok": true,
  "appVersion": "production",
  "schemaVersion": 2,
  "database": "postgres:restaurant_app",
  "storageMode": "persistent",
  "users": 3
}
```

## Important Files

- `index.html`: public customer menu page.
- `admin.html`: login, admin dashboard, customer/admin panels.
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
- `assets/js/shared-utils.js`: escaping, formatting, storage helpers.
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

Still worth improving:
- Some HTML still uses inline `onclick` attributes.
- Some rendering still uses `innerHTML`, although many user-controlled values are escaped.
- A future cleanup could move all event handling to delegated listeners and render more DOM with `createElement`.

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
  - Best-seller report
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
```

Current app tables:

```text
restaurant_app.users                  RLS on, 3 rows
restaurant_app.sessions               RLS on, 0 rows
restaurant_app.menu_items             RLS on, 9 rows
restaurant_app.restaurant_tables      RLS on, 8 rows
restaurant_app.restaurant_settings    RLS on, 1 row
restaurant_app.orders                 RLS on, 0 rows
restaurant_app.order_items            RLS on, 0 rows
restaurant_app.schema_migrations      RLS on, 2 rows
```

Security advisor note:
- Supabase advisor reports `RLS Enabled No Policy` at INFO level.
- This is expected in the current backend-only design.
- Do not add broad policies for `anon` or `authenticated` unless the frontend is changed to use Supabase client directly.

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
- Self-test covers limiter logic; Playwright covers the 429 lockout path.

Security caveats:
- Tokens are still stored in `localStorage`; acceptable for this prototype but not ideal for high-risk production.
- Some inline `onclick` remains, so CSP still allows `'unsafe-inline'`.
- Rate limiting/lockout state is in-memory and per-process, so on Vercel it is best-effort per warm instance, not shared across scaled instances. A shared store (DB/Redis) is needed for strict guarantees.
- No server-side admin audit log yet.
- No formal password reset flow yet.

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
12 passed
```

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

Still recommended:
- Move auth tokens to secure HTTP-only cookies if the project becomes more serious.
- Remove inline `onclick` and then tighten CSP by removing `'unsafe-inline'`.
- Add server-side audit log for admin actions.
- Add better error logging for production failures.
- Add backup automation beyond manual Supabase backups.
- Consider a shared-store (DB/Redis) limiter if strict cross-instance limits are needed (current limiter is in-memory per process).

### Priority 5: UI/UX Polish

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

`OPERATIONS.md` is done (Priority 3). The next best step is Priority 1 (final branding and real restaurant content), which needs owner decisions, or Priority 4 (production hardening: rate limiting, login lockout, admin audit log, tighten CSP), which can be done in code without owner input.
