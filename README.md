# FROSTPOINT v3

React PWA (customer storefront + Business Panel) · FastAPI · PostgreSQL · Docker Compose.

```bash
cp .env.example .env      # set real secrets first
docker compose up --build
```

- App: http://localhost:8088  (override with `WEB_PORT`)
- API docs: http://localhost:8088/api/docs
- Seeded admin: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (default `admin@frostpoint.ph` / `Frostpoint123!`)
- Demo data (60 orders, `customer1@example.com` / `Customer123!`, `staff@frostpoint.ph` / `Staff12345!`, `rider@frostpoint.ph` / `Rider12345!`) loads when `SEED_DEMO=true`. **Set it to `false` and change every password before real use.**

## Frontend UI development (no backend required)

In PowerShell:

```powershell
cd frontend
npm ci
npm run dev:mock
```

Open the URL printed by Vite (usually http://localhost:5173). Mock mode starts as a customer. The floating **Mock mode** controls let you preview Guest, Customer, Admin, Owner, Staff, and Rider screens. Select Guest to review sign-in and registration. Demo emails include `customer1@example.com`, `admin@frostpoint.ph`, `owner@frostpoint.ph`, `staff@frostpoint.ph`, and `rider@frostpoint.ph`; any password works here.

The catalog, checkout, orders, tracking, business dashboard, reports, users, settings, promotions, and support use browser-local fixtures. Edits persist after refresh; **Reset demo** restores the sample data. Data is shared between demo roles in the same browser. Tracking and pricing are simulated, PDF/print use sample report data, and Excel export requires the real API. Map tiles still require an internet connection. Mock mode never sends requests to the backend; it runs only with `dev:mock` and is disabled in production builds. Use `npm run dev` to return to the real API workflow.

## Local developer UI editor

**Developer Mode** appears in the Admin account sidebar during normal local development (`npm run dev` or `npm run dev:mock`). No special editor command is required. Sign in as Admin, or select **Admin** using the mock controls, then open **Developer Mode** and click **Enable developer mode** to show the floating **UI editor** button. The editor starts disabled; your preference is saved in this browser. **Disable developer mode** removes the editor and preview overrides while preserving saved edits. In mock mode, enable it before switching to other mock roles to edit their screens. `npm run dev:editor` remains an optional shortcut for a loopback-only mock server. The sidebar entry and settings route are Admin-only and excluded from production builds, along with the editor; no developer account is added to the deployed application. Normal `dev` keeps using the real API, while `dev:mock` and `dev:editor` use fixtures.

1. Open **UI editor**, enable **Select element**, and click an element on the page.
2. Drag **Move** to reposition it, or use the four edge handles (top, right, bottom, left) to resize one side at a time. Horizontal handles adjust width; vertical handles adjust height. The opposite edge stays anchored. Exact pixel values are also available in the panel. Empty width/height fields retain automatic sizing.
3. Turn selection off to navigate and use the app. Use **Show original**, **Undo**, **Redo**, **Reset element**, or **Reset view** to compare or recover. Escape exits selection.
4. Export **layout-overrides.css**, place it in `frontend/src/styles/`, and import `"./styles/layout-overrides.css"` after `"./styles/app.css"` in `frontend/src/main.tsx`. Review and commit the file and import to include the changes in deployment.

Changes save locally as you work. Exports target the current URL path and screen range (mobile below 768px, tablet 768–1023px, desktop 1024px and above). Review each responsive range before committing. Moving uses CSS `translate`, so it changes visual position without reordering document flow; resizing uses fixed pixel dimensions. For lasting layout changes, prefer transferring the values into the component's responsive CSS.

Use **Ctrl+Z** to undo applied editor changes and **Ctrl+Shift+Z** or **Ctrl+Y** to redo. While typing in an input or textarea, the browser's normal text undo is preserved. To change a label or heading, select it, edit **Text content**, and click **Apply text**. Text edits share the same undo history and save locally. Icons and nested controls remain intact; select the specific text element when a container contains several text nodes. Form field values are not changed by the text editor.

**Export text edits** downloads `text-edits.json` with the original and replacement text, page, screen range and selector. Apply these replacements in the source components or their data source before committing; importing CSS alone does not apply text changes.

The editor prefers `data-ui-id` hooks when present and otherwise generates structural selectors. Structural selectors can target a different element after markup or list ordering changes. Add a unique `data-ui-id` to important elements before editing them when you need stable exports. The editor does not edit React markup, business logic or backend data.

## Layout
- `backend/` FastAPI + SQLAlchemy 2 + Alembic. Pricing, stock, status transitions and role checks are enforced server-side (`app/services/core.py`, `app/deps.py`).
- `frontend/` Vite + React + TypeScript, `vite-plugin-pwa` (installable, offline shell, update toast).
- `design-system/frostpoint/MASTER.md` design rules (frosty glass, light theme tokens in `frontend/src/styles/app.css`).

## Checks
```bash
docker compose exec api python -m pytest -q     # backend (uses a separate frostpoint_test DB)
cd frontend && npm test && npm run build         # unit tests, typecheck, PWA build
```

## Notes
- GCash/Maya numbers are placeholders until set in Business Panel → Settings.
- Proof-of-payment files live in the `proofs` Docker volume and are only served to the owning customer and staff.
- Maps use MapLibre with free OpenFreeMap tiles (no key). Override the style with `VITE_MAP_STYLE` at build time.
- Route line and ETA come from OpenRouteService. Get a free key at openrouteservice.org and set `ORS_API_KEY`; without it, tracking shows a straight line and a rough ETA. The free plan allows 2,000 route requests a day and the server reuses each route until the rider moves about 300 m.
- Rider GPS needs HTTPS (or localhost) and the rider screen kept open; web pages cannot track in the background.
- Set `COOKIE_SECURE=true` and serve over HTTPS in production.
