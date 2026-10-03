"""DriverApi schemas (PRD §19). Driver writes go through ``POST /sync`` as outbox records."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import Field

from waypoint_rules.vocab import Brand, DockType, OrderStatus, Temp, VehicleTemp, VehicleType

from .base import ApiModel
from .common import Window

#: Why a day has no run for this driver (PRD §15 Runs for other dates).
NoRunReason = Literal["sunday", "holiday", "not_released", "no_trip"]


class RunStopOut(ApiModel):
    order_id: str
    outlet_id: str
    outlet_name: str | None = None
    seq: int
    temp: Temp
    units: int
    window: Window
    planned_arrival: datetime | None = None
    #: The server's state for this order after the last sync.
    status: OrderStatus
    tags: list[str] = Field(default_factory=list)
    brand: Brand | None = None
    district: str | None = None
    dock: DockType | None = None
    #: In the screen's words ("Vans only"), or none when parking is normal.
    parking_note: str | None = None
    #: Time to allow for unloading at this stop.
    unload_minutes: int | None = None
    weight_kg: float | None = None
    volume_m3: float | None = None


class NoRunOut(ApiModel):
    reason: NoRunReason
    #: When the next plan is expected, so the screen never shows an unexplained empty day.
    next_plan_at: datetime | None = None


class CalendarOut(ApiModel):
    """R10.1: a monsoon day runs slower. The speed indexes are null until ``traffic_speed`` is mapped."""

    monsoon: bool
    speed_index: int | None = None
    normal_index: int | None = None


class RunVehicleOut(ApiModel):
    kind: VehicleType
    temperature: VehicleTemp
    weight_cap_kg: float
    volume_cap_m3: float
    km_per_l: float
    #: "Available", "In workshop", "Held" or "Replaced" for the run's day.
    tags: list[str] = Field(default_factory=list)


class ShortfallOut(ApiModel):
    order_id: str
    short_by: int


class LoaderConfirmationOut(ApiModel):
    """R1.3 B: "Confirmed by Ruwan · 04:50"."""

    by: str | None = None
    at: datetime
    shortfalls: list[ShortfallOut] = Field(default_factory=list)


class RunOut(ApiModel):
    """The route package the phone caches for offline use, or why there is no run that day.

    With ``state`` ``no_run`` the run fields are null and ``no_run`` says why.
    """

    date: date
    state: Literal["run", "no_run"] = "run"
    no_run: NoRunOut | None = None
    calendar: CalendarOut | None = None
    vehicle_id: str | None = None
    trip_no: int | None = None
    #: Every trip this vehicle has that day, so the phone can ask for another with ``?trip=``.
    trips: list[int] = Field(default_factory=list)
    plan_version: int | None = None
    plan_released_at: datetime | None = None
    plan_note: str | None = None
    driver: str | None = None
    vehicle: RunVehicleOut | None = None
    depart_at: datetime | None = None
    planned_km: float | None = None
    stops: list[RunStopOut] = Field(default_factory=list)
    acknowledged: bool = False
    loader_confirmation: LoaderConfirmationOut | None = None
    server_time: datetime


class NoticeOut(ApiModel):
    id: int
    tag: str
    title: str
    body: str
    created_at: datetime
    read: bool
    link: dict | None = None


class DriverHistoryRowOut(ApiModel):
    date: date
    vehicle_id: str
    trip_no: int
    stops: int
    delivered: int
    km: float | None = None
    fuel_l: float | None = None
    departed_at: datetime | None = None
    finished_at: datetime | None = None
