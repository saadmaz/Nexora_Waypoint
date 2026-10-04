"""Refusal messages, written once in the screen voice (PRD §11).

Every screen that shows a refusal takes its words from here, so the dispatcher's trip board,
the D8 recommendation and the API all say the same thing.
"""

from __future__ import annotations

from .vocab import RuleId


def _kg(v: float) -> str:
    return f"{v:,.0f}"


def _m3(v: float) -> str:
    return f"{v:.1f}"


def kg_over(vehicle_id: str, load: float, cap: float) -> str:
    return f"Over weight: {_kg(load)} of {_kg(cap)} kg on {vehicle_id}"


def m3_over(vehicle_id: str, load: float, cap: float) -> str:
    return f"Over volume: {_m3(load)} of {_m3(cap)} m³ on {vehicle_id}"


def needs_reefer(vehicle_id: str) -> str:
    return f"Needs a reefer: {vehicle_id} is ambient"


def van_only(outlet_id: str, vehicle_id: str) -> str:
    return f"{outlet_id} takes vans only: {vehicle_id} is a truck"


def wrong_depot(vehicle_id: str, vehicle_depot: str, outlet_id: str, outlet_depot: str) -> str:
    return f"{vehicle_id} runs from {vehicle_depot.title()}; {outlet_id} is served from {outlet_depot.title()}"


def two_brands(a: str, b: str) -> str:
    return f"Two brands on one trip: {a} and {b}"


def two_districts(a: str, b: str) -> str:
    return f"Two districts on one trip: {a} and {b}"


def too_many_trips(vehicle_id: str, n: int) -> str:
    return f"{vehicle_id} would run {n} trips; the limit is 2"


def before_return(vehicle_id: str, trip_no: int, depart: str, prev_no: int, back: str) -> str:
    return f"{vehicle_id} trip {trip_no} leaves at {depart}, before trip {prev_no} is back at the depot at {back}"


def over_budget(vehicle_id: str, group: str, minutes: int, budget: int) -> str:
    return f"{group} minutes over budget: {minutes} of {budget} on {vehicle_id}"


def unavailable(vehicle_id: str, until: str | None) -> str:
    if until:
        return f"{vehicle_id} is in the workshop until {until}"
    return f"{vehicle_id} is held and can't be allocated"


def over_fuel(vehicle_id: str, litres: float, quota: float) -> str:
    return f"Weekly fuel over quota: {litres:.1f} of {quota:.0f} L on {vehicle_id}"


def after_window(arrival: str, outlet_id: str, close: str) -> str:
    return f"Arrives {arrival}, after {outlet_id} closes at {close}"


def after_mall(arrival: str, outlet_id: str, close: str) -> str:
    return f"Arrives {arrival}, after the {outlet_id} mall dock closes at {close}"


def continuity(outlet_id: str) -> str:
    return f"{outlet_id} was deferred yesterday; the continuity guard protects it"


def no_legal_vehicle(
    needs: list[str], largest_label: str | None, largest_kg: float | None, depot: str
) -> str:
    """Deferred · capacity (PRD §4b), e.g. ORD1020: "van_only and 1,250 kg; the largest Peliyagoda reefer van
    carries 1,040 kg; whole orders can't split."."""
    what = " and ".join(needs)
    if largest_label is None or largest_kg is None:
        return f"{what}; {depot.title()} has no vehicle that can take it; whole orders can't split."
    return f"{what}; the largest {depot.title()} {largest_label} carries {_kg(largest_kg)} kg; whole orders can't split."


def no_vehicle_free(depot: str) -> str:
    """Deferred · policy when a vehicle could carry the order but none is free for the whole morning."""
    return f"Every vehicle that could carry this order is busy or out of service at {depot.title()} today"


#: Human names for rule IDs (for tags and logs, not for refusals).
RULE_NAMES: dict[RuleId, str] = {
    RuleId.KG: "Weight capacity",
    RuleId.M3: "Volume capacity",
    RuleId.TEMP: "Chilled needs a reefer",
    RuleId.VAN: "Van only",
    RuleId.DEPOT: "Home depot",
    RuleId.WHOLE: "Whole orders only",
    RuleId.BRAND: "One brand per trip",
    RuleId.DISTRICT: "One district per trip",
    RuleId.TRIPS: "Two trips per vehicle",
    RuleId.TURN: "Next trip after the last one returns",
    RuleId.BUDGET_FRESH: "Fresh 270 minutes",
    RuleId.BUDGET_STYLE_TECH: "Style and Tech 480 minutes",
    RuleId.AVAIL: "Vehicle available",
    RuleId.FUEL: "Weekly fuel quota",
    RuleId.WINDOW: "Delivery window",
    RuleId.MALL: "Mall dock window",
    RuleId.CUTOFF: "16:00 cutoff",
    RuleId.OPDAY: "Operating day",
    RuleId.EDIT: "Edits before 16:00",
    RuleId.CONT: "Continuity guard",
}
