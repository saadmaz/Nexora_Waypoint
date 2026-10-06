# Tech-Triathlon 2026 Datathon: Preprocessing & Label Construction Specification
**Team:** Nexora  
**Scope:** Task 1 (Outlet Service Duration & Arrival Lateness), Task 2A (Demand Forecast), Task 2B (Peak Allocation)

---

## 1. Ground Truth Label Construction (Task 1)

### 1.1 Service Time Duration (`service_time_min`)
Per the official competition booklet rules:
> *"Outlets receive goods only within their delivery window. A vehicle that arrives early waits until the window opens."*

Consequently, early arrival waiting time is external to outlet handling and dock offloading. The effective start time of outlet service is mathematically defined as:
$$\text{effective\_start} = \max(\text{arrival\_time}, \text{window\_open\_time})$$
$$\text{service\_time\_min} = \text{leave\_outlet\_time} - \text{effective\_start}$$

#### Empirical Evidence & Verification:
- Analyzed across 91,894 executed route legs in `deliveries_train.csv` joined 1:1 with `route_legs_train.csv`.
- **4,023 deliveries (4.38%)** arrived before `window_open_time` (average wait time: 20.0 minutes). Stripping this wait eliminates negative duration artifacts.
- **17,991 deliveries (19.58%)** arrived after `window_close_time`. Profiling confirms that in 100% of these late arrivals, $\text{leave\_outlet\_time} > \text{arrival\_time}$, demonstrating that retail outlets service late arrivals. Lateness is evaluated as a separate performance indicator; service duration remains valid.
- Distribution: Minimum: 2.0 min, Median: 18.0 min, Mean: 19.00 min, Maximum: 428.0 min. Zero negative values, zero missing values.

### 1.2 Arrival Lateness Probability (`late_binary`)
Per the official competition booklet rules:
> *"Lateness refers to arrival after the window closes."*

$$\text{late\_binary} = \mathbb{I}(\text{arrival\_time} > \text{window\_close\_time})$$

#### Empirical Evidence & Verification:
- Exactly 279 deliveries arrived precisely at $\text{arrival\_time} == \text{window\_close\_time}$. These are classified as strictly on-time (`late_binary = 0`).
- Base training late rate: **19.58%** (17,991 / 91,894).
- Time format: 24-hour HH:MM parsed to minutes from midnight ($H \times 60 + M$). Wrapped-around midnight safety implemented.

---

## 2. Feature Engineering & Strict Leakage Boundary

### 2.1 Hard Leakage Gate (`assert_no_leakage`)
To ensure total compliance with competition rules, the feature pipeline implements a mandatory runtime verification gate:
- **Strictly Blocked Columns:** `arrival_time`, `leave_outlet_time`, `actual_depart_time`, `actual_travel_duration_min`, `service_time_min`, `late_binary`, `wait_min`.
- **Allowed Feature Prefixes:**
  - `ord_`: Order physics (units, weight, volume, density, weight/volume per unit, chilled flag, deferred status).
  - `plan_`: Planned schedule metrics (planned arrival min, planned depart min, planned travel duration, planned speed, planned speed vs traffic index, published service allowance baseline).
  - `win_`: Window geometries (window open min, window close min, window duration, arrival slack min = close - plan_arr, early offset min = plan_arr - open, slack ratio).
  - `route_`: Route topology (sequence in route, total stops on route, route progress ratio, stops remaining).
  - `veh_`: Fleet utilization (weight capacity, volume capacity, weight utilization, volume utilization, van flag, reefer flag).
  - `cal_`: Calendar and environmental temporal signals (day of week, weekend indicator, payday indicator, festival ramp, holiday indicator, monsoon, hour of day, ISO week).
  - `geo_`: Spatial and road metrics (road disruption index, traffic speed index, free-flow velocity, depot-to-district distance/time, inter-stop free-flow time, mall window indicator, van-only access restriction).
  - `hist_`: Empirical Bayes out-of-fold target encodings.

### 2.2 Out-Of-Fold Target Encoding (CV Hygiene)
To capture outlet-specific handling speeds and local congestion without data leakage:
- Evaluated via 5-Fold Cross-Validation on the training partition.
- Empirical Bayes smoothing applied:
  $$\hat{\mu}_{\text{outlet}} = \frac{N \cdot \bar{y}_{\text{outlet}} + M \cdot \mu_{\text{global}}}{N + M}$$
  with prior smoothing weight $M=10$ for service duration and $M=20$ for lateness.
- The test set is transformed strictly using encodings fitted across the full training dataset.

---

## 3. Data Cleaning & Auxiliary Table Integration
1. **Deliveries to Route Legs Merge:** 91,894 runnable training deliveries join strictly 1:1 on `(route_id, seq_in_route) == (route_id, seq)`. 413 unassigned orders (`dispatch_status == 'not_run'`) possess no actual leg and are excluded from label training.
2. **Road Conditions & Traffic Speed:** Joined on `(district, date)` and `(district, hour, monsoon)`. Road conditions and traffic speed indices are normalized to $[0.0, 1.0]$ where $1.0 = \text{clear/free-flow}$. Missing entries default to $1.0$ (nominal free-flow).
3. **Dock Type Standardization:** Standardized to include `rear_dock` (0), `street` (1), and `mall_bay` / `mall_dock` (2) matching all 120 physical outlets.
4. **Calendar Data:** Shipped `calendar.csv` contains complete holiday, payday, and festival ramp schedules across all 910 days of the evaluation horizon.

---

## 4. Task 2A Demand Accounting & Unconstrained Volume Construction
Per the official competition booklet rules (p. 17):
> *"Count every order once, including orders that were deferred or never dispatched. They still represent demand. Assign each order to the week the store requested the order. Use iso_year and iso_week from calendar.csv so the forecast periods match the supplied calendar. Only Fresh has chilled demand. Set pred_chilled_volume_m3 to 0 for Style and Tech."*

### 4.1 Methodology & Rationale
1. **Order Date Primacy (`order_date`):** Demand forecasting models store ordering behavior, not depot dispatch logistics. Dispatched orders that experienced multi-day deferrals (1,956 historical orders) were requested on `order_date`. Assigning orders to `dispatch_date` creates artificial weekly demand distortions across ISO week boundaries. Therefore, demand is aggregated strictly on `order_date`.
2. **Inclusive Dispatch Status Accounting:** All three dispatch categories represent genuine consumer demand:
   - `attempted` (90,351 rows): Dispatched on order date.
   - `deferred` (1,543 rows): Dispatched on subsequent days due to fleet shortages.
   - `not_run` (413 rows): Orders that were placed by retail stores but never dispatched due to insurmountable stockout or vehicle bottlenecks.
   Every order row is counted exactly once into weekly aggregate demand.
3. **Cold Chain Separation:**
   - Style and Tech series strictly output `pred_chilled_volume_m3 = 0.000` under domain rules.
   - Fresh series models empirical chilled proportion ($\approx 36.8\%$ at Peliyagoda, $\approx 36.3\%$ at Kandy) decomposed via joint multi-series LightGBM and Ridge estimators.

