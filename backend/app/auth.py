"""Passwords (bcrypt) and tokens (JWT, 12 h). Claims carry the role and the scope (PRD §9 Auth)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from .config import get_settings
from .errors import unauthenticated
from .models.people import User

ALGORITHM = "HS256"


def hash_secret(secret: str) -> str:
    """Hash a password or a loader PIN."""
    return bcrypt.hashpw(secret.encode(), bcrypt.gensalt()).decode()


def verify_secret(secret: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(secret.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(user: User) -> tuple[str, datetime]:
    """A bearer token for ``user``. Returns the token and when it expires."""
    settings = get_settings()
    now = datetime.now(UTC)  # real time: token lifetime is not scenario time
    expires = now + timedelta(hours=settings.jwt_ttl_hours)
    claims: dict[str, Any] = {
        "sub": str(user.id),
        "role": user.role.value,
        "depot": user.depot_id,
        "outletId": user.outlet_id,
        "vehicleId": user.vehicle_id,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm=ALGORITHM), expires


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise unauthenticated("Your session has expired. Sign in again") from None
    except jwt.InvalidTokenError:
        raise unauthenticated("That session isn't valid. Sign in again") from None
