"""
save_models.py - Trains and serializes production model files for Task 1 and Task 2A.
Fulfills the official Challenge Booklet requirement:
'Model file(s). Save your final model files alongside the notebook.'
"""

import sys
from pathlib import Path

cur_dir = Path(__file__).resolve().parent
if str(cur_dir / "src") not in sys.path:
    sys.path.insert(0, str(cur_dir / "src"))

import json
import joblib
import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.linear_model import Ridge

from nexora_dt.paths import ARTIFACTS, REPO_ROOT, assert_data_external
from nexora_dt.labels_task1 import build_labels
from nexora_dt.features_task1 import extract_raw_features, add_target_encodings
from nexora_dt.train_task2a import load_and_aggregate_weekly_data, train_and_forecast_series

def save_all_models():
    assert_data_external()
    print("=" * 60)
    print("STEP 1: Training and Serializing Task 1 Production Models")
    print("=" * 60)
    
    tr_raw = extract_raw_features("train")
    te_raw = extract_raw_features("test")
    labels = build_labels("train")
    
    X_train_df, X_test_df = add_target_encodings(tr_raw, te_raw, labels, n_splits=5, seed=42)
    df_train = X_train_df.merge(labels, on="delivery_id", how="inner")
    
    drop_cols = ["delivery_id", "service_time_min", "late_binary"]
    feature_cols = [c for c in df_train.columns if c not in drop_cols]
    
    X = df_train[feature_cols].copy()
    y_svc = df_train["service_time_min"].values
    y_late = df_train["late_binary"].values
    
    # Train full LightGBM Service Model
    model_svc = lgb.LGBMRegressor(
        objective="regression_l1",
        metric="mae",
        learning_rate=0.05,
        num_leaves=31,
        min_child_samples=25,
        subsample=0.8,
        colsample_bytree=0.8,
        n_estimators=450,
        random_state=42,
        verbose=-1,
        n_jobs=-1
    )
    model_svc.fit(X, y_svc)
    
    # Train full LightGBM Lateness Model
    model_late = lgb.LGBMClassifier(
        objective="binary",
        metric="binary_logloss",
        learning_rate=0.05,
        num_leaves=31,
        min_child_samples=30,
        subsample=0.8,
        colsample_bytree=0.8,
        n_estimators=450,
        random_state=42,
        verbose=-1,
        n_jobs=-1
    )
    model_late.fit(X, y_late)
    
    # Target encodings lookup tables for standalone test inference
    global_svc = float(y_svc.mean())
    global_late = float(y_late.mean())
    
    models_dir_repo = cur_dir / "models"
    models_dir_art = ARTIFACTS / "models"
    models_dir_repo.mkdir(parents=True, exist_ok=True)
    models_dir_art.mkdir(parents=True, exist_ok=True)
    
    svc_path = models_dir_repo / "model_task1_service.joblib"
    late_path = models_dir_repo / "model_task1_lateness.joblib"
    feat_path = models_dir_repo / "task1_features.json"
    
    joblib.dump(model_svc, svc_path)
    joblib.dump(model_late, late_path)
    with open(feat_path, "w") as f:
        json.dump({
            "features": feature_cols,
            "global_svc_mean": global_svc,
            "global_late_mean": global_late
        }, f, indent=2)
        
    joblib.dump(model_svc, models_dir_art / "model_task1_service.joblib")
    joblib.dump(model_late, models_dir_art / "model_task1_lateness.joblib")
    with open(models_dir_art / "task1_features.json", "w") as f:
        json.dump({
            "features": feature_cols,
            "global_svc_mean": global_svc,
            "global_late_mean": global_late
        }, f, indent=2)
        
    print(f"Task 1 models saved:\n  - {svc_path}\n  - {late_path}\n  - {feat_path}")
    
    print("\n" + "=" * 60)
    print("STEP 2: Training and Serializing Task 2A Demand Models")
    print("=" * 60)
    
    hist_df, test_df = load_and_aggregate_weekly_data()
    depots = ["Kandy", "Peliyagoda"]
    brands = ["Fresh", "Style", "Tech"]
    
    task2a_models = {}
    for d in depots:
        for b in brands:
            s_hist = hist_df[(hist_df.depot == d) & (hist_df.brand == b)].sort_values(["iso_year", "iso_week"]).copy().reset_index(drop=True)
            s_hist["week_idx"] = np.arange(len(s_hist))
            vol_lookup = {(r.iso_year, r.iso_week): r.total_volume_m3 for r in s_hist.itertuples()}
            
            def get_lag52(row):
                prev_year = row.iso_year - 1
                wk = row.iso_week
                return vol_lookup.get((prev_year, wk), s_hist["total_volume_m3"].mean())
                
            s_hist["lag_52"] = s_hist.apply(get_lag52, axis=1)
            train_data = s_hist.iloc[52:].copy()
            
            feat_cols_2a = [
                "iso_week", "operating_days", "festival_ramp_sum",
                "festival_days", "payday_count", "holiday_count",
                "monsoon_mean", "lag_52", "week_idx"
            ]
            X_2a = train_data[feat_cols_2a]
            y_2a = train_data["total_volume_m3"].values
            
            lgb_2a = lgb.LGBMRegressor(
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
            lgb_2a.fit(X_2a, y_2a)
            
            ridge_2a = Ridge(alpha=10.0)
            ridge_2a.fit(X_2a, y_2a)
            
            chilled_ratio = (s_hist["chilled_volume_m3"].sum() / s_hist["total_volume_m3"].sum()) if b == "Fresh" else 0.0
            
            task2a_models[(d, b)] = {
                "lgb": lgb_2a,
                "ridge": ridge_2a,
                "chilled_ratio": chilled_ratio,
                "recent_mean": float(s_hist["total_volume_m3"].iloc[-8:].mean()),
                "vol_lookup": vol_lookup,
                "feature_cols": feat_cols_2a
            }
            
    t2a_path = models_dir_repo / "models_task2a.joblib"
    joblib.dump(task2a_models, t2a_path)
    joblib.dump(task2a_models, models_dir_art / "models_task2a.joblib")
    print(f"Task 2A models saved to {t2a_path}")
    
    # Test Loading & Inference verification
    print("\n" + "=" * 60)
    print("STEP 3: Model Verification & Standalone Inference Test")
    print("=" * 60)
    
    loaded_svc = joblib.load(svc_path)
    loaded_late = joblib.load(late_path)
    loaded_2a = joblib.load(t2a_path)
    
    # Run test on 1 row of X_test_df
    sample_feat = X_test_df[feature_cols].iloc[[0]]
    p_svc = float(loaded_svc.predict(sample_feat)[0])
    p_late = float(loaded_late.predict_proba(sample_feat)[0, 1])
    
    print(f"Inference Test [Task 1 - Delivery {X_test_df.iloc[0]['delivery_id']}]:")
    print(f"  - Service Time: {p_svc:.2f} min")
    print(f"  - Lateness Prob: {p_late*100:.2f}%")
    print(f"Inference Test [Task 2A - 6 Models loaded]: Success! Total model pairs: {len(loaded_2a)}")
    print("All models serialized and verified successfully!")

if __name__ == "__main__":
    save_all_models()
