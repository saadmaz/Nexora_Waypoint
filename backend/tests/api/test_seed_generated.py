"""The generated day (PRD v3 §14 step 6, A41): the size §4c gives, the same every time, and what the planner makes of it.

The API tests seed the small world (``SEED_GENERATED_ORDERS=false``); these generate the full day inside a session and roll it back, so the
test database is left as it was.
"""

from __future__ import annotations

from collections import Counter
from datetime import date

from sqlalchemy import func, select

from app.config import COLOMBO

SERVICE = date(2026, 9, 29)
RECEIVED = date(2026, 9, 28)


def _generate(db) -> dict[str, int]:
    from app.models.orders import Order
    from seed import generated
    from seed import run as seed_run

    generated.extend_reference(db, service_date=SERVICE)
    seed_run.seed_vehicle_day(db, SERVICE)  # the workshop vehicles apply now that the fleet has them
    pinned = seed_run._orders_by_depot(db, SERVICE)
    made = generated.seed_orders(
        db, service_date=SERVICE, received_date=RECEIVED, pinned_peliyagoda=pinned.get("peliyagoda", 0), pinned_kandy=pinned.get("kandy", 0)
    )
    assert db.scalar(select(func.count()).select_from(Order)) is not None
    return made


def _signature(db) -> list[tuple]:
    from app.models.orders import Order

    return [
        (o.id, o.outlet_id, o.temp.value, o.units, o.weight_kg, o.volume_m3, o.received_at.isoformat())
        for o in db.scalars(select(Order).where(Order.id.like("ORD3%")).order_by(Order.id))
    ]


def test_the_day_has_the_size_the_prd_gives(client):
    from app.db import SessionLocal
    from app.models.orders import Order
    from app.models.reference import Outlet, Vehicle

    with SessionLocal() as db:
        try:
            _generate(db)
            per_depot = dict(
                db.execute(select(Outlet.depot_id, func.count()).join(Order, Order.outlet_id == Outlet.id).where(Order.service_date == SERVICE).group_by(Outlet.depot_id)).all()
            )
            assert per_depot == {"peliyagoda": 212, "kandy": 62}  # the judge places ORD2001 and ORD2002, which makes Kandy 64
            fleet = Counter((v.depot_id, v.type.value, v.temp.value) for v in db.scalars(select(Vehicle)))
            assert fleet == {
                ("peliyagoda", "truck", "reefer"): 7, ("peliyagoda", "truck", "ambient"): 27, ("peliyagoda", "van", "reefer"): 2, ("peliyagoda", "van", "ambient"): 2,
                ("kandy", "truck", "reefer"): 5, ("kandy", "truck", "ambient"): 13, ("kandy", "van", "reefer"): 2, ("kandy", "van", "ambient"): 2,
            }
            assert sum(fleet.values()) == 60
        finally:
            db.rollback()


def test_the_generated_orders_are_ordered_and_numbered_from_3001(client):
    from app.db import SessionLocal
    from app.models.orders import Order

    with SessionLocal() as db:
        try:
            made = _generate(db)
            orders = list(db.scalars(select(Order).where(Order.id.like("ORD3%")).order_by(Order.id)))
            assert [o.id for o in orders][0] == "ORD3001" and len(orders) == made["peliyagoda"] + made["kandy"]
            assert {o.status.value for o in orders} == {"ordered"} and {o.placed_by for o in orders} == {"seed"}
            local = [o.received_at.astimezone(COLOMBO) for o in orders]
            assert all((9, 0) <= (t.hour, t.minute) <= (15, 55) and t.date() == RECEIVED for t in local)  # Mon 09:00 to 15:55, Colombo
            assert all(o.units > 0 and o.weight_kg > 0 and o.volume_m3 > 0 for o in orders)
            assert not {o.id for o in orders} & {"ORD2001", "ORD2002"}
        finally:
            db.rollback()


def test_the_same_day_is_generated_every_time(client):
    from app.db import SessionLocal

    runs = []
    for _ in range(2):
        with SessionLocal() as db:
            try:
                _generate(db)
                runs.append(_signature(db))
            finally:
                db.rollback()
    assert runs[0] == runs[1] and len(runs[0]) == 189 + 61


