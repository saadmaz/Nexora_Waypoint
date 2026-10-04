"""LoaderApi schemas (PRD §19). Loader writes go through ``POST /sync`` as outbox records."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from .base import ApiModel
from .common import Window


class VerifyPinIn(ApiModel):
    person_id: int
    pin: str = Field(min_length=1, max_length=12)


class PinPersonOut(ApiModel):
    id: int
    name: str
    dock: str


class VerifyPinOut(ApiModel):
    ok: bool
    person: PinPersonOut | None = None


class DockVehicleOut(ApiModel):
    vehicle_id: str
    trip_no: int
    depart_at: datetime
    plan_version: int
    tags: list[str] = Field(default_factory=list, description="Held, Replaced, Acknowledged...")
    orders: int
    kg: float
    replaces: str | None = Field(default=None, description="The vehicle this one stands in for, once Dispatch has swapped them")
    replaced_by: str | None = Field(default=None, description="The vehicle that took this one's trips")


class DockOut(ApiModel):
    dock: str
    plan_version: int
    acknowledged: bool
    people: list[PinPersonOut]
    vehicles: list[DockVehicleOut]
    #: When the current plan was released, for L1's "Acknowledge before loading. Released 23:40."
    plan_released_at: datetime | None = None
    #: The newest released version this dock has acknowledged, which may be older than ``plan_version``:
    #: that is L1.5 "Plan changed, review". ``None`` when the dock has acknowledged nothing.
    acknowledged_version: int | None = None
    acknowledged_by: str | None = None
    acknowledged_at: datetime | None = None


class LoadLineOut(ApiModel):
    order_id: str
    outlet_id: str
    outlet_name: str | None = None
    load_no: int
    units_expected: int
    units_loaded: int | None = None
    window: Window | None = None


class LoadPlanOut(ApiModel):
    vehicle_id: str
    trip_no: int
    plan_version: int
    depart_at: datetime
    lines: list[LoadLineOut]
    confirmed_at: datetime | None = None
    replaces: str | None = Field(default=None, description="The vehicle this one stands in for, once Dispatch has swapped them")
    replaced_by: str | None = Field(default=None, description="The vehicle that took this one's trips")


class LoaderExceptionOut(ApiModel):
    id: int
    type: str
    vehicle_id: str | None = None
    trip_no: int | None = None
    order_ids: list[str]
    units_short: dict
    detail: str | None = None
    raised_at: datetime
    status: str
    decision: dict | None = None


class PlanDiffLineOut(ApiModel):
    vehicle_id: str
    trip_no: int
    change: str = Field(description="added, removed, moved, time or vehicle")
    order_id: str | None = None
    before: str | None = None
    after: str | None = None


class PlanDiffOut(ApiModel):
    dock: str
    from_version: int
    to_version: int
    lines: list[PlanDiffLineOut]
