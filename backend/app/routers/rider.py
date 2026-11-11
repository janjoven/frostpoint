from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import and_, exists, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..deps import require_roles
from ..services.core import TRANSITIONS, change_status, log, rider_order_out
from ..services.uploads import store_upload

router = APIRouter(prefix="/api/rider", tags=["rider"])
rider_only = require_roles("rider")

ACTIVE = ("Order Confirmed", "Preparing", "Out for Delivery")


def _mine(db: Session, user: models.Account, oid: int) -> models.Order:
    o = db.get(models.Order, oid)
    if not o or o.rider_id != user.id:
        raise HTTPException(404, "Order not found")
    return o


@router.get("/orders", response_model=list[schemas.RiderOrderOut])
def my_deliveries(user=Depends(rider_only), db: Session = Depends(get_db)):
    """Assigned deliveries that are ready to go, plus ones finished in the last 24 hours."""
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    done_recently = and_(models.Order.status == "Delivered Successfully", exists().where(
        models.OrderEvent.order_id == models.Order.id, models.OrderEvent.status == "Delivered Successfully",
        models.OrderEvent.at >= since))
    rows = db.scalars(select(models.Order).where(
        models.Order.rider_id == user.id, or_(models.Order.status.in_(ACTIVE), done_recently))
        .order_by(models.Order.schedule_at.is_(None), models.Order.schedule_at, models.Order.id)).unique().all()
    return [rider_order_out(o) for o in rows]


@router.post("/orders/{oid}/accept", response_model=schemas.RiderOrderOut)
def accept(oid: int, user=Depends(rider_only), db: Session = Depends(get_db)):
    o = _mine(db, user, oid)
    if o.status not in ACTIVE:
        raise HTTPException(400, "This delivery is not active")
    if o.rider_accepted_at is None:
        o.rider_accepted_at = datetime.now(timezone.utc)
        db.commit()
    return rider_order_out(o)


@router.post("/orders/{oid}/start", response_model=schemas.RiderOrderOut)
def start(oid: int, user=Depends(rider_only), db: Session = Depends(get_db)):
    o = _mine(db, user, oid)
    if "Out for Delivery" not in TRANSITIONS.get(o.status, set()):
        raise HTTPException(400, "This order is not ready for delivery yet" if o.status == "Order Placed"
                            else f"Cannot start a delivery that is {o.status.lower()}")
    if o.rider_accepted_at is None:
        o.rider_accepted_at = datetime.now(timezone.utc)
    change_status(db, o, "Out for Delivery", "", user)
    log(db, user, "Edited", "order", f"Order #{o.id} out for delivery with {user.name}",
        {"before": {"status": "Preparing"}, "after": {"status": "Out for Delivery"}})
    db.commit()
    return rider_order_out(o)


@router.post("/location", status_code=204)
def post_location(data: schemas.LocationIn, user=Depends(rider_only), db: Session = Depends(get_db)):
    """Latest GPS point from the rider's phone. Only accepted while a delivery is in progress."""
    busy = db.scalar(select(exists().where(models.Order.rider_id == user.id, models.Order.status == "Out for Delivery")))
    if not busy:
        raise HTTPException(409, "No delivery in progress")
    stmt = insert(models.RiderLocation).values(rider_id=user.id, lat=data.lat, lng=data.lng, accuracy=data.accuracy)
    db.execute(stmt.on_conflict_do_update(
        index_elements=[models.RiderLocation.rider_id],
        set_={"lat": data.lat, "lng": data.lng, "accuracy": data.accuracy, "updated_at": datetime.now(timezone.utc)}))
    db.commit()


@router.post("/orders/{oid}/delivered", response_model=schemas.RiderOrderOut)
async def delivered(oid: int, cash_collected: bool = Form(False), file: UploadFile | None = File(None),
                    user=Depends(rider_only), db: Session = Depends(get_db)):
    o = _mine(db, user, oid)
    if o.status != "Out for Delivery":
        raise HTTPException(400, "Start the delivery first")
    if o.payment_status == "cod_due" and not cash_collected:
        raise HTTPException(400, f"Confirm you collected ₱{o.total} in cash")
    if file is not None and file.filename:
        o.delivery_proof_path = await store_upload(file, f"delivery-{o.id}", allow_pdf=False)
    change_status(db, o, "Delivered Successfully", "", user)
    log(db, user, "Edited", "order", f"Order #{o.id} delivered by {user.name}",
        {"before": {"status": "Out for Delivery"}, "after": {"status": "Delivered Successfully"}})
    db.commit()
    return rider_order_out(o)
