"""Plain rows the driver endpoints pass between the database reads (``driver_repo``) and the shaping (``driver_views``)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time
from typing import Any

from waypoint_rules.vocab import Brand, DockType, OrderStatus, Temp, VehicleTemp, VehicleType


@dataclass(frozen=True, slots=True)
class StopRow:
    """One order on the trip, with its outlet."""

    order_id: str
    outlet_id: str
    outlet_name: str | None
    seq: int
    temp: Temp
    units: int
    status: OrderStatus
    tags: tuple[str, ...]
    window_open: time
    window_close: time
    planned_arrival: datetime | None
    brand: Brand
    district: str
    dock: DockType
    parking_constraint: str | None
    #: From the plan's handling times, when the planner wrote them.
    handling_minutes: int | None
    #: The brand and dock allowance, used when the plan has no handling times.
    allowance_minutes: int | None
    weight_kg: float
    volume_m3: float


@dataclass(frozen=True, slots=True)
class TripChoice:
    trip_no: int
    finished: bool


@dataclass(frozen=True, slots=True)
class VehicleRow:
    kind: VehicleType
    temperature: VehicleTemp
    weight_cap_kg: float
    volume_cap_m3: float
    km_per_l: float
    in_workshop: bool
    held: bool
    replaced: bool


@dataclass(frozen=True, slots=True)
class ConfirmationRow:
    by: str | None
    at: datetime
    shortfalls: tuple[tuple[str, int], ...]


@dataclass(frozen=True, slots=True)
class RunFacts:
    day: date
    version: int
    released_at: datetime | None
    note: str | None
    vehicle_id: str
    trip_no: int
    trips: tuple[int, ...]
    driver: str | None
    vehicle: VehicleRow | None
    depart_at: datetime
    planned_km: float
    stops: tuple[StopRow, ...]
    acknowledged: bool
    confirmation: ConfirmationRow | None


@dataclass(frozen=True, slots=True)
class NoticeRow:
    id: int
    tag: str
    title: str
    body: str
    created_at: datetime
    read: bool
    #: The notice's JSON refs column, as stored: its keys depend on who wrote the notice.
    refs: dict[str, Any]


@dataclass(frozen=True, slots=True)
class ResolutionRow:
    """What Dispatch decided on a conflict, for the driver's "resolved" notice (H16)."""

    outlet_id: str
    decision: str
    by: str | None
    units: int | None
