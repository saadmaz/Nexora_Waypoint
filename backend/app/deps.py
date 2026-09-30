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
    """A dependency that admits only ``roles`` (403 otherwise). Scope checks (depot, outlet, vehicle) sit in services."""

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
