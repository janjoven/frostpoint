from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..deps import current_user
from ..services.core import known_locations

router = APIRouter(prefix="/api/addresses", tags=["addresses"])

MAX_ADDRESSES = 5


def _mine(db: Session, user: models.Account) -> list[models.SavedAddress]:
    return list(db.scalars(select(models.SavedAddress).where(models.SavedAddress.account_id == user.id)
                           .order_by(models.SavedAddress.is_default.desc(), models.SavedAddress.id)))


def _get(db: Session, user: models.Account, aid: int) -> models.SavedAddress:
    a = db.get(models.SavedAddress, aid)
    if not a or a.account_id != user.id:
        raise HTTPException(404, "Address not found")
    return a


@router.get("", response_model=list[schemas.AddressOut])
def list_addresses(user=Depends(current_user), db: Session = Depends(get_db)):
    return _mine(db, user)


@router.post("", response_model=schemas.AddressOut, status_code=201)
def add_address(data: schemas.AddressIn, user=Depends(current_user), db: Session = Depends(get_db)):
    existing = _mine(db, user)
    if len(existing) >= MAX_ADDRESSES:
        raise HTTPException(400, f"You can save up to {MAX_ADDRESSES} addresses")
    loc = data.location.strip().upper()
    if loc not in known_locations(db):
        raise HTTPException(400, "Choose a delivery location from the list")
    make_default = data.is_default or not existing
    if make_default:
        db.execute(update(models.SavedAddress).where(models.SavedAddress.account_id == user.id)
                   .values(is_default=False))
    a = models.SavedAddress(account_id=user.id, label=data.label.strip(), location=loc,
                            address=data.address.strip(), lat=data.lat, lng=data.lng, is_default=make_default)
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.patch("/{aid}/default", response_model=schemas.AddressOut)
def make_default(aid: int, user=Depends(current_user), db: Session = Depends(get_db)):
    a = _get(db, user, aid)
    db.execute(update(models.SavedAddress).where(models.SavedAddress.account_id == user.id)
               .values(is_default=False))
    a.is_default = True
    db.commit()
    db.refresh(a)
    return a


@router.delete("/{aid}", status_code=204)
def delete_address(aid: int, user=Depends(current_user), db: Session = Depends(get_db)):
    a = _get(db, user, aid)
    was_default = a.is_default
    db.delete(a)
    db.flush()
    if was_default:
        rest = _mine(db, user)
        if rest:
            rest[0].is_default = True
    db.commit()
