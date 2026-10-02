"""DispatcherApi routes (PRD §19). One function per endpoint, grouped by owner branch.

Don't reorder or reformat other people's functions in this file (Contributing §2).
Each body raises 501 until its branch builds it. Operation names are the PRD proposal (open decision O-6).
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Query

from waypoint_rules.vocab import Brand, OrderStatus, Temp

from ..deps import Db, Dispatcher
from ..errors import not_implemented
from ..schemas.dispatcher import (
    AcknowledgementsView,
    CapacityView,
    ConflictView,
    DecideExceptionIn,
    DeferralsView,
    DeferStopIn,
    DeferStopResult,
    DepotId,
    ExceptionView,
    ForecastView,
    InboxView,
    LiveBoardView,
    MoveRequest,
    MoveResult,
    NotifyDeferralsIn,
    NotifyDeferralsOut,
    OrderHistory,
    PlanView,
    QueueView,
    ReleasePlanIn,
    ResolveConflictIn,
    SaveMovesIn,
)

router = APIRouter(prefix="/dispatcher", tags=["dispatcher"])

DEPOT_Q = Query(..., description="peliyagoda or kandy")
#: Plan routes act on the whole service day; this picks which depot's view comes back.
VIEW_DEPOT_Q = Query("peliyagoda", description="The depot whose view is returned")

#: Repeated query parameters, one value per filter chosen (``?brand=Fresh&brand=Style``).
BrandsQ = Annotated[list[Brand] | None, Query()]
TempsQ = Annotated[list[Temp] | None, Query()]
StatusesQ = Annotated[list[OrderStatus] | None, Query()]
WindowsQ = Annotated[
    list[Literal["early", "mid", "late"]] | None,
    Query(description="early before 05:00, mid 05:00 to 06:00, late after"),
]
TagsQ = Annotated[list[str] | None, Query()]
DistrictsQ = Annotated[list[str] | None, Query()]
LiveDepotQ = Annotated[Literal["peliyagoda", "kandy", "both"], Query(description="peliyagoda, kandy or both")]
ShowAllQ = Annotated[bool, Query(alias="all", description="Include vehicles that need no attention")]


# ---- queue and history (feature/order-management) ---------------------------


@router.get("/queue", operation_id="getQueue", response_model=QueueView)
def get_queue(
    db: Db,
    user: Dispatcher,
    depot: DepotId = DEPOT_Q,
    date: date | None = None,
    brand: BrandsQ = None,
    temp: TempsQ = None,
    status: StatusesQ = None,
    window: WindowsQ = None,
    tags: TagsQ = None,
    district: DistrictsQ = None,
    search: str | None = None,
) -> QueueView:
    """D1: the order queue for a depot and service date, grouped, with the filters and search applied."""
    raise not_implemented("getQueue")


@router.get("/orders/{order_id}/history", operation_id="getOrderHistory", response_model=OrderHistory)
def get_order_history(order_id: str, db: Db, user: Dispatcher) -> OrderHistory:
    """D1.5: the order's history drawer, built from its audit events (oldest first)."""
    raise not_implemented("getOrderHistory")


# ---- planning (feature/allocation-engine) -----------------------------------


@router.get("/capacity", operation_id="getCapacity", response_model=CapacityView)
def get_capacity(db: Db, user: Dispatcher, depot: DepotId = DEPOT_Q) -> CapacityView:
    """D2: binding resource, availability and the headline sentence."""
    raise not_implemented("getCapacity")


@router.get("/plan", operation_id="getPlan", response_model=PlanView)
def get_plan(db: Db, user: Dispatcher, depot: DepotId = DEPOT_Q, version: int | None = None) -> PlanView:
    """D3: a plan version with its trips and deferrals. Omit ``version`` for the latest."""
    raise not_implemented("getPlan")


@router.post("/plan/redraft", operation_id="redraftPlan", response_model=PlanView)
def redraft_plan(db: Db, user: Dispatcher, depot: DepotId = VIEW_DEPOT_Q) -> PlanView:
    """Runs the planner again and saves the next draft."""
    raise not_implemented("redraftPlan")


@router.post("/plan/validate-move", operation_id="validateMove", response_model=MoveResult)
def validate_move(body: MoveRequest, db: Db, user: Dispatcher) -> MoveResult:
    """D3.2 to D3.6: ``ok``, every violation, and a before / after consequence preview."""
    raise not_implemented("validateMove")


