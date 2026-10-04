"""Plain data the rules operate on. No database, no framework: the API, the seed checks and
the Datathon notebook all build these from their own sources.

Times are naive ``datetime`` values in Asia/Colombo local time. ``service_date`` is the
delivery day; order windows are ``time`` values on that day.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time

from .vocab import Brand, DockType, Temp, VehicleTemp, VehicleType


@dataclass(frozen=True, slots=True)
class District:
    name: str
    depot: str
    outbound_min: int
    outbound_km: float
    inter_stop_min: int
    inter_stop_km: float


@dataclass(frozen=True, slots=True)
class Outlet:
    id: str
    brand: Brand
    district: str
    depot: str
    dock_type: DockType
    window_open: time
    window_close: time
    van_only: bool = False
    mall_dock: bool = False
    mall_open: time | None = None
    mall_close: time | None = None

    @property
    def effective_open(self) -> time:
        """Handling can start at the later of the outlet window and, for mall docks, the mall window."""
        if self.mall_dock and self.mall_open is not None:
            return max(self.window_open, self.mall_open)
        return self.window_open

    @property
    def effective_close(self) -> time:
        if self.mall_dock and self.mall_close is not None:
            return min(self.window_close, self.mall_close)
        return self.window_close


@dataclass(frozen=True, slots=True)
class Vehicle:
    id: str
    depot: str
    type: VehicleType
    temp: VehicleTemp
    weight_cap_kg: float
    volume_cap_m3: float
    km_per_l: float
    weekly_fuel_quota_l: float

    @property
    def is_reefer(self) -> bool:
        return self.temp is VehicleTemp.REEFER

    @property
    def is_van(self) -> bool:
        return self.type is VehicleType.VAN


@dataclass(frozen=True, slots=True)
class Order:
    id: str
    outlet_id: str
    temp: Temp
    units: int
    weight_kg: float
    volume_m3: float
    #: Outlet was deferred on the previous run (continuity guard input).
    deferred_yesterday: bool = False
    days_since_served: int = 1


@dataclass(frozen=True, slots=True)
class VehicleDay:
    """A vehicle's state for one service day."""

    vehicle_id: str
    available_from: datetime | None = None  #: None = available all morning
    held: bool = False
    fuel_used_before_l: float = 0.0


@dataclass(frozen=True, slots=True)
class RefData:
    """Reference data for one day: outlets, districts, vehicles and handling allowances."""

    outlets: dict[str, Outlet]
    districts: dict[str, District]
    vehicles: dict[str, Vehicle]
    #: (brand, dock_type) -> handling minutes per order
    allowances: dict[tuple[Brand, DockType], int]
    #: (district, hour) -> how much longer a leg takes than free flow on this service day (1.0 = free flow). Built from
    #: typical traffic for the day's monsoon flag and that day's road conditions. Empty means free flow everywhere.
    travel: dict[tuple[str, int], float] = field(default_factory=dict)

    def allowance(self, outlet: Outlet) -> int:
        return self.allowances[(outlet.brand, outlet.dock_type)]

    def district_of(self, outlet: Outlet) -> District:
        return self.districts[outlet.district]

    def leg_minutes(self, district: str, start: datetime, free_flow_min: int) -> int:
        """Driving minutes for a leg that starts at ``start``: free flow, slowed by the hour's traffic and the day's roads."""
        return round(free_flow_min * self.travel.get((district, start.hour), 1.0))


@dataclass(slots=True)
class Trip:
    """One vehicle trip. ``order_ids`` is the stop sequence (seq 1..n)."""

    vehicle_id: str
    trip_no: int
    depart_at: datetime
    order_ids: list[str] = field(default_factory=list)

    @property
    def key(self) -> tuple[str, int]:
        return (self.vehicle_id, self.trip_no)


@dataclass(slots=True)
class Plan:
    """A plan draft: trips plus the deferred pool, for one service date."""

    service_date: date
    trips: dict[tuple[str, int], Trip]
    deferred: list[str] = field(default_factory=list)

    def trips_of(self, vehicle_id: str) -> list[Trip]:
        return sorted((t for t in self.trips.values() if t.vehicle_id == vehicle_id), key=lambda t: t.trip_no)

    def trip_of_order(self, order_id: str) -> Trip | None:
        for t in self.trips.values():
            if order_id in t.order_ids:
                return t
        return None
