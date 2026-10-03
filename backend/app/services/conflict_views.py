"""D7, reconciliation: two true records for one stop (PRD v3 §3 D7, §19 handoff 7), built from plain data.

The system recommends, a person confirms. ``/sync`` writes a ``conflicts`` row when a device record disagrees with the
server, and this module shows it. What ``/sync`` must put in the two snapshots (everything is optional; the screen
degrades to what it has):

``device_snapshot``
    ``vehicleId``, ``outcome`` ("delivered"), ``deviceTime`` (ISO), ``receivedBy``, ``units`` ("12 + 8"), ``photo`` (bool),
    ``planVersionOnDevice``, ``arrivedAt``, ``offlineSince``, ``syncedAt`` (all ISO times).
``server_snapshot``
    ``status`` ("deferred"), ``planVersion``, ``type`` ("store_request"), ``decidedAt`` (ISO), ``decidedBy``, ``reason``,
    ``reachedDriver`` (bool). The dispatcher's "ask the store" adds ``askedAt``; the store's answer adds ``storeReport``:
    ``{"orderId", "unitsReceived", "unitsOrdered", "by", "at"}``.

The wording follows ``frontend/src/screens/dispatcher/mock/conflict.ts``.
"""

from __future__ import annotations

from datetime import datetime

from waypoint_rules import reconcile_store_answer
from waypoint_rules.vocab import DeferralType

from ..config import COLOMBO
from ..models.enums import ConflictRecommendation, ConflictStatus
from ..schemas import dispatcher as s
from .dispatcher_views import day_label, hm
from .live_model import ConflictRow, LiveDay


def _naive_colombo(value: object) -> datetime | None:
    """An ISO time from a snapshot as naive Asia/Colombo, which is how the screens speak."""
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed
    return parsed.astimezone(COLOMBO).replace(tzinfo=None)


def store_report(c: ConflictRow) -> dict[str, object] | None:
    report = c.server_snapshot.get("storeReport")
    return report if isinstance(report, dict) else None


def short_units(c: ConflictRow) -> tuple[str | None, int, int]:
    """(order, units received, units ordered) from the store's answer, or ``(None, 0, 0)`` without one."""
    report = store_report(c)
    if report is None:
        return None, 0, 0
    return (
        str(report.get("orderId") or (c.order_ids[0] if c.order_ids else "")) or None,
        int(report.get("unitsReceived") or 0),  # type: ignore[call-overload]
        int(report.get("unitsOrdered") or 0),  # type: ignore[call-overload]
    )


def effective_recommendation(c: ConflictRow) -> tuple[ConflictRecommendation, list[str]]:
    """The recommendation as the screen shows it now: the store's answer, if it came, can turn it into a partial."""
    _, received, ordered = short_units(c)
    if store_report(c) is not None and ordered:
        rec, reasons = reconcile_store_answer(list(c.reasons), units_ordered=ordered, units_received=received)
        return ConflictRecommendation(rec.value), reasons
    return ConflictRecommendation(c.recommendation.value), list(c.reasons)


def _state(c: ConflictRow) -> str:
    if c.status is ConflictStatus.RESOLVED:
        return "resolved"
    if c.status is ConflictStatus.AWAITING_STORE:
        return "store reported an issue" if store_report(c) is not None else "awaiting store"
    return "needs decision"


