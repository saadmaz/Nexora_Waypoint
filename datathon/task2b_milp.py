"""
task2b_milp.py - Optimal Fleet Allocation via MILP (PuLP)
Solves Scenario S1 allocating orders to available vehicles and trips,
maximizing priority-weighted served orders subject to all physical,
capacity, district, brand, temperature, and duration constraints.
"""

import sys
from pathlib import Path

cur_dir = Path(__file__).resolve().parent
if str(cur_dir.parent) not in sys.path:
    sys.path.insert(0, str(cur_dir.parent))
if str(cur_dir) not in sys.path:
    sys.path.insert(0, str(cur_dir))

import pandas as pd
import numpy as np
import subprocess
import pulp
from datathon.config import FILES, SUBMISSIONS_DIR, DATA_ROOT

def load_data():
    scenarios = pd.read_csv(FILES["task2b_peak_day_scenarios"])
    fleet = pd.read_csv(FILES["task2b_peak_day_fleet"])
    vehicles = pd.read_csv(FILES["vehicles"]).set_index("vehicle_id")
    district_travel = pd.read_csv(FILES["district_travel"]).set_index("district").to_dict("index")
    service_allowance = pd.read_csv(FILES["service_allowance"])
    allowances = {
        (r.brand, r.dock_type): r.service_allowance_min
        for r in service_allowance.itertuples()
    }
    
    avail_fleet = fleet[fleet["status"] == "available"]["vehicle_id"].tolist()
    avail_vehicles = vehicles.loc[avail_fleet].copy()
    avail_vehicles = avail_vehicles[avail_vehicles["depot"] == "Peliyagoda"]
    
    return scenarios, avail_vehicles, district_travel, allowances

def calc_trip_time(district, brand, docks, dtravel, allowances):
    n = len(docks)
    if n == 0:
        return 0.0
    d = dtravel[district]
    return (
        d["depot_to_district_freeflow_min"]
        + (n - 1) * d["inter_stop_freeflow_min"]
        + sum(allowances[(brand, dk)] for dk in docks)
    )

