"""Calculations: trip minutes, the planned clock and planned fuel (PRD §4a)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta

from .model import Order, Outlet, RefData, Trip, Vehicle


def hhmm(dt: datetime) -> str:
    return dt.strftime("%H:%M")


def _group_stops(order_ids: list[str], orders: dict[str, Order]) -> list[tuple[str, list[str]]]:
    """Consecutive orders for the same outlet share one stop (one arrival, no hop between them)."""
    stops: list[tuple[str, list[str]]] = []
    for oid in order_ids:
        outlet_id = orders[oid].outlet_id
        if stops and stops[-1][0] == outlet_id:
            stops[-1][1].append(oid)
        else:
            stops.append((outlet_id, [oid]))
    return stops


def trip_minutes(trip: Trip, orders: dict[str, Order], ref: RefData) -> int:
    """Booklet formula (Task 2B), counted per ORDER, return leg excluded.

    trip min = outbound + inter_stop × (orders − 1) + Σ handling allowance(brand, dock_type)

    VEH003 trip 1: 24 + 8 × 4 + (15 + 16 + 15 + 15 + 15) = 132.
    """
    if not trip.order_ids:
        return 0
    first_outlet = ref.outlets[orders[trip.order_ids[0]].outlet_id]
    district = ref.district_of(first_outlet)
    handling = sum(ref.allowance(ref.outlets[orders[o].outlet_id]) for o in trip.order_ids)
    return district.outbound_min + district.inter_stop_min * (len(trip.order_ids) - 1) + handling


@dataclass(frozen=True, slots=True)
class StopTiming:
    outlet_id: str
    order_ids: tuple[str, ...]
    arrival: datetime
    handling_start: datetime
    handling_end: datetime
    window_close: datetime

    @property
    def waits(self) -> bool:
        return self.handling_start > self.arrival

    @property
    def late(self) -> bool:
        """Planned arrival after the (effective) window close."""
        return self.arrival > self.window_close


@dataclass(frozen=True, slots=True)
class TripClock:
    stops: tuple[StopTiming, ...]
    last_handling_end: datetime | None
    #: Back at the depot: last handling end + outbound time (earliest next departure).
    back_at_depot: datetime | None

    def stop_for_order(self, order_id: str) -> StopTiming | None:
        for s in self.stops:
            if order_id in s.order_ids:
                return s
        return None


def _on_day(day_anchor: datetime, t: time) -> datetime:
    return day_anchor.replace(hour=t.hour, minute=t.minute, second=0, microsecond=0)


def planned_clock(trip: Trip, orders: dict[str, Order], ref: RefData) -> TripClock:
    """Arrival, wait and handling per stop.

    Arrival = departure + outbound + inter-stop hops + handling at earlier stops + waiting.
    An early arrival waits for the window; handling starts at the later of arrival and
    window open. Orders at one outlet are handled one after the other.
    """
    if not trip.order_ids:
        return TripClock(stops=(), last_handling_end=None, back_at_depot=None)
    stops = _group_stops(trip.order_ids, orders)
    first_outlet = ref.outlets[stops[0][0]]
    district = ref.district_of(first_outlet)
    now = trip.depart_at + timedelta(minutes=district.outbound_min)
    timings: list[StopTiming] = []
    for i, (outlet_id, oids) in enumerate(stops):
        outlet: Outlet = ref.outlets[outlet_id]
        if i > 0:
            now = now + timedelta(minutes=district.inter_stop_min)
        arrival = now
        start = max(arrival, _on_day(trip.depart_at, outlet.effective_open))
        end = start + timedelta(minutes=ref.allowance(outlet) * len(oids))
        timings.append(
            StopTiming(
                outlet_id=outlet_id,
                order_ids=tuple(oids),
                arrival=arrival,
                handling_start=start,
                handling_end=end,
                window_close=_on_day(trip.depart_at, outlet.effective_close),
            )
        )
        now = end
    return TripClock(
        stops=tuple(timings),
        last_handling_end=now,
        back_at_depot=now + timedelta(minutes=district.outbound_min),
    )


@dataclass(frozen=True, slots=True)
class TripFuel:
    km: float
    litres: float


def planned_fuel(trip: Trip, vehicle: Vehicle, orders: dict[str, Order], ref: RefData) -> TripFuel:
    """km = 2 × depot_to_district_km + inter_stop_km × (orders − 1); litres = km ÷ km_per_l.

    The return leg counts for fuel only (A7).
    """
    if not trip.order_ids:
        return TripFuel(0.0, 0.0)
    district = ref.district_of(ref.outlets[orders[trip.order_ids[0]].outlet_id])
    km = 2 * district.outbound_km + district.inter_stop_km * (len(trip.order_ids) - 1)
    return TripFuel(km=km, litres=km / vehicle.km_per_l)


def trip_load(trip: Trip, orders: dict[str, Order]) -> tuple[float, float]:
    """(kg, m³) carried on the trip."""
    return (
        sum(orders[o].weight_kg for o in trip.order_ids),
        sum(orders[o].volume_m3 for o in trip.order_ids),
    )
