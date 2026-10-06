"""
datathon/label_builder.py - Grounded label construction for Task 1 and Task 2A.
"""
import pandas as pd
import numpy as np
from datathon.config import FILES

def time_to_minutes(t_series: pd.Series) -> pd.Series:
    """Converts HH:MM strings to minutes from midnight."""
    def _parse(val):
        if pd.isna(val) or val == "":
            return np.nan
        parts = str(val).strip().split(":")
        return int(parts[0]) * 60 + int(parts[1])
    return t_series.apply(_parse)

def build_task1_training_labels() -> pd.DataFrame:
    """
    Constructs ground truth training labels for Task 1 from deliveries_train and route_legs_train.
    
    Rules enforced from Challenge Booklet:
    1. Early arrival wait: Outlets receive goods only within their delivery window.
       A vehicle that arrives early waits until window opens.
       effective_service_start = max(arrival_time, window_open_time)
       service_time_min = leave_outlet_time - effective_service_start
    2. Lateness: Lateness refers to arrival after the window closes.
       is_late = 1 if arrival_time > window_close_time else 0
    """
    deliv = pd.read_csv(FILES["deliveries_train"])
    legs = pd.read_csv(FILES["route_legs_train"])
    
    # Inner join on route_id and sequence position
    df = pd.merge(
        deliv,
        legs,
        left_on=["route_id", "seq_in_route"],
        right_on=["route_id", "seq"],
        suffixes=("", "_leg")
    )
    
    # Convert clock times to minutes
    arr_min = time_to_minutes(df["arrival_time"])
    leave_min = time_to_minutes(df["leave_outlet_time"])
    open_min = time_to_minutes(df["window_open_time"])
    close_min = time_to_minutes(df["window_close_time"])
    
    # Calculate effective service start (accounting for early arrival waiting)
    effective_start = np.maximum(arr_min, open_min)
    service_time = leave_min - effective_start
    
    # Handle wrap-around midnight edge cases if any
    service_time = np.where(service_time < 0, service_time + 1440, service_time)
    
    # Lateness label: 1 if actual arrival is strictly after window close time
    is_late = (arr_min > close_min).astype(int)
    
    df["label_service_min"] = service_time
    df["label_is_late"] = is_late
    df["early_arrival_wait_min"] = np.maximum(0, open_min - arr_min)
    
    return df

if __name__ == "__main__":
    df = build_task1_training_labels()
    print(f"Loaded {len(df)} labeled training rows.")
    print("Label service time summary:\n", df["label_service_min"].describe())
    print("Label is_late distribution:\n", df["label_is_late"].value_counts(normalize=True))
