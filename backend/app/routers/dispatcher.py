"""DispatcherApi routes (PRD §19). One function per endpoint, grouped by owner branch.

Don't reorder or reformat other people's functions in this file (Contributing §2).
Operation names are the PRD proposal (open decision O-6).
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Query

from waypoint_rules import Move, NoSuchTrip
from waypoint_rules import validate_move as check_move
from waypoint_rules.vocab import Brand, OrderStatus, Temp

from .. import clock
from ..deps import Db, Dispatcher
from ..errors import ApiError, not_found
from ..models.enums import ConflictRecommendation
from ..models.orders import Order as OrderRow
from ..schemas.dispatcher import (
    AcknowledgementsView,
    CapacityView,
    ConflictView,
    ContactIn,
    ContactOut,
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
from ..services import (
    calendar_views,
    conflicts,
    contact,
    forecast,
    live_repo,
    live_views,
    planning,
    queue_repo,
    queue_views,
    stops,
)
from ..services import dispatcher_views as views
from ..services import exceptions as exception_service
from ..services import planning_repo as repo
from ..services.dispatch_model import DispatchDay
from ..services.plan_logic import after_move, plan_of
from ..services.queue_model import QueueFilter

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


def _day(db: Db, *, version: int | None = None) -> tuple[date, DispatchDay]:
    """The run the dispatcher is working on, at plan ``version`` (the latest when omitted)."""
    now = clock.now(db).replace(tzinfo=None)
    service_date = repo.active_service_date(now, repo.operating_days(db))
    day = repo.load_day(db, service_date, now, version=version)
    if version is not None and day.chosen is None:
        raise not_found(f"Plan v{version}")
    return service_date, day


def _live(db: Db):  # noqa: ANN202 - the board's plain-data bundle, private to this module
    """The live picture of the run the dispatcher is working on."""
    now = clock.now(db).replace(tzinfo=None)
    return live_repo.load_live(db, repo.active_service_date(now, repo.operating_days(db)), now)


def _target(request: MoveRequest) -> tuple[str, int] | None:
    """The trip a move names, or ``None`` for the deferred pool."""
    to = request.to
    if to.deferred:
        return None
    if to.vehicle_id is None or to.trip is None:
        raise ApiError(422, "validation_error", "A move needs a vehicle and a trip, or deferred")
    return (to.vehicle_id, to.trip)


def _reason(request: MoveRequest) -> str | None:
    """Why the dispatcher is deferring this order, trimmed; the service requires it for an accepted deferral."""
    if not request.to.deferred:
        return None
    return (request.reason or "").strip() or None


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
    now = clock.now(db).replace(tzinfo=None)
    run = date or repo.active_service_date(now, repo.operating_days(db))
    filters = QueueFilter(
        brand=tuple(brand or ()),
        temp=tuple(temp or ()),
        status=tuple(status or ()),
        window=tuple(window or ()),
        tags=tuple(tags or ()),
        district=tuple(district or ()),
        search=search or "",
    )
    view = queue_views.queue_view(queue_repo.load_queue(db, run, now), depot, filters)
    return view.model_copy(update={"day": calendar_views.service_day_info(db, run)})


@router.get("/orders/{order_id}/history", operation_id="getOrderHistory", response_model=OrderHistory)
def get_order_history(order_id: str, db: Db, user: Dispatcher) -> OrderHistory:
    """D1.5: the order's history drawer, built from its audit events (oldest first)."""
    order = db.get(OrderRow, order_id)
    if order is None:
        raise not_found(f"Order {order_id}")
    now = clock.now(db).replace(tzinfo=None)
    day = queue_repo.load_queue(db, order.service_date, now, only=order_id)
    return queue_views.order_history_view(day, day.rows[0], queue_repo.load_history(db, order_id))


# ---- planning (feature/allocation-engine) -----------------------------------


@router.get("/capacity", operation_id="getCapacity", response_model=CapacityView)
def get_capacity(db: Db, user: Dispatcher, depot: DepotId = DEPOT_Q) -> CapacityView:
    """D2: binding resource, availability and the headline sentence."""
    service_date, day = _day(db)
    return views.capacity_view(day, depot).model_copy(update={"day": calendar_views.service_day_info(db, service_date)})


