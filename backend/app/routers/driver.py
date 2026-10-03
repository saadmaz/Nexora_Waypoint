"""DriverApi routes (PRD §19). Owner: ``feature/driver`` (read endpoints).

Driver writes (``driver.ack``, ``driver.startRoute``, ``driver.arrival``, ``driver.outcome``, ``driver.problem``,
``driver.finishRun``) are outbox records sent through ``POST /sync``; there is no per-action route.
"""

from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter

from ..deps import Db, Driver
from ..schemas.driver import DriverHistoryRowOut, NoticeOut, RunOut
from ..services import driver as views

router = APIRouter(prefix="/driver", tags=["driver"])


@router.get("/runs/{day}", operation_id="getRun", response_model=RunOut)
def get_run(day: date, db: Db, user: Driver, trip: int | None = None) -> RunOut:
    """The route package: the current plan version and each order's server state after sync.

    ``DriverApi.getRun`` and ``DriverApi.downloadRun`` are the same endpoint; ``downloadRun`` also caches it.
    Without ``trip`` it is the earliest trip not finished yet. On a day with no run, ``state`` is ``no_run`` and says why.
    """
    return views.run(db, user, day, trip)


@router.get("/notices", operation_id="getNotices", response_model=list[NoticeOut])
def get_notices(db: Db, user: Driver, since: datetime | None = None) -> list[NoticeOut]:
    """R8: notices for this driver's vehicle, newest first."""
    return views.notices(db, user, since)


@router.get("/history", operation_id="getHistory", response_model=list[DriverHistoryRowOut])
def get_history(db: Db, user: Driver) -> list[DriverHistoryRowOut]:
    """R7: this driver's past runs."""
    return views.history(db, user)
