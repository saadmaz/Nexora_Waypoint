import sys
import os
from pathlib import Path

cur_dir = Path(__file__).resolve().parent
if str(cur_dir.parent) not in sys.path:
    sys.path.insert(0, str(cur_dir.parent))
if str(cur_dir) not in sys.path:
    sys.path.insert(0, str(cur_dir))

import pandas as pd
import numpy as np
import subprocess
from datathon.config import FILES, OUTPUT_DIR, SUBMISSIONS_DIR, DATA_ROOT

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
    
    # Filter available fleet for Peliyagoda depot
    avail_fleet = fleet[fleet["status"] == "available"]["vehicle_id"].tolist()
    avail_vehicles = vehicles.loc[avail_fleet].copy()
    avail_vehicles = avail_vehicles[avail_vehicles["depot"] == "Peliyagoda"]
    
    return scenarios, avail_vehicles, district_travel, allowances

def calc_trip_duration(district, brand, dock_types, district_travel, allowances):
    d = district_travel[district]
    n = len(dock_types)
    if n == 0:
        return 0.0
    outbound = d["depot_to_district_freeflow_min"]
    inter_stop = (n - 1) * d["inter_stop_freeflow_min"]
    handling = sum(allowances[(brand, dt)] for dt in dock_types)
    return outbound + inter_stop + handling

