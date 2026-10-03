"""Sync reconciliation: the H11 to H16 replay at rule level (PRD §17)."""

from waypoint_rules import (
    DeviceRecord,
    OrderStatus,
    Outcome,
    Recommendation,
    RecordType,
    ServerOrderState,
    SyncResult,
    reconcile,
    reconcile_store_answer,
)


def test_outcome_after_unseen_deferral_is_a_conflict_with_keep_delivery():
    state = ServerOrderState("ORD2001", OrderStatus.DEFERRED, changed_in_version=5)
    rec = DeviceRecord(RecordType.DRIVER_OUTCOME, 4, Outcome.DELIVERED, has_photo=True, has_receiver=True)
    r = reconcile(state, rec)
    assert r.result is SyncResult.CONFLICT
    assert r.new_status is OrderStatus.CONFLICT
    assert r.recommendation is Recommendation.KEEP_DELIVERY
    assert r.reasons[0] == "The goods are at the store, with photo, receiver and units"


def test_facts_are_always_accepted():
    for t in (RecordType.DRIVER_ARRIVAL, RecordType.LOADER_CHECK, RecordType.DRIVER_PROBLEM):
        assert reconcile(None, DeviceRecord(t, 1)).result is SyncResult.ACCEPTED


def test_outcome_on_current_plan_applies():
    state = ServerOrderState("ORD2003", OrderStatus.DEPARTED, changed_in_version=3)
    ok = reconcile(state, DeviceRecord(RecordType.DRIVER_OUTCOME, 4, Outcome.DELIVERED, True, True))
    assert (ok.result, ok.new_status) == (SyncResult.ACCEPTED, OrderStatus.DELIVERED)
    refused = reconcile(state, DeviceRecord(RecordType.DRIVER_OUTCOME, 4, Outcome.REFUSED))
    assert (refused.new_status, refused.tag) == (OrderStatus.ISSUE, "Refused")


def test_loader_ack_of_an_old_version_conflicts():
    r = reconcile(None, DeviceRecord(RecordType.LOADER_ACK, 3), current_version=4)
    assert r.result is SyncResult.CONFLICT
    assert reconcile(None, DeviceRecord(RecordType.LOADER_ACK, 4), current_version=4).result is SyncResult.ACCEPTED


STORE_REASONS = [
    "The goods are at the store, with photo, receiver and units",
    "The deferral never reached the driver: the phone was on v4, the deferral is in v5",
    "Reversing means a return trip for goods already received",
]


def test_a_store_that_received_everything_keeps_the_delivery():
    rec, reasons = reconcile_store_answer(STORE_REASONS, units_ordered=12, units_received=12)
    assert rec is Recommendation.KEEP_DELIVERY and reasons == STORE_REASONS


def test_a_store_that_received_fewer_units_turns_it_into_a_partial():
    rec, reasons = reconcile_store_answer(STORE_REASONS, units_ordered=12, units_received=10)
    assert rec is Recommendation.KEEP_PARTIAL
    assert reasons[-1] == "The store confirms goods arrived, 2 units short: Partial matches the evidence"
    assert not any(r.startswith("Reversing") for r in reasons) and len(reasons) == 3
