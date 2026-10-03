"""The clock and the presenter controls (PRD §13)."""

from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import select

from waypoint_rules import service_day_for

from .. import clock
from ..deps import AnyUser, Db, Dispatcher
from ..models.reference import CalendarDay
from ..schemas.common import AdvanceIn, ClockOut, ResetOut

router = APIRouter(tags=["shared"])


def clock_out(db: Db) -> ClockOut:
    now = clock.now(db)
    ops = list(db.scalars(select(CalendarDay.date).where(CalendarDay.is_operating)))
    # With no calendar loaded yet (empty database) the next calendar day stands in.
    service = service_day_for(now.replace(tzinfo=None), ops).service_date if ops else now.date()
    return ClockOut(now=now, checkpoint=clock.checkpoint(db), service_date=service)


@router.get("/clock", operation_id="getClock", response_model=ClockOut)
def get_clock(db: Db, _: AnyUser) -> ClockOut:
    return clock_out(db)


@router.post("/demo/advance", operation_id="advanceClock", response_model=ClockOut)
def advance_clock(body: AdvanceIn, db: Db, user: Dispatcher) -> ClockOut:
    """The presenter control's "Go to next step". Refuses to go backwards (409 ``clock_backwards``).

    Dispatcher only, like ``/demo/reset``: the clock is shared by every role, so moving it changes
    cutoffs and plan state for everyone. The presenter control that calls this is the dispatcher's
    (PRD §13); the store's own control moves a local scenario clock and never reaches the server.
    """
    clock.advance(db, body.to, actor=user.email)
    db.commit()
    return clock_out(db)


@router.post("/demo/reset", operation_id="resetDemo", response_model=ResetOut)
def reset_demo(db: Db, user: Dispatcher) -> ResetOut:
    """Truncate the operational tables and re-run the seed (PRD §13). Presenter only: the dispatcher's avatar menu."""
    from seed import run as seed_run

    db.rollback()
    seed_run.reset(actor=user.email)
    db.expire_all()
    return ResetOut(clock=clock_out(db), seeded=True)