def solve_milp():
    scenarios, vehicles, dtravel, allowances = load_data()
    
    # Calculate order weights for objective function:
    # 1. deferred_yesterday is top priority (prevent consecutive deferral)
    # 2. days_since_last_served
    # 3. chilled Fresh (perishable)
    # 4. base order bonus (every served order is +1000)
    scenarios["obj_weight"] = (
        1000.0 + # base value for serving any order
        scenarios["deferred_yesterday"] * 5000.0 +
        scenarios["days_since_last_served"] * 200.0 +
        (scenarios["temp_requirement"] == "chilled") * 100.0
    )
    
    orders = scenarios.to_dict("records")
    order_dict = {o["order_ref"]: o for o in orders}
    veh_list = list(vehicles.index)
    
    # We can assign orders to (vehicle, trip) where trip in [1, 2]
    # Decision variables:
    # x[o, v, t] in {0, 1}: order o is served by vehicle v in trip t
    # y[v, t] in {0, 1}: vehicle v operates trip t
    # cell_used[v, t, brand, district] in {0, 1}: indicates vehicle v trip t serves (brand, district)
    
    prob = pulp.LpProblem("Task2B_Allocation", pulp.LpMaximize)
    
    # Identify unique (brand, district) pairs
    cells = sorted(list(set((o["brand"], o["district"]) for o in orders)))
    orders_in_cell = {c: [o["order_ref"] for o in orders if (o["brand"], o["district"]) == c] for c in cells}
    
    # Variables
    x = {}
    for o in orders:
        oref = o["order_ref"]
        for v in veh_list:
            vrow = vehicles.loc[v]
            # Prune impossible order-vehicle pairings:
            # 1. van_only requires van
            if o["parking_constraint"] == "van_only" and vrow["type"] != "van":
                continue
            # 2. chilled requires reefer
            if o["temp_requirement"] == "chilled" and vrow["temp"] != "reefer":
                continue
            for t in [1, 2]:
                x[(oref, v, t)] = pulp.LpVariable(f"x_{oref}_{v}_{t}", cat=pulp.LpBinary)
                
    y_cell = {}
    for v in veh_list:
        for t in [1, 2]:
            for c in cells:
                y_cell[(v, t, c)] = pulp.LpVariable(f"ycell_{v}_{t}_{c[0]}_{c[1]}", cat=pulp.LpBinary)
                
    # Objective: Maximize priority-weighted served orders
    prob += pulp.lpSum(
        order_dict[oref]["obj_weight"] * x[(oref, v, t)]
        for (oref, v, t) in x
    )
    
    # Constraints:
    # 1. Each order served at most once
    for o in orders:
        oref = o["order_ref"]
        valid_vars = [x[(oref, v, t)] for v in veh_list for t in [1, 2] if (oref, v, t) in x]
        if valid_vars:
            prob += pulp.lpSum(valid_vars) <= 1, f"once_{oref}"
            
    # 2. Each (v, t) can serve AT MOST ONE cell (brand, district)
    for v in veh_list:
        for t in [1, 2]:
            prob += pulp.lpSum(y_cell[(v, t, c)] for c in cells) <= 1, f"one_cell_{v}_{t}"
            
    # 3. Order can only be assigned to (v, t) if y_cell[(v, t, cell)] == 1
    for c in cells:
        for oref in orders_in_cell[c]:
            for v in veh_list:
                for t in [1, 2]:
                    if (oref, v, t) in x:
                        prob += x[(oref, v, t)] <= y_cell[(v, t, c)], f"cell_link_{oref}_{v}_{t}"
                        
    # 4. Capacity constraints (weight and volume)
    for v in veh_list:
        vrow = vehicles.loc[v]
        w_cap = vrow["weight_cap_kg"]
        v_cap = vrow["volume_cap_m3"]
        for t in [1, 2]:
            vars_vt = [(oref, x[(oref, v, t)]) for oref in order_dict if (oref, v, t) in x]
            if vars_vt:
                prob += (
                    pulp.lpSum(order_dict[oref]["order_weight_kg"] * var for (oref, var) in vars_vt) <= w_cap,
                    f"wcap_{v}_{t}"
                )
                prob += (
                    pulp.lpSum(order_dict[oref]["order_volume_m3"] * var for (oref, var) in vars_vt) <= v_cap,
                    f"vcap_{v}_{t}"
                )
                
    # 5. Trip duration and daily budget constraints:
    # Duration = outbound + (n - 1)*inter_stop + sum(handling)
    # Notice: (n - 1)*inter_stop = n * inter_stop - inter_stop (if n > 0).
    # Precisely: for a given cell c = (brand, district):
    # dur = y_cell * (depot_to_dist - inter_stop) + sum_o (inter_stop + allowance) * x_o
    # Let's verify:
    # If 1 stop: (depot_to_dist - inter_stop) + (inter_stop + allowance) = depot_to_dist + allowance (exact!)
    # If 2 stops: (depot_to_dist - inter_stop) + 2*inter_stop + allowance1 + allowance2 = depot_to_dist + inter_stop + allowances (exact!)
    # This is a linear expression in x and y_cell.
    for v in veh_list:
        fresh_time_expr = []
        other_time_expr = []
        for t in [1, 2]:
            for c in cells:
                brand, district = c
                dinfo = dtravel[district]
                d_out = dinfo["depot_to_district_freeflow_min"]
                d_inter = dinfo["inter_stop_freeflow_min"]
                base_time = d_out - d_inter
                
                # Handling time per order
                cell_orders_vt = [
                    (oref, x[(oref, v, t)], d_inter + allowances[(brand, order_dict[oref]["dock_type"])])
                    for oref in orders_in_cell[c]
                    if (oref, v, t) in x
                ]
                
                if cell_orders_vt:
                    trip_time_expr = y_cell[(v, t, c)] * base_time + pulp.lpSum(coeff * var for (_, var, coeff) in cell_orders_vt)
                    if brand == "Fresh":
                        fresh_time_expr.append(trip_time_expr)
                    else:
                        other_time_expr.append(trip_time_expr)
                        
        if fresh_time_expr:
            prob += pulp.lpSum(fresh_time_expr) <= 270.0, f"fresh_budget_{v}"
        if other_time_expr:
            prob += pulp.lpSum(other_time_expr) <= 480.0, f"daytime_budget_{v}"
            
    # Symmetry breaking: trip 1 must be active if trip 2 is active
    for v in veh_list:
        prob += (
            pulp.lpSum(y_cell[(v, 2, c)] for c in cells) <= pulp.lpSum(y_cell[(v, 1, c)] for c in cells),
            f"sym_{v}"
        )
        
    print(f"Problem constructed: {len(prob.variables())} variables, {len(prob.constraints)} constraints.")
    solver = pulp.PULP_CBC_CMD(msg=True, timeLimit=60)
    res = prob.solve(solver)
    print("Solver Status:", pulp.LpStatus[res])
    
    # Extract results
    assigned = {}
    for (oref, v, t), var in x.items():
        if var.varValue and var.varValue > 0.5:
            assigned[oref] = (v, t)
            
    results = []
    for _, row in scenarios.iterrows():
        oref = row["order_ref"]
        if oref in assigned:
            v, t = assigned[oref]
            results.append({
                "scenario": row["scenario"],
                "order_ref": oref,
                "outlet_id": row["outlet_id"],
                "decision": "served",
                "vehicle_id": v,
                "trip_id": t
            })
        else:
            results.append({
                "scenario": row["scenario"],
                "order_ref": oref,
                "outlet_id": row["outlet_id"],
                "decision": "deferred",
                "vehicle_id": "",
                "trip_id": ""
            })
            
    df_res = pd.DataFrame(results)
    out_path = SUBMISSIONS_DIR / "submission_task2b.csv"
    df_res.to_csv(out_path, index=False)
    
    n_served = (df_res["decision"] == "served").sum()
    n_def = (df_res["decision"] == "deferred").sum()
    print(f"MILP Allocation: {n_served} served, {n_def} deferred.")
    
    # Check feasibility
    check_script = FILES["check_allocation"]
    check_res = subprocess.run(
        [sys.executable, str(check_script), str(out_path)],
        cwd=str(DATA_ROOT),
        capture_output=True,
        text=True
    )
    print("--- check_allocation.py verification ---")
    print(check_res.stdout)
    if check_res.stderr:
        print("STDERR:", check_res.stderr)
        
    return df_res, check_res.returncode == 0

if __name__ == "__main__":
    solve_milp()
