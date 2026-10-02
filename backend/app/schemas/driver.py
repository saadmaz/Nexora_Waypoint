"""DriverApi schemas (PRD §19). Driver writes go through ``POST /sync`` as outbox records."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import Field

from waypoint_rules.vocab import OrderStatus, Temp

from .base import ApiModel
from .common import Window


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


class RunOut(ApiModel):
    """The route package the phone caches for offline use."""

    date: date
    vehicle_id: str
    trip_no: int
    plan_version: int
    driver: str | None = None
    depart_at: datetime
    planned_km: float
    stops: list[RunStopOut]
    acknowledged: bool
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
