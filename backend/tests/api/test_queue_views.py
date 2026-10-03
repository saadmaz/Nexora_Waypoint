"""The order queue (D1) and the history drawer (D1.5), built from the §4c reference day with no database."""

from __future__ import annotations

from dataclasses import replace
from datetime import date, datetime, time, timedelta

import pytest

from app.services import queue_views as qv
from app.services.dispatch_model import DeferralRow, OutletRow
from app.services.queue_model import AuditRow, HistoryInput, HistoryRun, QueueDay, QueueFilter, QueueOrderRow
from tests.rules.conftest import ORDERS, REF, SERVICE, VEHICLE_DAYS
from waypoint_rules import OutletHistory, RefData
from waypoint_rules.vocab import Brand, DeferralType, OrderStatus, Temp

NOW = datetime(2026, 9, 28, 15, 40)
CUTOFF = datetime(2026, 9, 28, 16, 0)


def _rows(status: OrderStatus = OrderStatus.CONFIRMED, received: datetime = datetime(2026, 9, 28, 13, 0)) -> list[QueueOrderRow]:
    return [
        QueueOrderRow(o.id, o.outlet_id, o.temp, o.units, o.weight_kg, o.volume_m3, status, received + timedelta(minutes=i), False, SERVICE)
        for i, o in enumerate(ORDERS.values())
    ]


def _day(now: datetime = NOW, rows: list[QueueOrderRow] | None = None) -> QueueDay:
    outlets = {
        o.id: OutletRow(o.id, "Waypoint Fresh" if o.id == "OUT084" else o.id, o.brand, o.district, o.depot, o.dock_type, o.van_only, o.mall_dock)
        for o in REF.outlets.values()
    }
    history = {
        o.outlet_id: OutletHistory(o.deferred_yesterday, o.days_since_served)
        for o in ORDERS.values()
        if o.deferred_yesterday or o.days_since_served != 1
    }
    return QueueDay(
        service_date=SERVICE, now=now, cutoff=CUTOFF, following_run=date(2026, 9, 30), ref=REF, outlets=outlets,
        rows=rows if rows is not None else _rows(), history=history, vehicle_days=dict(VEHICLE_DAYS),
    )


def _ids(view) -> list[str]:
    return [o.id for g in view.groups for o in g.orders]


# --------------------------------------------------------------------------- grouping and flags


def test_peliyagoda_lists_carry_overs_first():
    view = qv.queue_view(_day(), "peliyagoda")
    assert [g.key for g in view.groups] == ["carry", "other"]
    carry = view.groups[0]
    assert carry.title == "Carry-overs · 2" and carry.kind == "carry"
    assert {o.outlet_id for o in carry.orders} == {"OUT012", "OUT029"}
    assert all(set(o.tags) == {"Carry-over", "Protected"} for o in carry.orders)
    assert carry.orders[0].note == "Deferred yesterday: protected by the continuity guard"
    assert {o.id: o.days_since_served for o in carry.orders} == {"ORD1001": 2, "ORD1005": 2}
    assert view.carry_overs == 2


def test_an_order_no_vehicle_can_carry_is_flagged():
    view = qv.queue_view(_day(), "peliyagoda")
    order = next(o for o in view.groups[-1].orders if o.id == "ORD1020")
    assert "No legal vehicle" in order.tags
    assert order.note == "Van only · 8.6 m³ · no van free on Tue 29 Sep"
    assert view.at_risk == 1
    assert "Van only" in order.access


def test_kandy_groups_by_outlet_and_tracks_a_two_order_stop_separately():
    """OUT084 has two orders at one stop (ORD2001 chilled, ORD2002 ambient); OUT087 has one."""
    ref = RefData(
        {**REF.outlets, "OUT084": replace(REF.outlets["OUT087"], id="OUT084", window_open=time(5, 30))},
        REF.districts, REF.vehicles, REF.allowances,
    )
    received = datetime(2026, 9, 28, 15, 40)
    rows = [
        *[r for r in _rows() if r.id == "ORD2003"],
        QueueOrderRow("ORD2001", "OUT084", Temp.CHILLED, 12, 70, 0.7, OrderStatus.ORDERED, received, False, SERVICE),
        QueueOrderRow("ORD2002", "OUT084", Temp.AMBIENT, 8, 45, 0.6, OrderStatus.ORDERED, received, False, SERVICE),
    ]
    day = _day(rows=rows)
    day.ref = ref
    day.outlets["OUT084"] = OutletRow("OUT084", "Waypoint Fresh", Brand.FRESH, "Kandy", "kandy", ref.outlets["OUT084"].dock_type, False, False)
    view = qv.queue_view(day, "kandy")
    assert [g.key for g in view.groups] == ["OUT084", "OUT087"] and all(g.kind == "outlet" for g in view.groups)
    hero, other = view.groups
    assert hero.title == "OUT084 · Waypoint Fresh" and [o.id for o in hero.orders] == ["ORD2001", "ORD2002"]
    assert hero.outlet is not None and hero.outlet.note == "2 orders · tracked separately"
    assert hero.outlet.brand is Brand.FRESH and hero.outlet.dock == "Rear dock"
    assert (hero.outlet.window.start, hero.outlet.window.end) == ("05:30", "08:00")
    assert other.title == "OUT087" and other.outlet is not None and other.outlet.note is None
    assert view.total == 3 and view.last_received == "15:40"


