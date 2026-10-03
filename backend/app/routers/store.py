"""StoreApi routes (PRD §19). Owner: ``feature/order-management`` (orders) and ``feature/store-receipt`` (the rest).

One function per endpoint; don't reorder or reformat other people's functions (Contributing §2).
The reads are in ``services/store_views``, the writes in ``services/store_writes``; a write commits here.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Response

from ..deps import Db, Store
from ..schemas.store import (
    AnswerReceivedIn,
    ConfirmReceiptIn,
    DeliveryOut,
    EditOrderIn,
    IssueOut,
    OrderDraftOut,
    OrderOut,
    PlaceOrdersIn,
    RecentOrderDayOut,
    ReportIssueIn,
    UpdatesFeedOut,
)
from ..services import store_views as views
from ..services import store_writes as writes

router = APIRouter(prefix="/store", tags=["store"])


# ---- orders (feature/order-management) --------------------------------------


@router.get("/order-form", operation_id="getOrderDraft", response_model=OrderDraftOut)
def get_order_draft(db: Db, user: Store, date: date | None = None) -> OrderDraftOut:
    """The S1 form for one day. ``date`` defaults to the day an order placed now counts for."""
    return views.order_draft(db, user, date)


@router.post("/orders", operation_id="placeOrders", response_model=list[OrderOut], status_code=201)
def place_orders(body: PlaceOrdersIn, db: Db, user: Store) -> list[OrderOut]:
    """Chilled and dry together: all are received or none is."""
    out = writes.place(db, user, body)
    db.commit()
    return out


@router.patch("/orders/{order_id}", operation_id="editOrder", response_model=OrderOut)
def edit_order(order_id: str, body: EditOrderIn, db: Db, user: Store) -> OrderOut:
    """Rejects (409) once the order is past cutoff."""
    out = writes.edit(db, user, order_id, body)
    db.commit()
    return out


@router.post("/orders/{order_id}/cancel", operation_id="cancelOrder", status_code=204)
def cancel_order(order_id: str, db: Db, user: Store) -> Response:
    """Rejects (409) once the order is past cutoff."""
    writes.cancel(db, user, order_id)
    db.commit()
    return Response(status_code=204)


# ---- deliveries, receipt, issues, feed (feature/store-receipt) --------------


@router.get("/deliveries", operation_id="listDeliveries", response_model=list[DeliveryOut])
def list_deliveries(
    db: Db,
    user: Store,
    from_: Annotated[date | None, Query(alias="from")] = None,
    to: date | None = None,
) -> list[DeliveryOut]:
    """The outlet's delivery days, earliest first (S2)."""
    return views.deliveries(db, user, from_=from_, to=to)


@router.get("/deliveries/{day}", operation_id="getDeliveryDay", response_model=list[DeliveryOut])
def get_delivery_day(day: date, db: Db, user: Store) -> list[DeliveryOut]:
    """One day's delivery; an empty list when the outlet has no orders for it."""
    return views.deliveries(db, user, from_=None, to=None, on=day)


@router.get("/history", operation_id="listRecent", response_model=list[RecentOrderDayOut])
def list_recent(
    db: Db, user: Store, limit: int = Query(5, ge=1, le=60), before: date | None = None
) -> list[RecentOrderDayOut]:
    """Past delivery days, newest first, Sundays skipped (S1.6, S2.10, S4 History)."""
    return views.recent(db, user, limit, before)


@router.get("/issues", operation_id="listIssues", response_model=list[IssueOut])
def list_issues(db: Db, user: Store) -> list[IssueOut]:
    """The problems the store has reported, open first, newest first (S3.7)."""
    return views.issues(db, user)


@router.post("/deferrals/{deferral_id}/seen", operation_id="acknowledgeDeferral", status_code=204)
def acknowledge_deferral(deferral_id: int, db: Db, user: Store) -> Response:
    """The store tapped Got it (S2.6, S2.9). Dispatch then sees it was read."""
    writes.acknowledge_deferral(db, user, deferral_id)
    db.commit()
    return Response(status_code=204)


@router.post("/reviews/{conflict_id}/answer", operation_id="answerReceivedQuestion", status_code=204)
def answer_received_question(conflict_id: int, body: AnswerReceivedIn, db: Db, user: Store) -> Response:
    """The store's answer to "Did you receive this delivery?" while Dispatch is reviewing (S2.7, S3.5)."""
    writes.answer_received(db, user, conflict_id)
    db.commit()
    return Response(status_code=204)


@router.post("/receipts", operation_id="confirmReceipt", response_model=DeliveryOut, status_code=201)
def confirm_receipt(body: ConfirmReceiptIn, db: Db, user: Store) -> DeliveryOut:
    """Confirms what arrived (S3.1), or records a shortfall (S3.1 B). 409 when nothing has been delivered."""
    out = writes.confirm_receipt(db, user, body)
    db.commit()
    return out


@router.post("/issues", operation_id="reportIssue", response_model=IssueOut, status_code=201)
def report_issue(body: ReportIssueIn, db: Db, user: Store) -> IssueOut:
    """A problem tied to the proof of delivery (S3.3). Dispatch is told at once."""
    out = writes.report_issue(db, user, body)
    db.commit()
    return out


@router.get("/updates", operation_id="getUpdates", response_model=UpdatesFeedOut)
def get_updates(db: Db, user: Store) -> UpdatesFeedOut:
    """The S4 feed, newest first, with the unread count for the bell."""
    return views.updates(db, user)


@router.post("/updates/read-all", operation_id="markAllRead", status_code=204)
def mark_all_read(db: Db, user: Store) -> Response:
    writes.mark_all_read(db, user)
    db.commit()
    return Response(status_code=204)
