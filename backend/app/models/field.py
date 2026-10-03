"""Field execution and reconciliation (PRD §10)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Float, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.associationproxy import association_proxy
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from ._types import JSON, TEXT_ARRAY, TZ, enum_col
from .enums import (
    AttachmentKind,
    ConflictRecommendation,
    ConflictStatus,
    DeviceRecordType,
    ExceptionKind,
    ExceptionStatus,
    SyncResultKind,
)
from .plans import Trip


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), unique=True)
    trip: Mapped[Trip] = relationship()

    plan_version_seen: Mapped[int | None] = mapped_column(ForeignKey("plan_versions.id"))
    departed_at: Mapped[datetime | None] = mapped_column(TZ)
    finished_at: Mapped[datetime | None] = mapped_column(TZ)
    gps_km: Mapped[float | None] = mapped_column(Float)
    gps_gap_filled_km: Mapped[float | None] = mapped_column(Float)
    fuel_l_est: Mapped[float | None] = mapped_column(Float)
    last_heard_at: Mapped[datetime | None] = mapped_column(TZ)

    @property
    def vehicle_id(self) -> str:
        """Derived from the trip; no duplicated vehicle column."""
        return self.trip.vehicle_id


class Conflict(Base):
    __tablename__ = "conflicts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_links: Mapped[list[ConflictOrder]] = relationship(cascade="all, delete-orphan", lazy="selectin", order_by="ConflictOrder.order_id")
    order_ids = association_proxy("order_links", "order_id", creator=lambda oid: ConflictOrder(order_id=oid))
    server_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    device_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    recommendation: Mapped[ConflictRecommendation] = mapped_column(
        enum_col(ConflictRecommendation, "conflict_recommendation")
    )
    reasons: Mapped[list[str]] = mapped_column(TEXT_ARRAY, default=list)
    status: Mapped[ConflictStatus] = mapped_column(enum_col(ConflictStatus, "conflict_status"))
    resolution: Mapped[str | None] = mapped_column(Text)
    resolved_by: Mapped[str | None] = mapped_column(Text)
    resolved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    resolved_at: Mapped[datetime | None] = mapped_column(TZ)


class DeviceRecord(Base):
    """One outbox record from a device. ``client_id`` is the idempotency key."""

    __tablename__ = "device_records"

    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    device_id: Mapped[str] = mapped_column(Text)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    #: The driver or the PIN person.
    actor: Mapped[str | None] = mapped_column(Text)
    type: Mapped[DeviceRecordType] = mapped_column(enum_col(DeviceRecordType, "device_record_type"))
    order_links: Mapped[list[DeviceRecordOrder]] = relationship(cascade="all, delete-orphan", lazy="selectin", order_by="DeviceRecordOrder.order_id")
    order_ids = association_proxy("order_links", "order_id", creator=lambda oid: DeviceRecordOrder(order_id=oid))
    outlet_id: Mapped[str | None] = mapped_column(ForeignKey("outlets.id"))
    vehicle_id: Mapped[str | None] = mapped_column(ForeignKey("vehicles.id"))
    trip_id: Mapped[int | None] = mapped_column(ForeignKey("trips.id"))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    device_time: Mapped[datetime | None] = mapped_column(TZ)
    plan_version_on_device: Mapped[int | None] = mapped_column(Integer)
    received_at: Mapped[datetime] = mapped_column(TZ)
    result: Mapped[SyncResultKind] = mapped_column(enum_col(SyncResultKind, "sync_result"))
    result_reason: Mapped[str | None] = mapped_column(Text)
    conflict_id: Mapped[int | None] = mapped_column(ForeignKey("conflicts.id"))


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    device_record_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("device_records.client_id"))
    kind: Mapped[AttachmentKind] = mapped_column(enum_col(AttachmentKind, "attachment_kind"))
    path: Mapped[str] = mapped_column(Text)
    mime: Mapped[str] = mapped_column(Text)
    bytes: Mapped[int] = mapped_column(Integer)


class FieldException(Base):
    """The ``exceptions`` table (renamed in Python: ``Exception`` is a builtin)."""

    __tablename__ = "exceptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind: Mapped[ExceptionKind] = mapped_column(enum_col(ExceptionKind, "exception_kind"))
    type: Mapped[str] = mapped_column(Text)
    vehicle_id: Mapped[str | None] = mapped_column(ForeignKey("vehicles.id"))
    trip_id: Mapped[int | None] = mapped_column(ForeignKey("trips.id"))
    order_links: Mapped[list[ExceptionOrder]] = relationship(cascade="all, delete-orphan", lazy="selectin", order_by="ExceptionOrder.order_id")
    order_ids = association_proxy("order_links", "order_id", creator=lambda oid: ExceptionOrder(order_id=oid))

    detail: Mapped[str | None] = mapped_column(Text)
    raised_by: Mapped[str | None] = mapped_column(Text)
    raised_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    raised_by_pin_id: Mapped[int | None] = mapped_column(ForeignKey("pin_people.id"))
    raised_at: Mapped[datetime] = mapped_column(TZ)
    device_time: Mapped[datetime | None] = mapped_column(TZ)
    status: Mapped[ExceptionStatus] = mapped_column(enum_col(ExceptionStatus, "exception_status"))
    decision: Mapped[dict | None] = mapped_column(JSON)
    decided_by: Mapped[str | None] = mapped_column(Text)
    decided_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    decided_at: Mapped[datetime | None] = mapped_column(TZ)

    @property
    def units_short(self) -> dict[str, int]:
        return {link.order_id: link.units_short for link in self.order_links if link.units_short is not None}

    @units_short.setter
    def units_short(self, values: dict[str, int]) -> None:
        for link in self.order_links:
            link.units_short = values.get(link.order_id)

class Receipt(Base):
    __tablename__ = "receipts"

    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), primary_key=True)
    units_received: Mapped[int] = mapped_column(Integer)
    shortfall_reason: Mapped[str | None] = mapped_column(Text)
    confirmed_at: Mapped[datetime] = mapped_column(TZ)
    confirmed_by: Mapped[str | None] = mapped_column(Text)


class ConflictOrder(Base):
    __tablename__ = "conflict_orders"

    conflict_id: Mapped[int] = mapped_column(ForeignKey("conflicts.id"), primary_key=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), primary_key=True, index=True)


class ExceptionOrder(Base):
    __tablename__ = "exception_orders"

    exception_id: Mapped[int] = mapped_column(ForeignKey("exceptions.id"), primary_key=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), primary_key=True, index=True)
    units_short: Mapped[int | None] = mapped_column(Integer)


class DeviceRecordOrder(Base):
    __tablename__ = "device_record_orders"

    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("device_records.client_id"), primary_key=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), primary_key=True, index=True)
