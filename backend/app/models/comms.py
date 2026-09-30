"""Communication, audit and the scenario clock (PRD §10, §13)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base
from ._types import JSON, TZ, enum_col
from .enums import AuditType, NoticeTag


class Notice(Base):
    """Feeds S4, R8, L1.5 and the D4 sent / seen column."""

    __tablename__ = "notices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    #: ``store:OUT084``, ``driver:VEH039``, ``dock:kandy`` or ``dispatch``.
    audience: Mapped[str] = mapped_column(Text, index=True)
    tag: Mapped[NoticeTag] = mapped_column(enum_col(NoticeTag, "notice_tag"))
    title: Mapped[str] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text)
    #: The screen state View opens.
    link: Mapped[dict | None] = mapped_column(JSON)
    #: Entity references (order ids, plan version, conflict id...).
    refs: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(TZ)
    read_at: Mapped[datetime | None] = mapped_column(TZ)


class AuditEvent(Base):
    """Append-only. ``at`` is scenario time."""

    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    at: Mapped[datetime] = mapped_column(TZ)
    actor: Mapped[str] = mapped_column(Text)
    entity_type: Mapped[str] = mapped_column(Text)
    entity_id: Mapped[str] = mapped_column(Text, index=True)
    type: Mapped[AuditType] = mapped_column(enum_col(AuditType, "audit_type"))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)


class Clock(Base):
    """A single row (id 1): the scenario clock (PRD §13)."""

    __tablename__ = "clock"
    __table_args__ = (CheckConstraint("id = 1", name="single_row"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    scenario_now: Mapped[datetime] = mapped_column(TZ)
    checkpoint: Mapped[datetime] = mapped_column(TZ)
    updated_at: Mapped[datetime] = mapped_column(TZ)


class ScenarioEvent(Base):
    __tablename__ = "scenario_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    at: Mapped[datetime] = mapped_column(TZ, index=True)
    kind: Mapped[str] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    applied_at: Mapped[datetime | None] = mapped_column(TZ)


_ = ForeignKey  # kept for future FKs on notices/audit