def conflict_view(live: LiveDay, c: ConflictRow) -> s.ConflictView:
    day = live.day
    dev, srv = c.device_snapshot, c.server_snapshot
    first = day.orders[c.order_ids[0]]
    outlet = day.outlets[first.outlet_id]
    vehicle = str(dev.get("vehicleId") or "")
    driver = day.drivers.get(vehicle, "")
    deferral = next((d for d in day.deferrals if d.order_id in c.order_ids), None)
    next_run = deferral.next_run_date if deferral else None
    label = day_label(next_run) if next_run else "the next run"
    wd = f"{next_run:%a}" if next_run else ""

    device_time = _naive_colombo(dev.get("deviceTime"))
    decided_at = _naive_colombo(srv.get("decidedAt")) or (deferral.decided_at if deferral else None)
    offline_since = _naive_colombo(dev.get("offlineSince"))
    arrived = _naive_colombo(dev.get("arrivedAt"))
    synced = _naive_colombo(dev.get("syncedAt"))
    plan_no = srv.get("planVersion") or (day.latest.number if day.latest else "")
    kind = str(srv.get("type") or (deferral.type.value if deferral else DeferralType.STORE_REQUEST.value)).replace("_", " ")
    reason = str(srv.get("reason") or (deferral.reason_text if deferral else ""))
    decided_by = str(srv.get("decidedBy") or (deferral.decided_by.split(" · ")[0] if deferral and deferral.decided_by else "Kumari"))
    outcome_word = str(dev.get("outcome") or "delivered").capitalize()
    units = str(dev.get("units") or " + ".join(str(day.orders[o].units) for o in c.order_ids))
    receiver = str(dev.get("receivedBy") or "the store")

    timeline: list[tuple[datetime, s.TimelineEntry]] = []
    if offline_since:
        timeline.append((offline_since, s.TimelineEntry(time=hm(offline_since), title="Driver offline", detail=f"No signal from {vehicle}'s phone", kind="offline")))
    if decided_at:
        timeline.append((decided_at, s.TimelineEntry(time=hm(decided_at), title=f"Dispatch deferred · v{plan_no}", detail=reason or kind.capitalize(), kind="deferred")))
    if arrived:
        opens = day.ref.outlets[first.outlet_id].window_open
        waiting = arrived.time() < opens
        timeline.append((arrived, s.TimelineEntry(time=hm(arrived), title="Arrived · waiting" if waiting else "Arrived", detail=f"Window opens {opens:%H:%M}" if waiting else "At the stop", kind="arrived")))
    if device_time:
        timeline.append((device_time, s.TimelineEntry(time=hm(device_time), title=outcome_word, detail=f"{units} units · {receiver}", kind="delivered")))
    if synced:
        timeline.append((synced, s.TimelineEntry(time=hm(synced), title="Synced", detail="Records disagree → conflict", kind="synced")))
    timeline.sort(key=lambda x: x[0])

    asked_at = _naive_colombo(srv.get("askedAt"))
    report = store_report(c)
    rec_choice, reasons = effective_recommendation(c)
    _, received, ordered = short_units(c)
    short = max(0, ordered - received)
    partial = rec_choice is ConflictRecommendation.KEEP_PARTIAL
    title = {
        ConflictRecommendation.KEEP_DELIVERY: "Recommended: Keep delivery",
        ConflictRecommendation.KEEP_PARTIAL: f"Recommended: Keep delivery as Partial ({received} / {ordered})",
        ConflictRecommendation.KEEP_DEFERRAL: "Recommended: Keep the deferral",
    }[rec_choice]
    outcome = {
        ConflictRecommendation.KEEP_DELIVERY: f"Status becomes Delivered · tag Deferral withdrawn · {wd} re-run removed · both records kept in the audit",
        ConflictRecommendation.KEEP_PARTIAL: f"Status becomes Partial · follow-up created for {short} units · {wd} re-run removed · all three records kept",
        ConflictRecommendation.KEEP_DEFERRAL: "Status stays Deferred · the goods go back with the truck · both records kept in the audit",
    }[rec_choice]
    recommendation = s.ConflictRecommendationView(
        choice=rec_choice,
        title=title,
        reasons=reasons,
        outcome=outcome,
        chip="Partial" if partial else None,
        paused_note="Paused until the store answers" if c.status is ConflictStatus.AWAITING_STORE and report is None else None,
    )

    view = s.ConflictView(
        id=str(c.id),
        outlet_id=outlet.id,
        outlet_name=outlet.name,
        district=outlet.district,
        orders=[s.ConflictOrder(id=o, temp=day.orders[o].temp, units=day.orders[o].units) for o in c.order_ids],
        state=_state(c),  # type: ignore[arg-type]
        outcome=("Delivered" if c.resolution == "keep_delivery" else "Partial" if c.resolution == "keep_partial" else None),
        timeline=[e for _, e in timeline],
        driver_record=s.DriverRecord(
            heading=f"Driver record · {vehicle} · {driver}".rstrip(" ·"),
            status=f"{outcome_word} {hm(device_time)}" if device_time else outcome_word,
            received_by=receiver,
            units=units,
            device_time=hm(device_time) if device_time else "",
            photo=f"POD photo {hm(device_time)}" if dev.get("photo") and device_time else "No photo",
        ),
        dispatch_record=s.DispatchRecord(
            heading=f"Dispatch record · {decided_by}",
            status=f"Deferred · {kind}" + (f" → {wd}" if wd else ""),
            decided=f"{hm(decided_at)} · plan v{plan_no}" if decided_at else f"plan v{plan_no}",
            reason=reason,
            reached=("Yes" if srv.get("reachedDriver") else f"No: offline since {hm(offline_since)}" if offline_since else "No"),
        ),
        recommendation=recommendation,
    )
    if asked_at:
        view.asked = s.AskedStore(
            at=hm(asked_at),
            minutes=max(0, round((day.now - asked_at).total_seconds() / 60)),
            text=f"Asked {outlet.id} at {hm(asked_at)}: 'Did you receive this delivery?'",
        )
    if report is not None:
        at = _naive_colombo(report.get("at"))
        view.store_report = s.StoreReport(
            heading=f"Store report · {report.get('by') or 'the store'}",
            tags=["Issue", "Short"] if short else ["Confirmed"],
            text=f"{short_units(c)[0]} · {received} of {ordered} units",
            at=hm(at) if at else "",
        )
    if c.status is ConflictStatus.RESOLVED and c.resolved_at is not None:
        t = hm(c.resolved_at)
        by = c.resolved_by or "Kumari"
        kept_partial = c.resolution == "keep_partial"
        kept_deferral = c.resolution == "keep_deferral"
        who = [
            s.WhoKnows(who=driver or vehicle or "Driver", what=f"Route notice '{outlet.id}: resolved: {'kept as partial' if kept_partial else 'deferred' if kept_deferral else 'delivered'}' · {t}"),
            s.WhoKnows(
                who=outlet.name if outlet.name != outlet.id else "Store",
                what=(
                    f"Deliveries updated: Partial ({received} / {ordered}) · follow-up created for {short} units · {t}" if kept_partial
                    else f"Deliveries updated: Deferred to {label} · {t}" if kept_deferral
                    else f"Deliveries updated: Delivered {hm(device_time) if device_time else ''} + Deferral withdrawn · {t}"
                ),
            ),
        ]
        if not kept_deferral:
            who.append(s.WhoKnows(who=f"{outlet.district} dock", what=f"{wd} re-run removed from tomorrow's queue · {t}"))
        view.resolved = s.ConflictResolved(
            by=by,
            at=t,
            title=(
                f"Resolved by {by} {t}, kept as Partial ({received} / {ordered})." if kept_partial
                else f"Resolved by {by} {t}, kept the deferral." if kept_deferral
                else f"Resolved by {by} {t}, kept delivery."
            ),
            text=(
                f"Follow-up created for {short} units. Both records and this decision are kept. {label} re-run removed." if kept_partial
                else "Both records and this decision are kept. The goods go back with the truck." if kept_deferral
                else f"Both records and this decision are kept. {label} re-run removed."
            ),
            who_knows=who,
            toast="Conflict resolved. Driver and store told.",
        )
    return view
