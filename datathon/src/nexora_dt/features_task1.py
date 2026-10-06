"""Task 1 Feature Engineering pipeline for Nexora Datathon.

Builds strictly legal, leakage-free feature matrices for training and test.
All engineered columns use approved prefixes and pass assert_no_leakage().
Historical statistics / target encodings are computed OUT-OF-FOLD on train,
and fitted on full train when transforming test.
"""
from __future__ import annotations

from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import KFold

from .paths import TRAIN, TEST, GENERAL, assert_data_external
from .leakage import assert_no_leakage
from .labels_task1 import hhmm_to_min, load_joined


def load_auxiliary_data():
    calendar = pd.read_csv(GENERAL / "calendar.csv")
    outlets = pd.read_csv(GENERAL / "outlets.csv")
    road_cond = pd.read_csv(GENERAL / "road_conditions.csv")
    traffic = pd.read_csv(GENERAL / "traffic_speed.csv")
    vehicles = pd.read_csv(GENERAL / "vehicles.csv")
    allowance = pd.read_csv(GENERAL / "service_allowance.csv")
    dtravel = pd.read_csv(GENERAL / "district_travel.csv")
    
    return {
        "calendar": calendar,
        "outlets": outlets,
        "road_conditions": road_cond,
        "traffic": traffic,
        "vehicles": vehicles,
        "allowance": allowance,
        "district_travel": dtravel,
    }


