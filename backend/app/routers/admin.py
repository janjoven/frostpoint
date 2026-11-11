import io
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..deps import owner_up, staff_up
from ..security import hash_password
from ..services.core import log

router = APIRouter(prefix="/api/admin", tags=["admin"])
MNL = ZoneInfo("Asia/Manila")


def _now():
    return datetime.now(MNL)


def _valid_orders(db: Session):
    return db.scalars(select(models.Order).where(models.Order.status != "Cancelled")).unique().all()


@router.get("/stats")
def stats(user=Depends(staff_up), db: Session = Depends(get_db)):
    orders = _valid_orders(db)
    today = _now().date()
    days = 30
    spark: dict = {(today - timedelta(days=i)): {"revenue": 0.0, "orders": 0} for i in range(days - 1, -1, -1)}
    products: dict[str, dict] = {}
    for o in orders:
        d = o.created_at.astimezone(MNL).date()
        if d in spark:
            spark[d]["revenue"] += float(o.total)
            spark[d]["orders"] += 1
            for it in o.items:
                row = products.setdefault(it.name, {"name": it.name, "qty": 0, "total": 0.0})
                row["qty"] += it.qty
                row["total"] += float(it.price * it.qty)
    rev = lambda d: spark.get(d, {"revenue": 0.0})["revenue"]
    last7 = sum(rev(today - timedelta(days=i)) for i in range(7))
    prev7 = sum(rev(today - timedelta(days=i)) for i in range(7, 14))
    cnt7 = sum(spark[today - timedelta(days=i)]["orders"] for i in range(7))
    cntp7 = sum(spark[today - timedelta(days=i)]["orders"] for i in range(7, 14))
    pct = lambda cur, prev: None if not prev else round((cur - prev) / prev * 100, 1)
    by_status: dict[str, int] = {}
    for o in orders:
        by_status[o.status] = by_status.get(o.status, 0) + 1
    low_items = db.scalars(select(models.Product).where(
        models.Product.stock <= models.Product.low_stock_at, models.Product.is_active.is_(True))
        .order_by(models.Product.stock)).all()
    unread = db.scalar(select(func.count()).select_from(models.SupportMessage).where(
        models.SupportMessage.sender == "customer", models.SupportMessage.is_read.is_(False)))
    customers = db.scalar(select(func.count()).select_from(models.Account).where(models.Account.role == "customer"))
    return {
        "revenue_total": float(sum(o.total for o in orders)),
        "revenue_today": rev(today),
        "revenue_yesterday": rev(today - timedelta(days=1)),
        "revenue_week_change": pct(last7, prev7),
        "orders_week_change": pct(cnt7, cntp7),
        "orders_total": len(orders),
        "orders_today": spark[today]["orders"],
        "orders_pending": sum(1 for o in orders if o.status in (
            "Order Placed", "Order Confirmed", "Preparing", "Out for Delivery")),
        "placed": by_status.get("Order Placed", 0),
        "confirmed": by_status.get("Order Confirmed", 0),
        "out_for_delivery": by_status.get("Out for Delivery", 0),
        "by_status": by_status,
        "low_stock": len(low_items),
        "low_stock_items": [{"id": p.id, "name": p.name, "stock": p.stock, "uom": p.uom, "alert": p.low_stock_at} for p in low_items],
        "top_products": sorted(products.values(), key=lambda r: -r["total"])[:5],
        "unread_support": unread,
        "customers": customers,
        "spark": [{"date": d.isoformat(), **v} for d, v in spark.items()],
    }


def _report(db: Session, period: str) -> dict:
    now = _now()
    if period == "daily":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        key = lambda d: f"{d.hour:02d}:00"
        labels = [f"{h:02d}:00" for h in range(24)]
    elif period == "weekly":
        start = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
        key = lambda d: d.strftime("%b %d")
        labels = [(start + timedelta(days=i)).strftime("%b %d") for i in range(7)]
    elif period == "monthly":
        start = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
        key = lambda d: d.strftime("%b %d")
        labels = [(start + timedelta(days=i)).strftime("%b %d") for i in range(30)]
    elif period == "yearly":
        start = (now.replace(day=1, hour=0, minute=0, second=0, microsecond=0) - timedelta(days=335)).replace(day=1)
        key = lambda d: d.strftime("%b %Y")
        labels, cur = [], start
        while cur <= now:
            labels.append(cur.strftime("%b %Y"))
            cur = (cur.replace(day=28) + timedelta(days=4)).replace(day=1)
    else:
        raise HTTPException(400, "period must be daily, weekly, monthly or yearly")
    series = {l: {"label": l, "revenue": 0.0, "orders": 0} for l in labels}
    products: dict[str, dict] = defaultdict(lambda: {"name": "", "qty": 0, "price": 0.0, "total": 0.0})
    rows, revenue, count, fees = [], Decimal("0"), 0, Decimal("0")
    for o in _valid_orders(db):
        local = o.created_at.astimezone(MNL)
        if local < start:
            continue
        k = key(local)
        if k in series:
            series[k]["revenue"] += float(o.total)
            series[k]["orders"] += 1
        revenue += o.total
        fees += o.delivery_fee
        count += 1
        for it in o.items:
            p = products[it.name]
            p.update(name=it.name, price=float(it.price))
            p["qty"] += it.qty
            p["total"] += float(it.price * it.qty)
        rows.append(o)
    return {
        "period": period, "revenue": float(revenue), "orders": count, "delivery_fees": float(fees),
        "average": float(revenue / count) if count else 0.0,
        "series": list(series.values()),
        "products": sorted(products.values(), key=lambda p: -p["total"]),
        "_orders": rows,
    }


