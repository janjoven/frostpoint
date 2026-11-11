from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..deps import current_user, staff_up

router = APIRouter(prefix="/api/support", tags=["support"])


def _thread_for(db: Session, user: models.Account) -> models.SupportThread:
    t = db.scalar(select(models.SupportThread).where(models.SupportThread.customer_id == user.id))
    if not t:
        t = models.SupportThread(customer_id=user.id)
        db.add(t)
        db.commit()
    return t


@router.get("/mine", response_model=list[schemas.MessageOut])
def my_messages(user=Depends(current_user), db: Session = Depends(get_db)):
    t = _thread_for(db, user)
    for m in db.scalars(select(models.SupportMessage).where(
            models.SupportMessage.thread_id == t.id, models.SupportMessage.sender == "admin",
            models.SupportMessage.is_read.is_(False))):
        m.is_read = True
    db.commit()
    return db.scalars(select(models.SupportMessage).where(models.SupportMessage.thread_id == t.id)
                      .order_by(models.SupportMessage.created_at)).all()


@router.get("/mine/unread")
def my_unread(user=Depends(current_user), db: Session = Depends(get_db)):
    t = _thread_for(db, user)
    n = db.scalar(select(func.count()).select_from(models.SupportMessage).where(
        models.SupportMessage.thread_id == t.id, models.SupportMessage.sender == "admin",
        models.SupportMessage.is_read.is_(False)))
    return {"unread": n}


@router.post("/mine", response_model=schemas.MessageOut, status_code=201)
def send_mine(data: schemas.MessageIn, user=Depends(current_user), db: Session = Depends(get_db)):
    t = _thread_for(db, user)
    m = models.SupportMessage(thread_id=t.id, sender="customer", body=data.body)
    t.updated_at = datetime.now(timezone.utc)
    db.add(m)
    db.commit()
    return m


@router.get("/threads", response_model=list[schemas.ThreadOut])
def threads(q: str = "", user=Depends(staff_up), db: Session = Depends(get_db)):
    out = []
    for t in db.scalars(select(models.SupportThread).order_by(models.SupportThread.updated_at.desc())).unique():
        if q and q.lower() not in t.customer.name.lower():
            continue
        last = db.scalar(select(models.SupportMessage).where(models.SupportMessage.thread_id == t.id)
                         .order_by(models.SupportMessage.created_at.desc()).limit(1))
        if not last:
            continue
        unread = db.scalar(select(func.count()).select_from(models.SupportMessage).where(
            models.SupportMessage.thread_id == t.id, models.SupportMessage.sender == "customer",
            models.SupportMessage.is_read.is_(False)))
        out.append(schemas.ThreadOut(id=t.id, customer_name=t.customer.name, last_message=last.body,
                                     updated_at=t.updated_at, unread=unread))
    return out


@router.get("/threads/{tid}", response_model=list[schemas.MessageOut])
def thread_messages(tid: int, user=Depends(staff_up), db: Session = Depends(get_db)):
    for m in db.scalars(select(models.SupportMessage).where(
            models.SupportMessage.thread_id == tid, models.SupportMessage.sender == "customer",
            models.SupportMessage.is_read.is_(False))):
        m.is_read = True
    db.commit()
    return db.scalars(select(models.SupportMessage).where(models.SupportMessage.thread_id == tid)
                      .order_by(models.SupportMessage.created_at)).all()


@router.post("/threads/{tid}", response_model=schemas.MessageOut, status_code=201)
def reply(tid: int, data: schemas.MessageIn, user=Depends(staff_up), db: Session = Depends(get_db)):
    t = db.get(models.SupportThread, tid)
    if not t:
        raise HTTPException(404, "Thread not found")
    m = models.SupportMessage(thread_id=tid, sender="admin", body=data.body)
    t.updated_at = datetime.now(timezone.utc)
    db.add(m)
    db.commit()
    return m


@router.delete("/messages/{mid}", status_code=204)
def delete_message(mid: int, user=Depends(staff_up), db: Session = Depends(get_db)):
    m = db.get(models.SupportMessage, mid)
    if m:
        db.delete(m)
        db.commit()