def test_the_walkthrough_has_a_refused_move_of_each_kind_on_the_generated_day(client, capsys):
    """PRD §16 step 4 needs three refusals the judge can reproduce: a window, a reefer plus a second rule, and the continuity guard.

    The search is in a fixed order (order id, then target vehicle and trip), so it finds the same three moves every time. The moves are
    printed so the README can name them.
    """
    import re

    from app.db import SessionLocal
    from app.services import planning_repo as repo
    from waypoint_rules import Move, RuleId, draft_plan, validate_move

    with SessionLocal() as db:
        try:
            _generate(db)
            ops = repo.operating_days(db)
            pool = repo.day_orders(db, SERVICE, ops)
            ref = repo.load_ref(db)
            vdays, _ = repo.vehicle_days(db, SERVICE)
            plan = draft_plan(pool, ref, vdays, service_date=SERVICE, operating_days=ops).as_plan()

            found: dict[str, tuple[Move, list]] = {}
            placed = sorted(o for t in plan.trips.values() for o in t.order_ids)
            for oid in placed:
                source = plan.trip_of_order(oid)
                for key in sorted(plan.trips):
                    if source is None or key == source.key or ref.outlets[pool[oid].outlet_id].depot != ref.vehicles[key[0]].depot:
                        continue
                    result = validate_move(plan, Move(oid, key), pool, ref, vdays)
                    rules = {v.rule for v in result.violations}
                    if RuleId.WINDOW in rules and "window" not in found:
                        found["window"] = (Move(oid, key), result.violations)
                    if RuleId.TEMP in rules and len(rules) >= 2 and "reefer" not in found:
                        found["reefer"] = (Move(oid, key), result.violations)
                    if len(found) >= 2:
                        break
                if len(found) >= 2:
                    break
            protected = next(o for o in sorted(pool) if pool[o].deferred_yesterday and plan.trip_of_order(o) is not None)
            guard = validate_move(plan, Move(protected, None), pool, ref, vdays)
            found["continuity"] = (Move(protected, None), guard.violations)

            window = next(v.message for v in found["window"][1] if v.rule is RuleId.WINDOW)
            assert re.fullmatch(r"Arrives \d\d:\d\d, after OUT\d+ closes at \d\d:\d\d", window), window
            reefer = found["reefer"][1]
            assert any(re.fullmatch(r"Needs a reefer: VEH\d+ is ambient", v.message) for v in reefer) and len({v.rule for v in reefer}) >= 2
            outlet = pool[protected].outlet_id
            assert [v.message for v in found["continuity"][1]] == [f"{outlet} was deferred yesterday; the continuity guard protects it"]

            with capsys.disabled():
                for kind, (move, violations) in found.items():
                    print(f"\nWALKTHROUGH REFUSAL {kind}: {move.order_id} -> {move.to}: {[v.message for v in violations]}")
        finally:
            db.rollback()


def test_the_planner_plans_the_whole_day_legally_and_defers_about_as_many_as_the_prd(client):
    from app.db import SessionLocal
    from app.services import planning_repo as repo
    from waypoint_rules import DeferralType, check_trip, check_vehicle_day, draft_plan

    with SessionLocal() as db:
        try:
            _generate(db)
            ops = repo.operating_days(db)
            pool = repo.day_orders(db, SERVICE, ops)
            ref = repo.load_ref(db)
            vdays, _ = repo.vehicle_days(db, SERVICE)
            draft = draft_plan(pool, ref, vdays, service_date=SERVICE, operating_days=ops)

            # every order is served once or deferred once, and nothing a trip carries breaks a rule
            served = [o for t in draft.trips for o in t.order_ids]
            deferred = [d.order_id for d in draft.deferrals]
            assert sorted(served + deferred) == sorted(pool) and len(served) == len(set(served))
            plan = draft.as_plan()
            for t in draft.trips:
                assert check_trip(t.to_trip(), pool, ref, vdays.get(t.vehicle_id)) == []
            for vid in {t.vehicle_id for t in draft.trips}:
                assert check_vehicle_day(ref.vehicles[vid], plan.trips_of(vid), pool, ref, vdays.get(vid)) == []

            # §4c: ORD1020 is the one capacity deferral, and Peliyagoda defers about 19 (DP-01: the computed count is shown)
            peliyagoda = [d for d in draft.deferrals if ref.outlets[pool[d.order_id].outlet_id].depot == "peliyagoda"]
            assert [d.order_id for d in peliyagoda if d.type is DeferralType.CAPACITY] == ["ORD1020"]
            assert 10 <= len(peliyagoda) <= 30
            assert not [d for d in draft.deferrals if ref.outlets[pool[d.order_id].outlet_id].depot == "kandy"]
            # the continuity guard still holds on a full day
            assert draft.warnings == ()
            # the three workshop vehicles added for A12 are not used, and neither is VEH036 (back at 02:45)
            used = {t.vehicle_id for t in draft.trips}
            assert not used & {"VEH015", "VEH022", "VEH030", "VEH036"}
        finally:
            db.rollback()
