"""Full deterministic fallback day with the judge's two pinned hero orders, against PostgreSQL."""

from datetime import datetime

from app.config import COLOMBO
from tests.rules.conftest import ORDERS

from .test_seed_generated import SERVICE, _generate


def test_full_seeded_allocation_results(client, capsys):
    import json

    from app.db import SessionLocal
    from app.models.enums import ServerStatus
    from app.models.orders import Order
    from app.services import planning_repo as repo
    from waypoint_rules import check_plan, draft_plan

    with SessionLocal() as db:
        try:
            # Store placement remains another team's unimplemented API. These are documented
            # PRD fixtures, not competition CSV rows or planner ID special cases.
            for oid in ("ORD2001", "ORD2002"):
                source = ORDERS[oid]
                db.add(Order(id=oid, outlet_id=source.outlet_id, service_date=SERVICE, temp=source.temp,
                             units=source.units, weight_kg=source.weight_kg, volume_m3=source.volume_m3,
                             status=ServerStatus.ORDERED, tags=[], after_cutoff=False, row_version=1,
                             received_at=datetime(2026, 9, 28, 15, 40, tzinfo=COLOMBO), placed_by="seed"))
            db.flush()
            _generate(db)
            ops, ref = repo.operating_days(db), repo.load_ref(db)
            pool = repo.day_orders(db, SERVICE, ops)
            days, _ = repo.vehicle_days(db, SERVICE)
            draft = draft_plan(pool, ref, days, service_date=SERVICE, operating_days=ops)
            assert check_plan(draft.as_plan(), pool, ref, days,
                              deferral_reasons={d.order_id: (d.type, d.reason_text) for d in draft.deferrals}) == []
            placed = {oid: {"vehicle": trip.vehicle_id, "trip": trip.trip_no} for trip in draft.trips for oid in trip.order_ids}
            deferred = {d.order_id: {"type": d.type.value, "binding": d.binding.value if d.binding else None,
                                    "reason": d.reason_text} for d in draft.deferrals}
            assert deferred["ORD1020"]["type"] == "capacity"
            assert "ORD2001" in placed and "ORD2002" in placed
            anchors = {oid: placed.get(oid, deferred.get(oid)) for oid in ("ORD1020", "ORD1009", "ORD1017", "ORD1006", "ORD2001", "ORD2002")}
            count = sum(ref.outlets[pool[d.order_id].outlet_id].depot == "peliyagoda" for d in draft.deferrals)
            with capsys.disabled():
                print("\nFULL SEEDED ALLOCATION " + json.dumps({"anchors": anchors, "peliyagoda_deferrals": count}, sort_keys=True))
        finally:
            db.rollback()