@router.get("/plan", operation_id="getPlan", response_model=PlanView)
def get_plan(db: Db, user: Dispatcher, depot: DepotId = DEPOT_Q, version: int | None = None) -> PlanView:
    """D3: a plan version with its trips and deferrals. Omit ``version`` for the latest."""
    return views.plan_view(_day(db, version=version)[1], depot)


@router.post("/plan/redraft", operation_id="redraftPlan", response_model=PlanView)
def redraft_plan(db: Db, user: Dispatcher, depot: DepotId = VIEW_DEPOT_Q) -> PlanView:
    """Runs the planner again and saves the next draft."""
    service_date, _ = _day(db)
    planning.draft(db, service_date, actor=user.email, actor_name=user.display_name, note=f"Redrafted by {user.display_name}")
    db.commit()
    return views.plan_view(_day(db)[1], depot)


@router.post("/plan/validate-move", operation_id="validateMove", response_model=MoveResult)
def validate_move(body: MoveRequest, db: Db, user: Dispatcher) -> MoveResult:
    """D3.2 to D3.6: ``ok``, every violation, and a before / after consequence preview."""
    day = _day(db)[1]
    if day.chosen is None:
        raise ApiError(409, "not_ready", "There is no plan yet. The first draft appears at 16:05.")
    if body.order_id not in day.orders:
        raise not_found(f"Order {body.order_id}")
    move = Move(body.order_id, _target(body))
    plan = plan_of(day)
    try:
        result = check_move(plan, move, day.orders, day.ref, day.vehicle_days)
    except NoSuchTrip as e:
        raise ApiError(409, "no_such_trip", str(e.args[0])) from e
    return views.move_result_view(day, move, result, after_move(plan, move, day.orders, result))


@router.post("/plan/moves", operation_id="saveMoves", response_model=PlanView)
def save_moves(body: SaveMovesIn, db: Db, user: Dispatcher, depot: DepotId = VIEW_DEPOT_Q) -> PlanView:
    """Accepted moves write a new draft version."""
    service_date, _ = _day(db)
    planning.save_moves(
        db,
        service_date,
        [(m.order_id, _target(m), _reason(m)) for m in body.moves],
        note=body.note,
        actor=user.email,
        actor_name=user.display_name,
    )
    db.commit()
    return views.plan_view(_day(db)[1], depot)


@router.get("/deferrals", operation_id="listDeferrals", response_model=DeferralsView)
def list_deferrals(db: Db, user: Dispatcher, depot: DepotId = DEPOT_Q) -> DeferralsView:
    """D4: every deferral with its type, binding tag, impact, frees and notice state."""
    return views.deferrals_view(_day(db)[1], depot)


@router.post("/deferrals/notify", operation_id="notifyDeferrals", response_model=NotifyDeferralsOut)
def notify_deferrals(body: NotifyDeferralsIn, db: Db, user: Dispatcher) -> NotifyDeferralsOut:
    """Sends the store notices for every deferral at the depot that has not been told yet."""
    service_date, _ = _day(db)
    sent = planning.notify_deferrals(db, service_date, body.depot, actor=user.email, order_id=body.order_id)
    db.commit()
    return NotifyDeferralsOut(sent=sent)


@router.post("/plan/release", operation_id="releasePlan", response_model=PlanView)
def release_plan(body: ReleasePlanIn, db: Db, user: Dispatcher, depot: DepotId = VIEW_DEPOT_Q) -> PlanView:
    """D5: releasing the current draft creates the released snapshot."""
    service_date, _ = _day(db)
    planning.release(db, service_date, send_notices=body.send_notices, actor=user.email, actor_name=user.display_name)
    db.commit()
    return views.plan_view(_day(db)[1], depot)


@router.get("/acknowledgements", operation_id="listAcknowledgements", response_model=AcknowledgementsView)
def list_acknowledgements(db: Db, user: Dispatcher, version: int | None = None) -> AcknowledgementsView:
    """D5: who has acknowledged a plan version, and who is pending."""
    return views.acknowledgements_view(_day(db, version=version)[1])


