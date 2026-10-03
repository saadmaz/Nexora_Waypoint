"""The ticking clock (DP-26): anchor and rate, pause and resume, and jobs that run themselves exactly once."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app import clock
from app.models.comms import Clock, JobRun

CHECKPOINT = datetime.fromisoformat("2026-09-28T15:30:00+05:30")
WALL0 = datetime(2026, 10, 3, 9, 0, 0, tzinfo=UTC)


class Wall:
    """A wall clock the test moves by hand."""

    def __init__(self) -> None:
        self.t = WALL0

    def __call__(self) -> datetime:
        return self.t

    def tick(self, **delta: float) -> None:
        self.t += timedelta(**delta)


@pytest.fixture
def wall(monkeypatch) -> Wall:
    w = Wall()
    monkeypatch.setattr(clock, "wall_now", w)
    return w


def _anchor(db, rate: float, scenario: datetime = CHECKPOINT) -> None:
    row = clock._row(db)
    row.anchor_scenario, row.anchor_wall, row.rate = scenario, WALL0, rate
    db.commit()


def test_now_follows_the_rate(client, reseed, wall):
    from app.db import SessionLocal

    with SessionLocal() as db:
        _anchor(db, 1.0)
        wall.tick(minutes=10)
        assert clock.now(db) == CHECKPOINT + timedelta(minutes=10)

        _anchor(db, 0.0)  # paused: wall time passes, scenario time does not
        assert clock.now(db) == CHECKPOINT

        _anchor(db, 60.0)  # a minute a second
        wall.tick(seconds=30)
        assert clock.now(db) == CHECKPOINT + timedelta(minutes=30 + 600)  # 10 min of earlier tick + 30 s x 60


def test_now_is_in_colombo_whatever_the_wall_zone(client, reseed, wall):
    from app.db import SessionLocal

    with SessionLocal() as db:
        _anchor(db, 1.0)
        assert clock.now(db).utcoffset() == timedelta(hours=5, minutes=30)


def test_advance_keeps_the_rate_and_refuses_to_go_back(client, auth, reseed, wall):
    from app.db import SessionLocal

    with SessionLocal() as db:
        _anchor(db, 1.0)
    wall.tick(minutes=5)  # the clock is now 15:35
    ok = client.post("/api/v1/demo/advance", json={"to": "2026-09-28T16:00:00+05:30"}, headers=auth("dispatcher"))
    assert ok.status_code == 200, ok.text
    assert ok.json()["rate"] == 1.0
    wall.tick(minutes=1)  # it keeps ticking from the new anchor
    assert datetime.fromisoformat(client.get("/api/v1/clock", headers=auth("store")).json()["now"]) == datetime.fromisoformat(
        "2026-09-28T16:01:00+05:30"
    )
    back = client.post("/api/v1/demo/advance", json={"to": "2026-09-28T15:45:00+05:30"}, headers=auth("dispatcher"))
    assert back.status_code == 409 and back.json()["code"] == "clock_backwards"


def test_pause_freezes_and_resume_restarts(client, auth, reseed, wall):
    from app.db import SessionLocal

    with SessionLocal() as db:
        _anchor(db, 1.0)
    wall.tick(minutes=2)
    paused = client.post("/api/v1/demo/pause", headers=auth("dispatcher"))
    assert paused.status_code == 200, paused.text
    assert paused.json()["rate"] == 0
    frozen = paused.json()["now"]
    wall.tick(hours=1)
    assert client.get("/api/v1/clock", headers=auth("store")).json()["now"] == frozen
    resumed = client.post("/api/v1/demo/resume", headers=auth("dispatcher"))
    assert resumed.json()["rate"] == 1.0  # CLOCK_RATE is 0 in tests, so resume falls back to real time
    wall.tick(minutes=3)
    assert datetime.fromisoformat(client.get("/api/v1/clock", headers=auth("store")).json()["now"]) == (
        datetime.fromisoformat(frozen) + timedelta(minutes=3)
    )


def test_pause_and_resume_are_dispatcher_only(client, auth):
    for path in ("/api/v1/demo/pause", "/api/v1/demo/resume"):
        for role in ("store", "loader", "driver"):
            assert client.post(path, headers=auth(role)).status_code == 403, (path, role)
        assert client.post(path).status_code == 401


def test_reset_returns_to_the_checkpoint_at_the_configured_rate(client, auth, reseed, wall):
    from app.db import SessionLocal

    with SessionLocal() as db:
        _anchor(db, 60.0, CHECKPOINT + timedelta(hours=9))
    res = client.post("/api/v1/demo/reset", headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    body = res.json()["clock"]
    assert datetime.fromisoformat(body["now"]) == CHECKPOINT
    assert body["rate"] == 0  # CLOCK_RATE in tests


def _ran(db) -> list[str]:
    return [r.key for r in db.scalars(select(JobRun).order_by(JobRun.ran_at, JobRun.key))]


def test_timer_runs_jobs_when_the_ticking_clock_crosses_their_time(client, reseed, wall):
    """No /demo/advance: wall time passes at 60x and the cutoff and the draft run on their own."""
    from app.db import SessionLocal
    from app.main import run_jobs_once

    with SessionLocal() as db:
        _anchor(db, 60.0)  # 15:30 now, a minute a second
    assert run_jobs_once() == []  # nothing is due yet
    wall.tick(minutes=0, seconds=31)  # 15:30 + 31 min = 16:01
    assert run_jobs_once() == ["cutoff"]
    wall.tick(seconds=5)  # 16:06
    assert [x for x in run_jobs_once()] == [f"draft {datetime(2026, 9, 29).date().isoformat()}"]
    with SessionLocal() as db:
        assert _ran(db) == ["cutoff:2026-09-29", "draft:2026-09-29"]


def test_each_job_runs_once_across_restarts(client, reseed, wall):
    from app.db import SessionLocal
    from app.main import run_jobs_once

    with SessionLocal() as db:
        _anchor(db, 60.0)
    wall.tick(seconds=40)  # 16:10: cutoff and draft are both due
    first = run_jobs_once()
    assert first == ["cutoff", "draft 2026-09-29"]
    # A restarted process, a second worker and a replay all call it again: nothing runs twice.
    for _ in range(3):
        assert run_jobs_once() == []
    with SessionLocal() as db:
        assert _ran(db) == ["cutoff:2026-09-29", "draft:2026-09-29"]
        from app.models.plans import PlanVersion

        assert len(list(db.scalars(select(PlanVersion)))) == 1


def test_jobs_after_a_big_jump_run_in_time_order(client, auth, reseed):
    """16:00 cutoff, 16:05 draft, 21:15 v2, 23:30 v3: one advance, four jobs, in the order they fell due."""
    res = client.post("/api/v1/demo/advance", json={"to": "2026-09-28T23:35:00+05:30"}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    from app.db import SessionLocal

    with SessionLocal() as db:
        rows = list(db.scalars(select(JobRun).order_by(JobRun.ran_at, JobRun.key)))
        keys = [r.key for r in rows]
        assert keys[0] == "cutoff:2026-09-29"
        assert keys[1] == "draft:2026-09-29"
        assert [k for k in keys if k.startswith("event:")] and len(keys) >= 4
        times = [r.ran_at.astimezone(clock.COLOMBO).strftime("%H:%M") for r in rows]
        assert times == sorted(times)  # all on the evening of the 28th, so clock order is time order
        assert times[:2] == ["16:00", "16:05"]
        assert db.get(Clock, 1) is not None
