from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from .config import settings

_ph = PasswordHasher()


def hash_password(pw: str) -> str:
    return _ph.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, pw)
    except VerifyMismatchError:
        return False


def make_token(sub: int, kind: str, delta: timedelta) -> str:
    exp = datetime.now(timezone.utc) + delta
    return jwt.encode({"sub": str(sub), "kind": kind, "exp": exp}, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str, kind: str) -> int | None:
    try:
        data = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    return int(data["sub"]) if data.get("kind") == kind else None
