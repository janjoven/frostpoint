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

## AML ERP requisitions

In real API mode, all AML section cards, paginated lists, search, status filters,
and record details read from ERP through FastAPI. Requisitions also support a With MR
filter. `npm run dev:mock` continues to use browser-local sample records.
Live ERP access is restricted to local Admin accounts. No ERP credentials are sent
to the frontend, and ERP responses are excluded from service-worker caching.

| AML section | ERP DocType | Status mapping |
| --- | --- | --- |
| Requisition Slip | Requisition Slip | Workflow State |
| Direct Payment Order | Direct Payment Order | Workflow State |
| Purchase Order | Purchase Order | Workflow State and fulfillment Status, separately |
| Disbursement Voucher | Payment Entry | `docstatus`: Draft / Submitted / Cancelled |
| Employee List | Employee | Employment Status |

Assign the dedicated integration role Select and Read on each DocType and assign
that role to the integration user. List and detail adapters are read-only. Dedicated
creation endpoints are described below; approval, posting, payment execution, and
deletion remain in ERP. The non-requisition
lists include all companies accessible to that ERP user, without name-prefix filters.
Source amounts and currency codes are retained; a missing currency is not replaced
with an assumed PHP symbol.

Employee list and detail requests fetch only a fixed work-directory projection:
record ID, name, company, department, designation, company email, joining date,
employment type, branch, status, and modification timestamp. They do not fetch the
full HR document. Financial details use allowlisted scalar and child-table fields.
Payment Entry reviews display actual references, amounts, and available payment
breakdowns. Official voucher printing stays in ERP; real API mode does not put
live records into the sample voucher/PDF template.

Set these in the root `.env` (not a frontend `.env`):

```dotenv
ERP_BASE_URL=https://erp.amlgroupofcompanies.com
ERP_API_KEY=
ERP_API_SECRET=
ERP_REQUISITION_PREFIX=FRP-
ERP_REQUISITION_CREATE_ENABLED=false
ERP_DPO_CREATE_ENABLED=false
ERP_REQUISITION_WRITES_ENABLED=false
```

Confirm the environment and approved integration user with the ERP administrator.
For a Frappe ERP, open that user from the User list, go to Settings (if present),
then API Access. Obtain the API Key and API Secret. Generating new keys can replace
existing credentials, so do not regenerate another integration's keys.
See the [Frappe authentication documentation](https://docs.frappe.io/framework/user/en/api/rest#authentication).

Keep credentials in the ignored root `.env`; never commit them or use a `VITE_`
prefix. Compose passes these settings only to FastAPI. After changing environment
values or backend source, run `docker compose up -d --build api` from the root.
Vite reloads frontend edits, but the current API container needs rebuilding for
backend code changes.

AML Network defaults to Frostpoint's `FRP-` requisitions. The backend prefix scopes
the list, counts, searches, and detail access; there is no source checkbox in AML.
Other AML sections continue to include all accessible companies. The Pending
Approval card groups the pending and forwarded workflow states listed in the UI;
it does not perform an ERP approval action.

Editing is disabled by default. To enable it after confirming the target environment,
grant the integration user Write permission on Requisition Slip and set
`ERP_REQUISITION_WRITES_ENABLED=true`, then recreate the API container. Each record
also requires ERP document-level Write permission; Frappe enforces its workflow
and field permissions when saving. Updates include the original modification
timestamp to reject stale edits. Approval fields and workflow state are read-only.
The editor preserves unedited item amounts, accounting references, and attachments;
adding/removing item rows on existing records is not supported.

**Add Requisition Slip** creates a new Frostpoint request through the standard ERP
resource API when `ERP_REQUISITION_CREATE_ENABLED=true` and the ERP user has Create
permission on Requisition Slip. The backend controls the naming series
`FRP-RS-.YYYY.-.######`; it never accepts caller-supplied names, workflow states,
approval fields, or permission-bypass flags. ERP chooses the sequence and initial
workflow state. Required fields are cost center, date, requester, and at least one
item with an ERP UOM and positive quantity. Linked searches need Select access to
Cost Center, Project, UOM, and Equipment (where used), subject to ERP user restrictions.
Creating requisitions does not grant Write, Delete, or approval permissions.

Unfinished forms are retained locally, but **Create in ERP** transmits to the
configured ERP. Each submission carries a UUID. A durable local submission ledger
serializes duplicates and stores the resulting ERP ID; uncertain network outcomes
are checked against ERP's existing `custom_client_action_id` field and are never
blindly re-inserted. If ERP assigns an unexpected prefix, the response reports it
and prevents another insert. The form supports checking a pending submission after
a page closes. ERP still enforces its business validations and workflow permissions.

The requested ERP-only FROSTPOINT checkbox is supplied in
[`erp_customizations/requisition_slip_frostpoint.js`](erp_customizations/requisition_slip_frostpoint.js).
Install it as a separate List Client Script using the ERP administrator account;
see [`erp_customizations/README.md`](erp_customizations/README.md). It preserves the
existing ACCSYS script and filters IDs with `FRP-%`. The integration user does not
need permission to manage Client Scripts.

### Direct Payment Order creation

**Add Direct Payment Order** saves a payment request to ERP when
`ERP_DPO_CREATE_ENABLED=true` and the integration user has Create on Direct Payment
Order. New IDs use `FRP-DPO-.YYYY.-.#####`. Existing payment lists still include all
accessible ERP orders. Mock mode keeps its separate local preview form.

The form uses ERP department choices, Employee/Supplier payees, and permission-aware
link searches. Required core lookup access is Select on Company, Account, Cost Center,
and the selected payee's DocType. UOM, Project, Equipment, Requisition Slip, Bank
Account, Tax Category, and Cash Advance Liquidation need Select access when used.
The backend verifies company, cost center, payee, and expense-account selections;
account and cost-center searches are constrained to the selected company.

Expense amounts are validated against quantity × unit cost when both are supplied.
The backend independently computes subtotal, percentage/fixed discounts, taxes, and
total using decimal rounding. Derived total fields are not accepted from the browser.
Approval, audit, paid, and cleared flags cannot be supplied through the creation API.
Creating an order does not create a Payment Entry, execute a transfer, or invoke
approval actions. ERP validates the request and chooses its initial workflow state.

The separate payment submission ledger provides the same duplicate/retry protection
as requisitions. An appended `Frostpoint submission ID: FRP-DPO:<UUID>` line in
Internal Notes supports reconciling uncertain outcomes without requiring an ERP
custom field. Unconfirmed inserts are never blindly repeated. Editing the request,
approving it, and processing its payment remain ERP actions.

Mappings were checked against the target ERP's form and child-table metadata.
The API uses a fixed set of DocTypes and an allowlist of exposed/editable fields.
No ERP writes are required for setup or automated tests. Run the isolated adapter
tests with `docker compose exec api python -m pytest -q erp_tests`; these use fake
ERP responses and never connect to a database or the live ERP.

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
