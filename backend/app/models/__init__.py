"""Importing this package registers every table on ``Base.metadata`` (Alembic relies on it)."""

from . import comms, enums, field, orders, people, plans, reference
from .comms import AuditEvent, Clock, Notice, NoticeRead, ScenarioEvent
from .field import (
    Attachment,
    Conflict,
    ConflictOrder,
    DeviceRecord,
    DeviceRecordOrder,
    ExceptionOrder,
    FieldException,
    Receipt,
    Run,
)
from .orders import Deferral, Order, OutletServiceHistory
from .people import Driver, PinPerson, User
from .plans import (
    Acknowledgement,
    DemandForecast,
    FuelLedger,
    LoadCheck,
    LoadGate,
    PlanVersion,
    Trip,
    TripOrder,
    VehicleDayStatus,
)
from .reference import CalendarDay, Depot, District, Outlet, RoadCondition, ServiceAllowance, TrafficSpeed, Vehicle

__all__ = [
    "Acknowledgement", "Attachment", "AuditEvent", "CalendarDay", "Clock", "Conflict", "Deferral", "Depot",
    "DeviceRecord", "District", "Driver", "FieldException", "FuelLedger", "LoadCheck", "LoadGate", "Notice",
    "Order", "Outlet", "OutletServiceHistory", "PinPerson", "PlanVersion", "Receipt", "Run", "ScenarioEvent",
    "ServiceAllowance", "TrafficSpeed", "Trip", "TripOrder", "User", "Vehicle", "VehicleDayStatus",
    "ConflictOrder", "DemandForecast", "DeviceRecordOrder", "ExceptionOrder", "NoticeRead", "RoadCondition",
    "comms", "enums", "field", "orders", "people", "plans", "reference",
]
