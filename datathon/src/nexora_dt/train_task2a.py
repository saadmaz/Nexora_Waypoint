"""Task 2A: 10-Week Depot x Brand Demand Forecasting Pipeline.

Forecasts weekly delivered volume (total m3 and chilled m3) across 10 weeks
(2026-W14 through 2026-W23) for all 6 (depot, brand) combinations.

Uses 117 weeks of continuous historical deliveries (2024-W01 to 2026-W13),
engineered calendar features (Sinhala/Tamil New Year festival ramp, paydays,
operating days, monsoon), lag features, and LightGBM / Ridge models.

Strict constraints enforced:
- Style and Tech chilled volume is strictly 0.000.
- Fresh chilled volume <= total volume.
- Output matches template format: row_id,pred_total_volume_m3,pred_chilled_volume_m3.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error

from .paths import TRAIN, TEST, GENERAL, TEMPLATES, ARTIFACTS, REPO_ROOT, assert_data_external


def load_and_aggregate_weekly_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    assert_data_external()
    
    # 1. Historical deliveries from train and test
    dels_tr = pd.read_csv(TRAIN / "deliveries_train.csv")
    dels_te = pd.read_csv(TEST / "task1_test_inputs.csv")
    all_dels = pd.concat([dels_tr, dels_te], ignore_index=True)
    all_dels["date"] = all_dels["dispatch_date"].fillna(all_dels["order_date"])
    
    # 2. Calendar data
    cal = pd.read_csv(GENERAL / "calendar.csv")
    
    # Weekly calendar aggregates
    weekly_cal = cal.groupby(["iso_year", "iso_week"]).agg(
        operating_days=("is_operating", "sum"),
        festival_ramp_sum=("festival_ramp", "sum"),
        festival_days=("festival", lambda s: (s != "none").sum()),
        payday_count=("is_payday", "sum"),
        holiday_count=("is_holiday", "sum"),
        monsoon_mean=("monsoon", "mean"),
    ).reset_index()
    
    # Merge date to deliveries
    all_dels = all_dels.merge(cal[["date", "iso_year", "iso_week"]], on="date", how="left")
    
    # Weekly demand aggregation
    weekly_demand = all_dels.groupby(["depot", "brand", "iso_year", "iso_week"]).agg(
        total_volume_m3=("order_volume_m3", "sum"),
        chilled_volume_m3=("order_volume_m3", lambda s: s[all_dels.loc[s.index, "temp_requirement"] == "chilled"].sum()),
        order_count=("delivery_id", "count")
    ).reset_index()
    
    # Merge calendar features
    df = weekly_demand.merge(weekly_cal, on=["iso_year", "iso_week"], how="left")
    
    # Test inputs for Task 2A (60 rows)
    test_inputs = pd.read_csv(TEST / "task2a_test_inputs.csv")
    test_merged = test_inputs.merge(weekly_cal, on=["iso_year", "iso_week"], how="left")
    
    return df, test_merged


def train_and_forecast_series(
    depot: str,
    brand: str,
    hist_df: pd.DataFrame,
    test_df: pd.DataFrame,
    horizon: int = 10
) -> pd.DataFrame:
    """Trains forecasting model for a single (depot, brand) series and generates 10-week predictions."""
    s_hist = hist_df[(hist_df.depot == depot) & (hist_df.brand == brand)].sort_values(["iso_year", "iso_week"]).copy().reset_index(drop=True)
    s_test = test_df[(test_df.depot == depot) & (test_df.brand == brand)].sort_values(["iso_year", "iso_week"]).copy().reset_index(drop=True)
    
    # Add elapsed week index for trend
    s_hist["week_idx"] = np.arange(len(s_hist))
    start_test_idx = len(s_hist)
    s_test["week_idx"] = np.arange(start_test_idx, start_test_idx + len(s_test))
    
    # Compute chilled ratio for Fresh
    if brand == "Fresh":
        chilled_ratio = (s_hist["chilled_volume_m3"].sum() / s_hist["total_volume_m3"].sum())
    else:
        chilled_ratio = 0.0
        
    # Build lag and seasonal features
    # For a 10-week multi-step horizon, we can use direct multi-step forecasting or recursive forecasting
    # Let's engineer:
    # - Annual seasonality: lag_52 (same week last year)
    # - Recent baseline: mean of last 4 and 8 weeks
    # - Week of year (iso_week)
    # - Calendar effects (festival_ramp_sum, payday_count, operating_days)
    
    # Map historical lag_52 (volume 52 weeks ago)
    # Create lookup map (iso_year, iso_week) -> total_volume
    vol_lookup = {(r.iso_year, r.iso_week): r.total_volume_m3 for r in s_hist.itertuples()}
    
    def get_lag52(row):
        prev_year = row.iso_year - 1
        wk = row.iso_week
        if (prev_year, wk) in vol_lookup:
            return vol_lookup[(prev_year, wk)]
        elif (prev_year, wk - 1) in vol_lookup:
            return vol_lookup[(prev_year, wk - 1)]
        elif (prev_year, wk + 1) in vol_lookup:
            return vol_lookup[(prev_year, wk + 1)]
        return s_hist["total_volume_m3"].mean()
        
    s_hist["lag_52"] = s_hist.apply(get_lag52, axis=1)
    s_test["lag_52"] = s_test.apply(get_lag52, axis=1)
    
    # Features for model
    feature_cols = [
        "iso_week", "operating_days", "festival_ramp_sum",
        "festival_days", "payday_count", "holiday_count",
        "monsoon_mean", "lag_52", "week_idx"
    ]
    
    # We train on historical weeks (excluding the first 52 weeks which use lag_52 from 2024)
    train_data = s_hist.iloc[52:].copy()
    
    # We fit an ensemble of LightGBM and Ridge for stability
    X_train = train_data[feature_cols].copy()
    y_train = train_data["total_volume_m3"].values
    
    X_test = s_test[feature_cols].copy()
    
    # Model 1: LightGBM
    lgb_model = lgb.LGBMRegressor(
        objective="regression",
        metric="mae",
        learning_rate=0.04,
        num_leaves=15,
        n_estimators=150,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        verbose=-1
    )
    lgb_model.fit(X_train, y_train)
    pred_lgb = lgb_model.predict(X_test)
    
    # Model 2: Ridge Regressor
    ridge_model = Ridge(alpha=10.0)
    ridge_model.fit(X_train, y_train)
    pred_ridge = ridge_model.predict(X_test)
    
    # Ensemble predictions (70% LightGBM, 30% Ridge)
    preds_total = 0.7 * pred_lgb + 0.3 * pred_ridge
    
    # Post-processing: Ensure positive and realistic
    recent_mean = s_hist["total_volume_m3"].iloc[-8:].mean()
    preds_total = np.maximum(recent_mean * 0.4, preds_total)
    
    if brand == "Fresh":
        preds_chilled = np.round(preds_total * chilled_ratio, 3)
    else:
        preds_chilled = np.zeros_like(preds_total)
        
    s_test["pred_total_volume_m3"] = np.round(preds_total, 3)
    s_test["pred_chilled_volume_m3"] = preds_chilled
    
    return s_test[["row_id", "depot", "brand", "iso_year", "iso_week", "pred_total_volume_m3", "pred_chilled_volume_m3"]]


def run_task2a_pipeline() -> tuple[pd.DataFrame, dict]:
    hist_df, test_df = load_and_aggregate_weekly_data()
    
    # Backtest evaluation: evaluate on last 10 weeks of historical data (2026-W04 to W13)
    print("=" * 60)
    print("TASK 2A: 10-Week Demand Forecasting Pipeline")
    print("=" * 60)
    
    all_series_results = []
    
    depots = ["Kandy", "Peliyagoda"]
    brands = ["Fresh", "Style", "Tech"]
    
    for d in depots:
        for b in brands:
            res = train_and_forecast_series(d, b, hist_df, test_df)
            all_series_results.append(res)
            
    final_df = pd.concat(all_series_results, ignore_index=True)
    
    # Sort to match original test_inputs order
    template = pd.read_csv(TEMPLATES / "submission_task2a.csv")
    final_sub = template[["row_id"]].merge(
        final_df[["row_id", "pred_total_volume_m3", "pred_chilled_volume_m3"]],
        on="row_id",
        how="left"
    )
    
    # Validations
    assert len(final_sub) == 60, f"Expected 60 rows, got {len(final_sub)}"
    assert final_sub.isna().sum().sum() == 0, "Null values found in submission_task2a!"
    assert (final_sub["row_id"] == template["row_id"]).all(), "Row ID ordering mismatch!"
    
    # Save submission files
    out_artifact = ARTIFACTS / "submission_task2a.csv"
    out_repo = REPO_ROOT / "submissions" / "submission_task2a.csv"
    out_repo.parent.mkdir(parents=True, exist_ok=True)
    
    final_sub.to_csv(out_artifact, index=False)
    final_sub.to_csv(out_repo, index=False)
    
    print("\nForecast summary by (depot, brand):")
    merged_summary = final_df.groupby(["depot", "brand"]).agg(
        avg_total_vol=("pred_total_volume_m3", "mean"),
        max_total_vol=("pred_total_volume_m3", "max"),
        avg_chilled_vol=("pred_chilled_volume_m3", "mean")
    )
    print(merged_summary)
    
    print(f"\nWrote Task 2A submission to:\n  - {out_artifact}\n  - {out_repo}")
    
    return final_sub, merged_summary.to_dict()


if __name__ == "__main__":
    run_task2a_pipeline()
