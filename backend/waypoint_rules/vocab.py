"""Shared vocabulary: one set of enums for the database, the API schema and the TypeScript types.

PRD v3 §4b. Eleven order statuses (``pending_sync`` exists only on devices), three deferral
types, binding resources and rule IDs. Everything that is not a status is a tag.
"""

from __future__ import annotations

from enum import StrEnum


class OrderStatus(StrEnum):
    ORDERED = "ordered"
    CONFIRMED = "confirmed"
    PLANNED = "planned"
    DEFERRED = "deferred"
    LOADED = "loaded"
    DEPARTED = "departed"
    DELIVERED = "delivered"
    PARTIAL = "partial"
    ISSUE = "issue"
    CONFLICT = "conflict"
    #: Device-only. Never stored as a server status.
    PENDING_SYNC = "pending_sync"


SERVER_STATUSES: frozenset[OrderStatus] = frozenset(OrderStatus) - {OrderStatus.PENDING_SYNC}


class DeferralType(StrEnum):
    CAPACITY = "capacity"
    POLICY = "policy"
    STORE_REQUEST = "store_request"


class Binding(StrEnum):
    REEFER_MINUTES = "reefer_minutes"
    WEIGHT = "weight"
    VOLUME = "volume"
    VAN_ACCESS = "van_access"
    WINDOW = "window"
    FUEL = "fuel"


class Temp(StrEnum):
    CHILLED = "chilled"
    AMBIENT = "ambient"


class VehicleTemp(StrEnum):
    REEFER = "reefer"
    AMBIENT = "ambient"


class VehicleType(StrEnum):
    TRUCK = "truck"
    VAN = "van"


class Brand(StrEnum):
    FRESH = "Fresh"
    STYLE = "Style"
    TECH = "Tech"


class DockType(StrEnum):
    REAR_DOCK = "rear_dock"
    STREET = "street"
    MALL_BAY = "mall_bay"


class Role(StrEnum):
    DISPATCHER = "dispatcher"
    LOADER = "loader"
    DRIVER = "driver"
    STORE = "store"


class LatenessRisk(StrEnum):
    ON_TIME = "on_time"
    AT_RISK = "at_risk"
    UNKNOWN_OFFLINE = "unknown_offline"


class RuleId(StrEnum):
    """Hard constraints (PRD §4a). A plan never breaks these."""

    KG = "R-KG"
    M3 = "R-M3"
    TEMP = "R-TEMP"
    VAN = "R-VAN"
    DEPOT = "R-DEPOT"
    WHOLE = "R-WHOLE"
    BRAND = "R-BRAND"
    DISTRICT = "R-DISTRICT"
    TRIPS = "R-TRIPS"
    BUDGET_FRESH = "R-BUDGET-F"
    BUDGET_STYLE_TECH = "R-BUDGET-ST"
    AVAIL = "R-AVAIL"
    FUEL = "R-FUEL"
    WINDOW = "R-WINDOW"
    MALL = "R-MALL"
    CUTOFF = "R-CUTOFF"
    OPDAY = "R-OPDAY"
    EDIT = "R-EDIT"
    CONT = "R-CONT"


#: Labels shown to people. Stores never see "Conflict" (decision 4, PRD §4b).
_LABELS: dict[OrderStatus, str] = {
    OrderStatus.ORDERED: "Ordered",
    OrderStatus.CONFIRMED: "Confirmed",
    OrderStatus.PLANNED: "Planned",
    OrderStatus.DEFERRED: "Deferred",
    OrderStatus.LOADED: "Loaded",
    OrderStatus.DEPARTED: "Departed",
    OrderStatus.DELIVERED: "Delivered",
    OrderStatus.PARTIAL: "Partial",
    OrderStatus.ISSUE: "Issue",
    OrderStatus.CONFLICT: "Conflict",
    OrderStatus.PENDING_SYNC: "Pending sync",
}


def status_label(status: OrderStatus, role: Role) -> str:
    """The one place that turns a status into words for a role."""
    if status is OrderStatus.CONFLICT and role is Role.STORE:
        return "Under review"
    return _LABELS[status]


#: Per-vehicle minute budgets (R-BUDGET-F, R-BUDGET-ST).
FRESH_BUDGET_MIN = 270
STYLE_TECH_BUDGET_MIN = 480
MAX_TRIPS_PER_VEHICLE = 2
