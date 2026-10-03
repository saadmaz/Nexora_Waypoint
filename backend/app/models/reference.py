"""Reference data loaded from the competition CSVs (PRD §10)."""

from __future__ import annotations

from datetime import date, time

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from waypoint_rules.vocab import Brand, DockType, VehicleTemp, VehicleType

from ..db import Base
from ._types import enum_col


class Depot(Base):
    __tablename__ = "depots"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # "peliyagoda", "kandy"
    name: Mapped[str] = mapped_column(Text)


class District(Base):
    __tablename__ = "districts"
    __table_args__ = (UniqueConstraint("name", "depot_id", name="uq_districts_name_depot_id"),)

    name: Mapped[str] = mapped_column(Text, primary_key=True)
    depot_id: Mapped[str] = mapped_column(ForeignKey("depots.id"))
    road_class: Mapped[str | None] = mapped_column(Text)
    free_flow_kmh: Mapped[float | None] = mapped_column(Float)
    depot_to_district_km: Mapped[float] = mapped_column(Float)
    depot_to_district_freeflow_min: Mapped[float] = mapped_column(Float)
    inter_stop_km: Mapped[float] = mapped_column(Float)
    inter_stop_freeflow_min: Mapped[float] = mapped_column(Float)


class ServiceAllowance(Base):
    __tablename__ = "service_allowances"

    brand: Mapped[Brand] = mapped_column(enum_col(Brand, "brand"), primary_key=True)
    dock_type: Mapped[DockType] = mapped_column(enum_col(DockType, "dock_type"), primary_key=True)
    minutes: Mapped[int] = mapped_column(Integer)


class Outlet(Base):
    __tablename__ = "outlets"
    __table_args__ = (
        ForeignKeyConstraint(["district", "depot_id"], ["districts.name", "districts.depot_id"], name="fk_outlets_district_depot_id_districts"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str | None] = mapped_column(Text)
    brand: Mapped[Brand] = mapped_column(enum_col(Brand, "brand"))
    district: Mapped[str] = mapped_column(ForeignKey("districts.name"))
    depot_id: Mapped[str] = mapped_column(ForeignKey("depots.id"))
    dock_type: Mapped[DockType] = mapped_column(enum_col(DockType, "dock_type"))
    #: As supplied, e.g. "normal", "van_only", "mall_dock".
    parking_constraint: Mapped[str] = mapped_column(Text, default="normal")
    mall_window_open: Mapped[time | None] = mapped_column(Time)
    mall_window_close: Mapped[time | None] = mapped_column(Time)
    window_open: Mapped[time] = mapped_column(Time)
    window_close: Mapped[time] = mapped_column(Time)
    #: Derived from delivery history (A14).
    units_to_kg: Mapped[float | None] = mapped_column(Float)
    units_to_m3: Mapped[float | None] = mapped_column(Float)


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    type: Mapped[VehicleType] = mapped_column(enum_col(VehicleType, "vehicle_type"))
    temp: Mapped[VehicleTemp] = mapped_column(enum_col(VehicleTemp, "vehicle_temp"))
    weight_cap_kg: Mapped[float] = mapped_column(Float)
    volume_cap_m3: Mapped[float] = mapped_column(Float)
    fuel_type: Mapped[str | None] = mapped_column(Text)
    km_per_l: Mapped[float] = mapped_column(Float)
    weekly_fuel_quota_l: Mapped[float] = mapped_column(Float)
    depot_id: Mapped[str] = mapped_column(ForeignKey("depots.id"))


class CalendarDay(Base):
    __tablename__ = "calendar_days"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    dow: Mapped[int] = mapped_column(Integer)
    dow_name: Mapped[str] = mapped_column(Text)
    is_weekend: Mapped[bool] = mapped_column(Boolean)
    iso_year: Mapped[int] = mapped_column(Integer)
    iso_week: Mapped[int] = mapped_column(Integer)
    is_payday: Mapped[bool] = mapped_column(Boolean)
    festival: Mapped[str | None] = mapped_column(Text)
    festival_ramp: Mapped[float] = mapped_column(Float, default=0)
    is_holiday: Mapped[bool] = mapped_column(Boolean)
    monsoon: Mapped[bool] = mapped_column(Boolean)
    is_operating: Mapped[bool] = mapped_column(Boolean)


class TrafficSpeed(Base):
    """Typical traffic by district and hour, normalized from the reference CSV."""

    __tablename__ = "traffic_speed"

    district: Mapped[str] = mapped_column(ForeignKey("districts.name"), primary_key=True)
    hour: Mapped[int] = mapped_column(Integer, primary_key=True)
    speed_factor: Mapped[float] = mapped_column(Float)


class RoadCondition(Base):
    __tablename__ = "road_conditions"
    __table_args__ = (CheckConstraint("kind IN ('roadworks', 'flooding', 'incident')", name="road_kind"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    service_date: Mapped[date] = mapped_column(ForeignKey("calendar_days.date"), index=True)
    district: Mapped[str] = mapped_column(ForeignKey("districts.name"), index=True)
    kind: Mapped[str] = mapped_column(Text)
    delay_factor: Mapped[float] = mapped_column(Float)
    note: Mapped[str | None] = mapped_column(Text)
