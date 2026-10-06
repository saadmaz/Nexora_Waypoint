# Task 2B: Peak-Day Fleet Allocation & Deferral Policy
**Author:** Team Nexora | **Competition:** Tech-Triathlon 2026 Datathon  
**Target Scenario:** Scenario S1 (Peliyagoda Depot, Peak-Day Demand)  
**Submission Artifact:** `submission_task2b.csv` (79 Served, 6 Deferred — Feasibility Passed)

---

## 1. Executive Summary & Optimization Outcome
On Scenario S1, 85 customer orders across three retail brands (Fresh, Style, Tech) were requested for fulfillment from the Peliyagoda depot. With 28 available fleet vehicles and 10 vehicles immobilized in workshop maintenance, Team Nexora deployed an exact Mixed-Integer Linear Programming (MILP) formulation using HiGHS. The solver achieved provable global optimality within a **0.0099% duality gap** (well within the standard 0.01% MIP tolerance), successfully serving **79 out of 85 orders (92.9% fulfillment rate)** across **22 vehicle trips** (17 vehicles utilized), with **zero feasibility violations** under the official `check_allocation.py` validation harness.

Only **6 orders** were deferred. This document articulates the binding operational bottlenecks, categorizes the deferrals into physical impossibilities versus economic policy trade-offs, and details operational remedies.

---

## 2. Active Operational Bottlenecks

### 2.1 The "8 vs. 9 Reefer Slots" Impossibility Proof
Mathematical profiling reveals that vehicle fleet count is not the aggregate bottleneck (11 ambient vehicles remained idle in depot reserve). Rather, refrigerated capacity and geographic dispersion create an insurmountable structural bottleneck:
- **Available Refrigerated Fleet:** Only **4 refrigerated vehicles** are operational at Peliyagoda:
  - `VEH006` (truck, reefer): 33.4 $m^3$ / 6,840 kg
  - `VEH003` (truck, reefer): 26.4 $m^3$ / 5,510 kg
  - `VEH007` (truck, reefer): 19.4 $m^3$ / 3,610 kg
  - `VEH036` (van, reefer): 7.0 $m^3$ / 1,040 kg
- **Maximum Reefer Slot Budget:** Under the official competition rule capping each vehicle at a maximum of 2 trips per day, the absolute maximum theoretical chilled trip capacity is $4 \times 2 = \mathbf{8\text{ trip slots}}$.
- **Chilled District Demand:** 26 orders in Scenario S1 require chilled transport, dispersed across **7 distinct geographic districts**:
  1. **Colombo:** 9 orders, 51.60 $m^3$ $\implies$ Exceeds single-truck maximum capacity (33.4 $m^3$); strictly requires $\ge 2$ trips.
  2. **Gampaha:** 6 orders, 48.06 $m^3$ $\implies$ Exceeds single-truck maximum capacity; strictly requires $\ge 2$ trips.
  3. **Kalutara:** 3 orders, 16.03 $m^3$ $\implies$ Requires $\ge 1$ trip.
  4. **Kurunegala:** 3 orders, 25.04 $m^3$ $\implies$ Requires $\ge 1$ trip.
  5. **Galle:** 2 orders, 20.27 $m^3$ $\implies$ Requires $\ge 1$ trip.
  6. **Matara:** 2 orders, 11.98 $m^3$ $\implies$ Requires $\ge 1$ trip.
  7. **Puttalam:** 1 order, 8.66 $m^3$ $\implies$ Requires $\ge 1$ trip.
- **The Mathematical Impossibility:** Under the single-district per trip rule, covering all 7 chilled districts requires at least $2 + 2 + 1 + 1 + 1 + 1 + 1 = \mathbf{9\text{ trip slots}}$.
  $$\text{Required Slots (9)} > \text{Available Slots (8)}$$
  **Conclusion:** Serving all 7 chilled districts is physically and mathematically impossible. At least one district was guaranteed to experience deferral; the solver's task was determining *which* district deferrals minimize systemic damage.

### 2.2 Pre-Dawn Fresh Delivery Window (270-Minute Budget)
Fresh deliveries operate strictly within the pre-dawn window ($03:30 - 08:00$, a 270-minute budget):
- **Puttalam:** 173 min free-flow outbound + 25 min handling = 198 min ($73.3\%$ of the entire daily Fresh shift for 1 order).
- **Matara:** 137 min free-flow outbound + 29 min handling = 166 min ($61.5\%$ of shift for 2 orders).
- **Galle:** 103 min free-flow outbound + 40 min handling = 143 min ($53.0\%$ of shift for 2 orders).
Committing a reefer truck to a 198-minute Puttalam run exhausts the vehicle's pre-dawn shift on a single stop, starving dense urban clusters where a single truck services 6 to 9 stores.