def test_before_the_cutoff_the_queue_says_how_long_is_left():
    before = qv.queue_view(_day(), "peliyagoda")
    assert not before.cutoff.closed and before.cutoff.at == "16:00" and before.cutoff.minutes_left == 20
    after = qv.queue_view(_day(now=datetime(2026, 9, 28, 16, 7)), "peliyagoda")
    assert after.cutoff.closed and after.cutoff.minutes_left == 0


def test_counts_cover_both_depots_whatever_is_filtered():
    view = qv.queue_view(_day(), "peliyagoda", QueueFilter(brand=(Brand.STYLE,)))
    assert view.counts.peliyagoda + view.counts.kandy == len(ORDERS)
    assert view.total == view.counts.peliyagoda and view.shown == 1


def test_a_mall_order_shows_the_mall_window():
    order = next(o for g in qv.queue_view(_day(), "peliyagoda").groups for o in g.orders if o.id == "ORD1007")
    assert order.mall_window and order.window.start == "09:00" and order.window.end == "11:00"
    assert "Mall dock" in order.access and "Mall bay" in order.access


def test_an_order_that_just_arrived_before_the_cutoff_is_marked():
    rows = [replace(r, received_at=NOW - timedelta(minutes=3)) if r.id == "ORD1014" else r for r in _rows()]
    flagged = [o.id for g in qv.queue_view(_day(rows=rows), "peliyagoda").groups for o in g.orders if o.just_in]
    assert flagged == ["ORD1014"]
    # Once the cutoff has passed nothing is "just in".
    late = qv.queue_view(_day(now=datetime(2026, 9, 28, 16, 1), rows=rows), "peliyagoda")
    assert not [o for g in late.groups for o in g.orders if o.just_in]


def test_an_after_cutoff_order_moves_to_the_following_run():
    rows = _rows()
    rows.append(QueueOrderRow("ORD9001", "OUT001", Temp.CHILLED, 5, 30, 0.3, OrderStatus.CONFIRMED, datetime(2026, 9, 28, 16, 7), True, date(2026, 9, 30)))
    order = next(o for g in qv.queue_view(_day(now=datetime(2026, 9, 28, 16, 8), rows=rows), "peliyagoda").groups for o in g.orders if o.id == "ORD9001")
    assert "After cutoff" in order.tags and order.status is OrderStatus.ORDERED
    assert order.note == "Moves to the following run (Wed 30 Sep)"
    assert "No legal vehicle" not in order.tags and "Carry-over" not in order.tags


# --------------------------------------------------------------------------- filters and search


@pytest.mark.parametrize(
    ("filters", "expected"),
    [
        (QueueFilter(brand=(Brand.STYLE,)), {"ORD1007"}),
        (QueueFilter(temp=(Temp.AMBIENT,)), {"ORD1007"}),
        (QueueFilter(district=("Gampaha",)), {"ORD1023", "ORD1024", "ORD1022", "ORD1021", "ORD1004", "ORD1003", "ORD1005", "ORD1006"}),
        (QueueFilter(tags=("Carry-over",)), {"ORD1001", "ORD1005"}),
        (QueueFilter(tags=("Van only",)), {"ORD1020"}),
        (QueueFilter(tags=("Mall dock",)), {"ORD1007"}),
        (QueueFilter(tags=("No legal vehicle",)), {"ORD1020"}),
        (QueueFilter(window=("late",)), {"ORD1007"}),
        (QueueFilter(window=("early",)), {"ORD1014", "ORD1016", "ORD1011", "ORD1002", "ORD1023", "ORD1024", "ORD1022"}),
        (
            QueueFilter(window=("mid",)),
            {"ORD1001", "ORD1013", "ORD1015", "ORD1018", "ORD1012", "ORD1009", "ORD1017", "ORD1020", "ORD1021", "ORD1004", "ORD1003", "ORD1005", "ORD1006"},
        ),
        (QueueFilter(status=(OrderStatus.DELIVERED,)), set()),
        (QueueFilter(search="out012"), {"ORD1001"}),
        (QueueFilter(search="ORD1013"), {"ORD1013"}),
    ],
)
def test_filters_and_search_narrow_the_queue(filters, expected):
    view = qv.queue_view(_day(), "peliyagoda", filters)
    assert set(_ids(view)) == expected
    assert view.shown == len(expected) and view.matching == len(expected)


