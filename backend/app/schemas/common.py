"""Shared schemas: sign-in, the current user, the clock, health."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import Field

from waypoint_rules.vocab import Role

from .base import ApiModel


class HealthOut(ApiModel):
    status: str = "ok"


class LoginIn(ApiModel):
    email: str
    password: str


class MeOut(ApiModel):
    id: int
    email: str
    role: Role
    display_name: str
    depot: str | None = None
    outlet_id: str | None = None
    vehicle_id: str | None = None


class LoginOut(ApiModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: MeOut


class ClockOut(ApiModel):
    """Scenario time in Asia/Colombo, with its offset (``2026-09-28T15:30:00+05:30``)."""

    now: datetime
    checkpoint: datetime
    service_date: date = Field(description="The delivery day an order placed now counts for")
    run_date: date = Field(description="The delivery run the apps are working on: today's until midday, then the next operating day")
    rate: float = Field(description="Scenario seconds per wall second: 1 is real time, 0 is paused")
    server_wall: datetime = Field(description="The server's wall clock when this was read, for extrapolating between polls")


class AdvanceIn(ApiModel):
    #: A time with an offset, or without one (then Asia/Colombo).
    to: datetime


class ResetOut(ApiModel):
    clock: ClockOut
    seeded: bool


class Window(ApiModel):
    start: str = Field(examples=["05:30"])
    end: str = Field(examples=["08:00"])


class Violation(ApiModel):
    rule_id: str
    message: str
    figures: dict[str, float | str | None] = Field(default_factory=dict)


class Page(ApiModel):
    next_cursor: str | None = None
