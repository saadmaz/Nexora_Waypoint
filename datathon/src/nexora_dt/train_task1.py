"""Task 1 Model Training & Inference Pipeline for Nexora Datathon.

Trains two dedicated LightGBM models:
1. Service Time Regressor: MAE objective (L1 loss) predicting outlet service duration in minutes.
2. Arrival Lateness Classifier: Binary LogLoss objective predicting probability of late arrival.

Evaluates against competition baselines:
- Service Time: Published standard from service_allowance.csv.
- Arrival Lateness: Historical prior / base rate.

Validates via 5-Fold Stratified / Time-split CV, logs metrics, and outputs submission_task1.csv.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.model_selection import KFold
from sklearn.metrics import mean_absolute_error, log_loss, roc_auc_score, brier_score_loss

from .paths import ARTIFACTS, TEMPLATES, assert_data_external, REPO_ROOT
from .labels_task1 import build_labels
from .features_task1 import extract_raw_features, add_target_encodings


def train_and_predict(n_splits: int = 5, seed: int = 42) -> tuple[pd.DataFrame, dict]:
    assert_data_external()
    print("=" * 60)
    print("STEP 1: Extracting Raw Features & Ground Truth Labels")
    print("=" * 60)
    
    tr_raw = extract_raw_features("train")
    te_raw = extract_raw_features("test")
    labels = build_labels("train")
    
    print("Computing out-of-fold target encodings and running leakage verification...")
    tr_feats, te_feats = add_target_encodings(tr_raw, te_raw, labels, n_splits=n_splits, seed=seed)
    
    # Merge labels for training
    df_train = tr_feats.merge(labels, on="delivery_id", how="inner")
    df_test = te_feats.copy()
    
    # Exclude non-feature columns
    drop_cols = ["delivery_id", "service_time_min", "late_binary"]
    feature_cols = [c for c in df_train.columns if c not in drop_cols]
    
    print(f"Dataset summary: {len(df_train):,} train rows, {len(df_test):,} test rows, {len(feature_cols)} features.")
    
    X = df_train[feature_cols].copy()
    y_svc = df_train["service_time_min"].values
    y_late = df_train["late_binary"].values
    
    X_test = df_test[feature_cols].copy()
    
    # Baselines
    svc_baseline = df_train["plan_service_allowance_min"].values
    base_svc_mae = mean_absolute_error(y_svc, svc_baseline)
    
    late_prior = np.full_like(y_late, fill_value=y_late.mean(), dtype=float)
    base_late_loss = log_loss(y_late, late_prior)
    base_late_brier = brier_score_loss(y_late, late_prior)
    
    print(f"\n--- BASELINE METRICS ---")
    print(f"Baseline Service MAE (Published Service Allowance): {base_svc_mae:.3f} min")
    print(f"Baseline Lateness LogLoss (Historical Prior {y_late.mean():.4f}): {base_late_loss:.4f}")
    print(f"Baseline Lateness Brier Score: {base_late_brier:.4f}")
    
    # Prepare CV
    kf = KFold(n_splits=n_splits, shuffle=True, random_state=seed)
    
    oof_pred_svc = np.zeros(len(df_train))
    oof_pred_late = np.zeros(len(df_train))
    
    test_preds_svc = np.zeros(len(df_test))
    test_preds_late = np.zeros(len(df_test))
    
    # Hyperparameters
    svc_params = {
        "objective": "regression_l1",
        "metric": "mae",
        "learning_rate": 0.05,
        "num_leaves": 31,
        "min_child_samples": 25,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "n_estimators": 600,
        "random_state": seed,
        "verbose": -1,
        "n_jobs": -1,
    }
    
    late_params = {
        "objective": "binary",
        "metric": "binary_logloss",
        "learning_rate": 0.05,
        "num_leaves": 31,
        "min_child_samples": 30,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "n_estimators": 600,
        "random_state": seed,
        "verbose": -1,
        "n_jobs": -1,
    }
    
    print("\n" + "=" * 60)
    print("STEP 2: Training 5-Fold Cross-Validated Models")
    print("=" * 60)
    
    fold_svc_maes = []
    fold_late_losses = []
    fold_late_aucs = []
    
    svc_importances = np.zeros(len(feature_cols))
    late_importances = np.zeros(len(feature_cols))
    
    for fold, (tr_idx, val_idx) in enumerate(kf.split(X)):
        X_tr, y_svc_tr, y_late_tr = X.iloc[tr_idx], y_svc[tr_idx], y_late[tr_idx]
        X_val, y_svc_val, y_late_val = X.iloc[val_idx], y_svc[val_idx], y_late[val_idx]
        
        # 1. Service Time Model (LightGBM L1)
        model_svc = lgb.LGBMRegressor(**svc_params)
        model_svc.fit(
            X_tr, y_svc_tr,
            eval_set=[(X_val, y_svc_val)],
            callbacks=[lgb.early_stopping(stopping_rounds=40, verbose=False)]
        )
        val_pred_svc = np.maximum(2.0, model_svc.predict(X_val))
        oof_pred_svc[val_idx] = val_pred_svc
        fold_mae = mean_absolute_error(y_svc_val, val_pred_svc)
        fold_svc_maes.append(fold_mae)
        svc_importances += model_svc.feature_importances_ / n_splits
        
        test_preds_svc += np.maximum(2.0, model_svc.predict(X_test)) / n_splits
        
        # 2. Lateness Probability Model (LightGBM Binary)
        model_late = lgb.LGBMClassifier(**late_params)
        model_late.fit(
            X_tr, y_late_tr,
            eval_set=[(X_val, y_late_val)],
            callbacks=[lgb.early_stopping(stopping_rounds=40, verbose=False)]
        )
        val_pred_late = model_late.predict_proba(X_val)[:, 1]
        oof_pred_late[val_idx] = val_pred_late
        fold_loss = log_loss(y_late_val, val_pred_late)
        fold_auc = roc_auc_score(y_late_val, val_pred_late)
        fold_late_losses.append(fold_loss)
        fold_late_aucs.append(fold_auc)
        late_importances += model_late.feature_importances_ / n_splits
        
        test_preds_late += model_late.predict_proba(X_test)[:, 1] / n_splits
        
        print(f"Fold {fold+1}/{n_splits} | Service MAE: {fold_mae:.3f}m (vs {mean_absolute_error(y_svc_val, svc_baseline[val_idx]):.3f}m base) | Late LogLoss: {fold_loss:.4f} | Late AUC: {fold_auc:.4f}")
        
    overall_svc_mae = mean_absolute_error(y_svc, oof_pred_svc)
    overall_late_loss = log_loss(y_late, oof_pred_late)
    overall_late_auc = roc_auc_score(y_late, oof_pred_late)
    overall_late_brier = brier_score_loss(y_late, oof_pred_late)
    
    svc_mae_std = float(np.std(fold_svc_maes))
    late_loss_std = float(np.std(fold_late_losses))
    late_auc_std = float(np.std(fold_late_aucs))
    
    print("\n" + "=" * 60)
    print("STEP 3: Overall Out-Of-Fold Evaluation vs Baselines")
    print("=" * 60)
    svc_gain = (base_svc_mae - overall_svc_mae) / base_svc_mae * 100.0
    late_gain = (base_late_loss - overall_late_loss) / base_late_loss * 100.0
    
    print(f"Service Time MAE:     {overall_svc_mae:.3f} +/- {svc_mae_std:.3f} min (Baseline: {base_svc_mae:.3f} min -> {svc_gain:+.1f}% improvement)")
    print(f"Lateness LogLoss:     {overall_late_loss:.4f} +/- {late_loss_std:.4f} (Baseline: {base_late_loss:.4f} -> {late_gain:+.1f}% improvement)")
    print(f"Lateness ROC-AUC:     {overall_late_auc:.4f} +/- {late_auc_std:.4f}")
    print(f"Lateness Brier Score: {overall_late_brier:.4f} (Baseline: {base_late_brier:.4f})")
    
    # Top features
    df_imp_svc = pd.DataFrame({"feature": feature_cols, "importance": svc_importances}).sort_values("importance", ascending=False)
    df_imp_late = pd.DataFrame({"feature": feature_cols, "importance": late_importances}).sort_values("importance", ascending=False)
    
    print("\nTop 5 Service Time Features:")
    for _, r in df_imp_svc.head(5).iterrows():
        print(f"  - {r.feature}: {r.importance:.1f}")
        
    print("\nTop 5 Lateness Probability Features:")
    for _, r in df_imp_late.head(5).iterrows():
        print(f"  - {r.feature}: {r.importance:.1f}")
        
    # Build Submission DataFrame with safe probability clipping
    # Avoid exact 0.0 or 1.0 which cause logloss cliffs on hidden evaluations
    clipped_late_prob = np.clip(test_preds_late, 0.0005, 0.9995)
    
    sub_df = pd.DataFrame({
        "delivery_id": df_test["delivery_id"].values,
        "pred_service_min": np.round(test_preds_svc, 2),
        "pred_late_prob": np.round(clipped_late_prob, 4)
    })
    
    # Validate against template
    template_path = TEMPLATES / "submission_task1.csv"
    template = pd.read_csv(template_path)
    assert len(sub_df) == len(template), f"Row count mismatch: {len(sub_df)} vs template {len(template)}"
    assert (sub_df["delivery_id"] == template["delivery_id"]).all(), "Delivery ID ordering mismatch!"
    assert sub_df.isna().sum().sum() == 0, "Submission contains NaN values!"
    
    # Save to artifacts and repo submissions directory
    out_artifact = ARTIFACTS / "submission_task1.csv"
    out_repo = REPO_ROOT / "submissions" / "submission_task1.csv"
    out_repo.parent.mkdir(parents=True, exist_ok=True)
    
    sub_df.to_csv(out_artifact, index=False)
    sub_df.to_csv(out_repo, index=False)
    print(f"\nWrote verified submission to:\n  - {out_artifact}\n  - {out_repo}")
    
    summary = {
        "overall_svc_mae": overall_svc_mae,
        "base_svc_mae": base_svc_mae,
        "svc_gain_pct": svc_gain,
        "overall_late_loss": overall_late_loss,
        "base_late_loss": base_late_loss,
        "late_gain_pct": late_gain,
        "overall_late_auc": overall_late_auc,
        "top_svc_features": df_imp_svc.head(5).to_dict("records"),
        "top_late_features": df_imp_late.head(5).to_dict("records"),
    }
    
    return sub_df, summary


if __name__ == "__main__":
    train_and_predict()