@router.post("/plan/moves", operation_id="saveMoves", response_model=PlanView)
def save_moves(body: SaveMovesIn, db: Db, user: Dispatcher, depot: DepotId = VIEW_DEPOT_Q) -> PlanView:
    """Accepted moves write a new draft version."""
    raise not_implemented("saveMoves")


@router.get("/deferrals", operation_id="listDeferrals", response_model=DeferralsView)
def list_deferrals(db: Db, user: Dispatcher, depot: DepotId = DEPOT_Q) -> DeferralsView:
    """D4: every deferral with its type, binding tag, impact, frees and notice state."""
    raise not_implemented("listDeferrals")


@router.post("/deferrals/notify", operation_id="notifyDeferrals", response_model=NotifyDeferralsOut)
def notify_deferrals(body: NotifyDeferralsIn, db: Db, user: Dispatcher) -> NotifyDeferralsOut:
    """Sends the store notices for every deferral at the depot that has not been told yet."""
    raise not_implemented("notifyDeferrals")


@router.post("/plan/release", operation_id="releasePlan", response_model=PlanView)
def release_plan(body: ReleasePlanIn, db: Db, user: Dispatcher, depot: DepotId = VIEW_DEPOT_Q) -> PlanView:
    """D5: releasing the current draft creates the released snapshot."""
    raise not_implemented("releasePlan")


@router.get("/acknowledgements", operation_id="listAcknowledgements", response_model=AcknowledgementsView)
def list_acknowledgements(db: Db, user: Dispatcher, version: int | None = None) -> AcknowledgementsView:
    """D5: who has acknowledged a plan version, and who is pending."""
    raise not_implemented("listAcknowledgements")


@router.get("/forecast", operation_id="getForecast", response_model=ForecastView)
def get_forecast(db: Db, user: Dispatcher, depot: DepotId = DEPOT_Q) -> ForecastView:
    """D9: the baseline capacity outlook (feature/analytics)."""
    raise not_implemented("getForecast")


# ---- live operations, conflicts, exceptions (feature/offline-sync) ----------


@router.get("/live", operation_id="getLiveBoard", response_model=LiveBoardView)
def get_live_board(db: Db, user: Dispatcher, depot: LiveDepotQ = "both", show_all: ShowAllQ = False) -> LiveBoardView:
    """D6: one row per vehicle trip with lateness risk and last heard."""
    raise not_implemented("getLiveBoard")


@router.post("/stops/defer", operation_id="deferStop", response_model=DeferStopResult)
def defer_stop(body: DeferStopIn, db: Db, user: Dispatcher) -> DeferStopResult:
    """D6: defer stops after release. Creates and releases the next plan version at once."""
    raise not_implemented("deferStop")


@router.get("/inbox", operation_id="getInbox", response_model=InboxView)
def get_inbox(db: Db, user: Dispatcher) -> InboxView:
    """Open conflicts, exceptions and dispatch notices."""
    raise not_implemented("getInbox")


@router.get("/conflicts/{conflict_id}", operation_id="getConflict", response_model=ConflictView)
def get_conflict(conflict_id: int, db: Db, user: Dispatcher) -> ConflictView:
    """D7: both records, the recommendation and its reasons."""
    raise not_implemented("getConflict")


@router.post("/conflicts/{conflict_id}/ask-store", operation_id="askStore", response_model=ConflictView)
def ask_store(conflict_id: int, db: Db, user: Dispatcher) -> ConflictView:
    """D7: asks the store "Did you receive this delivery?" (status ``awaiting_store``)."""
    raise not_implemented("askStore")


@router.post("/conflicts/{conflict_id}/resolve", operation_id="resolveConflict", response_model=ConflictView)
def resolve_conflict(conflict_id: int, body: ResolveConflictIn, db: Db, user: Dispatcher) -> ConflictView:
    """D7.4: writes the decision and posts notices to driver, store and dock."""
    raise not_implemented("resolveConflict")


@router.get("/exceptions/{exception_id}", operation_id="getExceptionForReview", response_model=ExceptionView)
def get_exception_for_review(exception_id: int, db: Db, user: Dispatcher) -> ExceptionView:
    """D8: a loader flag or driver problem, with the recommended swap."""
    raise not_implemented("getExceptionForReview")


@router.post("/exceptions/{exception_id}/decide", operation_id="decideException", response_model=ExceptionView)
def decide_exception(exception_id: int, body: DecideExceptionIn, db: Db, user: Dispatcher) -> ExceptionView:
    """D8: swap the vehicle and defer orders. Creates and releases the next plan version."""
    raise not_implemented("decideException")