def solve_allocation():
    scenarios, vehicles, dtravel, allowances = load_data()
    
    # Priority score for sorting orders:
    # High weight to: deferred_yesterday (critical: prevent consecutive misses)
    # days_since_last_served, Fresh chilled (perishable)
    scenarios["priority_score"] = (
        scenarios["deferred_yesterday"] * 1000.0 +
        scenarios["days_since_last_served"] * 50.0 +
        (scenarios["temp_requirement"] == "chilled") * 20.0 +
        (scenarios["brand"] == "Fresh") * 10.0
    )
    
    # Sort orders by priority descending
    orders_sorted = scenarios.sort_values(by="priority_score", ascending=False).copy()
    
    # Track assignments
    assigned_orders = {}  # order_ref -> (vehicle_id, trip_id)
    
    # Track vehicle usage:
    # vehicle_id -> {
    #   'trips': {1: [orders], 2: [orders]},
    #   'fresh_min': float,
    #   'style_tech_min': float
    # }
    veh_state = {}
    for vid, vrow in vehicles.iterrows():
        veh_state[vid] = {
            "row": vrow,
            "trips": {1: [], 2: []},
            "fresh_min": 0.0,
            "style_tech_min": 0.0,
        }
        
    # Group orders by (brand, district) cell
    # In each cell, attempt to batch orders into trips
    # To maximise served orders while strictly respecting capacity and budgets:
    # Group orders by brand, then district
    cells = orders_sorted.groupby(["brand", "district"])
    
    # Prioritise Fresh cells first (since Fresh operates in pre-dawn window 03:30-08:00)
    sorted_cells = sorted(cells, key=lambda c: (0 if c[0][0] == "Fresh" else 1, -len(c[1])))
    
    for (brand, district), cell_df in sorted_cells:
        cell_orders = cell_df.to_dict("records")
        
        # Sort cell orders by van_only requirement and chilled requirement first
        cell_orders = sorted(
            cell_orders,
            key=lambda o: (
                o["parking_constraint"] == "van_only",
                o["temp_requirement"] == "chilled",
                o["priority_score"]
            ),
            reverse=True
        )
        
        for order in cell_orders:
            oref = order["order_ref"]
            if oref in assigned_orders:
                continue
                
            needs_van = (order["parking_constraint"] == "van_only")
            needs_reefer = (order["temp_requirement"] == "chilled")
            weight = order["order_weight_kg"]
            vol = order["order_volume_m3"]
            dock = order["dock_type"]
            is_fresh = (brand == "Fresh")
            budget_limit = 270.0 if is_fresh else 480.0
            
            # Find an existing trip or open a new trip
            best_placement = None
            
            # 1. Try to add to an existing open trip in the same cell
            for vid, st in veh_state.items():
                vrow = st["row"]
                if needs_van and vrow["type"] != "van":
                    continue
                if needs_reefer and vrow["temp"] != "reefer":
                    continue
                    
                for tid in [1, 2]:
                    current_trip = st["trips"][tid]
                    if len(current_trip) > 0:
                        # Must match cell brand and district
                        if current_trip[0]["brand"] != brand or current_trip[0]["district"] != district:
                            continue
                            
                        # Check capacity
                        cur_w = sum(o["order_weight_kg"] for o in current_trip)
                        cur_v = sum(o["order_volume_m3"] for o in current_trip)
                        if cur_w + weight > vrow["weight_cap_kg"] or cur_v + vol > vrow["volume_cap_m3"]:
                            continue
                            
                        # Check trip duration and budget
                        docks = [o["dock_type"] for o in current_trip] + [dock]
                        new_trip_dur = calc_trip_duration(district, brand, docks, dtravel, allowances)
                        old_trip_dur = calc_trip_duration(district, brand, [o["dock_type"] for o in current_trip], dtravel, allowances)
                        delta_dur = new_trip_dur - old_trip_dur
                        
                        cur_budget = st["fresh_min"] if is_fresh else st["style_tech_min"]
                        if cur_budget + delta_dur <= budget_limit:
                            best_placement = (vid, tid, "add", delta_dur)
                            break
                if best_placement:
                    break
                    
            # 2. If cannot add to existing trip, try to create a new trip (trip 1 or 2)
            if not best_placement:
                for vid, st in veh_state.items():
                    vrow = st["row"]
                    if needs_van and vrow["type"] != "van":
                        continue
                    if needs_reefer and vrow["temp"] != "reefer":
                        continue
                        
                    for tid in [1, 2]:
                        if len(st["trips"][tid]) == 0:
                            # Can open new trip
                            if weight <= vrow["weight_cap_kg"] and vol <= vrow["volume_cap_m3"]:
                                new_dur = calc_trip_duration(district, brand, [dock], dtravel, allowances)
                                cur_budget = st["fresh_min"] if is_fresh else st["style_tech_min"]
                                if cur_budget + new_dur <= budget_limit:
                                    best_placement = (vid, tid, "new", new_dur)
                                    break
                    if best_placement:
                        break
                        
            # Execute placement if found
            if best_placement:
                vid, tid, action, dur_add = best_placement
                veh_state[vid]["trips"][tid].append(order)
                if is_fresh:
                    veh_state[vid]["fresh_min"] += dur_add
                else:
                    veh_state[vid]["style_tech_min"] += dur_add
                assigned_orders[oref] = (vid, tid)
                
    # Build submission DataFrame
    results = []
    for _, row in scenarios.iterrows():
        oref = row["order_ref"]
        if oref in assigned_orders:
            vid, tid = assigned_orders[oref]
            results.append({
                "scenario": row["scenario"],
                "order_ref": oref,
                "outlet_id": row["outlet_id"],
                "decision": "served",
                "vehicle_id": vid,
                "trip_id": tid
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
            
    sub_df = pd.DataFrame(results)
    out_path = SUBMISSIONS_DIR / "submission_task2b.csv"
    sub_df.to_csv(out_path, index=False)
    
    # Print statistics
    served_cnt = (sub_df["decision"] == "served").sum()
    def_cnt = (sub_df["decision"] == "deferred").sum()
    print(f"Task 2B Allocation Complete: {served_cnt} served, {def_cnt} deferred.")
    
    # Verify with check_allocation.py
    check_script = FILES["check_allocation"]
    res = subprocess.run(
        [sys.executable, str(check_script), str(out_path)],
        cwd=str(DATA_ROOT),
        capture_output=True,
        text=True
    )
    print("--- check_allocation.py output ---")
    print(res.stdout)
    if res.stderr:
        print("STDERR:", res.stderr)
        
    return sub_df, res.returncode == 0

if __name__ == "__main__":
    sub_df, passed = solve_allocation()
    print("Feasibility passed:", passed)
