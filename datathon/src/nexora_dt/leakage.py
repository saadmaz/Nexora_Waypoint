"""Hard leakage gate for Task 1 features. Import and call before any fit()."""
from __future__ import annotations

from collections.abc import Iterable

# Actuals and label-derived columns may NEVER enter a feature matrix.
BLOCKED = frozenset(
    {
        "arrival_time",
        "leave_outlet_time",
        "actual_depart_time",
        "actual_travel_duration_min",
        "service_time_min",
        "late_binary",
        "wait_min",
    }
)

# Raw columns that are legal at prediction time (task1_test_inputs +
# route_legs_test planned-only). Engineered features must use the prefixes
# below so this gate can distinguish them from raw actuals.
ALLOWED_RAW = frozenset(
    {
        "delivery_id", "order_date", "dispatch_date", "dispatch_status",
        "outlet_id", "brand", "district", "depot", "temp_requirement",
        "order_units", "order_weight_kg", "order_volume_m3",
        "route_id", "seq_in_route", "vehicle_id", "vehicle_type", "vehicle_temp",
        "planned_arrival_time", "window_open_time", "window_close_time",
        "leg_id", "date", "seq", "from_point", "to_outlet", "distance_km",
        "planned_depart_time", "planned_travel_duration_min", "monsoon", "dow",
    }
)

# Engineered prefixes. 'te_' = target encoding: MUST be fitted out-of-fold
# on the training split only (CV hygiene), never on train+test jointly.
ALLOWED_PREFIXES = ("cal_", "hist_", "te_", "geo_", "veh_", "win_", "plan_", "route_", "ord_")


def assert_no_leakage(columns: Iterable[str]) -> None:
    cols = set(columns)
    bad = BLOCKED & cols
    if bad:
        raise RuntimeError(f"LEAKAGE: blocked feature(s) present: {sorted(bad)}")
    unknown = {
        c
        for c in cols
        if c not in ALLOWED_RAW and not c.startswith(ALLOWED_PREFIXES)
    }
    if unknown:
        raise RuntimeError(
            f"Unregistered feature(s): {sorted(unknown)}. "
            "Add to ALLOWED_RAW with a leakage justification, or rename with an "
            "approved engineered prefix."
        )