def extract_raw_features(split: str = "train") -> pd.DataFrame:
    assert_data_external()
    aux = load_auxiliary_data()
    m = load_joined(split)
    
    # If train, filter only rows that ran (have legs and arrival times)
    if split == "train":
        m = m[m["arrival_time"].notna()].copy()
        
    # Join outlets info (dock_type, parking_constraint, mall_window)
    # Note: outlets has outlet_id
    outlets = aux["outlets"][["outlet_id", "dock_type", "parking_constraint", "mall_window"]]
    m = m.merge(outlets, on="outlet_id", how="left")
    
    # Join service allowance by (brand, dock_type)
    m = m.merge(aux["allowance"], on=["brand", "dock_type"], how="left")
    
    # Join calendar info by date
    # In deliveries: order_date / dispatch_date. Route leg has 'date'.
    cal = aux["calendar"][[
        "date", "is_weekend", "is_payday", "festival_ramp", "is_holiday", "iso_week"
    ]]
    m = m.merge(cal, on="date", how="left")
    
    # Join road conditions by (district, date)
    m = m.merge(aux["road_conditions"], on=["district", "date"], how="left")
    
    # Join district travel by (district, depot)
    m = m.merge(
        aux["district_travel"][[
            "district", "depot", "road_class", "free_flow_kmh",
            "depot_to_district_km", "depot_to_district_freeflow_min",
            "inter_stop_km", "inter_stop_freeflow_min"
        ]],
        on=["district", "depot"],
        how="left"
    )
    
    # Join vehicles info
    veh = aux["vehicles"][["vehicle_id", "weight_cap_kg", "volume_cap_m3", "km_per_l"]]
    m = m.merge(veh, on="vehicle_id", how="left")
    
    # Compute route stop counts from route_id
    route_stop_counts = m.groupby("route_id")["seq_in_route"].transform("max")
    m["route_total_stops"] = route_stop_counts
    
    # Planned times in minutes since midnight
    plan_arr = hhmm_to_min(m["planned_arrival_time"])
    plan_dep = hhmm_to_min(m["planned_depart_time"])
    win_open = hhmm_to_min(m["window_open_time"])
    win_close = hhmm_to_min(m["window_close_time"])
    
    # Join traffic speed by (district, hour, monsoon)
    arr_hour = (plan_arr // 60).fillna(8).clip(0, 23).astype(int)
    m["cal_hour"] = arr_hour
    m["monsoon"] = m["monsoon"].fillna(0).astype(int)
    traffic = aux["traffic"].rename(columns={"hour": "cal_hour"})
    m = m.merge(traffic, on=["district", "cal_hour", "monsoon"], how="left")
    
    # Engineered features with approved prefixes:
    feats = pd.DataFrame(index=m.index)
    feats["delivery_id"] = m["delivery_id"].values
    
    # 1. Order physics (ord_)
    feats["ord_units"] = m["order_units"].astype(float).values
    feats["ord_weight_kg"] = m["order_weight_kg"].astype(float).values
    feats["ord_volume_m3"] = m["order_volume_m3"].astype(float).values
    feats["ord_density"] = (feats["ord_weight_kg"] / (feats["ord_volume_m3"] + 1e-4)).values
    feats["ord_weight_per_unit"] = (feats["ord_weight_kg"] / (feats["ord_units"] + 1e-4)).values
    feats["ord_volume_per_unit"] = (feats["ord_volume_m3"] / (feats["ord_units"] + 1e-4)).values
    feats["ord_is_chilled"] = (m["temp_requirement"] == "chilled").astype(float).values
    feats["ord_is_deferred"] = (m["dispatch_status"] == "deferred").astype(float).values
    
    # 2. Planned schedule & windows (plan_, win_)
    feats["plan_arr_min"] = plan_arr.astype(float).values
    feats["plan_dep_min"] = plan_dep.astype(float).values
    feats["plan_travel_dur_min"] = m["planned_travel_duration_min"].astype(float).values
    feats["plan_dist_km"] = m["distance_km"].astype(float).values
    feats["plan_speed_kmh"] = (feats["plan_dist_km"] / (feats["plan_travel_dur_min"] / 60.0 + 1e-4)).values
    feats["plan_service_allowance_min"] = m["service_allowance_min"].astype(float).values
    
    feats["win_open_min"] = win_open.astype(float).values
    feats["win_close_min"] = win_close.astype(float).values
    feats["win_duration_min"] = (win_close - win_open).astype(float).values
    feats["win_slack_min"] = (win_close - plan_arr).astype(float).values
    feats["win_early_offset_min"] = (plan_arr - win_open).astype(float).values
    feats["win_slack_ratio"] = (feats["win_slack_min"] / (feats["win_duration_min"] + 1e-4)).values
    
    # 3. Route structure (route_)
    feats["route_seq"] = m["seq_in_route"].astype(float).values
    feats["route_total_stops"] = m["route_total_stops"].astype(float).values
    feats["route_progress"] = (feats["route_seq"] / (feats["route_total_stops"] + 1e-4)).values
    feats["route_stops_remaining"] = (feats["route_total_stops"] - feats["route_seq"]).values
    
    # 4. Vehicle utilization (veh_)
    feats["veh_weight_cap"] = m["weight_cap_kg"].astype(float).values
    feats["veh_volume_cap"] = m["volume_cap_m3"].astype(float).values
    feats["veh_weight_util"] = (feats["ord_weight_kg"] / (feats["veh_weight_cap"] + 1e-4)).values
    feats["veh_volume_util"] = (feats["ord_volume_m3"] / (feats["veh_volume_cap"] + 1e-4)).values
    feats["veh_is_van"] = (m["vehicle_type"] == "van").astype(float).values
    feats["veh_is_reefer"] = (m["vehicle_temp"] == "reefer").astype(float).values
    
    # 5. Calendar & Environmental (cal_, geo_)
    feats["cal_dow"] = m["dow"].astype(float).values
    feats["cal_is_weekend"] = m["is_weekend"].astype(float).values
    feats["cal_is_payday"] = m["is_payday"].astype(float).values
    feats["cal_festival_ramp"] = m["festival_ramp"].astype(float).values
    feats["cal_is_holiday"] = m["is_holiday"].astype(float).values
    feats["cal_monsoon"] = m["monsoon"].astype(float).values
    feats["cal_hour"] = m["cal_hour"].astype(float).values
    feats["cal_iso_week"] = m["iso_week"].astype(float).values
    
    # In road_conditions and traffic_speed, 100 is clear / free-flow.
    # We normalize to [0, 1] where 1.0 = clear, and impute missing with 1.0 (clear).
    feats["geo_disruption_index"] = (m["disruption_index"].fillna(100.0) / 100.0).astype(float).values
    feats["geo_speed_index"] = (m["speed_index"].fillna(100.0) / 100.0).astype(float).values
    feats["geo_freeflow_kmh"] = m["free_flow_kmh"].astype(float).values
    feats["geo_depot_to_dist_km"] = m["depot_to_district_km"].astype(float).values
    feats["geo_depot_to_dist_min"] = m["depot_to_district_freeflow_min"].astype(float).values
    feats["geo_inter_stop_min"] = m["inter_stop_freeflow_min"].astype(float).values
    feats["geo_mall_window"] = m["mall_window"].notna().astype(float).values
    feats["geo_is_van_only"] = (m["parking_constraint"] == "van_only").astype(float).values
    
    # Speed comparison feature: planned speed vs expected traffic speed
    feats["plan_speed_vs_traffic"] = (feats["plan_speed_kmh"] / (feats["geo_speed_index"] * feats["geo_freeflow_kmh"] + 1e-4)).values
    
    # Categoricals for LightGBM
    # Brand: Fresh=0, Style=1, Tech=2
    brand_map = {"Fresh": 0, "Style": 1, "Tech": 2}
    feats["ord_brand_cat"] = m["brand"].map(brand_map).fillna(0).astype(int).values
    
    # Depot: Peliyagoda=0, Kandy=1
    depot_map = {"Peliyagoda": 0, "Kandy": 1}
    feats["geo_depot_cat"] = m["depot"].map(depot_map).fillna(0).astype(int).values
    
    # Dock type: rear_dock=0, street=1, mall_bay/mall_dock=2
    dock_map = {"rear_dock": 0, "street": 1, "mall_bay": 2, "mall_dock": 2}
    feats["geo_dock_cat"] = m["dock_type"].map(dock_map).fillna(0).astype(int).values
    
    # Keep outlet_id for out-of-fold target encoding
    feats["_outlet_id"] = m["outlet_id"].values
    feats["_district"] = m["district"].values
    
    return feats


def add_target_encodings(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    train_labels: pd.DataFrame,
    n_splits: int = 5,
    seed: int = 42
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Computes out-of-fold target encodings for train, and full-train encodings for test.
    Never touches test labels.
    """
    tr = train_df.copy()
    te = test_df.copy()
    
    # Merge labels to train
    tr = tr.merge(train_labels, on="delivery_id", how="left")
    
    # Targets: service_time_min, late_binary
    global_svc_mean = tr["service_time_min"].mean()
    global_late_mean = tr["late_binary"].mean()
    
    # Columns to initialize
    tr["hist_outlet_mean_service"] = np.nan
    tr["hist_outlet_late_rate"] = np.nan
    tr["hist_district_mean_service"] = np.nan
    tr["hist_district_late_rate"] = np.nan
    
    kf = KFold(n_splits=n_splits, shuffle=True, random_state=seed)
    
    for tr_idx, val_idx in kf.split(tr):
        split_tr = tr.iloc[tr_idx]
        
        # Outlet level
        outlet_svc = split_tr.groupby("_outlet_id")["service_time_min"].agg(["count", "mean"])
        # Empirical Bayes smoothing: weight by count / (count + 10)
        smooth_svc = (outlet_svc["count"] * outlet_svc["mean"] + 10 * global_svc_mean) / (outlet_svc["count"] + 10)
        
        outlet_late = split_tr.groupby("_outlet_id")["late_binary"].agg(["count", "mean"])
        smooth_late = (outlet_late["count"] * outlet_late["mean"] + 20 * global_late_mean) / (outlet_late["count"] + 20)
        
        tr.iloc[val_idx, tr.columns.get_loc("hist_outlet_mean_service")] = tr.iloc[val_idx]["_outlet_id"].map(smooth_svc)
        tr.iloc[val_idx, tr.columns.get_loc("hist_outlet_late_rate")] = tr.iloc[val_idx]["_outlet_id"].map(smooth_late)
        
        # District level
        dist_svc = split_tr.groupby("_district")["service_time_min"].mean()
        dist_late = split_tr.groupby("_district")["late_binary"].mean()
        tr.iloc[val_idx, tr.columns.get_loc("hist_district_mean_service")] = tr.iloc[val_idx]["_district"].map(dist_svc)
        tr.iloc[val_idx, tr.columns.get_loc("hist_district_late_rate")] = tr.iloc[val_idx]["_district"].map(dist_late)
        
    tr["hist_outlet_mean_service"] = tr["hist_outlet_mean_service"].fillna(global_svc_mean)
    tr["hist_outlet_late_rate"] = tr["hist_outlet_late_rate"].fillna(global_late_mean)
    tr["hist_district_mean_service"] = tr["hist_district_mean_service"].fillna(global_svc_mean)
    tr["hist_district_late_rate"] = tr["hist_district_late_rate"].fillna(global_late_mean)
    
    # Compute on full train for test set
    full_outlet_svc = tr.groupby("_outlet_id")["service_time_min"].agg(["count", "mean"])
    full_smooth_svc = (full_outlet_svc["count"] * full_outlet_svc["mean"] + 10 * global_svc_mean) / (full_outlet_svc["count"] + 10)
    
    full_outlet_late = tr.groupby("_outlet_id")["late_binary"].agg(["count", "mean"])
    full_smooth_late = (full_outlet_late["count"] * full_outlet_late["mean"] + 20 * global_late_mean) / (full_outlet_late["count"] + 20)
    
    full_dist_svc = tr.groupby("_district")["service_time_min"].mean()
    full_dist_late = tr.groupby("_district")["late_binary"].mean()
    
    te["hist_outlet_mean_service"] = te["_outlet_id"].map(full_smooth_svc).fillna(global_svc_mean)
    te["hist_outlet_late_rate"] = te["_outlet_id"].map(full_smooth_late).fillna(global_late_mean)
    te["hist_district_mean_service"] = te["_district"].map(full_dist_svc).fillna(global_svc_mean)
    te["hist_district_late_rate"] = te["_district"].map(full_dist_late).fillna(global_late_mean)
    
    # Drop temporary grouping columns and labels from feature matrices
    tr_clean = tr.drop(columns=["_outlet_id", "_district", "service_time_min", "late_binary"])
    te_clean = te.drop(columns=["_outlet_id", "_district"])
    
    # Run the strict leakage gate
    feature_cols = [c for c in tr_clean.columns if c != "delivery_id"]
    assert_no_leakage(feature_cols)
    assert_no_leakage([c for c in te_clean.columns if c != "delivery_id"])
    
    return tr_clean, te_clean