@router.get("/reports/{period}")
def report(period: str, user=Depends(staff_up), db: Session = Depends(get_db)):
    data = _report(db, period)
    data.pop("_orders")
    return data


@router.get("/reports/{period}/export.xlsx")
def export_xlsx(period: str, user=Depends(staff_up), db: Session = Depends(get_db)):
    from openpyxl import Workbook
    data = _report(db, period)
    wb = Workbook()
    ws = wb.active
    ws.title = "Summary"
    for r in (("Period", period), ("Revenue", data["revenue"]), ("Orders", data["orders"]),
              ("Delivery fees", data["delivery_fees"]), ("Average order", data["average"])):
        ws.append(r)
    ws = wb.create_sheet("Products")
    ws.append(["Product", "Qty", "Price", "Total"])
    for p in data["products"]:
        ws.append([p["name"], p["qty"], p["price"], p["total"]])
    ws = wb.create_sheet("Trend")
    ws.append(["Label", "Orders", "Revenue"])
    for s in data["series"]:
        ws.append([s["label"], s["orders"], s["revenue"]])
    ws = wb.create_sheet("Orders")
    ws.append(["Order #", "Date", "Customer", "Mode", "Payment", "Status", "Subtotal", "Delivery", "Total"])
    for o in data["_orders"]:
        ws.append([o.id, o.created_at.astimezone(MNL).strftime("%Y-%m-%d %H:%M"), o.receiver_name, o.mode,
                   o.payment_method, o.status, float(o.subtotal), float(o.delivery_fee), float(o.total)])
    ws = wb.create_sheet("Items")
    ws.append(["Order #", "Item", "Qty", "Price"])
    for o in data["_orders"]:
        for it in o.items:
            ws.append([o.id, it.name, it.qty, float(it.price)])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f'attachment; filename="frostpoint-{period}.xlsx"'})


# ---------- users ----------
@router.get("/customers")
def customers(user=Depends(staff_up), db: Session = Depends(get_db)):
    accounts = db.scalars(select(models.Account).where(models.Account.role == "customer")
                          .order_by(models.Account.created_at.desc())).all()
    totals = {cid: (n, float(s or 0)) for cid, n, s in db.execute(
        select(models.Order.customer_id, func.count(), func.sum(models.Order.total))
        .where(models.Order.status != "Cancelled").group_by(models.Order.customer_id))}
    return [{**schemas.AccountOut.model_validate(a).model_dump(mode="json"),
             "orders": totals.get(a.id, (0, 0))[0], "spent": totals.get(a.id, (0, 0))[1]} for a in accounts]


@router.get("/team", response_model=list[schemas.AccountOut])
def team(user=Depends(owner_up), db: Session = Depends(get_db)):
    return db.scalars(select(models.Account).where(models.Account.role != "customer")).all()


@router.post("/team", response_model=schemas.AccountOut, status_code=201)
def add_member(data: schemas.TeamMemberIn, user=Depends(owner_up), db: Session = Depends(get_db)):
    if data.role not in ("staff", "owner", "admin", "rider"):
        raise HTTPException(400, "Invalid role")
    if data.role == "admin" and user.role != "admin":
        raise HTTPException(403, "Only an admin can create admins")
    if db.scalar(select(models.Account).where(models.Account.email == data.email.lower())):
        raise HTTPException(409, "Email already in use")
    a = models.Account(email=data.email.lower(), name=data.name, role=data.role,
                       password_hash=hash_password(data.password))
    db.add(a)
    log(db, user, "Added", "user", f"Added team member {a.name} ({a.role})", {"after": {"email": a.email, "role": a.role}})
    db.commit()
    return a


