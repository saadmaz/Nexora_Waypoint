"""The live board (D6), the inbox and the reconciliation screen (D7), on the PRD's plan v3, with no database.

The hero's Kandy run is VEH039 (ORD2001 chilled and ORD2002 ambient at OUT084, ORD2003 at OUT087), which leaves at 05:10 in v3. These
tests give it the design's own night: silent from 05:17, a store request at 05:21, a delivery at 05:42 the phone synced at 06:40.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime

from app.models.enums import ConflictStatus, ExceptionStatus
from app.services import conflict_views as cv
from app.services import live_views as lv
from app.services.dispatch_model import DeferralRow
from app.services.live_model import ConflictRow, LiveDay, RunRow
from tests.api.test_exception_logic import NEXT_RUN, _day, _row
from waypoint_rules.reconcile import Recommendation
from waypoint_rules.vocab import DeferralType, OrderStatus

P, D = OrderStatus.PLANNED, OrderStatus.DEPARTED
K_ORDERS = ("ORD2001", "ORD2002", "ORD2003")


def at(hhmm: str, day: int = 29) -> datetime:
    h, m = map(int, hhmm.split(":"))
    return datetime(2026, 9, day if h < 12 else 28, h, m)


def _live(now: str, status: dict[str, OrderStatus] | None = None, **kw) -> LiveDay:
    day = _day(now=at(now))
    live = LiveDay(day=day, trips_by_version={3: list(day.trips)}, released_number=3)
    live.status = {oid: P for oid in day.orders}
    live.status.update(status or {})
    for k, v in kw.items():
        setattr(live, k, v)
    return live


def _kandy_departed(now: str, **kw) -> LiveDay:
    run = RunRow("VEH039", 1, at("05:10"), None, at("05:17"), 3)
    status = {o: D for o in K_ORDERS}
    return _live(now, status, runs={("VEH039", 1): run}, **kw)


# --------------------------------------------------------------------------- the board


def test_a_vehicle_still_at_the_dock_is_planned_with_its_departure():
    view = lv.live_board_view(_live("02:50"), "peliyagoda")
    row = next(r for r in view.rows if r.vehicle_id == "VEH035")
    assert row.status == "Planned" and row.next_stop == "Loading · departs 03:30" and row.risk == "On time"
    assert row.stops.total == 4 and row.stops.done == 0 and row.plan_on_device == 3
    assert view.stats.departed.value == 0 and view.stats.departed.foot == "first departures 03:30"
    assert view.date == "Tue 29 Sep" and view.plan == "Plan v3"


def test_a_departed_vehicle_that_goes_quiet_is_unknown_offline():
    """H12: the phone was last heard at 05:17; four minutes later the board says so and does not guess."""
    view = lv.live_board_view(_kandy_departed("05:21"), "kandy")
    row = view.rows[0]
    assert row.vehicle_id == "VEH039" and row.status == "Departed"
    assert row.risk == "Unknown · offline"
    assert row.last_heard.time == "05:17" and row.last_heard.age == "4 min · known gap"
    assert row.offline_note == "The phone keeps recording offline. Records arrive when it's back in coverage."
    assert row.expanded and [st.outlet_id for st in row.stops_detail] == ["OUT084", "OUT087"]
    assert row.next_stop == "OUT084 · ETA 05:26"


def test_a_vehicle_heard_a_minute_ago_is_on_time():
    live = _kandy_departed("05:18")
    assert lv.live_board_view(live, "kandy").rows[0].risk == "On time"


def test_the_stop_that_waits_for_its_window_says_so():
    live = _kandy_departed("05:28")
    live.runs[("VEH039", 1)] = replace(live.runs[("VEH039", 1)], last_heard_at=at("05:27"))
    live.arrivals[("VEH039", "OUT084")] = at("05:26")
    assert lv.live_board_view(live, "kandy").rows[0].next_stop == "At OUT084 · waiting for 05:30"


def test_a_held_vehicle_is_at_risk_and_asks_for_a_decision():
    live = _live("02:56", exceptions=[_row()])
    view = lv.live_board_view(live, "peliyagoda")
    held = next(r for r in view.rows if r.vehicle_id == "VEH003")
    assert held.held and held.risk == "At risk" and held.last_heard.time == "02:55" and held.last_heard.note == "Priya"
    assert view.rows[0].vehicle_id == "VEH003"  # needing attention comes first
    decision = next(d for d in view.decisions if d.kind == "held")
    assert decision.title == "VEH003 held: vehicle check failed"
    assert decision.text == "Reefer not holding temperature · flagged by Priya 02:55 · 9 orders on 2 trips · departs 03:30"
    assert decision.countdown == "34 min to departure" and decision.action.to == "/dispatcher/exceptions/1"
    assert view.stats.issues.value == 1 and view.stats.issues.foot == "VEH003 held"
    spare = next(d for d in view.decisions if d.id == "spare")
    assert spare.title == "VEH036 available since 02:45" and spare.info_only
    assert spare.text == "Reefer van · 1,040 kg · 7.0 m³ · back from the workshop"


def test_a_decided_exception_is_no_longer_asked_about():
    live = _live("03:10", exceptions=[replace(_row(), status=ExceptionStatus.DECIDED)])
    assert [d for d in lv.live_board_view(live, "peliyagoda").decisions if d.kind == "held"] == []


def test_rows_default_to_the_top_few_and_show_all_on_request():
    live = _live("05:00")
    assert len(lv.live_board_view(live, "both").rows) == 4  # VEH003, VEH011, VEH035, VEH039 have trips in v3
    assert len(lv.live_board_view(live, "both", show_all=True).rows) == 4
    assert len(lv.live_board_view(live, "peliyagoda").rows) == 3 and len(lv.live_board_view(live, "kandy").rows) == 1


def test_delivered_orders_are_counted_and_a_finished_trip_says_returning():
    status = {o: OrderStatus.DELIVERED for o in ("ORD1023", "ORD1024", "ORD1022", "ORD1021")}
    run = RunRow("VEH035", 1, at("03:30"), None, at("05:20"), 3)
    live = _live("05:21", status, runs={("VEH035", 1): run})
    live.outcome_at["ORD1023"] = at("04:07")
    view = lv.live_board_view(live, "peliyagoda")
    row = next(r for r in view.rows if r.vehicle_id == "VEH035")
    assert row.trip == 2  # trip 1 is done, the vehicle is on to trip 2
    assert view.stats.delivered.value == 4 and view.stats.departed.value == 1
    assert row.stops.total == 3 and row.stops.done == 0  # trip 2 has not started its stops


def test_the_change_the_phone_has_not_received_is_shown_on_its_stop():
    """H12 to H13: v4 defers OUT084's orders; the phone still holds v3, so the stop shows a pending change."""
    live = _kandy_departed("05:21")
    day = live.day
    store_request = [
        DeferralRow(20 + i, o, DeferralType.STORE_REQUEST, None, "Receiving staff unavailable", {}, {}, NEXT_RUN, "Kumari · 05:21", at("05:21"), at("05:21"), None)
        for i, o in enumerate(("ORD2001", "ORD2002"))
    ]
    day.deferrals = [*day.deferrals, *store_request]
    day.trips = [t if t.vehicle_id != "VEH039" else replace(t, order_ids=("ORD2003",)) for t in day.trips]
    day.versions.append(replace(day.versions[0], id=5, number=5, released_at=at("05:21")))
    day.chosen = day.versions[-1]
    live.trips_by_version[5] = day.trips
    live.released_number = 5
    live.status.update({"ORD2001": OrderStatus.DEFERRED, "ORD2002": OrderStatus.DEFERRED})
    view = lv.live_board_view(live, "kandy")
    row = view.rows[0]
    assert row.change_pending and row.plan_on_device == 3 and row.risk == "Unknown · offline"
    hero = row.stops_detail[0]
    assert hero.outlet_id == "OUT084" and hero.status == "Change pending" and hero.change == "Deferred · store request → Wed"
    assert not hero.can_defer
    pending = next(d for d in view.decisions if d.id == "pending")
    assert pending.title == "VEH039 hasn't received v5, pending since 05:21"
    assert pending.text == "ORD2001 + ORD2002 deferred at OUT084's request. The phone gets v5 when it's back in coverage."
    assert view.stats.delivered.foot == "orders so far · VEH039 records pending sync"