---

## 3. Categorization of Deferrals: Unavoidable vs. Chosen Trade-Offs ("Price of Fairness")

| Order Ref | Outlet | Brand | District | Temp | Volume ($m^3$) | Def. Yest. | Days Unserved | Category | Binding Constraint | Counterfactual Solved Opportunity Cost (Orders Displaced if Forced) |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- | :--- | :--- |
| **S1-078** | OUT070 | Style | Kurunegala | Ambient | **40.66** | 0 | 2 | **Unavoidable** | **Individual Volume Cap:** Max truck volume in fleet is 38.0 $m^3$. | **$0.00$** — Physically unservable under single-order vehicle rules. |
| **S1-083** | OUT074 | Fresh | Puttalam | Chilled | 8.66 | 1 | 5 | **Chosen** | **Transit Time & Reefer Slot Cap:** 173 min line-haul. | **4 Orders Displaced:** Forcing S1-083 drops S1-075, S1-073, S1-071 (Kurunegala) and S1-003 (Colombo) — a net loss of **26.89 $m^3$** chilled volume ($>3\times$ volume loss). |
| **S1-056** | OUT053 | Fresh | Galle | Chilled | 3.75 | 0 | 2 | **Chosen** | **Reefer Fleet Cap:** Paired with S1-058 in Galle. | **2 Orders Displaced:** Forcing S1-056 drops S1-021 and S1-003 in Colombo — a net loss of **11.74 $m^3$** chilled volume. |
| **S1-058** | OUT054 | Fresh | Galle | Chilled | 16.52 | 0 | 1 | **Chosen** | **Reefer Fleet Cap:** Dispatched volume prioritized closer urban clusters. | Paired with S1-056; displaces Colombo high-density stores. |
| **S1-064** | OUT060 | Fresh | Matara | Chilled | 6.78 | 0 | 1 | **Chosen** | **Window Depletion:** Peliyagoda $\to$ Matara is 137 min outbound (65.5% shift). | **4 Orders Displaced:** Forcing S1-064 drops S1-075, S1-073, S1-071, and S1-003 (**26.89 $m^3$** chilled volume loss). |
| **S1-067** | OUT062 | Fresh | Matara | Chilled | 5.19 | 0 | 1 | **Chosen** | **Window Depletion:** Paired with S1-064 in Matara district. | Conserves reefer truck for second-wave city replenishment. |

---

## 4. Priority Objective Function & Fairness Rules
Our optimization objective function explicitly balances operational yield with customer fairness:
$$\text{Maximize} \quad \sum_{o \in \mathcal{O}} W(o) \cdot x_o - \epsilon \cdot \sum_{t} y_t$$
where weights are structured as:
$$W(o) = 1.0 + 100.0 \cdot \mathbb{I}(\text{chilled}) + 40.0 \cdot \mathbb{I}(\text{deferred\_yesterday}) + 3.0 \cdot \text{days\_since\_last\_served}$$

- **Consecutive Deferral Prevention:** 9 out of 10 orders with `deferred_yesterday=1` were successfully served. Only S1-083 was deferred due to extreme line-haul budget exhaustion.
- **Stockout Mitigation:** Orders with elevated `days_since_last_served` receive linear priority boosts, ensuring remote retail outlets do not experience systemic stockouts.

---

## 5. Store Manager Impact & Mitigation Roadmap
1. **Automated Order Splitting for Oversized Parcels:** S1-078 (40.66 $m^3$) must be partitioned at order-entry into two sub-orders ($20.33\ m^3 \times 2$) to allow multi-vehicle conveyance.
2. **Reefer Van Utilization & Overnight Cross-Docking:** Stationing a refrigerated shuttle at southern cross-docks (Galle/Matara) allows line-haul ambient transfer with localized last-mile refrigerated delivery.
3. **Guaranteed Priority Next-Day Dispatch (SLA Recovery):** The 6 deferred outlets receive automatic first-priority morning dispatch slots on Day S2, protected by a hard constraint in the scheduler.
