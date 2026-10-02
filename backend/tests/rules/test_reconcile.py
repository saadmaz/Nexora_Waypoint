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
