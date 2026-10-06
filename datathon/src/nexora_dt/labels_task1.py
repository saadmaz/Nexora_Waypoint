"""Task 1 label construction: service_time_min and late_binary.

Booklet rules implemented exactly:
  - Outlets receive goods only within their delivery window.
    A vehicle that arrives early waits until the window opens.
  - Lateness refers to arrival after the window closes (strictly after).
"""
from __future__ import annotations

import argparse

import pandas as pd

from .paths import TRAIN, TEST, assert_data_external

MIN_PER_DAY = 24 * 60


def hhmm_to_min(s: pd.Series) -> pd.Series:
    """'HH:MM' 24h -> minutes since midnight. NaN-safe (Int64)."""
    parts = s.str.split(":", expand=True)
    return parts[0].astype("Int64") * 60 + parts[1].astype("Int64")


def load_joined(split: str = "train") -> pd.DataFrame:
    """Join deliveries to route legs. STRICTLY 1:1 — raises if a stop ever
    serves multiple orders (verified: not the case in the shipped data)."""
    assert_data_external()
    if split == "train":
        legs = pd.read_csv(TRAIN / "route_legs_train.csv")
        dels = pd.read_csv(TRAIN / "deliveries_train.csv")
        runnable = dels[dels["route_id"].notna()].copy()
        not_run = dels[dels["route_id"].isna()].copy()
        merged_run = runnable.merge(
            legs,
            left_on=["route_id", "seq_in_route", "outlet_id"],
            right_on=["route_id", "seq", "to_outlet"],
            how="left",
            suffixes=("", "_leg"),
            validate="one_to_one",
        )
        return pd.concat([merged_run, not_run], ignore_index=True)
    else:
        legs = pd.read_csv(TEST / "route_legs_test.csv")
        dels = pd.read_csv(TEST / "task1_test_inputs.csv")
        return dels.merge(
            legs,
            left_on=["route_id", "seq_in_route", "outlet_id"],
            right_on=["route_id", "seq", "to_outlet"],
            how="left",
            suffixes=("", "_leg"),
            validate="one_to_one",
        )


def build_labels(split: str = "train") -> pd.DataFrame:
    m = load_joined(split)
    # Rows without a leg (train dispatch_status == 'not_run') have no actuals.
    actual = m[m["arrival_time"].notna()].copy()

    arr = hhmm_to_min(actual["arrival_time"]).astype("int64")
    leave = hhmm_to_min(actual["leave_outlet_time"]).astype("int64")
    wopen = hhmm_to_min(actual["window_open_time"]).astype("int64")
    wclose = hhmm_to_min(actual["window_close_time"]).astype("int64")

    # Midnight-crossing safety (none observed in the data; keep it correct).
    leave = leave.where(leave >= arr, leave + MIN_PER_DAY)
    wclose = wclose.where(wclose >= wopen, wclose + MIN_PER_DAY)

    effective_start = pd.concat([arr, wopen], axis=1).max(axis=1)
    actual["service_time_min"] = leave - effective_start
    actual["late_binary"] = (arr > wclose).astype("int8")

    # Invariants — fail loudly, never silently repair.
    bad = actual[actual["service_time_min"] < 0]
    if not bad.empty:
        raise RuntimeError(f"negative service time in {len(bad)} rows: {bad.delivery_id.head()}")
    return actual[["delivery_id", "service_time_min", "late_binary"]]


def qa() -> None:
    m = load_joined("train")
    no_leg = m[m["arrival_time"].isna()]
    lab = build_labels("train")
    arr = hhmm_to_min(m["arrival_time"])
    wopen = hhmm_to_min(m["window_open_time"])
    wclose = hhmm_to_min(m["window_close_time"])
    print(f"deliveries: {len(m)}  with-leg: {m.arrival_time.notna().sum()}  "
          f"not_run/excluded: {len(no_leg)}")
    print(f"early arrivals (wait): {(arr < wopen).sum()}  "
          f"arrival==close (not late): {(arr == wclose).sum()}")
    print(f"late rate: {lab.late_binary.mean():.4f}  "
          f"service min/max/mean: {lab.service_time_min.min()}/"
          f"{lab.service_time_min.max()}/{lab.service_time_min.mean():.2f}")
    t = load_joined("test")
    print(f"test rows: {len(t)}  unmatched legs: {t.leg_id.isna().sum()}  "
          f"statuses: {t.dispatch_status.value_counts().to_dict()}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--qa", action="store_true")
    ap.add_argument("--split", default="train", choices=["train", "test"])
    args = ap.parse_args()
    if args.qa:
        qa()
    else:
        print(build_labels(args.split).to_csv(index=False))
