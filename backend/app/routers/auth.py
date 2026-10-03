from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import APIRouter, Request
from sqlalchemy import select

from ..auth import create_token, hash_secret, verify_secret
from ..deps import AnyUser, Db
from ..errors import ApiError
from ..models import reference
from ..models.people import User
from ..schemas.common import LoginIn, LoginOut, MeOut, OutletInfo
from ..services.store_views import dock_label, outlet_name, window_of

router = APIRouter(tags=["auth"])

# Checked against when the email is unknown, so a wrong email and a wrong password take the same time.
_DUMMY_HASH = hash_secret("not-a-real-password")

#: Failed attempts per client address, newest last. In process: one API container, and a counter that
#: resets on restart is the right trade for a demo. A real deployment behind several workers needs
#: shared storage for this.
_FAILURES: defaultdict[str, deque[float]] = defaultdict(deque)
#: Deliberately generous. Four roles sign in one after another from one address during the judge
#: walkthrough (PRD §16) and again in the Playwright run, and judges retype the shared demo password.
#: This stops a brute force, not a clumsy afternoon.
_MAX_FAILURES = 20
_WINDOW_SECONDS = 300.0


def _client_key(request: Request) -> str:
    # Behind the nginx proxy every request arrives from the same container address, so the forwarded
    # address is what distinguishes callers. It is caller-supplied and therefore spoofable: this is a
    # speed bump, and the audit (docs/auth-audit.md) says so.
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_rate_limit(key: str) -> None:
    attempts = _FAILURES[key]
    cutoff = time.monotonic() - _WINDOW_SECONDS
    while attempts and attempts[0] < cutoff:
        attempts.popleft()
    if len(attempts) >= _MAX_FAILURES:
        raise ApiError(429, "too_many_attempts", "Too many sign-in attempts. Wait a few minutes and try again")


@router.post("/auth/login", operation_id="login", response_model=LoginOut)
def login(body: LoginIn, db: Db, request: Request) -> LoginOut:
    key = _client_key(request)
    _check_rate_limit(key)
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    ok = verify_secret(body.password, user.password_hash if user else _DUMMY_HASH)
    if user is None or not ok:
        _FAILURES[key].append(time.monotonic())
        raise ApiError(401, "invalid_credentials", "That email and password don't match")
    # A sign-in that works clears the run of failures before it, so one person's typing does not
    # count against the next.
    _FAILURES.pop(key, None)
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
def get_me(user: AnyUser, db: Db) -> MeOut:
    outlet = db.get(reference.Outlet, user.outlet_id) if user.outlet_id else None
    return MeOut(
        id=user.id,
        email=user.email,
        role=user.role,
        display_name=user.display_name,
        depot=user.depot,
        outlet_id=user.outlet_id,
        outlet=OutletInfo(
            id=outlet.id, name=outlet_name(outlet), brand=outlet.brand.value, district=outlet.district,
            dock=dock_label(outlet.dock_type), window=window_of(outlet),
        )
        if outlet
        else None,
        vehicle_id=user.vehicle_id,
    )
