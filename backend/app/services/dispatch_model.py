"""Plain data the dispatcher screens are built from.

The repository (``planning_repo``) fills a :class:`DispatchDay` from the database; the view builders
(``dispatcher_views``) turn it into the screens' view models. Nothing in this module touches the database or
FastAPI, so every view can be built and tested from plain values.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime

from waypoint_rules import Order, RefData, VehicleDay
from waypoint_rules.vocab import Binding, Brand, DeferralType, DockType

from ..models.enums import ActorKind, PlanState


@dataclass(frozen=True, slots=True)
class OutletRow:
    id: str
    name: str
    brand: Brand
    district: str
    depot: str
    dock_type: DockType
    van_only: bool
    mall_dock: bool


@dataclass(frozen=True, slots=True)
class VersionRow:
    id: int
    number: int
    state: PlanState
    note: str | None
    created_by: str | None
    created_at: datetime
    released_at: datetime | None


@dataclass(frozen=True, slots=True)
class TripRow:
    vehicle_id: str
    trip_no: int
    brand: Brand
    district: str
    #: Naive Asia/Colombo, as the rules expect.
    depart_at: datetime
    #: The stop sequence (seq 1..n).
    order_ids: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class DeferralRow:
    id: int
    order_id: str
    type: DeferralType
    binding: Binding | None
    reason_text: str
    impact: dict[str, object]
    frees: dict[str, object]
    next_run_date: date | None
    decided_by: str | None
    decided_at: datetime | None
    notice_sent_at: datetime | None
    notice_seen_at: datetime | None


@dataclass(frozen=True, slots=True)
class AckRow:
    actor_kind: ActorKind
    dock: str | None
    vehicle_id: str | None
    acknowledged_at: datetime


@dataclass(frozen=True, slots=True)
class VehicleAvailability:
    """A vehicle's standing for the day: in the workshop until a time, or replaced by another."""

    in_workshop: bool = False
    available_from: datetime | None = None
    replaced_by: str | None = None


@dataclass(slots=True)
class DispatchDay:
    """Everything the dispatcher views need for one service date and one plan version."""

    service_date: date
    #: Scenario time, naive Asia/Colombo.
    now: datetime
    ref: RefData
    #: Every order of the day that is not cancelled, with the continuity inputs applied.
    orders: dict[str, Order]
    outlets: dict[str, OutletRow]
    #: Orders the plan answers for: Confirmed, Planned or Deferred (not still Ordered, not on the road).
    plannable: set[str] = field(default_factory=set)
    versions: list[VersionRow] = field(default_factory=list)
    chosen: VersionRow | None = None
    trips: list[TripRow] = field(default_factory=list)
    deferrals: list[DeferralRow] = field(default_factory=list)
    #: Orders deferred in the version before ``chosen`` (for "New in vN").
    earlier_deferred: set[str] = field(default_factory=set)
    #: The version before ``chosen`` and its trips (for "no change" on the acknowledgements).
    previous: VersionRow | None = None
    previous_trips: list[TripRow] = field(default_factory=list)
    vehicle_days: dict[str, VehicleDay] = field(default_factory=dict)
    availability: dict[str, VehicleAvailability] = field(default_factory=dict)
    #: vehicle id -> driver name; depot id -> the loader who runs that dock.
    drivers: dict[str, str] = field(default_factory=dict)
    loaders: dict[str, str] = field(default_factory=dict)
    #: Acknowledgements of ``chosen``, and of ``previous``.
    acks: list[AckRow] = field(default_factory=list)
    previous_acks: list[AckRow] = field(default_factory=list)

    @property
    def latest(self) -> VersionRow | None:
        return self.versions[-1] if self.versions else None

    def depot_of(self, order_id: str) -> str:
        return self.ref.outlets[self.orders[order_id].outlet_id].depot
