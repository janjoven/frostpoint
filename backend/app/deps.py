from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from . import models
from .db import get_db
from .security import decode_token


def current_user(request: Request, db: Session = Depends(get_db)) -> models.Account:
    auth = request.headers.get("authorization", "")
    uid = decode_token(auth[7:], "access") if auth.lower().startswith("bearer ") else None
    user = db.get(models.Account, uid) if uid else None
    if not user or not user.is_active:
        raise HTTPException(401, "Not authenticated")
    return user


def require_roles(*roles: str):
    def dep(user: models.Account = Depends(current_user)) -> models.Account:
        if user.role not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user

    return dep


staff_up = require_roles("staff", "owner", "admin")
owner_up = require_roles("owner", "admin")
