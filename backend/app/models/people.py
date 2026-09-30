"""People and access (PRD §10)."""

from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from waypoint_rules.vocab import Role

from ..db import Base
from ._types import enum_col


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(Text, unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[Role] = mapped_column(enum_col(Role, "role"))
    display_name: Mapped[str] = mapped_column(Text)
    depot_id: Mapped[str | None] = mapped_column(ForeignKey("depots.id"))
    outlet_id: Mapped[str | None] = mapped_column(ForeignKey("outlets.id"))
    vehicle_id: Mapped[str | None] = mapped_column(ForeignKey("vehicles.id"))


class PinPerson(Base):
    __tablename__ = "pin_people"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    loader_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(Text)
    dock: Mapped[str] = mapped_column(ForeignKey("depots.id"))
    pin_hash: Mapped[str] = mapped_column(Text)


class Driver(Base):
    __tablename__ = "drivers"

    vehicle_id: Mapped[str] = mapped_column(ForeignKey("vehicles.id"), primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
