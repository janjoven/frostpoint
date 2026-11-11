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

## Layout
- `backend/` FastAPI + SQLAlchemy 2 + Alembic. Pricing, stock, status transitions and role checks are enforced server-side (`app/services/core.py`, `app/deps.py`).
- `frontend/` Vite + React + TypeScript, `vite-plugin-pwa` (installable, offline shell, update toast).
- `design-system/frostpoint/MASTER.md` design rules (frosty glass, light + dark tokens in `frontend/src/styles/app.css`).

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