# --------------------------------------------------------------------------- D7, the conflict


def _conflict_live(**snap_extra) -> tuple[LiveDay, ConflictRow]:
    live = _kandy_departed("06:41")
    day = live.day
    day.deferrals = [
        *day.deferrals,
        *[DeferralRow(30 + i, o, DeferralType.STORE_REQUEST, None, "Receiving staff unavailable", {}, {}, NEXT_RUN, "Kumari · 05:21", at("05:21"), None, None) for i, o in enumerate(("ORD2001", "ORD2002"))],
    ]
    day.drivers["VEH039"] = "Nimal"
    live.status.update({"ORD2001": OrderStatus.CONFLICT, "ORD2002": OrderStatus.CONFLICT, "ORD2003": OrderStatus.DELIVERED})
    server = {"status": "deferred", "planVersion": 5, "type": "store_request", "decidedAt": "2026-09-29T05:21:00+05:30", "decidedBy": "Kumari",
              "reason": "Receiving staff unavailable", "reachedDriver": False, **snap_extra}
    device = {"vehicleId": "VEH039", "outcome": "delivered", "deviceTime": "2026-09-29T05:42:00+05:30", "receivedBy": "S. Fernando (night staff)",
              "units": "12 + 8", "photo": True, "planVersionOnDevice": 4, "arrivedAt": "2026-09-29T05:26:00+05:30",
              "offlineSince": "2026-09-29T05:17:00+05:30", "syncedAt": "2026-09-29T06:40:00+05:30"}
    reasons = (
        "The goods are at the store, with photo, receiver and units",
        "The deferral never reached the driver: the phone was on v4, the deferral is in v5",
        "Reversing means a return trip for goods already received",
    )
    c = ConflictRow(7, ("ORD2001", "ORD2002"), server, device, Recommendation.KEEP_DELIVERY, reasons, ConflictStatus.OPEN, None, None, None)
    live.conflicts = [c]
    return live, c


