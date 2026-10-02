"""DispatcherApi routes (PRD §19). One function per endpoint, grouped by owner branch.

Don't reorder or reformat other people's functions in this file (Contributing §2).
Each body raises 501 until its branch builds it. Operation names are the PRD proposal (open decision O-6).
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Query

from ..deps import Db, Dispatcher
from ..errors import not_implemented
from ..schemas.dispatcher import (
    AcknowledgementOut,
    CapacityOut,
    ConflictOut,
    DecideExceptionIn,
    DeferralOut,
    DeferralsOut,
    DeferStopIn,
    ExceptionOut,
    ForecastOut,
    HistoryEventOut,
    InboxOut,
    LiveBoardOut,
    MoveIn,
    MoveResultOut,
    NotifyDeferralsIn,
    NotifyDeferralsOut,
    PlanOut,
    QueueOut,
    ReleasePlanIn,
    ResolveConflictIn,
    SaveMovesIn,
)

router = APIRouter(prefix="/dispatcher", tags=["dispatcher"])

DEPOT_Q = Query(..., description="peliyagoda or kandy")


# ---- queue and history (feature/order-management) ---------------------------


@router.get("/queue", operation_id="getQueue", response_model=QueueOut)
def get_queue(db: Db, user: Dispatcher, depot: str = DEPOT_Q, date: date | None = None) -> QueueOut:
    """D1: the order queue for a depot and service date."""
    raise not_implemented("getQueue")


@router.get("/orders/{order_id}/history", operation_id="getOrderHistory", response_model=list[HistoryEventOut])
def get_order_history(order_id: str, db: Db, user: Dispatcher) -> list[HistoryEventOut]:
    """D1.5: the order's audit events, oldest first."""
    raise not_implemented("getOrderHistory")


# ---- planning (feature/allocation-engine) -----------------------------------


@router.get("/capacity", operation_id="getCapacity", response_model=CapacityOut)
def get_capacity(db: Db, user: Dispatcher, depot: str = DEPOT_Q) -> CapacityOut:
    """D2: binding resource, availability and the headline sentence."""
    raise not_implemented("getCapacity")


@router.get("/plan", operation_id="getPlan", response_model=PlanOut)
def get_plan(db: Db, user: Dispatcher, version: int | None = None) -> PlanOut:
    """D3: a plan version with its trips and deferrals. Omit ``version`` for the latest."""
    raise not_implemented("getPlan")


@router.post("/plan/redraft", operation_id="redraftPlan", response_model=PlanOut)
def redraft_plan(db: Db, user: Dispatcher) -> PlanOut:
    """Runs the planner again and saves the next draft."""
    raise not_implemented("redraftPlan")


@router.post("/plan/validate-move", operation_id="validateMove", response_model=MoveResultOut)
def validate_move(body: MoveIn, db: Db, user: Dispatcher) -> MoveResultOut:
    """D3.2 to D3.6: ``ok``, every violation, and a before / after consequence preview."""
    raise not_implemented("validateMove")


@router.post("/plan/moves", operation_id="saveMoves", response_model=PlanOut)
def save_moves(body: SaveMovesIn, db: Db, user: Dispatcher) -> PlanOut:
    """Accepted moves write a new draft version."""
    raise not_implemented("saveMoves")


@router.get("/deferrals", operation_id="listDeferrals", response_model=DeferralsOut)
def list_deferrals(db: Db, user: Dispatcher, depot: str = DEPOT_Q) -> DeferralsOut:
    """D4: every deferral with its type, binding tag, impact, frees and notice state."""
    raise not_implemented("listDeferrals")


@router.post("/deferrals/notify", operation_id="notifyDeferrals", response_model=NotifyDeferralsOut)
def notify_deferrals(body: NotifyDeferralsIn, db: Db, user: Dispatcher) -> NotifyDeferralsOut:
    """Sends the store notices for the chosen deferrals."""
    raise not_implemented("notifyDeferrals")


@router.post("/plan/release", operation_id="releasePlan", response_model=PlanOut)
def release_plan(body: ReleasePlanIn, db: Db, user: Dispatcher) -> PlanOut:
    """D5: releasing the current draft creates the released snapshot."""
    raise not_implemented("releasePlan")


@router.get("/acknowledgements", operation_id="listAcknowledgements", response_model=list[AcknowledgementOut])
def list_acknowledgements(db: Db, user: Dispatcher, version: int | None = None) -> list[AcknowledgementOut]:
    """D5: who has acknowledged a plan version, and who is pending."""
    raise not_implemented("listAcknowledgements")


@router.get("/forecast", operation_id="getForecast", response_model=ForecastOut)
def get_forecast(db: Db, user: Dispatcher) -> ForecastOut:
    """D9: the baseline capacity outlook (feature/analytics)."""
    raise not_implemented("getForecast")


# ---- live operations, conflicts, exceptions (feature/offline-sync) ----------


@router.get("/live", operation_id="getLiveBoard", response_model=LiveBoardOut)
def get_live_board(db: Db, user: Dispatcher, depot: str = DEPOT_Q) -> LiveBoardOut:
    """D6: one row per vehicle trip with lateness risk and last heard."""
    raise not_implemented("getLiveBoard")


@router.post("/stops/defer", operation_id="deferStop", response_model=list[DeferralOut])
def defer_stop(body: DeferStopIn, db: Db, user: Dispatcher) -> list[DeferralOut]:
    """D6: defer stops after release. Creates and releases the next plan version at once."""
    raise not_implemented("deferStop")


@router.get("/inbox", operation_id="getInbox", response_model=InboxOut)
def get_inbox(db: Db, user: Dispatcher) -> InboxOut:
    """Open conflicts, exceptions and dispatch notices."""
    raise not_implemented("getInbox")


@router.get("/conflicts/{conflict_id}", operation_id="getConflict", response_model=ConflictOut)
def get_conflict(conflict_id: int, db: Db, user: Dispatcher) -> ConflictOut:
    """D7: both records, the recommendation and its reasons."""
    raise not_implemented("getConflict")


@router.post("/conflicts/{conflict_id}/ask-store", operation_id="askStore", response_model=ConflictOut)
def ask_store(conflict_id: int, db: Db, user: Dispatcher) -> ConflictOut:
    """D7: asks the store "Did you receive this delivery?" (status ``awaiting_store``)."""
    raise not_implemented("askStore")


@router.post("/conflicts/{conflict_id}/resolve", operation_id="resolveConflict", response_model=ConflictOut)
def resolve_conflict(conflict_id: int, body: ResolveConflictIn, db: Db, user: Dispatcher) -> ConflictOut:
    """D7.4: writes the decision and posts notices to driver, store and dock."""
    raise not_implemented("resolveConflict")


@router.get("/exceptions/{exception_id}", operation_id="getExceptionForReview", response_model=ExceptionOut)
def get_exception_for_review(exception_id: int, db: Db, user: Dispatcher) -> ExceptionOut:
    """D8: a loader flag or driver problem, with the recommended swap."""
    raise not_implemented("getExceptionForReview")


@router.post("/exceptions/{exception_id}/decide", operation_id="decideException", response_model=ExceptionOut)
def decide_exception(exception_id: int, body: DecideExceptionIn, db: Db, user: Dispatcher) -> ExceptionOut:
    """D8: swap the vehicle, defer orders, or proceed. Creates and releases the next plan version."""
    raise not_implemented("decideException")
