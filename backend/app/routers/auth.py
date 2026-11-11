from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..security import decode_token, hash_password, make_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

_attempts: dict[str, list[float]] = {}


def _ip(request: Request) -> str:
    # nginx sets X-Forwarded-For; the api container is not exposed directly.
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() or (request.client.host if request.client else "?")


def _throttle(key: str, limit: int = 8, window: int = 60):
    import time
    now = time.time()
    hits = [t for t in _attempts.get(key, []) if now - t < window]
    if len(hits) >= limit:
        raise HTTPException(429, "Too many attempts. Try again in a minute.")
    hits.append(now)
    _attempts[key] = hits


def _session(resp: Response, user: models.Account) -> dict:
    refresh = make_token(user.id, "refresh", timedelta(days=settings.refresh_days))
    resp.set_cookie("fp_refresh", refresh, httponly=True, samesite="lax", secure=settings.cookie_secure,
                    max_age=settings.refresh_days * 86400, path="/api/auth")
    return {"access_token": make_token(user.id, "access", timedelta(minutes=settings.access_minutes)), "user": user}


@router.post("/register", response_model=schemas.TokenOut, status_code=201)
def register(data: schemas.RegisterIn, resp: Response, request: Request, db: Session = Depends(get_db)):
    _throttle("reg:" + _ip(request))
    email = data.email.lower()
    if db.scalar(select(models.Account).where(models.Account.email == email)):
        raise HTTPException(409, "An account with this email already exists")
    user = models.Account(email=email, password_hash=hash_password(data.password), name=data.name,
                          phone=data.phone, address=data.address, role="customer")
    db.add(user)
    db.commit()
    return _session(resp, user)


@router.post("/login", response_model=schemas.TokenOut)
def login(data: schemas.LoginIn, resp: Response, request: Request, db: Session = Depends(get_db)):
    _throttle("login:" + _ip(request))
    user = db.scalar(select(models.Account).where(models.Account.email == data.email.lower()))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(403, "This account has been deactivated")
    return _session(resp, user)


@router.post("/refresh", response_model=schemas.TokenOut)
def refresh(request: Request, resp: Response, db: Session = Depends(get_db)):
    uid = decode_token(request.cookies.get("fp_refresh", ""), "refresh")
    user = db.get(models.Account, uid) if uid else None
    if not user or not user.is_active:
        raise HTTPException(401, "Session expired")
    return _session(resp, user)


@router.post("/logout", status_code=204)
def logout(resp: Response):
    resp.delete_cookie("fp_refresh", path="/api/auth")


@router.get("/me", response_model=schemas.AccountOut)
def me(user: models.Account = Depends(current_user)):
    return user


@router.patch("/me", response_model=schemas.AccountOut)
def update_me(data: schemas.AccountUpdate, user: models.Account = Depends(current_user),
              db: Session = Depends(get_db)):
    # Role and active flag are never self-editable.
    if data.name:
        user.name = data.name
    if data.phone:
        user.phone = schemas.normalize_phone(data.phone)
    if data.address is not None:
        user.address = data.address
    db.commit()
    return user