def test_the_conflict_shows_both_records_side_by_side():
    live, c = _conflict_live()
    view = cv.conflict_view(live, c)
    assert (view.id, view.outlet_id, view.district, view.state) == ("7", "OUT084", "Kandy", "needs decision")
    assert [(e.time, e.kind) for e in view.timeline] == [("05:17", "offline"), ("05:21", "deferred"), ("05:26", "arrived"), ("05:42", "delivered"), ("06:40", "synced")]
    assert view.timeline[1].title == "Dispatch deferred · v5" and view.timeline[2].title == "Arrived · waiting" and view.timeline[2].detail == "Window opens 05:30"
    assert view.timeline[3].detail == "12 + 8 units · S. Fernando (night staff)"
    d = view.driver_record
    assert (d.heading, d.status, d.received_by, d.units, d.device_time, d.photo) == (
        "Driver record · VEH039 · Nimal", "Delivered 05:42", "S. Fernando (night staff)", "12 + 8", "05:42", "POD photo 05:42")
    k = view.dispatch_record
    assert (k.heading, k.status, k.decided, k.reason, k.reached) == (
        "Dispatch record · Kumari", "Deferred · store request → Wed", "05:21 · plan v5", "Receiving staff unavailable", "No: offline since 05:17")
    assert [o.id for o in view.orders] == ["ORD2001", "ORD2002"] and view.outcome is None and view.asked is None


def test_the_recommendation_is_keep_delivery_with_its_reasons():
    live, c = _conflict_live()
    rec = cv.conflict_view(live, c).recommendation
    assert rec.choice.value == "keep_delivery" and rec.title == "Recommended: Keep delivery" and rec.chip is None
    assert rec.outcome == "Status becomes Delivered · tag Deferral withdrawn · Wed re-run removed · both records kept in the audit"
    assert rec.reasons[0].startswith("The goods are at the store")


def test_asking_the_store_pauses_the_recommendation():
    live, c = _conflict_live(askedAt="2026-09-29T06:50:00+05:30")
    c = replace(c, status=ConflictStatus.AWAITING_STORE)
    view = cv.conflict_view(live, c)
    assert view.state == "awaiting store" and view.recommendation.paused_note == "Paused until the store answers"
    assert view.asked is not None and view.asked.at == "06:50" and view.asked.text == "Asked OUT084 at 06:50: 'Did you receive this delivery?'"
    assert view.asked.minutes == 0


