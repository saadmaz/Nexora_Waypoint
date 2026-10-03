"""What the store reads about its deliveries: the S2 days, the S4 history and feed, the S3.7 issue list.

Three thin orchestrations over ``store_repo`` (the reads) and ``store_views`` (the wording). The outlet always
comes from the token, never from the request: a store account may only read its own outlet (PRD §9 principle 6),
which is what makes every one of these routes safe without a path parameter.

The writes live in ``receipts``.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from waypoint_rules.vocab import Temp

from .. import clock
from ..deps import CurrentUser
from ..errors import not_found
from ..schemas.store import DeliveryOut, IssueOut, RecentOrderDayOut, UpdatesFeedOut
from . import store_repo, store_views
from .store_model import DeliveryDay
from .store_orders import outlet_of


def list_deliveries(db: Session, user: CurrentUser, since: date | None, until: date | None) -> list[DeliveryOut]:
    """The outlet's delivery days, earliest first (S2.10).

    Without a range the store is answered from the day it is working on onwards, which is what the Deliveries
    tab opens with; past days are the history list's job (``list_recent``).
    """
    outlet = outlet_of(db, user)
    now = clock.now(db).replace(tzinfo=None)
    start = since if since is not None else now.date()
    days = store_repo.service_dates(db, outlet.id, since=start, until=until)
    return [out for day in days if (out := _day(db, user, day)) is not None]


def get_delivery_day(db: Session, user: CurrentUser, day: date) -> list[DeliveryOut]:
    """One day, as a list of length 0 or 1: the screens take the same shape either way."""
    built = _day(db, user, day)
    return [built] if built is not None else []


def _day(db: Session, user: CurrentUser, day: date) -> DeliveryOut | None:
    outlet = outlet_of(db, user)
    now = clock.now(db).replace(tzinfo=None)
    facts = store_repo.delivery_day(db, outlet, day, now)
    if facts is None:
        return None
    return store_views.delivery_out(facts, _sizes(db, facts))


def _sizes(db: Session, day: DeliveryDay) -> dict[str, tuple[Temp, int]]:
    """Each order a reported problem names, with its kind and size, so an issue line is complete."""
    named = {oid for issue in day.issues for oid in issue.order_ids}
    sizes: dict[str, tuple[Temp, int]] = {o.id: (o.temp, o.units) for o in day.orders}
    missing = named - set(sizes)
    if missing:
        sizes.update(store_repo.order_sizes(db, missing))
    return sizes


def list_recent(db: Session, user: CurrentUser, *, limit: int, before: date | None) -> list[RecentOrderDayOut]:
    """Past delivery days, newest first, Sundays skipped (S1.6, S2.10, S4.2)."""
    outlet = outlet_of(db, user)
    now = clock.now(db).replace(tzinfo=None)
    rows = store_repo.history(db, outlet.id, limit=limit, before=before, now=now)
    return [store_views.recent_out(row) for row in rows]


def list_issues(db: Session, user: CurrentUser) -> list[IssueOut]:
    """The problems the store has reported, open first, newest first (S3.7)."""
    outlet = outlet_of(db, user)
    rows = store_repo.issues(db, outlet.id)
    photos = store_repo.issue_photos(db, [e.id for e in rows])
    sizes = store_repo.order_sizes(db, [oid for e in rows for oid in e.order_ids or ()])
    out: list[IssueOut] = []
    for e in rows:
        service_date = store_repo.service_date_of(db, e)
        if service_date is None:
            continue  # an issue whose orders are gone has no delivery day to show it on
        facts = store_repo.issue_fact(e, photo=e.id in photos)
        out.append(store_views.issue_out(facts, outlet.id, service_date, sizes))
    # Open problems first; within each, the newest report first.
    return sorted(out, key=lambda i: (i.resolved, -int(i.id)))


def get_updates(db: Session, user: CurrentUser) -> UpdatesFeedOut:
    """The S4 feed, newest first, with the unread count for the bell."""
    outlet = outlet_of(db, user)
    return store_views.updates_out(store_repo.notice_facts(db, outlet.id))


def mark_all_read(db: Session, user: CurrentUser) -> None:
    """"Mark all read" reads everything sent up to now (A53)."""
    outlet = outlet_of(db, user)
    now = clock.now(db)
    for notice in store_repo.unread_notices(db, outlet.id):
        notice.read_at = now
    db.commit()


def day_or_404(db: Session, user: CurrentUser, day: date) -> DeliveryOut:
    """The day a write answers with, or a 404 when the outlet has nothing for it."""
    built = _day(db, user, day)
    if built is None:
        raise not_found(f"A delivery for {day.isoformat()}")
    return built