@router.patch("/users/{uid}", response_model=schemas.AccountOut)
def edit_user(uid: int, data: schemas.AccountUpdate, user=Depends(owner_up), db: Session = Depends(get_db)):
    a = db.get(models.Account, uid)
    if not a:
        raise HTTPException(404, "User not found")
    if a.id == user.id and (data.role or data.is_active is False):
        raise HTTPException(400, "You cannot change your own role or deactivate yourself")
    if data.role and data.role not in models.ROLES:
        raise HTTPException(400, "Invalid role")
    if (data.role == "admin" or a.role == "admin") and user.role != "admin":
        raise HTTPException(403, "Only an admin can change admin roles")
    before = {"name": a.name, "phone": a.phone, "role": a.role, "is_active": a.is_active}
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(a, k, schemas.normalize_phone(v) if k == "phone" else v)
    log(db, user, "Edited", "user", f"Edited user {a.name}",
        {"before": before, "after": {"name": a.name, "phone": a.phone, "role": a.role, "is_active": a.is_active}})
    db.commit()
    return a


@router.delete("/users/{uid}", status_code=204)
def delete_user(uid: int, user=Depends(owner_up), db: Session = Depends(get_db)):
    a = db.get(models.Account, uid)
    if not a or a.id == user.id:
        raise HTTPException(400, "Cannot delete this user")
    if a.role == "admin" and user.role != "admin":
        raise HTTPException(403, "Only an admin can delete admins")
    if db.scalar(select(func.count()).select_from(models.Order).where(models.Order.customer_id == a.id)):
        raise HTTPException(409, "User has orders; deactivate instead of deleting")
    log(db, user, "Deleted", "user", f"Deleted user {a.name}", {"before": {"email": a.email, "role": a.role}})
    db.delete(a)
    db.commit()


# ---------- broadcast ----------
def _ann_out(a: models.Announcement) -> dict:
    now = datetime.now(timezone.utc)
    live = a.starts_at <= now and (a.ends_at is None or a.ends_at > now)
    return {**{c: getattr(a, c) for c in ("id", "title", "message", "starts_at", "ends_at", "created_at")}, "live": live}


@router.get("/announcements", response_model=list[schemas.AnnouncementOut])
def announcements(user=Depends(staff_up), db: Session = Depends(get_db)):
    return [_ann_out(a) for a in db.scalars(select(models.Announcement).order_by(models.Announcement.created_at.desc()))]


@router.post("/announcements", response_model=schemas.AnnouncementOut, status_code=201)
def add_announcement(data: schemas.AnnouncementIn, user=Depends(staff_up), db: Session = Depends(get_db)):
    a = models.Announcement(title=data.title, message=data.message,
                            starts_at=data.starts_at or datetime.now(timezone.utc), ends_at=data.ends_at)
    db.add(a)
    log(db, user, "Added", "broadcast", f"Sent promotion “{a.title}”", {"after": data.model_dump(mode="json")})
    db.commit()
    return _ann_out(a)


@router.delete("/announcements/{aid}", status_code=204)
def del_announcement(aid: int, user=Depends(staff_up), db: Session = Depends(get_db)):
    a = db.get(models.Announcement, aid)
    if not a:
        raise HTTPException(404, "Not found")
    log(db, user, "Deleted", "broadcast", f"Deleted promotion “{a.title}”")
    db.delete(a)
    db.commit()


# ---------- activity ----------
@router.get("/activity", response_model=list[schemas.LogOut])
def activity(q: str = "", action: str = "", since: datetime | None = None, until: datetime | None = None,
             limit: int = 200, user=Depends(owner_up), db: Session = Depends(get_db)):
    stmt = select(models.ActivityLog).order_by(models.ActivityLog.created_at.desc()).limit(min(limit, 500))
    if action:
        stmt = stmt.where(models.ActivityLog.action == action)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(models.ActivityLog.description.ilike(like) | models.ActivityLog.user_name.ilike(like))
    if since:
        stmt = stmt.where(models.ActivityLog.created_at >= since)
    if until:
        stmt = stmt.where(models.ActivityLog.created_at <= until)
    return db.scalars(stmt).all()


# customer-facing live promotions
public = APIRouter(prefix="/api", tags=["public"])


@public.get("/promotions", response_model=list[schemas.AnnouncementOut])
def live_promotions(db: Session = Depends(get_db)):
    return [a for a in (_ann_out(x) for x in db.scalars(select(models.Announcement)
            .order_by(models.Announcement.created_at.desc()))) if a["live"]]