def test_a_short_delivery_reported_by_the_store_turns_it_into_a_partial():
    report = {"orderId": "ORD2001", "unitsReceived": 10, "unitsOrdered": 12, "by": "Anusha", "at": "2026-09-29T07:04:00+05:30"}
    live, c = _conflict_live(askedAt="2026-09-29T06:50:00+05:30", storeReport=report)
    c = replace(c, status=ConflictStatus.AWAITING_STORE)
    view = cv.conflict_view(live, c)
    assert view.state == "store reported an issue"
    assert (view.store_report.heading, view.store_report.tags, view.store_report.text, view.store_report.at) == (
        "Store report · Anusha", ["Issue", "Short"], "ORD2001 · 10 of 12 units", "07:04")
    rec = view.recommendation
    assert rec.choice.value == "keep_partial" and rec.title == "Recommended: Keep delivery as Partial (10 / 12)" and rec.chip == "Partial"
    assert rec.outcome == "Status becomes Partial · follow-up created for 2 units · Wed re-run removed · all three records kept"
    assert rec.reasons[-1] == "The store confirms goods arrived, 2 units short: Partial matches the evidence" and rec.paused_note is None


def test_a_settled_conflict_says_who_knows():
    live, c = _conflict_live()
    c = replace(c, status=ConflictStatus.RESOLVED, resolution="keep_delivery", resolved_by="Kumari", resolved_at=at("06:44"))
    view = cv.conflict_view(live, c)
    assert view.state == "resolved" and view.outcome == "Delivered"
    r = view.resolved
    assert r.title == "Resolved by Kumari 06:44, kept delivery." and r.toast == "Conflict resolved. Driver and store told."
    assert r.text == "Both records and this decision are kept. Wed 30 Sep re-run removed."
    who = {w.who: w.what for w in r.who_knows}
    assert who["Nimal"] == "Route notice 'OUT084: resolved: delivered' · 06:44"
    assert who["Kandy dock"] == "Wed re-run removed from tomorrow's queue · 06:44"


def test_the_settled_stop_carries_its_tooltip_on_the_board():
    live, c = _conflict_live()
    live.conflicts = [replace(c, status=ConflictStatus.RESOLVED, resolution="keep_delivery", resolved_by="Kumari", resolved_at=at("06:44"))]
    live.status.update({"ORD2001": OrderStatus.DELIVERED, "ORD2002": OrderStatus.DELIVERED})
    live.outcome_at.update({"ORD2001": at("05:42"), "ORD2002": at("05:42")})
    hero = lv.live_board_view(live, "kandy").rows[0].stops_detail[0]
    assert hero.status == "Delivered" and hero.status_note == "Delivered 05:42"
    assert hero.tooltip == "Resolved by Kumari 06:44, kept delivery. Both records kept in the audit."


def test_an_open_conflict_leads_the_inbox_and_the_board():
    live, c = _conflict_live()
    view = lv.live_board_view(live, "both")
    decision = next(d for d in view.decisions if d.kind == "conflict")
    assert decision.title == "OUT084 · ORD2001 + ORD2002: needs a decision" and decision.chip == "Conflict" and decision.at == "06:40"
    assert decision.text == "Driver recorded Delivered 05:42 (S. Fernando (night staff), photo). Plan v5 says Deferred · store request 05:21."
    assert decision.action.label == "Resolve" and decision.action.to == "/dispatcher/conflicts/7?depot=kandy"
    assert view.stats.issues.value == 1 and view.stats.issues.foot == "1 conflict needs a decision" and view.stats.issues.bad
    assert view.rows[0].vehicle_id == "VEH039"
    assert [d.id for d in lv.inbox_view(live).items][0] == "c7"


def test_every_wire_view_validates_against_the_schema():
    live, c = _conflict_live()
    live.exceptions = [_row()]
    for build in (lambda: lv.live_board_view(live, "both", show_all=True), lambda: lv.inbox_view(live), lambda: cv.conflict_view(live, c)):
        assert build().model_dump(by_alias=True, mode="json")
