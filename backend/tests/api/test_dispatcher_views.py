"""The dispatcher views and the plan logic behind them, built from the §4c reference day with no database.

The planner writes the plan, the repository would load it, and these tests hand the same facts to the view
builders directly, so what a screen shows is checked against the rules' own numbers.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import date, datetime, timedelta

import pytest

from app.jobs import cutoff_at
from app.models.enums import ActorKind, PlanState
from app.services import dispatcher_views as views
from app.services.dispatch_model import (
    AckRow,
    DeferralRow,
    DispatchDay,
    OutletRow,
    TripRow,
    VehicleAvailability,
    VersionRow,
)
from app.services.plan_logic import after_move, gate, plan_of
from tests.rules.conftest import ORDERS, REF, SERVICE, VEHICLE_DAYS, at
from waypoint_rules import Move, draft_plan, validate_move
from waypoint_rules.vocab import DeferralType

NOW = datetime(2026, 9, 28, 21, 15)


def _day(*, now: datetime = NOW, state: PlanState = PlanState.DRAFT, with_second_version: bool = False) -> DispatchDay:
    draft = draft_plan(ORDERS, REF, VEHICLE_DAYS, service_date=SERVICE)
    outlets = {
        o.id: OutletRow(o.id, o.id, o.brand, o.district, o.depot, o.dock_type, o.van_only, o.mall_dock)
        for o in REF.outlets.values()
    }
    trips = [TripRow(t.vehicle_id, t.trip_no, t.brand, t.district, t.depart_at, tuple(t.order_ids)) for t in draft.trips]
    deferrals = [
        DeferralRow(
            i + 1, d.order_id, d.type, d.binding, d.reason_text,
            {"deferred_yesterday": d.impact.deferred_yesterday, "days_since_served": d.impact.days_since_served, "consequence": d.impact.consequence},
            {"kg": d.frees.kg, "m3": d.frees.m3, "minutes": d.frees.minutes},
            d.next_run_date, "System draft · 16:05", datetime(2026, 9, 28, 16, 5), None, None,
        )
        for i, d in enumerate(draft.deferrals)
    ]
    v1 = VersionRow(1, 1, PlanState.DRAFT, "System draft from the closed queue", "System draft", datetime(2026, 9, 28, 16, 5), None)
    versions = [v1]
    chosen = v1
    if with_second_version or state is PlanState.RELEASED:
        released = state is PlanState.RELEASED
        v2 = VersionRow(2, 2, state, "Peliyagoda + Kandy" if released else "Kumari's adjustments", "Kumari", datetime(2026, 9, 28, 23, 40), datetime(2026, 9, 28, 23, 40) if released else None)
        versions.append(v2)
        chosen = v2
    availability = {
        vid: VehicleAvailability(vd.available_from is not None, vd.available_from, None) for vid, vd in VEHICLE_DAYS.items()
    }
    return DispatchDay(
        service_date=SERVICE,
        now=now,
        ref=REF,
        orders=dict(ORDERS),
        outlets=outlets,
        plannable=set(ORDERS),
        versions=versions,
        chosen=chosen,
        trips=trips,
        deferrals=deferrals,
        vehicle_days=dict(VEHICLE_DAYS),
        availability=availability,
        drivers={vid: f"Driver {vid}" for vid in REF.vehicles},
        loaders={"peliyagoda": "Priya", "kandy": "Ruwan"},
    )


# --------------------------------------------------------------------------- formatting


def test_labels_read_like_the_screens():
    assert views.when(datetime(2026, 9, 28, 16, 5)) == "Mon 16:05"
    assert views.day_label(date(2026, 9, 30)) == "Wed 30 Sep"
    assert views.day_label(date(2026, 10, 5)) == "Mon 5 Oct"
    assert views.until_label(NOW, NOW + timedelta(minutes=329)) == "in 5 h 29 min"
    assert views.until_label(NOW, NOW + timedelta(minutes=14)) == "in 14 min"
    assert views.until_label(NOW, NOW) == "now"


def test_the_cutoff_is_16_00_on_the_last_operating_day_before():
    operating = [date(2026, 9, 28), date(2026, 9, 29), date(2026, 9, 30), date(2026, 10, 3), date(2026, 10, 5)]
    assert cutoff_at(date(2026, 9, 29), operating) == datetime(2026, 9, 28, 16, 0)
    assert cutoff_at(date(2026, 10, 5), operating) == datetime(2026, 10, 3, 16, 0)  # nothing runs on Sunday


# --------------------------------------------------------------------------- D3 trip board


def test_plan_view_lists_the_depots_vehicles_and_trips():
    view = views.plan_view(_day(), "peliyagoda")
    ids = {lane.vehicle_id: lane for lane in view.lanes}
    assert set(ids) == {"VEH003", "VEH035", "VEH036", "VEH037"}
    assert ids["VEH036"].status == "workshop" and ids["VEH036"].workshop_until == "02:45"
    assert ids["VEH003"].trips[0].departs == "03:30"
    trip = ids["VEH003"].trips[0]
    assert 0 < trip.fill.kg <= 1 and 0 < trip.fill.minutes <= 1
    assert trip.kg_cap == REF.vehicles["VEH003"].weight_cap_kg
    meters = {m.label: m for m in ids["VEH003"].meters}
    assert meters["Fresh"].limit == 270 and meters["Fuel"].limit == 480
    assert [m.label for m in ids["VEH037"].meters][0] == "Style+Tech"


def test_plan_view_summary_adds_up():
    day = _day()
    view = views.plan_view(day, "peliyagoda")
    placed = {o for t in day.trips for o in t.order_ids}
    assert view.summary.orders == len(ORDERS)
    assert view.summary.served == len(placed)
    assert view.summary.served + view.summary.deferred == view.summary.orders
    assert view.summary.capacity_deferred == 1 and view.summary.policy_deferred == view.summary.deferred - 1
    assert view.summary.receivers.docks == 2
    assert {r.depot for r in view.summary.by_depot} == {"peliyagoda", "kandy"}
    assert next(r for r in view.summary.by_depot if r.depot == "peliyagoda").receivers.startswith("Priya · ")


def test_plan_view_marks_protected_stops_and_deferred_cards():
    view = views.plan_view(_day(), "peliyagoda")
    stops = [s for lane in view.lanes for t in lane.trips for s in t.stops]
    assert {s.outlet_id for s in stops if s.protected} == {"OUT012", "OUT029"}
    assert view.deferred[0].order_id == "ORD1020" and view.deferred[0].kind is DeferralType.CAPACITY
    assert view.deferred[0].binding == "van access"
    assert view.deferred_total == len(view.deferred) <= views.CARDS_IN_POOL or view.deferred_total > len(view.deferred)


def test_a_draft_that_passes_every_rule_can_be_released():
    day = _day()
    assert all(ok for _, ok in gate(day))
    view = views.plan_view(day, "peliyagoda")
    assert view.ready_to_release and not view.read_only
    assert [c.text for c in view.checks][0] == "All trips pass every rule"


def test_a_released_plan_is_read_only_and_not_releasable():
    view = views.plan_view(_day(state=PlanState.RELEASED), "peliyagoda")
    assert view.read_only and not view.ready_to_release
    assert view.version.scope == "Peliyagoda + Kandy"
    assert [v.number for v in view.versions] == [1, 2]
    assert sum(v.current for v in view.versions) == 1


def test_a_plan_with_an_unmanned_vehicle_fails_the_gate():
    day = _day()
    del day.drivers["VEH003"]
    assert ("Every vehicle has a driver and dock assigned", False) in gate(day)
    assert not views.plan_view(day, "peliyagoda").ready_to_release


def test_an_unplaced_order_without_a_reason_fails_the_gate():
    day = _day()
    day.deferrals = [d for d in day.deferrals if d.order_id != "ORD1017"]
    failed = [text for text, ok in gate(day) if not ok]
    assert failed == ["1 unplaced orders without a reason"]


def test_no_plan_yet_is_an_empty_plan_not_an_error():
    day = _day()
    day.versions, day.chosen, day.trips, day.deferrals = [], None, [], []
    view = views.plan_view(day, "peliyagoda")
    assert view.version.number == 0 and view.version.note == "No plan yet"
    assert view.lanes == [] or all(not lane.trips for lane in view.lanes)
    assert not view.ready_to_release


# --------------------------------------------------------------------------- moves


def _move(order: str, to: tuple[str, int] | None):
    day = _day()
    plan = plan_of(day)
    move = Move(order, to)
    result = validate_move(plan, move, day.orders, day.ref, day.vehicle_days)
    return day, views.move_result_view(day, move, result, after_move(plan, move, day.orders, result))


def test_a_refused_move_names_every_rule_it_breaks():
    """D3.4: a chilled order on an ambient vehicle that also carries another brand."""
    _, out = _move("ORD1002", ("VEH037", 1))
    assert not out.ok
    assert {v.rule for v in out.violations} == {"R-TEMP", "R-BRAND"}
    assert out.summary == "Can't move ORD1002 to VEH037 · Trip 1"
    assert out.preview is None and out.checks


def test_a_protected_order_cannot_be_deferred():
    """D3.5: OUT012 was deferred yesterday and a legal vehicle exists."""
    _, out = _move("ORD1001", None)
    assert not out.ok and out.protected_reason
    assert [v.rule for v in out.violations] == ["R-CONT"]
    assert out.summary == "Can't defer ORD1001"


def test_deferring_an_ordinary_order_is_allowed_with_a_preview():
    _, out = _move("ORD1012", None)
    assert out.ok and out.to.deferred
    assert out.preview and out.preview.verdict == "Drop to defer"
    assert out.preview.note.startswith("Policy deferral, next run ")


def test_a_legal_move_shows_before_and_after():
    day = _day()
    plan = plan_of(day)
    # Take ORD1004 (Gampaha) off VEH035 and put it back: a move onto the trip it already rides is a no-op the rules accept.
    move = Move("ORD1004", ("VEH035", 1))
    result = validate_move(plan, move, day.orders, day.ref, day.vehicle_days)
    out = views.move_result_view(day, move, result, after_move(plan, move, day.orders, result))
    assert out.ok
    weight = next(r for r in out.preview.rows if r.label == "Weight")
    assert weight.limit == REF.vehicles["VEH035"].weight_cap_kg
    assert {c.rule for c in out.checks} >= {"Reefer", "Weight", "Volume", "Window", "Fuel"}


# --------------------------------------------------------------------------- D4 deferrals


def test_deferrals_view_counts_and_wording():
    day = _day()
    view = views.deferrals_view(day, "peliyagoda")
    assert view.counts.total == 2 and view.counts.capacity == 1 and view.counts.policy == 1
    assert view.headline == "2 orders wait for Wed 30 Sep"
    assert view.banner.tone == "warning"
    assert view.banner.title == "Capacity forces 2 deferrals at Peliyagoda."
    assert view.banner.text.startswith("1 has no legal vehicle; policy chose the other 1.")
    card = view.capacity[0]
    assert card.order_id == "ORD1020" and card.reason.headline == "Van-only access"
    assert card.reason.detail.startswith("van_only and 1,250 kg; the largest Peliyagoda reefer van carries 1,040 kg")
    assert card.frees == "(no legal vehicle)" and card.impact.startswith("3 days since served")
    assert card.access == ["Street", "Van only"]
    assert card.store_told.state == "not sent"
    assert view.notices.note == "Notices go out when you release, or now with Notify stores."
    assert {p.outlet_id for p in view.protected} == {"OUT012", "OUT029"}
    assert view.can_release


def test_deferrals_view_reports_notices_sent_and_seen():
    day = _day()
    sent = datetime(2026, 9, 28, 23, 41)
    day.deferrals = [
        replace(d, notice_sent_at=sent, notice_seen_at=sent + timedelta(minutes=6) if d.order_id == "ORD1017" else None)
        for d in day.deferrals
    ]
    view = views.deferrals_view(day, "peliyagoda")
    assert view.notices.sent == 2 and view.notices.seen == 1
    assert view.banner.tone == "success" and view.banner.title.startswith("2 notices sent at 23:41 · 1 seen")
    told = {c.order_id: c.store_told for c in [*view.capacity, *view.policy]}
    assert told["ORD1017"].state == "seen" and told["ORD1020"].state == "sent"


def test_a_store_request_is_not_counted_as_forced():
    day = _day()
    day.deferrals.append(
        DeferralRow(9, "ORD2001", DeferralType.STORE_REQUEST, None, "Store request: receiving staff unavailable.",
                    {"days_since_served": 1}, {"kg": 70, "m3": 0.7, "minutes": 21}, date(2026, 9, 30), "Kumari", None, None, None)
    )
    view = views.deferrals_view(day, "kandy")
    assert view.counts.store_request == 1 and view.counts.capacity == 0 and view.counts.policy == 0
    assert view.banner.tone == "info" and view.banner.title.startswith("0 deferrals forced by capacity at Kandy. 1 at store request.")
    assert view.store_request[0].reason.headline == "Other · store request"
    assert view.store_request[0].binding == "none: store asked"


def test_a_deferral_that_is_new_in_this_version_says_so():
    day = _day(with_second_version=True)
    day.earlier_deferred = {"ORD1020"}
    cards = {c.order_id: c for c in views.deferrals_view(day, "peliyagoda").capacity + views.deferrals_view(day, "peliyagoda").policy}
    assert cards["ORD1020"].new_in_version is None and cards["ORD1017"].new_in_version == 2


# --------------------------------------------------------------------------- D2 capacity


def test_capacity_view_counts_the_fleet_and_the_workshop():
    view = views.capacity_view(_day(), "peliyagoda")
    assert view.orders == len([o for o in ORDERS if REF.outlets[ORDERS[o].outlet_id].depot == "peliyagoda"])
    assert view.vehicles.total == 5 and view.vehicles.in_workshop == 1 and view.vehicles.available == 4
    assert view.reefers.total == 3 and view.reefers.available == 2
    assert view.reefers.note == "VEH036 in workshop until 02:45"
    assert view.deferrals.total == 2 and view.deferrals.capacity == 1
    assert view.spare is None
    assert view.plan is not None and view.plan.number == 1 and view.plan.state is PlanState.DRAFT
    assert view.pool.depot == "kandy"
    assert view.closest.label == "Fuel quota" and view.closest.limit > 0


def test_capacity_view_shows_the_spare_vehicle_once_it_is_back():
    day = _day(now=at("02:46"))
    view = views.capacity_view(day, "peliyagoda")
    assert view.spare is not None and view.spare.vehicle_id == "VEH036" and view.spare.since == "02:45"
    assert view.reefers.available == 3 and view.reefers.note == "VEH036 is spare"
    lanes = {lane.vehicle_id: lane for lane in views.plan_view(day, "peliyagoda").lanes}
    assert lanes["VEH036"].status == "spare"


def test_capacity_view_before_the_first_draft_has_no_plan_or_binding():
    day = _day()
    day.versions, day.chosen, day.trips, day.deferrals = [], None, [], []
    view = views.capacity_view(day, "peliyagoda")
    assert view.plan is None and view.binding is None and view.deferrals.total == 0


def test_a_depot_with_enough_capacity_has_no_binding_resource_and_shows_its_fleet():
    view = views.capacity_view(_day(), "kandy")
    assert view.binding is None
    assert view.fleet is not None and view.fleet.total == 1
    assert view.lane is not None and view.lane.vehicle_id == "VEH039"
    assert [m.label for m in view.lane.meters][:2] == ["Weight", "Volume"]
    assert view.fresh_use is not None and 0 < view.fresh_use < 1


def test_released_capacity_carries_the_totals():
    view = views.capacity_view(_day(state=PlanState.RELEASED), "peliyagoda")
    assert view.released is not None and view.released.at == "23:40"
    assert view.released.served + view.released.deferred == view.released.orders


# --------------------------------------------------------------------------- D5 acknowledgements


def _ack(depot: str | None = None, vehicle: str | None = None, minute: int = 10) -> AckRow:
    kind = ActorKind.PIN_PERSON if depot else ActorKind.DRIVER
    return AckRow(kind, depot, vehicle, datetime(2026, 9, 28, 23, 40) + timedelta(minutes=minute))


def test_acknowledgements_start_pending_and_warn_about_the_dock():
    day = _day(now=datetime(2026, 9, 28, 23, 45), state=PlanState.RELEASED)
    view = views.acknowledgements_view(day)
    assert view.version == 2 and view.acknowledged == 0 and view.total == 2 + 4  # two docks and four drivers
    assert view.banner is not None and view.banner.tone == "warning"
    assert "hasn't acknowledged v2" in view.banner.title
    first_driver = next(r for r in view.rows if r.role == "Driver")
    assert first_driver.state == "pending" and first_driver.departs_in.startswith("in ")


def test_everyone_acknowledged_is_a_success_banner():
    day = _day(now=datetime(2026, 9, 29, 0, 30), state=PlanState.RELEASED)
    day.acks = [_ack(depot="peliyagoda"), _ack(depot="kandy"), *[_ack(vehicle=v) for v in {t.vehicle_id for t in day.trips}]]
    view = views.acknowledgements_view(day)
    assert view.acknowledged == view.total
    assert view.banner is not None and view.banner.tone == "success" and view.banner.title == "Everyone has plan v2."


def test_a_driver_whose_trips_did_not_change_keeps_the_earlier_version():
    """Unaffected by the new version: the row says "no change" and keeps the v1 acknowledgement."""
    day = _day(now=datetime(2026, 9, 29, 3, 5), state=PlanState.RELEASED)
    day.previous = replace(day.versions[0], state=PlanState.RELEASED, released_at=datetime(2026, 9, 28, 23, 0))
    day.previous_trips = list(day.trips)
    day.previous_acks = [_ack(vehicle="VEH003", minute=-20)]
    view = views.acknowledgements_view(day)
    row = next(r for r in view.rows if r.place == "VEH003")
    assert row.state == "no change" and row.has == 1 and row.note == "no change in v2"


def test_departed_vehicles_say_so():
    day = _day(now=datetime(2026, 9, 29, 3, 40), state=PlanState.RELEASED)
    row = next(r for r in views.acknowledgements_view(day).rows if r.place == "VEH003")
    assert row.departs_in == "Departed 03:30"


@pytest.mark.parametrize("depot", ["peliyagoda", "kandy"])
def test_every_view_builds_for_both_depots(depot):
    day = _day()
    for build in (views.plan_view, views.capacity_view, views.deferrals_view):
        assert build(day, depot).depot == depot  # type: ignore[operator]
