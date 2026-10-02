"""Request dependencies: the signed-in user and the role guard."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from waypoint_rules.vocab import Role

from .auth import decode_token
from .db import get_db
from .errors import forbidden, unauthenticated
from .models.people import User

_bearer = HTTPBearer(auto_error=False, description="Token from POST /auth/login")

Db = Annotated[Session, Depends(get_db)]


@dataclass(frozen=True, slots=True)
class CurrentUser:
    id: int
    email: str
    role: Role
    display_name: str
    depot: str | None
    outlet_id: str | None
    vehicle_id: str | None


def current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Db,
) -> CurrentUser:
    if creds is None:
        raise unauthenticated()
    claims = decode_token(creds.credentials)
    user = db.get(User, int(claims["sub"]))
    if user is None:
        raise unauthenticated("That account no longer exists")
    return CurrentUser(user.id, user.email, user.role, user.display_name, user.depot_id, user.outlet_id, user.vehicle_id)


AnyUser = Annotated[CurrentUser, Depends(current_user)]


def require_role(*roles: Role) -> Callable[..., CurrentUser]:
    """A dependency that admits only ``roles`` (403 otherwise). Scope checks sit in services: see below."""

    def guard(user: AnyUser) -> CurrentUser:
        if user.role not in roles:
            raise forbidden(f"This is for {' or '.join(r.value for r in roles)} accounts")
        return user

    return guard


Dispatcher = Annotated[CurrentUser, Depends(require_role(Role.DISPATCHER))]
Store = Annotated[CurrentUser, Depends(require_role(Role.STORE))]
Loader = Annotated[CurrentUser, Depends(require_role(Role.LOADER))]
Driver = Annotated[CurrentUser, Depends(require_role(Role.DRIVER))]
#: Sync and attachments are used by the two field roles.
FieldUser = Annotated[CurrentUser, Depends(require_role(Role.LOADER, Role.DRIVER))]


# ---- scope (PRD §9 principle 6) ---------------------------------------------
# Services call these after loading a record, before returning or changing it. An account bound to an
# outlet, vehicle or depot reaches only that one; an unbound account is not limited by it. So the
# dispatcher reaches everything, and the loader's shared dock tablet reaches both docks (the dock is a
# device setting, PRD §9 Auth).


def require_outlet(user: CurrentUser, outlet_id: str) -> None:
    """Raise 403 unless ``user`` may act for ``outlet_id``."""
    if user.outlet_id is not None and user.outlet_id != outlet_id:
        raise forbidden("That outlet isn't linked to your account")


def require_vehicle(user: CurrentUser, vehicle_id: str) -> None:
    """Raise 403 unless ``user`` may act for ``vehicle_id``."""
    if user.vehicle_id is not None and user.vehicle_id != vehicle_id:
        raise forbidden("That vehicle isn't linked to your account")


def require_depot(user: CurrentUser, depot: str) -> None:
    """Raise 403 unless ``user`` may act for ``depot``."""
    if user.depot is not None and user.depot != depot:
        raise forbidden("That depot isn't linked to your account")
