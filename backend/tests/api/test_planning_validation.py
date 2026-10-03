"""Write validation uses the workflow's trusted input, independent of the proposed plan."""

from dataclasses import replace
from datetime import datetime

import pytest

from app.errors import ApiError
from app.models.enums import PlanState
from app.services.dispatch_model import DeferralRow, DispatchDay, TripRow, VersionRow
from app.services.plan_logic import plan_of
from app.services.planning import DeferralSpec, _validate_for_write
from tests.rules.conftest import ORDERS, REF, SERVICE, VEHICLE_DAYS
from waypoint_rules import draft_plan
from waypoint_rules.vocab import DeferralType


def _day(state: PlanState | None) -> DispatchDay:
    pool = {"ORD2003": ORDERS["ORD2003"]}
    result = draft_plan(pool, REF, VEHICLE_DAYS, service_date=SERVICE)
    assert not result.deferrals
    day = DispatchDay(
        SERVICE, datetime(2026, 9, 28, 16, 6), REF, dict(pool), {},
        plannable=set(pool), vehicle_days=dict(VEHICLE_DAYS),
    )
    if state is not None:
        version = VersionRow(1, 1, state, None, "system", day.now, day.now if state is PlanState.RELEASED else None)
        day.versions = [version]
        day.chosen = version
    day.trips = [
        TripRow(t.vehicle_id, t.trip_no, t.brand, t.district, t.depart_at, tuple(t.order_ids))
        for t in result.trips
    ]
    return day


def _deferral(order_id: str) -> DeferralSpec:
    return DeferralSpec(order_id, DeferralType.STORE_REQUEST, None, "Store asked to wait", {}, {}, None, "Kumari")


@pytest.mark.parametrize("state", [None, PlanState.DRAFT, PlanState.RELEASED], ids=["first-draft", "draft-release", "live"])
@pytest.mark.parametrize("destination", ["trip", "deferred"])
def test_proposed_order_ids_cannot_expand_write_scope(state, destination):
    day = _day(state)
    _validate_for_write(day, plan_of(day), [])  # Start with a valid plan and trusted input pool.
    extra = replace(day.orders["ORD2003"], id="ORDERED-EXTRA", weight_kg=1, volume_m3=0.01)
    day.orders[extra.id] = extra  # Exists in the day but, like an Ordered row, is not plannable.
    assert extra.id not in day.plannable
    proposed = plan_of(day)
    specs = []
    if destination == "trip":
        next(iter(proposed.trips.values())).order_ids.append(extra.id)
    else:
        proposed.deferred.append(extra.id)
        specs.append(_deferral(extra.id))

    with pytest.raises(ApiError) as caught:
        _validate_for_write(day, proposed, specs)
    assert (caught.value.status, caught.value.code) == (409, "invalid_plan")
    assert f"Unknown order {extra.id} in the plan" in caught.value.details


@pytest.mark.parametrize("destination", ["trip", "deferred"])
def test_live_change_cannot_adopt_an_unowned_plannable_order(destination):
    day = _day(PlanState.RELEASED)
    extra = replace(day.orders["ORD2003"], id="CONFIRMED-EXTRA", weight_kg=1, volume_m3=0.01)
    day.orders[extra.id] = extra
    day.plannable.add(extra.id)  # Confirmed, but never included in the released workflow.
    proposed = plan_of(day)
    specs = []
    if destination == "trip":
        next(iter(proposed.trips.values())).order_ids.append(extra.id)
    else:
        proposed.deferred.append(extra.id)
        specs.append(_deferral(extra.id))

    with pytest.raises(ApiError) as caught:
        _validate_for_write(day, proposed, specs)
    assert (caught.value.status, caught.value.code) == (409, "invalid_plan")
    assert f"Unknown order {extra.id} in the plan" in caught.value.details


def test_live_change_retains_and_reclassifies_an_owned_non_plannable_order():
    day = _day(PlanState.RELEASED)
    day.plannable.clear()  # Loaded/departed rows leave the plannable set, but remain on stored trips.
    _validate_for_write(day, plan_of(day), [])
    proposed = plan_of(day)
    proposed.trips.clear()
    proposed.deferred.append("ORD2003")
    _validate_for_write(day, proposed, [_deferral("ORD2003")])

    # The next live version owns the persisted deferred pool too.
    day.trips.clear()
    day.deferrals = [DeferralRow(1, "ORD2003", DeferralType.STORE_REQUEST, None, "Store asked to wait", {}, {}, None, "Kumari", None, None, None)]
    _validate_for_write(day, plan_of(day), [_deferral("ORD2003")])