def test_no_filter_means_no_matching_count():
    assert qv.queue_view(_day(), "peliyagoda").matching is None


def test_a_filter_that_hides_carry_overs_says_how_many():
    view = qv.queue_view(_day(), "peliyagoda", QueueFilter(brand=(Brand.STYLE,)))
    assert view.hidden_carry_overs == 2 and view.carry_overs == 2


def test_the_window_buckets_follow_the_opening_time():
    assert [qv._bucket(t) for t in ("03:00", "04:59", "05:00", "05:59", "06:00", "09:00")] == ["early", "early", "mid", "mid", "late", "late"]


# --------------------------------------------------------------------------- the history drawer


def _history(order_id: str, status: OrderStatus, **kw) -> tuple[QueueDay, QueueOrderRow, HistoryInput]:
    rows = [QueueOrderRow(r.id, r.outlet_id, r.temp, r.units, r.weight_kg, r.volume_m3, status, r.received_at, False, SERVICE) for r in _rows() if r.id == order_id]
    return _day(now=datetime(2026, 9, 28, 16, 30), rows=rows), rows[0], HistoryInput(order_id, **kw)


def test_the_drawer_describes_the_order_and_its_outlet():
    day, row, hist = _history("ORD1002", OrderStatus.CONFIRMED)
    view = qv.order_history_view(day, row, hist)
    assert view.outlet_name == "OUT009" and view.summary == "Fresh · Colombo · chilled · rear dock"
    assert view.continuity.protected is False and view.continuity.text == "Served on the last run · not protected"
    assert view.order.id == "ORD1002"


def test_a_protected_outlet_says_why():
    day, row, hist = _history("ORD1001", OrderStatus.CONFIRMED)
    view = qv.order_history_view(day, row, hist)
    assert view.continuity.protected
    assert view.continuity.text == "Deferred yesterday · 2 days since last served · Protected by continuity guard"


def test_the_journey_marks_what_has_happened():
    day, row, hist = _history("ORD1002", OrderStatus.PLANNED, audit=[
        AuditRow(datetime(2026, 9, 28, 16, 0), "system", "cutoff"),
        AuditRow(datetime(2026, 9, 28, 16, 5), "System draft", "plan"),
    ])
    steps = {s.step: s for s in qv.order_history_view(day, row, hist).journey}
    assert [s.state for s in steps.values()] == ["done", "done", "current", "pending", "pending", "pending", "pending"]
    assert steps["Ordered"].by is not None and steps["Ordered"].by.startswith("Store · ")
    assert steps["Confirmed"].by == "System · 16:00" and steps["Planned"].by == "System · 16:05"
    assert steps["Loaded"].by is None


def test_a_deferred_order_stays_on_the_planned_step_and_lists_its_reason():
    deferral = DeferralRow(1, "ORD1020", DeferralType.CAPACITY, None, "van_only and 1,250 kg; whole orders can't split.", {}, {}, date(2026, 9, 30), "System draft", None, None, None)
    day, row, hist = _history("ORD1020", OrderStatus.DEFERRED, deferral=deferral)
    view = qv.order_history_view(day, row, hist)
    assert next(s for s in view.journey if s.state == "current").step == "Planned"
    assert view.notes == ["Deferred (capacity): van_only and 1,250 kg; whole orders can't split.", "Next run Wed 30 Sep"]


def test_the_last_runs_end_with_today():
    runs = [HistoryRun(date(2026, 9, d), o) for d, o in [(24, "served"), (25, "served"), (26, "served"), (27, "served"), (28, "deferred")]]
    day, row, hist = _history("ORD1001", OrderStatus.PLANNED, runs=runs)
    out = qv.order_history_view(day, row, hist).last_runs
    assert [r.date for r in out] == ["Fri 25 Sep", "Sat 26 Sep", "Sun 27 Sep", "Mon 28 Sep", "Tue 29 Sep"]
    assert out[-2].outcome == "deferred" and out[-2].label == "Deferred"
    assert out[-1].outcome == "pending" and out[-1].label == "Today pending"


@pytest.mark.parametrize(
    ("status", "step"),
    [("ordered", "Ordered"), ("confirmed", "Confirmed"), ("loaded", "Loaded"), ("departed", "Departed"), ("delivered", "Delivered"), ("conflict", "Departed")],
)
def test_the_journey_current_step_follows_the_status(status, step):
    day, row, hist = _history("ORD1002", OrderStatus(status))
    current = next(s for s in qv.order_history_view(day, row, hist).journey if s.state == "current")
    assert current.step == step
