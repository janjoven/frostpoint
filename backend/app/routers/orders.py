import math
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import settings
from ..db import get_db
from ..deps import current_user, staff_up
from ..services.core import (assign_rider, change_status, log, order_out, place_order, quote,
                             set_payment_status)
from ..services import routing
from ..services.uploads import store_upload

router = APIRouter(prefix="/api", tags=["orders"])

STAFF_ROLES = ("staff", "owner", "admin")
STALE_SECONDS = 60


@router.post("/quote", response_model=schemas.QuoteOut)
def get_quote(data: schemas.QuoteIn, db: Session = Depends(get_db)):
    return quote(db, data.items, data.mode, data.location)


@router.post("/orders", response_model=schemas.OrderOut, status_code=201)
def create_order(data: schemas.OrderIn, user=Depends(current_user), db: Session = Depends(get_db)):
    return order_out(place_order(db, user, data))


@router.get("/orders/mine", response_model=list[schemas.OrderOut])
def my_orders(user=Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(models.Order).where(models.Order.customer_id == user.id)
                      .order_by(models.Order.created_at.desc())).unique().all()
    return [order_out(o) for o in rows]


@router.get("/orders", response_model=list[schemas.OrderOut])
def all_orders(status: str | None = None, user=Depends(staff_up), db: Session = Depends(get_db)):
    stmt = select(models.Order).order_by(models.Order.created_at.desc())
    if status:
        stmt = stmt.where(models.Order.status == status)
    return [order_out(o) for o in db.scalars(stmt).unique().all()]


def _get_visible(db: Session, user: models.Account, oid: int) -> models.Order:
    """Staff see every order, customers only their own. Riders have their own endpoints (/api/rider)."""
    o = db.get(models.Order, oid)
    if not o or (user.role not in STAFF_ROLES and (user.role != "customer" or o.customer_id != user.id)):
        raise HTTPException(404, "Order not found")
    return o


@router.get("/orders/{oid}", response_model=schemas.OrderOut)
def get_order(oid: int, user=Depends(current_user), db: Session = Depends(get_db)):
    return order_out(_get_visible(db, user, oid))


@router.patch("/orders/{oid}/status", response_model=schemas.OrderOut)
def set_status(oid: int, data: schemas.StatusIn, user=Depends(staff_up), db: Session = Depends(get_db)):
    o = _get_visible(db, user, oid)
    before = o.status
    change_status(db, o, data.status, data.reason, user)
    log(db, user, "Approved" if data.status != "Cancelled" else "Rejected", "order",
        f"Order #{o.id}: {before} → {data.status}", {"before": {"status": before}, "after": {"status": data.status}})
    db.commit()
    return order_out(o)


@router.patch("/orders/{oid}/payment", response_model=schemas.OrderOut)
def set_payment(oid: int, data: schemas.PaymentIn, user=Depends(staff_up), db: Session = Depends(get_db)):
    o = _get_visible(db, user, oid)
    before = o.payment_status
    set_payment_status(o, data.payment_status)
    log(db, user, "Approved", "order", f"Order #{o.id} payment: {before} → {o.payment_status}",
        {"before": {"payment_status": before}, "after": {"payment_status": o.payment_status}})
    db.commit()
    return order_out(o)


@router.patch("/orders/{oid}/schedule", response_model=schemas.OrderOut)
def set_schedule(oid: int, data: schemas.ScheduleIn, user=Depends(staff_up), db: Session = Depends(get_db)):
    o = _get_visible(db, user, oid)
    before = o.schedule_at.isoformat() if o.schedule_at else None
    o.schedule_at = data.schedule_at
    log(db, user, "Edited", "order", f"Order #{o.id} rescheduled",
        {"before": {"schedule_at": before}, "after": {"schedule_at": data.schedule_at.isoformat()}})
    db.commit()
    return order_out(o)