@router.get("/forecast", operation_id="getForecast", response_model=ForecastView)
def get_forecast(db: Db, user: Dispatcher, depot: DepotId = DEPOT_Q) -> ForecastView:
    """D9: the baseline capacity outlook (feature/analytics)."""
    return forecast.load_forecast(db, depot, clock.now(db).replace(tzinfo=None))


# ---- live operations, conflicts, exceptions (feature/offline-sync) ----------


@router.get("/live", operation_id="getLiveBoard", response_model=LiveBoardView)
def get_live_board(db: Db, user: Dispatcher, depot: LiveDepotQ = "both", show_all: ShowAllQ = False) -> LiveBoardView:
    """D6: one row per vehicle trip with lateness risk and last heard."""
    return live_views.live_board_view(_live(db), depot, show_all=show_all)


@router.post("/stops/defer", operation_id="deferStop", response_model=DeferStopResult)
def defer_stop(body: DeferStopIn, db: Db, user: Dispatcher) -> DeferStopResult:
    """D6: defer stops after release. Creates and releases the next plan version at once."""
    plan_no, deferred = stops.defer_stop(db, body.order_ids, body.kind, body.reason, actor=user.email, actor_name=user.display_name)
    db.commit()
    return DeferStopResult(plan=plan_no, deferred=deferred)


@router.get("/inbox", operation_id="getInbox", response_model=InboxView)
def get_inbox(db: Db, user: Dispatcher) -> InboxView:
    """Open conflicts, exceptions and dispatch notices."""
    return live_views.inbox_view(_live(db))


@router.get("/conflicts/{conflict_id}", operation_id="getConflict", response_model=ConflictView)
def get_conflict(conflict_id: int, db: Db, user: Dispatcher) -> ConflictView:
    """D7: both records, the recommendation and its reasons."""
    return conflicts.review(db, conflict_id)


@router.post("/conflicts/{conflict_id}/ask-store", operation_id="askStore", response_model=ConflictView)
def ask_store(conflict_id: int, db: Db, user: Dispatcher) -> ConflictView:
    """D7: asks the store "Did you receive this delivery?" (status ``awaiting_store``)."""
    view = conflicts.ask_store(db, conflict_id, actor=user.email)
    db.commit()
    return view


@router.post("/conflicts/{conflict_id}/resolve", operation_id="resolveConflict", response_model=ConflictView)
def resolve_conflict(conflict_id: int, body: ResolveConflictIn, db: Db, user: Dispatcher) -> ConflictView:
    """D7.4: writes the decision and posts notices to driver, store and dock."""
    view = conflicts.resolve(db, conflict_id, ConflictRecommendation(body.resolution), actor=user.email, actor_name=user.display_name)
    db.commit()
    return view


@router.get("/exceptions/{exception_id}", operation_id="getExceptionForReview", response_model=ExceptionView)
def get_exception_for_review(exception_id: int, db: Db, user: Dispatcher) -> ExceptionView:
    """D8: a loader flag or driver problem, with the recommended swap."""
    return exception_service.review(db, exception_id)


@router.post("/exceptions/{exception_id}/decide", operation_id="decideException", response_model=ExceptionView)
def decide_exception(exception_id: int, body: DecideExceptionIn, db: Db, user: Dispatcher) -> ExceptionView:
    """D8: swap the vehicle and defer orders. Creates and releases the next plan version."""
    view = exception_service.decide(db, exception_id, body.defer_order_ids, actor=user.email, actor_name=user.display_name)
    db.commit()
    return view


# ---- contact (fix/dead-buttons) ----------------------------------------------


@router.post("/contact", operation_id="contact", response_model=ContactOut)
def contact_someone(body: ContactIn, db: Db, user: Dispatcher) -> ContactOut:
    """D5, D7 "Call": a call-back request in the store's updates, the driver's notifications or on the dock."""
    out = contact.send(db, body, actor_name=user.display_name)
    db.commit()
    return out
