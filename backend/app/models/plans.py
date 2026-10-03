"""Plans, trips and loading (PRD §10)."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, Float, ForeignKey, ForeignKeyConstraint, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from waypoint_rules.vocab import Brand

from ..db import Base
from ._types import TZ, enum_col
from .enums import ActorKind, Availability, PlanState, StopOutcome


class PlanVersion(Base):
    """One plan per service date, covering both depots."""

    __tablename__ = "plan_versions"
    __table_args__ = (UniqueConstraint("service_date", "number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    service_date: Mapped[date] = mapped_column(ForeignKey("calendar_days.date"))
    number: Mapped[int] = mapped_column(Integer)
    state: Mapped[PlanState] = mapped_column(enum_col(PlanState, "plan_state"))
    note: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TZ)
    released_at: Mapped[datetime | None] = mapped_column(TZ)


class Trip(Base):
    __tablename__ = "trips"
    __table_args__ = (
        UniqueConstraint("plan_version_id", "vehicle_id", "trip_no"),
        UniqueConstraint("id", "plan_version_id", name="uq_trips_id_plan_version_id"),
        CheckConstraint("trip_no IN (1, 2)", name="trip_no"),
    )

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
    __table_args__ = (
        UniqueConstraint("plan_version_id", "order_id"),
        ForeignKeyConstraint(["trip_id", "plan_version_id"], ["trips.id", "trips.plan_version_id"], name="fk_trip_orders_trip_plan_version_trips"),
    )

    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), primary_key=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), primary_key=True)
    seq: Mapped[int] = mapped_column(Integer)  # stop order
    plan_version_id: Mapped[int] = mapped_column(ForeignKey("plan_versions.id"))
    planned_arrival: Mapped[datetime | None] = mapped_column(TZ)
    planned_handling_start: Mapped[datetime | None] = mapped_column(TZ)
    planned_handling_end: Mapped[datetime | None] = mapped_column(TZ)
    actual_arrival: Mapped[datetime | None] = mapped_column(TZ)
    actual_handling_end: Mapped[datetime | None] = mapped_column(TZ)
    outcome: Mapped[StopOutcome] = mapped_column(enum_col(StopOutcome, "stop_outcome"), default=StopOutcome.PENDING, server_default="pending")
    units_delivered: Mapped[int | None] = mapped_column(Integer)
    outcome_record_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("device_records.client_id"))
    pod_attachment_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("attachments.id"))


class DemandForecast(Base):
    __tablename__ = "demand_forecasts"
    __table_args__ = (CheckConstraint("brand = 'Fresh' OR chilled_volume_m3 = 0", name="chilled_brand"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    depot_id: Mapped[str] = mapped_column(ForeignKey("depots.id"), index=True)
    brand: Mapped[Brand] = mapped_column(enum_col(Brand, "brand"))
    iso_year: Mapped[int] = mapped_column(Integer)
    iso_week: Mapped[int] = mapped_column(Integer)
    total_volume_m3: Mapped[float] = mapped_column(Float)
    chilled_volume_m3: Mapped[float] = mapped_column(Float)
    model_version: Mapped[str] = mapped_column(Text)
    generated_at: Mapped[datetime] = mapped_column(TZ)


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
    pin_person_id: Mapped[int | None] = mapped_column(ForeignKey("pin_people.id"))
    depot_id: Mapped[str | None] = mapped_column(ForeignKey("depots.id"))
    driver_vehicle_id: Mapped[str | None] = mapped_column(ForeignKey("drivers.vehicle_id"))
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
    client_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("device_records.client_id"), unique=True)


class LoadGate(Base):
    __tablename__ = "load_gates"

    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), primary_key=True)
    confirmed_at: Mapped[datetime] = mapped_column(TZ)
    confirmed_by_pin: Mapped[int | None] = mapped_column(ForeignKey("pin_people.id"))
