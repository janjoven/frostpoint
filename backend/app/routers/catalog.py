from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..deps import current_user, staff_up
from ..services.core import get_settings, known_locations, log

router = APIRouter(prefix="/api", tags=["catalog"])


@router.get("/products", response_model=list[schemas.ProductOut])
def list_products(all: bool = False, db: Session = Depends(get_db)):
    stmt = select(models.Product).order_by(models.Product.id)
    if not all:
        stmt = stmt.where(models.Product.is_active.is_(True))
    return db.scalars(stmt).all()


@router.post("/products", response_model=schemas.ProductOut, status_code=201)
def create_product(data: schemas.ProductIn, user=Depends(staff_up), db: Session = Depends(get_db)):
    p = models.Product(**data.model_dump())
    db.add(p)
    log(db, user, "Added", "product", f"Added product {p.name}", {"after": data.model_dump(mode="json")})
    db.commit()
    return p


@router.put("/products/{pid}", response_model=schemas.ProductOut)
def update_product(pid: int, data: schemas.ProductIn, user=Depends(staff_up), db: Session = Depends(get_db)):
    p = db.get(models.Product, pid)
    if not p:
        raise HTTPException(404, "Product not found")
    before = schemas.ProductIn.model_validate(p, from_attributes=True).model_dump(mode="json")
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    log(db, user, "Edited", "product", f"Edited product {p.name}",
        {"before": before, "after": data.model_dump(mode="json")})
    db.commit()
    return p


@router.patch("/products/{pid}/stock", response_model=schemas.ProductOut)
def set_stock(pid: int, data: schemas.StockIn, user=Depends(staff_up), db: Session = Depends(get_db)):
    p = db.get(models.Product, pid)
    if not p:
        raise HTTPException(404, "Product not found")
    old = p.stock
    p.stock = data.stock
    log(db, user, "Edited", "product", f"Stock of {p.name}: {old} → {data.stock}",
        {"before": {"stock": old}, "after": {"stock": data.stock}})
    db.commit()
    return p


@router.delete("/products/{pid}", status_code=204)
def delete_product(pid: int, user=Depends(staff_up), db: Session = Depends(get_db)):
    p = db.get(models.Product, pid)
    if not p:
        raise HTTPException(404, "Product not found")
    log(db, user, "Deleted", "product", f"Deleted product {p.name}", {"before": {"name": p.name, "price": str(p.price)}})
    db.delete(p)
    db.commit()


@router.get("/rates/ice-block", response_model=list[schemas.IceBlockRateOut])
def ice_rates(db: Session = Depends(get_db)):
    return db.scalars(select(models.IceBlockRate).order_by(models.IceBlockRate.location)).all()


@router.post("/rates/ice-block", response_model=schemas.IceBlockRateOut, status_code=201)
def add_ice_rate(data: schemas.IceBlockRateIn, user=Depends(staff_up), db: Session = Depends(get_db)):
    r = models.IceBlockRate(**{**data.model_dump(), "location": data.location.strip().upper()})
    db.add(r)
    log(db, user, "Added", "rate", f"Added Ice Block rate for {r.location}", {"after": data.model_dump(mode="json")})
    db.commit()
    return r


@router.put("/rates/ice-block/{rid}", response_model=schemas.IceBlockRateOut)
def edit_ice_rate(rid: int, data: schemas.IceBlockRateIn, user=Depends(staff_up), db: Session = Depends(get_db)):
    r = db.get(models.IceBlockRate, rid)
    if not r:
        raise HTTPException(404, "Rate not found")
    before = {"per_piece_rate": str(r.per_piece_rate), "flat_fee": str(r.flat_fee)}
    r.per_piece_rate, r.flat_fee = data.per_piece_rate, data.flat_fee
    log(db, user, "Edited", "rate", f"Edited Ice Block rate for {r.location}",
        {"before": before, "after": data.model_dump(mode="json")})
    db.commit()
    return r


@router.delete("/rates/ice-block/{rid}", status_code=204)
def del_ice_rate(rid: int, user=Depends(staff_up), db: Session = Depends(get_db)):
    r = db.get(models.IceBlockRate, rid)
    if not r:
        raise HTTPException(404, "Rate not found")
    log(db, user, "Deleted", "rate", f"Deleted Ice Block rate for {r.location}")
    db.delete(r)
    db.commit()


@router.get("/rates/fixed", response_model=list[schemas.FixedRateOut])
def fixed_rates(db: Session = Depends(get_db)):
    return db.scalars(select(models.FixedDeliveryRate).order_by(
        models.FixedDeliveryRate.location, models.FixedDeliveryRate.category)).all()


@router.post("/rates/fixed", response_model=schemas.FixedRateOut, status_code=201)
def add_fixed(data: schemas.FixedRateIn, user=Depends(staff_up), db: Session = Depends(get_db)):
    r = models.FixedDeliveryRate(**{**data.model_dump(), "location": data.location.strip().upper()})
    db.add(r)
    log(db, user, "Added", "rate", f"Added fixed rate {r.location}/{r.category}", {"after": data.model_dump(mode="json")})
    db.commit()
    return r


@router.put("/rates/fixed/{rid}", response_model=schemas.FixedRateOut)
def edit_fixed(rid: int, data: schemas.FixedRateIn, user=Depends(staff_up), db: Session = Depends(get_db)):
    r = db.get(models.FixedDeliveryRate, rid)
    if not r:
        raise HTTPException(404, "Rate not found")
    before = {"fee": str(r.fee)}
    r.fee = data.fee
    log(db, user, "Edited", "rate", f"Edited fixed rate {r.location}/{r.category}",
        {"before": before, "after": {"fee": str(data.fee)}})
    db.commit()
    return r


@router.delete("/rates/fixed/{rid}", status_code=204)
def del_fixed(rid: int, user=Depends(staff_up), db: Session = Depends(get_db)):
    r = db.get(models.FixedDeliveryRate, rid)
    if not r:
        raise HTTPException(404, "Rate not found")
    log(db, user, "Deleted", "rate", f"Deleted fixed rate {r.location}/{r.category}")
    db.delete(r)
    db.commit()


@router.get("/locations", response_model=list[str])
def locations(db: Session = Depends(get_db)):
    return known_locations(db)


@router.get("/settings")
def public_settings(user=Depends(current_user), db: Session = Depends(get_db)):
    s = get_settings(db)
    if user.role in ("customer", "rider"):
        keys = ("free_delivery_threshold", "gcash_number", "gcash_name", "maya_number", "maya_name", "bank_details")
        return {k: s[k] for k in keys}
    return s


@router.put("/settings")
def save_settings(data: dict[str, str], user=Depends(staff_up), db: Session = Depends(get_db)):
    from ..services.core import DEFAULT_SETTINGS
    before = get_settings(db)
    for k, v in data.items():
        if k not in DEFAULT_SETTINGS:
            continue
        row = db.get(models.AppSetting, k)
        if row:
            row.value = v
        else:
            db.add(models.AppSetting(key=k, value=v))
    changed = {k: {"before": before[k], "after": v} for k, v in data.items() if k in before and before[k] != v}
    if changed:
        log(db, user, "Edited", "settings", "Edited settings: " + ", ".join(changed), {"changes": changed})
    db.commit()
    return get_settings(db)
