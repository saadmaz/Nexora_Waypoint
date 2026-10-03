"""Calendar and time-facing rules: the service day for an order, what the store sees as the
arrival time, and the D6 lateness risk (PRD §4a)."""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from .calc import hhmm
from .vocab import LatenessRisk

CUTOFF = time(16, 0)


@dataclass(frozen=True, slots=True)
class ServiceDay:
    service_date: date
    after_cutoff: bool
    #: Last moment the store may edit or cancel (R-EDIT).
    editable_until: datetime


def next_operating_day(after: date, operating_days: Iterable[date]) -> date:
    days = sorted(d for d in operating_days if d > after)
    if not days:
        raise ValueError(f"No operating day after {after:%a %d %b %Y} in the calendar")
    return days[0]


#: When Dispatch releases a day's plan, the evening before (the scenario's 23:40 release; a person's action, not a job).
PLAN_RELEASE = time(23, 40)


def next_plan_at(after: date, operating_days: Iterable[date]) -> datetime | None:
    """When the driver can expect the next plan: 23:40 the evening before the next operating day. None past the calendar.

    Sun 28 Jun → Sun 28 Jun 23:40 (for Mon 29 Jun).
    """
    try:
        day = next_operating_day(after, operating_days)
    except ValueError:
        return None
    return datetime.combine(day - timedelta(days=1), PLAN_RELEASE)


def service_day_for(placed_at: datetime, operating_days: Iterable[date]) -> ServiceDay:
    """R-CUTOFF and R-OPDAY. Before 16:00 → next operating day; after → the one after that.

    Mon 15:40 → Tue 29 Sep. Mon 16:07 → Wed 30 Sep (After cutoff).
    """
    ops = sorted(operating_days)
    after = placed_at >= datetime.combine(placed_at.date(), CUTOFF)
    first = next_operating_day(placed_at.date(), ops)
    day = next_operating_day(first, ops) if after else first
    return ServiceDay(day, after, datetime.combine(_cutoff_day(day, placed_at.date(), ops), CUTOFF))


def _cutoff_day(service: date, placed: date, ops: Sequence[date]) -> date:
    """The run for ``service`` closes at 16:00 on the last operating day before it (or the
    placement day when no operating day falls in between)."""
    earlier = [d for d in ops if placed <= d < service]
    return earlier[-1] if earlier else placed


def store_arrival(predicted: datetime, window_open: datetime) -> str:
    """Shown arrival = the later of predicted arrival and window open, as a range.

    "from 05:30 (truck may arrive 05:26 and wait)".
    """
    if predicted < window_open:
        return f"from {hhmm(window_open)} (truck may arrive {hhmm(predicted)} and wait)"
    return f"about {hhmm(predicted)}"


@dataclass(frozen=True, slots=True)
class RemainingStop:
    outlet_id: str
    predicted_arrival: datetime
    window_close: datetime


def lateness_risk(remaining: Sequence[RemainingStop], *, offline: bool, held: bool = False) -> LatenessRisk:
    """D6. Predicted arrival = last event + remaining planned legs (A27); not a Datathon model."""
    if offline:
        return LatenessRisk.UNKNOWN_OFFLINE
    if held or any(s.predicted_arrival > s.window_close for s in remaining):
        return LatenessRisk.AT_RISK
    return LatenessRisk.ON_TIME


#: A run in progress that has not been heard from for this long is out of coverage (D6 "Unknown · offline").
OFFLINE_AFTER_MINUTES = 3


def is_offline(last_heard: datetime | None, now: datetime, *, in_progress: bool) -> bool:
    """No event since the vehicle went out of coverage (PRD §4a lateness risk).

    A vehicle on a run that has been silent for more than ``OFFLINE_AFTER_MINUTES`` is offline: the board says
    "Unknown · offline" and never guesses that it is late. A vehicle that is not on a run is not offline, it is parked.
    """
    return in_progress and last_heard is not None and now - last_heard > timedelta(minutes=OFFLINE_AFTER_MINUTES)
