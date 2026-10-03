"""Enums that only the database and API need. The shared vocabulary lives in ``waypoint_rules.vocab``."""

from __future__ import annotations

from enum import StrEnum

from waypoint_rules.vocab import SERVER_STATUSES, OrderStatus

#: The ten statuses a server row may hold. ``pending_sync`` is device-only (PRD §10).
ServerStatus = StrEnum("ServerStatus", {s.name: s.value for s in OrderStatus if s in SERVER_STATUSES})


class Availability(StrEnum):
    AVAILABLE = "available"
    IN_WORKSHOP = "in_workshop"


class PlanState(StrEnum):
    DRAFT = "draft"
    RELEASED = "released"


class HistoryOutcome(StrEnum):
    SERVED = "served"
    DEFERRED = "deferred"
    PARTIAL = "partial"
    NO_RUN = "no_run"


class ActorKind(StrEnum):
    PIN_PERSON = "pin_person"
    DRIVER = "driver"


class DeviceRecordType(StrEnum):
    DRIVER_ACK = "driver.ack"
    DRIVER_START_ROUTE = "driver.startRoute"
    DRIVER_ARRIVAL = "driver.arrival"
    DRIVER_OUTCOME = "driver.outcome"
    DRIVER_PROBLEM = "driver.problem"
    DRIVER_FINISH_RUN = "driver.finishRun"
    LOADER_ACK = "loader.ack"
    LOADER_CHECK = "loader.check"
    LOADER_CONFIRM_LOADED = "loader.confirmLoaded"
    LOADER_EXCEPTION = "loader.exception"


class SyncResultKind(StrEnum):
    ACCEPTED = "accepted"
    DUPLICATE = "duplicate"
    CONFLICT = "conflict"
    ERROR = "error"


class AttachmentKind(StrEnum):
    PHOTO = "photo"
    SIGNATURE = "signature"


class ExceptionKind(StrEnum):
    LOADER_SHORTFALL = "loader_shortfall"
    DRIVER_PROBLEM = "driver_problem"
    STORE_ISSUE = "store_issue"


class ExceptionStatus(StrEnum):
    OPEN = "open"
    DECIDED = "decided"


class ConflictRecommendation(StrEnum):
    KEEP_DELIVERY = "keep_delivery"
    KEEP_PARTIAL = "keep_partial"
    KEEP_DEFERRAL = "keep_deferral"


class ConflictStatus(StrEnum):
    OPEN = "open"
    AWAITING_STORE = "awaiting_store"
    RESOLVED = "resolved"


class NoticeTag(StrEnum):
    ORDER = "Order"
    PLAN = "Plan"
    DELIVERY = "Delivery"
    DEFERRAL = "Deferral"
    REVIEW = "Review"
    CHANGE = "Change"


class AuditType(StrEnum):
    ORDER_PLACED = "ORDER_PLACED"
    ORDER_EDITED = "ORDER_EDITED"
    ORDER_CANCELLED = "ORDER_CANCELLED"
    CUTOFF_CLOSED = "CUTOFF_CLOSED"
    PLAN_DRAFTED = "PLAN_DRAFTED"
    MOVE_ACCEPTED = "MOVE_ACCEPTED"
    MOVE_REFUSED = "MOVE_REFUSED"
    PLAN_RELEASED = "PLAN_RELEASED"
    PLAN_ACKNOWLEDGED = "PLAN_ACKNOWLEDGED"
    LOAD_CHECKED = "LOAD_CHECKED"
    LOAD_CONFIRMED = "LOAD_CONFIRMED"
    FLAG_RAISED = "FLAG_RAISED"
    VEHICLE_SWAPPED = "VEHICLE_SWAPPED"
    ORDER_DEFERRED = "ORDER_DEFERRED"
    RUN_STARTED = "RUN_STARTED"
    ARRIVED = "ARRIVED"
    OUTCOME_RECORDED = "OUTCOME_RECORDED"
    SYNCED = "SYNCED"
    CONFLICT_OPENED = "CONFLICT_OPENED"
    CONFLICT_RESOLVED = "CONFLICT_RESOLVED"
    RECEIPT_CONFIRMED = "RECEIPT_CONFIRMED"
    ISSUE_REPORTED = "ISSUE_REPORTED"
    NOTICE_SEEN = "NOTICE_SEEN"
    CLOCK_ADVANCED = "CLOCK_ADVANCED"


class StopOutcome(StrEnum):
    PENDING = "pending"
    DELIVERED = "delivered"
    PARTIAL = "partial"
    FAILED = "failed"


class AudienceKind(StrEnum):
    STORE = "store"
    DRIVER = "driver"
    DOCK = "dock"
    DISPATCHER = "dispatcher"
