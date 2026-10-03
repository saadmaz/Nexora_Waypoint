"""Orders and deferrals (PRD §10)."""

from __future__ import annotations

from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, Float, ForeignKey, Index, Integer, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from waypoint_rules.vocab import Binding, DeferralType, Temp

from ..db import Base
from ._types import JSON, TEXT_ARRAY, TZ, enum_col
from .enums import HistoryOutcome, ServerStatus


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (Index("ix_orders_service_date_status", "service_date", "status"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # ORD2001
    outlet_id: Mapped[str] = mapped_column(ForeignKey("outlets.id"), index=True)
    service_date: Mapped[date] = mapped_column(ForeignKey("calendar_days.date"))
    temp: Mapped[Temp] = mapped_column(enum_col(Temp, "temp"))
    units: Mapped[int] = mapped_column(Integer)
    weight_kg: Mapped[float] = mapped_column(Float)
    volume_m3: Mapped[float] = mapped_column(Float)
    status: Mapped[ServerStatus] = mapped_column(enum_col(ServerStatus, "order_status"))
    tags: Mapped[list[str]] = mapped_column(TEXT_ARRAY, default=list)
    received_at: Mapped[datetime | None] = mapped_column(TZ)
    placed_by: Mapped[str | None] = mapped_column(Text)
    after_cutoff: Mapped[bool] = mapped_column(Boolean, default=False)
    cancelled_at: Mapped[datetime | None] = mapped_column(TZ)
    #: Re-run lineage: the order this one is the next-run copy of.
    deferred_from_order_id: Mapped[str | None] = mapped_column(ForeignKey("orders.id"))
    row_version: Mapped[int] = mapped_column(Integer, default=1)

    __mapper_args__ = {"version_id_col": row_version}


class OutletServiceHistory(Base):
    """Drives deferred_yesterday, days_since_served, S4.2 and S2.10."""

    __tablename__ = "outlet_service_history"

    outlet_id: Mapped[str] = mapped_column(ForeignKey("outlets.id"), primary_key=True)
    service_date: Mapped[date] = mapped_column(Date, primary_key=True)
    outcome: Mapped[HistoryOutcome] = mapped_column(enum_col(HistoryOutcome, "history_outcome"))
    time: Mapped[time | None] = mapped_column(Time)


class Deferral(Base):
    __tablename__ = "deferrals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), index=True)
    plan_version_id: Mapped[int | None] = mapped_column(ForeignKey("plan_versions.id"))
    type: Mapped[DeferralType] = mapped_column(enum_col(DeferralType, "deferral_type"))
    binding: Mapped[Binding | None] = mapped_column(enum_col(Binding, "binding"))
    reason_text: Mapped[str] = mapped_column(Text)
    #: deferred_yesterday, days_since_served, consequence
    impact: Mapped[dict] = mapped_column(JSON, default=dict)
    #: kg, m3, minutes
    frees: Mapped[dict] = mapped_column(JSON, default=dict)
    next_run_date: Mapped[date | None] = mapped_column(Date)
    decided_by: Mapped[str | None] = mapped_column(Text)
    decided_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    decided_at: Mapped[datetime | None] = mapped_column(TZ)
    notice_sent_at: Mapped[datetime | None] = mapped_column(TZ)
    notice_seen_at: Mapped[datetime | None] = mapped_column(TZ)
    withdrawn_at: Mapped[datetime | None] = mapped_column(TZ)
    withdrawn_reason: Mapped[str | None] = mapped_column(Text)
