from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from .. import models

DEFAULT_SETTINGS = {
    "free_delivery_threshold": "0",
    "default_delivery_fee": "50",
    "gcash_number": "09XX-XXX-XXXX",
    "gcash_name": "",
    "maya_number": "09XX-XXX-XXXX",
    "maya_name": "",
    "bank_details": "",
}

# Placed -> Confirmed (staff verify payment) -> Preparing -> On the way -> Delivered.
# After confirmation steps may be skipped (e.g. pickup orders never go "Out for Delivery").
TRANSITIONS = {
    "Order Placed": {"Order Confirmed", "Cancelled"},
    "Order Confirmed": {"Preparing", "Out for Delivery", "Delivered Successfully", "Cancelled"},
    "Preparing": {"Out for Delivery", "Delivered Successfully", "Cancelled"},
    "Out for Delivery": {"Delivered Successfully", "Cancelled"},
    "Delivered Successfully": set(),
    "Cancelled": set(),
}


def get_settings(db: Session) -> dict[str, str]:
    stored = {s.key: s.value for s in db.scalars(select(models.AppSetting))}
    return {**DEFAULT_SETTINGS, **stored}


def known_locations(db: Session) -> list[str]:
    names = set(db.scalars(select(models.IceBlockRate.location)))
    names |= set(db.scalars(select(models.FixedDeliveryRate.location)))
    return sorted(names)


def log(db: Session, user: models.Account, action: str, entity: str, description: str, meta: dict | None = None):
    db.add(models.ActivityLog(
        action=action, entity=entity, description=description,
        user_name=user.name, user_email=user.email, meta=meta or {},
    ))


def _load_lines(db: Session, lines, lock: bool = False):
    ids = [l.product_id for l in lines]
    stmt = select(models.Product).where(models.Product.id.in_(ids))
    if lock:
        stmt = stmt.with_for_update()
    products = {p.id: p for p in db.scalars(stmt)}
    out = []
    for l in lines:
        p = products.get(l.product_id)
        if not p or not p.is_active:
            raise HTTPException(400, f"Product {l.product_id} is unavailable")
        if l.qty < p.min_order_qty:
            raise HTTPException(400, f"{p.name}: minimum order is {p.min_order_qty}")
        out.append((p, l.qty))
    return out


def compute_quote(db: Session, resolved, mode: str, location: str):
    """Server-side pricing. `resolved` is a list of (Product, qty)."""
    cfg = get_settings(db)
    subtotal = sum((p.price * q for p, q in resolved), Decimal("0"))
    notes: list[str] = []
    fee = Decimal("0")
    threshold = Decimal(cfg["free_delivery_threshold"])
    if mode == "delivery":
        loc = location.strip().upper()
        default_fee = Decimal(cfg["default_delivery_fee"])
        matched = False
        block_qty = sum(q for p, q in resolved if p.category == "Ice Block")
        if block_qty:
            r = db.scalar(select(models.IceBlockRate).where(models.IceBlockRate.location == loc))
            if r and r.per_piece_rate is not None:
                fee += r.per_piece_rate * block_qty
                matched = True
            elif r and r.flat_fee is not None:
                fee += r.flat_fee
                matched = True
            else:
                fee += default_fee
        others = {p.category for p, _ in resolved if p.category != "Ice Block"}
        for cat in sorted(others):
            r = db.scalar(select(models.FixedDeliveryRate).where(
                models.FixedDeliveryRate.location == loc, models.FixedDeliveryRate.category == cat))
            if r:
                fee += r.fee
                matched = True
            else:
                fee += default_fee
        if not matched:
            notes.append("No rate found for this location; default delivery fee applied.")
        if threshold > 0 and subtotal >= threshold:
            fee = Decimal("0")
            notes.append("Free delivery applied.")
    q = Decimal("0.01")
    return subtotal.quantize(q), fee.quantize(q), threshold, notes


def quote(db: Session, lines, mode: str, location: str):
    resolved = _load_lines(db, lines)
    subtotal, fee, threshold, notes = compute_quote(db, resolved, mode, location)
    return {"subtotal": subtotal, "delivery_fee": fee, "total": subtotal + fee,
            "free_delivery_threshold": threshold, "notes": notes}


