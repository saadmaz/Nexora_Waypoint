"""Liveness and readiness.

They answer different questions and a deployment needs both. Liveness is "is this process still running": restart it
when that fails. Readiness is "should it be sent traffic": take it out of rotation, but do not restart it, when the
database is unreachable or the job loop has stopped ticking. A single endpoint that checks the database conflates the
two, so a database blip restarts every API container at once.
"""

from __future__ import annotations

from fastapi import APIRouter, Response
from sqlalchemy import text

from ..config import get_settings
from ..deps import Db
from ..schemas.common import HealthOut, ReadyOut

router = APIRouter(tags=["health"])

#: How far behind the job loop may fall before this process stops calling itself ready. The loop ticks every
#: ``JOB_LOOP_SECONDS`` (5), so this is several missed ticks, not one slow one.
MAX_JOB_LAG_SECONDS = 60.0


@router.get("/health", operation_id="getHealth", response_model=HealthOut)
def get_health(db: Db) -> HealthOut:
    """Liveness plus a database round trip (used by the Compose healthcheck)."""
    db.execute(text("select 1"))
    return HealthOut()


@router.get("/health/live", operation_id="getLive", response_model=HealthOut)
def get_live() -> HealthOut:
    """Liveness on its own: the process is up and serving. Touches nothing it depends on, so a restart is never a blip."""
    return HealthOut()


@router.get("/health/ready", operation_id="getReady", response_model=ReadyOut)
def get_ready(db: Db, response: Response) -> ReadyOut:
    """Readiness: the database answers and the job loop is still ticking. 503 with ``failing`` when it is not."""
    from ..main import job_lag_seconds

    failing: list[str] = []
    try:
        db.execute(text("select 1"))
    except Exception:  # reported, not raised: an unready process answers, it does not fail
        failing.append("database")

    lag = job_lag_seconds()
    if get_settings().job_loop and (lag is None or lag > MAX_JOB_LAG_SECONDS):
        failing.append("job_loop")

    if failing:
        response.status_code = 503
    return ReadyOut(status="ok" if not failing else "unready", job_lag_seconds=lag, failing=failing)
