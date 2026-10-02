from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import select

from ..auth import create_token, hash_secret, verify_secret
from ..deps import AnyUser, Db
from ..errors import ApiError
from ..models.people import User
from ..schemas.common import LoginIn, LoginOut, MeOut

router = APIRouter(tags=["auth"])

# Checked against when the email is unknown, so a wrong email and a wrong password take the same time.
_DUMMY_HASH = hash_secret("not-a-real-password")


@router.post("/auth/login", operation_id="login", response_model=LoginOut)
def login(body: LoginIn, db: Db) -> LoginOut:
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    ok = verify_secret(body.password, user.password_hash if user else _DUMMY_HASH)
    if user is None or not ok:
        raise ApiError(401, "invalid_credentials", "That email and password don't match")
    token, expires = create_token(user)
    return LoginOut(access_token=token, expires_at=expires, user=MeOut.model_validate(_me(user)))


def _me(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "display_name": user.display_name,
        "depot": user.depot_id,
        "outlet_id": user.outlet_id,
        "vehicle_id": user.vehicle_id,
    }


@router.get("/me", operation_id="getMe", response_model=MeOut)
def get_me(user: AnyUser) -> MeOut:
    return MeOut(
        id=user.id,
        email=user.email,
        role=user.role,
        display_name=user.display_name,
        depot=user.depot,
        outlet_id=user.outlet_id,
        vehicle_id=user.vehicle_id,
    )
