"""Plans, trips and loading (PRD §10)."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, Float, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from waypoint_rules.vocab import Brand

from ..db import Base
from ._types import TZ, enum_col
from .enums import ActorKind, Availability, PlanState


class PlanVersion(Base):
    """One plan per service date, covering both depots."""

    __tablename__ = "plan_versions"
    __table_args__ = (UniqueConstraint("service_date", "number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    service_date: Mapped[date] = mapped_column(Date)
    number: Mapped[int] = mapped_column(Integer)
    state: Mapped[PlanState] = mapped_column(enum_col(PlanState, "plan_state"))
    note: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TZ)
    released_at: Mapped[datetime | None] = mapped_column(TZ)


class Trip(Base):
    __tablename__ = "trips"
    __table_args__ = (UniqueConstraint("plan_version_id", "vehicle_id", "trip_no"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_version_id: Mapped[int] = mapped_column(ForeignKey("plan_versions.id"), index=True)
    vehicle_id: Mapped[str] = mapped_column(ForeignKey("vehicles.id"))
    trip_no: Mapped[int] = mapped_column(Integer)
    brand: Mapped[Brand] = mapped_column(enum_col(Brand, "brand"))
    district: Mapped[str] = mapped_column(ForeignKey("districts.name"))
    depart_at: Mapped[datetime] = mapped_column(TZ)
    minutes: Mapped[int] = mapped_column(Integer)
    kg: Mapped[float] = mapped_column(Float)
    m3: Mapped[float] = mapped_column(Float)
    planned_km: Mapped[float] = mapped_column(Float)
    planned_fuel_l: Mapped[float] = mapped_column(Float)


class TripOrder(Base):
    __tablename__ = "trip_orders"

    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), primary_key=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), primary_key=True)
    seq: Mapped[int] = mapped_column(Integer)  # stop order
    load_no: Mapped[int] = mapped_column(Integer)  # reverse of seq
    planned_arrival: Mapped[datetime | None] = mapped_column(TZ)
    handling_start: Mapped[datetime | None] = mapped_column(TZ)
    handling_end: Mapped[datetime | None] = mapped_column(TZ)


class VehicleDayStatus(Base):
    __tablename__ = "vehicle_day_status"

    vehicle_id: Mapped[str] = mapped_column(ForeignKey("vehicles.id"), primary_key=True)
    service_date: Mapped[date] = mapped_column(Date, primary_key=True)
    availability: Mapped[Availability] = mapped_column(enum_col(Availability, "availability"))
    available_from: Mapped[datetime | None] = mapped_column(TZ)
    held_at: Mapped[datetime | None] = mapped_column(TZ)
    held_reason: Mapped[str | None] = mapped_column(Text)
    replaced_by: Mapped[str | None] = mapped_column(ForeignKey("vehicles.id"))


class FuelLedger(Base):
    __tablename__ = "fuel_ledger"

    vehicle_id: Mapped[str] = mapped_column(ForeignKey("vehicles.id"), primary_key=True)
    iso_year: Mapped[int] = mapped_column(Integer, primary_key=True)
    iso_week: Mapped[int] = mapped_column(Integer, primary_key=True)
    used_before_l: Mapped[float] = mapped_column(Float)


class Acknowledgement(Base):
    __tablename__ = "acknowledgements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_version_id: Mapped[int] = mapped_column(ForeignKey("plan_versions.id"))
    actor_kind: Mapped[ActorKind] = mapped_column(enum_col(ActorKind, "actor_kind"))
    actor_id: Mapped[str] = mapped_column(Text)
    dock: Mapped[str | None] = mapped_column(ForeignKey("depots.id"))
    vehicle_id: Mapped[str | None] = mapped_column(ForeignKey("vehicles.id"))
    acknowledged_at: Mapped[datetime] = mapped_column(TZ)


class LoadCheck(Base):
    __tablename__ = "load_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), index=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"))
    units_expected: Mapped[int] = mapped_column(Integer)
    units_loaded: Mapped[int] = mapped_column(Integer)
    checked_by_pin: Mapped[int | None] = mapped_column(ForeignKey("pin_people.id"))
    checked_at: Mapped[datetime] = mapped_column(TZ)
    client_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), unique=True)


class LoadGate(Base):
    __tablename__ = "load_gates"

    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), primary_key=True)
    confirmed_at: Mapped[datetime] = mapped_column(TZ)
    confirmed_by_pin: Mapped[int | None] = mapped_column(ForeignKey("pin_people.id"))
