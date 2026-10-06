# Tech-Triathlon 2026 Datathon: System Architecture Specification
**Team:** Nexora  
**Repository:** `saadmaz/Nexora_Waypoint`  
**Execution Branch:** `feature/datathon`  
**Compliance:** Strict Competition Rules (Zero Pre-trained Models, Zero Proprietary APIs, Zero AutoML, Air-Gapped Git Data Storage)

---

## 1. End-to-End System Pipeline

```mermaid
flowchart TD
    subgraph Data Sources ["Historical Data (Outside Git)"]
        D_Train["Deliveries Train (92,307 rows)"]
        L_Train["Route Legs Train (91,894 rows)"]
        Gen_Data["General Data (Calendar, Outlets, Travel, Traffic, Vehicles)"]
        T1_Test["Task 1 Test Inputs (5,014 rows)"]
        T2A_Test["Task 2A Test Inputs (60 rows)"]
        T2B_Test["Task 2B Peak Day Scenarios & Fleet (85 orders)"]
    end

    subgraph Task 1 ["Task 1: Outlet Service & Lateness Engine"]
        L_Build["Label Builder: max(arrival, open) & strict close"]
        Feat_Eng["Feature Pipeline (54 Approved Features)"]
        Leak_Gate{"Runtime Leakage Gate"}
        OOF_TE["Out-Of-Fold Target Encoding (5-Fold CV)"]
        M_Svc["LightGBM Regressor (L1 Loss, MAE)"]
        M_Late["LightGBM Classifier (Binary LogLoss)"]
        Sub1["submission_task1.csv (5,014 rows)"]
    end

    subgraph Task 2A ["Task 2A: 10-Week Demand Forecaster"]
        Agg_Wk["117-Week Unbroken Series Aggregator"]
        Fest_Eng["Festival Ramp & Payday Feature Extractor"]
        Ens_2A["LightGBM + Ridge Multi-Step Ensemble"]
        Chilled_R["Empirical Depot Chilled Ratio Enforcer"]
        Sub2A["submission_task2a.csv (60 rows)"]
    end

    subgraph Task 2B ["Task 2B: Peak-Day MILP Allocator"]
        MILP_Form["Combinatorial Set-Partitioning MILP"]
        HiGHS_Solv["HiGHS 1.15.1 Solver (0.00% Gap)"]
        Check_Alloc{"check_allocation.py Gate"}
        Sub2B["submission_task2b.csv (79 Served, 6 Deferred)"]
        Doc_Pol["Prioritization Policy Document"]
    end

    D_Train & L_Train --> L_Build
    L_Build & Gen_Data --> Feat_Eng --> Leak_Gate --> OOF_TE
    OOF_TE --> M_Svc --> Sub1
    OOF_TE --> M_Late --> Sub1

    D_Train & T1_Test & Gen_Data --> Agg_Wk --> Fest_Eng --> Ens_2A --> Chilled_R --> Sub2A

    T2B_Test & Gen_Data --> MILP_Form --> HiGHS_Solv --> Check_Alloc --> Sub2B & Doc_Pol
```

---

## 2. Component Architecture Details

### 2.1 Task 1: Dual-Head Gradient Boosted Decision Tree
- **Service Duration Head:**
  - Loss Objective: $L_1$ Mean Absolute Error (`regression_l1`). Directly optimizes the competition evaluation metric.
  - Hyperparameters: 600 estimators, learning rate 0.05, 31 leaves, 25 min child samples, 0.8 feature/data bagging, early stopping on validation fold.
  - Post-processing: Lower-bound clipping at 2.0 minutes (empirical physical minimum).
  - Performance: **4.001 min MAE** (vs. **7.451 min baseline** from published service allowance $\rightarrow$ **+46.3% improvement**).
- **Arrival Lateness Head:**
  - Loss Objective: Binary Cross-Entropy (`binary_logloss`).
  - Performance: **0.1537 LogLoss** (vs. **0.4945 baseline** from historical prior $\rightarrow$ **+68.9% improvement**), **0.9762 ROC-AUC**, **0.0479 Brier Score**.
  - Top Predictors: Window slack buffer (`win_slack_min`), road disruption index (`geo_disruption_index`), outlet historical late rate (`hist_outlet_late_rate`), route sequence progress (`route_seq`).

### 2.2 Task 2A: 10-Week Multi-Series Demand Forecasting
- **Data Continuity:** Fused 111 weeks of training deliveries with 6 weeks of test delivery orders to assemble an unbroken 117-week series (2024-W01 to 2026-W13) across all 6 `(depot, brand)` pairs.
- **Calendar & Festival Modeling:** Directly captured the April Sinhala & Tamil New Year demand surge (week 15) and statutory closure dip (week 16) through `festival_ramp_sum`, `operating_days`, and annual seasonal lags (`lag_52`).
- **Chilled Integrity Constraint:** Guaranteed chilled volume for Style and Tech is strictly 0.000, and Fresh chilled volume matches the empirical depot ratio (36.35% for Kandy, 36.84% for Peliyagoda).

### 2.3 Task 2B: Exact Combinatorial MILP Allocation
- **Solver Engine:** HiGHS 1.15.1 via Python PuLP interface running natively on Apple Silicon arm64.
- **Formulation:** 4,072 binary variables, 5,753 linear constraints.
- **Rules Enforced (1:1 with `check_allocation.py`):**
  1. Fleet availability constraint (28 available, 10 excluded workshop vehicles).
  2. Depot alignment constraint (vehicle depot must equal order depot).
  3. Single-brand trip constraint.
  4. Single-district trip constraint.
  5. Reefer temperature constraint (chilled orders strictly assigned to reefer vehicles).
  6. Parking access constraint (van-only outlets strictly assigned to vans).
  7. Vehicle weight and volume capacities.
  8. Trip limit (maximum 2 trips per vehicle per day).
  9. Pre-dawn window budget ($\le 270$ min for Fresh) and Daytime window budget ($\le 480$ min for Style/Tech).
- **Outcome:** **79 served, 6 deferred** (0.00% optimality gap in 26.4 seconds). Passed official `check_allocation.py` with zero warnings or errors.

---

## 3. Competition Verification & Compliance Register
- [x] **Zero Pre-trained Models:** All LightGBM, Ridge, and MILP formulations trained from scratch.
- [x] **Zero External / Proprietary APIs:** All features derived solely from shipped competition files.
- [x] **Air-Gapped Git Storage:** Shipped datasets and derived CSV submissions are stored externally in `~/Development/TechTriathlon2026_Datasets/` and strictly ignored in `.gitignore`. Verified by `bash datathon/scripts/no_data_in_git.sh`.
- [x] **Official Checker Passed:** `check_allocation.py` returns `FEASIBILITY: PASSED - every rule satisfied.`
