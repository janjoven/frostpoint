from fastapi import FastAPI

from .routers import addresses, admin, auth, catalog, erp, erp_records, erp_payment_create, orders, rider, support

app = FastAPI(title="FROSTPOINT API", docs_url="/api/docs", openapi_url="/api/openapi.json")

for r in (auth.router, catalog.router, orders.router, addresses.router, rider.router, admin.router, admin.public,
          support.router, erp.router, erp_records.router, erp_payment_create.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"ok": True}
