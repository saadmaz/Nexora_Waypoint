"""The demo date is configuration (SCENARIO_SERVICE_DATE), not code: the seed moves every timestamp with it."""

from __future__ import annotations

from datetime import date, datetime

import pytest
from sqlalchemy import func, select

SECOND_DATE = date(2026, 10, 6)  # a Tuesday: the planning day is Monday 5 Oct


def _reseed_for(monkeypatch, day: date) -> None:
    from app.config import get_settings
    from seed import run as seed_run

    monkeypatch.setattr(get_settings(), "scenario_service_date", day)
    seed_run.reset()


def test_a_second_service_date_shifts_every_seeded_timestamp(client, auth, reseed, monkeypatch):
    from app.config import COLOMBO
    from app.db import SessionLocal
    from app.models.comms import ScenarioEvent
    from app.models.orders import Order

    _reseed_for(monkeypatch, SECOND_DATE)

    clock = client.get("/api/v1/clock", headers=auth("store")).json()
    assert datetime.fromisoformat(clock["now"]) == datetime.fromisoformat("2026-10-05T15:30:00+05:30")
    assert datetime.fromisoformat(clock["checkpoint"]) == datetime.fromisoformat("2026-10-05T15:30:00+05:30")
    assert clock["serviceDate"] == "2026-10-06"

    with SessionLocal() as db:
        dates = set(db.scalars(select(Order.service_date)))
        assert dates == {SECOND_DATE}
        received = db.scalar(select(func.max(Order.received_at)))
        assert received is not None and received.date() == date(2026, 10, 5)
        rows = list(db.scalars(select(ScenarioEvent).order_by(ScenarioEvent.at)))
        assert len(rows) == 3
        times = [e.at.astimezone(COLOMBO) for e in rows]
        assert [(t.date().isoformat(), t.strftime("%H:%M")) for t in times] == [
            ("2026-10-05", "21:15"), ("2026-10-05", "23:30"), ("2026-10-06", "02:45"),
        ]


def test_the_planner_drafts_a_second_day(client, auth, reseed, monkeypatch):
    """Not fitted to one day: the same cutoff, draft and scripted events run for another date."""
    _reseed_for(monkeypatch, SECOND_DATE)
    res = client.post("/api/v1/demo/advance", json={"to": "2026-10-05T16:10:00+05:30"}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    from .test_dispatcher_planning import get_plan

    plan = get_plan(client, auth)
    assert plan["version"]["number"] == 1 and plan["version"]["state"] == "draft"
    assert plan["lanes"], "the planner placed nothing on the second day"


def test_a_date_that_does_not_operate_is_refused_loudly(client, reseed, monkeypatch):
    from seed.load_reference import SeedConfigError

    with pytest.raises(SeedConfigError, match="SCENARIO_SERVICE_DATE 2026-10-04"):  # a Sunday
        _reseed_for(monkeypatch, date(2026, 10, 4))