@router.delete("/orders/{oid}", status_code=204)
def delete_order(oid: int, user=Depends(staff_up), db: Session = Depends(get_db)):
    o = _get_visible(db, user, oid)
    log(db, user, "Deleted", "order", f"Deleted order #{o.id}",
        {"before": {"status": o.status, "total": str(o.total)}})
    db.delete(o)
    db.commit()


@router.post("/orders/{oid}/proof", status_code=204)
async def upload_proof(oid: int, file: UploadFile = File(...), user=Depends(current_user),
                       db: Session = Depends(get_db)):
    o = _get_visible(db, user, oid)
    if user.role == "customer" and o.status not in ("Order Placed", "Order Confirmed"):
        raise HTTPException(400, "Order is no longer open")
    o.proof_path = await store_upload(file, str(o.id))
    if o.payment_status == "unpaid":
        o.payment_status = "proof_sent"
    db.commit()


@router.get("/riders", response_model=list[schemas.RiderOut])
def list_riders(user=Depends(staff_up), db: Session = Depends(get_db)):
    return db.scalars(select(models.Account).where(models.Account.role == "rider", models.Account.is_active.is_(True))
                      .order_by(models.Account.name)).all()


@router.patch("/orders/{oid}/rider", response_model=schemas.OrderOut)
def set_rider(oid: int, data: schemas.RiderAssignIn, user=Depends(staff_up), db: Session = Depends(get_db)):
    o = _get_visible(db, user, oid)
    before = o.rider.name if o.rider else None
    assign_rider(db, o, data.rider_id)
    after = o.rider.name if o.rider else None
    log(db, user, "Edited", "order", f"Order #{o.id} rider: {before or 'none'} → {after or 'none'}",
        {"before": {"rider": before}, "after": {"rider": after}})
    db.commit()
    db.refresh(o)
    return order_out(o)


@router.get("/orders/{oid}/track", response_model=schemas.TrackOut)
def track(oid: int, user=Depends(current_user), db: Session = Depends(get_db)):
    """Live view for the customer: destination pin, and while out for delivery the rider, route and ETA."""
    o = _get_visible(db, user, oid)
    dest = (o.dest_lat, o.dest_lng) if o.dest_lat is not None and o.dest_lng is not None else None
    out: dict = {"status": o.status, "dest": {"lat": dest[0], "lng": dest[1]} if dest else None}
    loc = db.get(models.RiderLocation, o.rider_id) if o.rider_id and o.status == "Out for Delivery" else None
    if o.status != "Out for Delivery":
        routing.forget(o.id)
    if loc:
        age = (datetime.now(timezone.utc) - loc.updated_at).total_seconds()
        # Rounded to about 10 m: enough to follow the rider, not enough to pinpoint where they live.
        out["rider"] = {"name": o.rider.name if o.rider else "", "lat": round(loc.lat, 4), "lng": round(loc.lng, 4),
                        "accuracy": loc.accuracy, "updated_at": loc.updated_at, "stale": age > STALE_SECONDS}
        if dest:
            r = routing.get_route(o.id, (loc.lat, loc.lng), dest)
            out["route"] = {"coords": [[round(x, 5), round(y, 5)] for x, y in r["coords"]],
                            "distance_m": round(r["distance_m"]), "source": r["source"]}
            out["eta_minutes"] = max(1, math.ceil(r["duration_s"] / 60))
    return out


@router.get("/orders/{oid}/delivery-proof")
def get_delivery_proof(oid: int, user=Depends(current_user), db: Session = Depends(get_db)):
    o = _get_visible(db, user, oid)
    if not o.delivery_proof_path:
        raise HTTPException(404, "No delivery photo")
    return FileResponse(os.path.join(settings.proofs_dir, os.path.basename(o.delivery_proof_path)))


@router.get("/orders/{oid}/proof")
def get_proof(oid: int, user=Depends(current_user), db: Session = Depends(get_db)):
    o = _get_visible(db, user, oid)
    if not o.proof_path:
        raise HTTPException(404, "No proof uploaded")
    return FileResponse(os.path.join(settings.proofs_dir, os.path.basename(o.proof_path)))
