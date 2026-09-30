from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from ..deps import Db
from ..schemas.common import HealthOut

router = APIRouter(tags=["health"])


@router.get("/health", operation_id="getHealth", response_model=HealthOut)
def get_health(db: Db) -> HealthOut:
    """Liveness plus a database round trip (used by the Compose healthcheck)."""
    db.execute(text("select 1"))
    return HealthOut()
