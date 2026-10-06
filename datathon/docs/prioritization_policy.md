# Task 2B: Peak-Day Fleet Allocation & Deferral Policy
**Author:** Team Nexora | **Competition:** Tech-Triathlon 2026 Datathon  
**Target Scenario:** Scenario S1 (Peliyagoda Depot, Peak-Day Demand)  
**Submission Artifact:** `submission_task2b.csv` (79 Served, 6 Deferred — Feasibility Passed)

---

## 1. Executive Summary & Optimization Outcome
On Scenario S1, 85 customer orders across three retail brands (Fresh, Style, Tech) were requested for fulfillment from the Peliyagoda depot. With 28 available fleet vehicles and 10 vehicles immobilized in workshop maintenance, Team Nexora deployed an exact Mixed-Integer Linear Programming (MILP) formulation using HiGHS. The solver achieved global optimality (0.00% duality gap), successfully serving **79 out of 85 orders (92.9% fulfillment rate)** across 23 vehicle trips, with **zero feasibility violations** under the official `check_allocation.py` validation harness.

Only **6 orders** were deferred. This document articulates the binding operational bottlenecks, categorizes the deferrals into physical impossibilities versus economic policy trade-offs, and details operational remedies.

---

## 2. Active Operational Bottlenecks
Mathematical profiling reveals that vehicle fleet count is not the aggregate bottleneck (16 ambient vehicles remained in depot reserve). Rather, the operational constraints form two binding bottlenecks:

1. **Refrigerated Vehicle Scarcity:**
   - 26 orders in Scenario S1 require chilled transport (exclusively Fresh).
   - Only **4 refrigerated vehicles** are operational at Peliyagoda (`VEH003`, `VEH006`, `VEH007` [5,000 kg / 25 $m^3$ trucks] and `VEH036` [1,500 kg / 9 $m^3$ van]).
   - Under the rule capping vehicles at 2 trips/day, the maximum theoretical reefer trip capacity across Peliyagoda is $4 \times 2 = 8$ trips.
   - Chilled orders are dispersed across **7 distinct geographic districts** (Colombo, Gampaha, Kalutara, Galle, Kurunegala, Matara, Puttalam). Because the operating rules strictly forbid multi-district trips ("one district per trip"), serving all 7 districts would require at least 7 trips, consuming 87.5% of all reefer trip slots.

2. **Pre-Dawn Fresh Delivery Window (270-Minute Budget):**
   - Fresh orders must be completed between 03:30 and 08:00 (a rigid 270-minute window).
   - Peripheral districts demand substantial line-haul transit times from Peliyagoda:
     - **Puttalam:** 173 min free-flow outbound + 24 min inter-stop.
     - **Matara:** 137 min free-flow outbound + 10 min inter-stop.
     - **Kurunegala:** 127 min free-flow outbound + 19 min inter-stop.
     - **Galle:** 103 min free-flow outbound + 9 min inter-stop.
   - Any vehicle dispatched on a long-haul trip (e.g., Puttalam at 173 min + handling = 193 min) expends $>70\%$ of its entire daily Fresh budget on a single trip, precluding it from executing a second long-haul run.

---

## 3. Categorization of Deferrals: Unavoidable vs. Chosen Trade-Offs

| Order Ref | Brand | District | Temp | Volume ($m^3$) | Weight (kg) | Deferred Yesterday | Category | Operational Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **S1-078** | Style | Kurunegala | Ambient | **40.66** | 2,561.6 | 0 | **Unavoidable** | **Physical Volumetric Infeasibility.** The largest truck in the fleet has a volume capacity of 25.0 $m^3$. Order S1-078 exceeds single-vehicle capacity by 62.6% and cannot be loaded on any available vehicle under single-trip rules. |
| **S1-056** | Fresh | Galle | Chilled | 3.75 | 670.7 | 0 | **Chosen** | **Reefer Opportunity Cost.** Dispatched reefer capacity prioritized Gampaha (6 chilled orders) and Colombo (9 chilled orders). Dedicating a 143-min reefer run to Galle for 2 orders would starve high-density urban clusters. |
| **S1-058** | Fresh | Galle | Chilled | 16.52 | 2,741.8 | 0 | **Chosen** | **Reefer Opportunity Cost.** Paired with S1-056; deferred to preserve reefer vehicle availability for high-demand clusters. |
| **S1-064** | Fresh | Matara | Chilled | 6.78 | 1,277.8 | 0 | **Chosen** | **Budget Depletion.** Matara round-trip + service totals 177 min. Assigning a reefer truck to Matara consumes 65.5% of its 270-min window for only 2 orders, preventing 2 separate local Gampaha trips. |
| **S1-067** | Fresh | Matara | Chilled | 5.19 | 930.2 | 0 | **Chosen** | **Budget Depletion.** Paired with S1-064. |
| **S1-083** | Fresh | Puttalam | Chilled | 8.66 | 1,588.8 | 1 | **Chosen** | **Extreme Transit Penalty.** Puttalam requires 173 min outbound transit for a single order. While S1-083 had `deferred_yesterday=1`, committing a reefer truck would have forced the deferral of 4+ chilled orders in Gampaha. |

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
