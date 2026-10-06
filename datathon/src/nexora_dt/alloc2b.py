"""Task 2B peak-day allocation — PuLP MILP (HiGHS / CBC), official-checker semantics.

Seven rules + budgets, mapped 1:1 from check_allocation.py:
  available-only, depot match, one brand/trip, one district/trip,
  chilled=>reefer, van_only=>van, volume/weight capacity,
  trip_id in {1,2}, <=2 trips/vehicle/day,
  Fresh (pre-dawn) <= 270 min and Style/Tech (daytime) <= 480 min per vehicle.

Guarantee: the all-deferred solution is always feasible, so the model always
returns a valid submission; solver maximises the weighted priority objective.
The official checker is executed as the post-gate; non-zero exit => failure.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import pandas as pd
import pulp

from .paths import ARTIFACTS, CHECKER, GENERAL, TEST, assert_data_external

PREDAWN_BUDGET = 270.0
DAYTIME_BUDGET = 480.0
MAX_TRIPS = 2

W_CHILLED = 100.0
W_DEFERRED = 40.0
W_DAYS = 3.0
EPS_TRIP = 0.01  # lexicographic tie-break: fewer trips


def load(scenario: str):
    scn = pd.read_csv(TEST / "task2b_peak_day_scenarios.csv")
    scn = scn[scn.scenario == scenario].reset_index(drop=True)
    fleet = pd.read_csv(TEST / "task2b_peak_day_fleet.csv")
    avail = [
        r.vehicle_id
        for r in fleet.itertuples()
        if r.scenario == scenario and r.status == "available"
    ]
    veh = pd.read_csv(GENERAL / "vehicles.csv").set_index("vehicle_id")
    dtravel = pd.read_csv(GENERAL / "district_travel.csv").set_index("district").to_dict("index")
    al = pd.read_csv(GENERAL / "service_allowance.csv")
    allowance = {(r.brand, r.dock_type): r.service_allowance_min for r in al.itertuples()}
    return scn, avail, veh, dtravel, allowance


def solve(scenario: str, out_path: Path, time_limit: int = 300) -> int:
    assert_data_external()
    scn, avail, veh, dtravel, allowance = load(scenario)

    # Candidate trips: (vehicle, slot, brand, district) with depot match.
    trips = []
    for v in avail:
        depot = veh.loc[v, "depot"]
        for slot in (1, 2):
            for (b, d), g in scn.groupby(["brand", "district"]):
                if g.depot.iloc[0] == depot:
                    trips.append((v, slot, b, d))

    def eligible(o, tr) -> bool:
        v, _slot, b, d = tr
        if o.brand != b or o.district != d:
            return False
        vv = veh.loc[v]
        if o.temp_requirement == "chilled" and vv.temp != "reefer":
            return False
        if o.parking_constraint == "van_only" and vv.type != "van":
            return False
        return True

    prob = pulp.LpProblem("task2b_peak_day", pulp.LpMaximize)
    y = pulp.LpVariable.dicts("y", trips, cat="Binary")
    x = {}
    for o in scn.itertuples():
        for tr in trips:
            if eligible(o, tr):
                x[(o.Index, tr)] = pulp.LpVariable(f"x_{o.Index}_{tr[0]}_{tr[1]}", cat="Binary")

    # Each order served at most once (unserved => deferred).
    for o in scn.itertuples():
        xs = [xv for (i, _tr), xv in x.items() if i == o.Index]
        if xs:
            prob += pulp.lpSum(xs) <= 1

    # Per-trip: capacity, non-empty, x <= y.
    for tr in trips:
        v, _slot, _b, _d = tr
        vv = veh.loc[v]
        xs = [(o, x[(o.Index, tr)]) for o in scn.itertuples() if (o.Index, tr) in x]
        if not xs:
            prob += y[tr] == 0
            continue
        prob += pulp.lpSum(o.order_volume_m3 * xv for o, xv in xs) <= vv.volume_cap_m3 * y[tr]
        prob += pulp.lpSum(o.order_weight_kg * xv for o, xv in xs) <= vv.weight_cap_kg * y[tr]
        prob += pulp.lpSum(xv for _o, xv in xs) >= y[tr]
        for _o, xv in xs:
            prob += xv <= y[tr]

    # One pattern per (vehicle, slot); max 2 trips per vehicle.
    for v in avail:
        for slot in (1, 2):
            prob += pulp.lpSum(y[tr] for tr in trips if tr[0] == v and tr[1] == slot) <= 1
        prob += pulp.lpSum(y[tr] for tr in trips if tr[0] == v) <= MAX_TRIPS
        
        # Operational hygiene: Trip 1 must be utilized before Trip 2 is scheduled
        prob += pulp.lpSum(y[tr] for tr in trips if tr[0] == v and tr[1] == 2) <= pulp.lpSum(y[tr] for tr in trips if tr[0] == v and tr[1] == 1)
        
        # Pre-dawn Fresh deliveries occur 03:00-07:30 before daytime routes; must occupy slot 1
        fresh_in_slot2 = pulp.lpSum(y[tr] for tr in trips if tr[0] == v and tr[1] == 2 and tr[2] == "Fresh")
        fresh_in_slot1 = pulp.lpSum(y[tr] for tr in trips if tr[0] == v and tr[1] == 1 and tr[2] == "Fresh")
        prob += fresh_in_slot2 <= fresh_in_slot1

    # Linear trip-time expression, identical to check_allocation.trip_time().
    def trip_time_expr(tr):
        _v, _slot, b, d = tr
        dtr = dtravel[d]
        xs = [(o, x[(o.Index, tr)]) for o in scn.itertuples() if (o.Index, tr) in x]
        n = pulp.lpSum(xv for _o, xv in xs)
        allow = pulp.lpSum(allowance[(b, o.dock_type)] * xv for o, xv in xs)
        return (
            dtr["depot_to_district_freeflow_min"] * y[tr]
            + dtr["inter_stop_freeflow_min"] * (n - y[tr])
            + allow
        )

    for v in avail:
        fresh = [tr for tr in trips if tr[0] == v and tr[2] == "Fresh"]
        other = [tr for tr in trips if tr[0] == v and tr[2] != "Fresh"]
        if fresh:
            prob += pulp.lpSum(trip_time_expr(tr) for tr in fresh) <= PREDAWN_BUDGET
        if other:
            prob += pulp.lpSum(trip_time_expr(tr) for tr in other) <= DAYTIME_BUDGET

    def weight(o) -> float:
        return (
            1.0
            + W_CHILLED * (o.temp_requirement == "chilled")
            + W_DEFERRED * o.deferred_yesterday
            + W_DAYS * o.days_since_last_served
        )

    prob += (
        pulp.lpSum(weight(scn.iloc[i]) * xv for (i, _tr), xv in x.items())
        - EPS_TRIP * pulp.lpSum(y[tr] for tr in trips)
    )

    available_solvers = pulp.listSolvers(onlyAvailable=True)
    if "HiGHS" in available_solvers:
        solver = pulp.HiGHS(msg=1, timeLimit=time_limit)
    else:
        solver = pulp.PULP_CBC_CMD(msg=1, timeLimit=time_limit, gapRel=0.0)

    status = prob.solve(solver)
    if pulp.LpStatus[status] not in ("Optimal", "Feasible"):
        print(f"FAIL: solver status {pulp.LpStatus[status]}")
        return 1
    served = sum(1 for xv in x.values() if xv.value() and xv.value() > 0.5)
    used = sum(1 for tr in trips if y[tr].value() and y[tr].value() > 0.5)
    print(f"solver={pulp.LpStatus[status]} served={served}/{len(scn)} trips={used}")

    rows = []
    for o in scn.itertuples():
        hit = [tr for (i, tr), xv in x.items() if i == o.Index and xv.value() and xv.value() > 0.5]
        if hit:
            v, slot, _b, _d = hit[0]
            rows.append((scenario, o.order_ref, o.outlet_id, "served", v, slot))
        else:
            rows.append((scenario, o.order_ref, o.outlet_id, "deferred", pd.NA, pd.NA))
    sub = pd.DataFrame(
        rows, columns=["scenario", "order_ref", "outlet_id", "decision", "vehicle_id", "trip_id"]
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sub.to_csv(out_path, index=False)
    print(f"wrote {out_path}")

    # Mandatory official gate.
    rc = subprocess.run([sys.executable, str(CHECKER), str(out_path)]).returncode
    return rc


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenario", default="S1")
    ap.add_argument("--out", default=str(ARTIFACTS / "submission_task2b.csv"))
    ap.add_argument("--time-limit", type=int, default=300)
    args = ap.parse_args()
    sys.exit(solve(args.scenario, Path(args.out).expanduser(), args.time_limit))