def place_order(db: Session, user: models.Account, data) -> models.Order:
    resolved = _load_lines(db, data.items, lock=True)
    if data.mode not in ("delivery", "pickup"):
        raise HTTPException(400, "Invalid mode")
    if data.mode == "delivery" and not data.location.strip():
        raise HTTPException(400, "Select a delivery location")
    subtotal, fee, _, _ = compute_quote(db, resolved, data.mode, data.location)
    order = models.Order(
        customer_id=user.id, receiver_name=data.receiver_name, phone=data.phone,
        address=data.address, location=data.location.strip().upper(), mode=data.mode,
        schedule_at=data.schedule_at, payment_method=data.payment_method,
        payment_ref=data.payment_ref, notes=data.notes,
        payment_status="cod_due" if data.payment_method == "COD" else "unpaid",
        dest_lat=data.dest_lat if data.mode == "delivery" else None,
        dest_lng=data.dest_lng if data.mode == "delivery" else None,
        subtotal=subtotal, delivery_fee=fee, total=subtotal + fee,
    )
    order.events.append(models.OrderEvent(status="Order Placed", by_id=user.id))
    for p, q in resolved:
        # Atomic: only decrements if enough stock remains.
        res = db.execute(update(models.Product)
                         .where(models.Product.id == p.id, models.Product.stock >= q)
                         .values(stock=models.Product.stock - q))
        if res.rowcount != 1:
            db.rollback()
            raise HTTPException(409, f"Not enough stock for {p.name}")
        order.items.append(models.OrderItem(product_id=p.id, name=p.name, category=p.category, price=p.price, qty=q))
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def change_status(db: Session, order: models.Order, status: str, reason: str = "", user: models.Account | None = None):
    if status not in TRANSITIONS.get(order.status, set()):
        raise HTTPException(400, f"Cannot change from {order.status} to {status}")
    if status == "Cancelled":
        if not reason.strip():
            raise HTTPException(400, "A cancellation reason is required")
        order.cancel_reason = reason
        for it in order.items:
            if it.product_id:
                db.execute(update(models.Product).where(models.Product.id == it.product_id)
                           .values(stock=models.Product.stock + it.qty))
    if status == "Delivered Successfully" and order.payment_status == "cod_due":
        order.payment_status = "paid"  # cash was collected at the door
    order.status = status
    order.events.append(models.OrderEvent(status=status, by_id=user.id if user else None))
    if status in ("Delivered Successfully", "Cancelled") and order.rider_id:
        release_rider_location(db, order.rider_id)


def release_rider_location(db: Session, rider_id: int):
    """Stop sharing a rider's position once they have no delivery in progress."""
    db.flush()
    busy = db.scalar(select(func.count()).select_from(models.Order).where(
        models.Order.rider_id == rider_id, models.Order.status == "Out for Delivery"))
    if not busy:
        db.execute(delete(models.RiderLocation).where(models.RiderLocation.rider_id == rider_id))


def assign_rider(db: Session, order: models.Order, rider_id: int | None):
    if order.status in ("Delivered Successfully", "Cancelled"):
        raise HTTPException(400, "Order is already closed")
    rider = None
    if rider_id is not None:
        rider = db.get(models.Account, rider_id)
        if not rider or rider.role != "rider" or not rider.is_active:
            raise HTTPException(400, "Choose an active rider")
        if order.mode != "delivery":
            raise HTTPException(400, "Pickup orders do not need a rider")
    old = order.rider_id
    order.rider = rider
    order.rider_accepted_at = None
    if old and old != rider_id:
        release_rider_location(db, old)


def rider_order_out(o: models.Order) -> dict:
    due = o.total if o.payment_status == "cod_due" else Decimal("0")
    return {
        **{c: getattr(o, c) for c in (
            "id", "status", "receiver_name", "phone", "address", "location", "notes", "schedule_at",
            "payment_method", "payment_status", "created_at")},
        "cash_to_collect": due, "dest_lat": o.dest_lat, "dest_lng": o.dest_lng,
        "accepted_at": o.rider_accepted_at, "items": o.items,
    }


def set_payment_status(order: models.Order, status: str):
    if status not in ("unpaid", "paid"):
        raise HTTPException(400, "Payment can only be marked paid or unpaid")
    if order.status == "Cancelled":
        raise HTTPException(400, "Order is cancelled")
    if status == "unpaid" and order.payment_method == "COD":
        status = "cod_due"
    order.payment_status = status


def order_out(o: models.Order) -> dict:
    return {
        **{c: getattr(o, c) for c in (
            "id", "customer_id", "receiver_name", "phone", "address", "location", "mode", "schedule_at",
            "payment_method", "payment_ref", "payment_status", "notes", "subtotal", "delivery_fee", "total",
            "status", "cancel_reason", "created_at")},
        "customer_name": o.customer.name if o.customer else "",
        "has_proof": bool(o.proof_path),
        "has_delivery_proof": bool(o.delivery_proof_path),
        "dest_lat": o.dest_lat,
        "dest_lng": o.dest_lng,
        "rider_id": o.rider_id,
        "rider_name": o.rider.name if o.rider else "",
        "rider_accepted_at": o.rider_accepted_at,
        "items": o.items,
        "events": o.events,
    }
