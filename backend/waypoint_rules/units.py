"""What a unit weighs and takes up for one outlet (PRD §19 StoreApi, A14, A42).

A store orders in units. The kilograms and cubic metres that follow from them decide which vehicles can
legally carry the order (``R-KG``, ``R-M3``) and how the planner packs the day, so the conversion is a rule
and lives here: the API computes it on every write and the screen only shows the estimate it is given.

The factors come from the outlet's own last order of that kind, which the API reads and passes in; this
module does the arithmetic and nothing else, so the Datathon notebook and the tests use the same function.
"""

from __future__ import annotations

from dataclasses import dataclass

#: Units, kilograms and cubic metres are rounded to this many places before they are stored or compared.
PLACES = 3


@dataclass(frozen=True, slots=True)
class UnitFactor:
    """What one unit of a kind means for an outlet."""

    kg: float
    m3: float


@dataclass(frozen=True, slots=True)
class Estimate:
    kg: float
    m3: float


def estimate(units: int, factor: UnitFactor) -> Estimate:
    """The weight and volume ``units`` comes to. The server's figure, never the client's."""
    return Estimate(kg=round(units * factor.kg, PLACES), m3=round(units * factor.m3, PLACES))


def disagrees(claimed_kg: float, claimed_m3: float, computed: Estimate, *, tolerance: float = 0.5) -> bool:
    """True when a client's own figure is further from the server's than rounding explains.

    The server's figure wins either way. This is only so a stale factor on a device can be noticed rather
    than silently corrected: a screen showing one weight while the plan uses another is worth a log line.
    """
    return abs(claimed_kg - computed.kg) > tolerance or abs(claimed_m3 - computed.m3) > tolerance
