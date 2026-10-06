# Tech-Triathlon 2026 Datathon: AI Tool Disclosure Statement
**Team:** Nexora  
**Competition:** Tech-Triathlon 2026  
**Document Purpose:** Compliance with Challenge Booklet Section "AI Tool Disclosure" (p. 22)

---

## 1. Overview of AI Tool Utilization
In strict adherence to the competition rules (Booklet p. 22: *“Usage of Low-code/No-code AI tools or fully automated end-to-end modelling tools are strictly prohibited... Proprietary API-based modelling/preprocessing is prohibited”*), Team Nexora used AI coding assistants (Google Antigravity and Anthropic Claude) exclusively in an interactive, pair-programming and code-auditing capacity.

- **No Proprietary AI APIs at Inference Time:** All models are self-contained LightGBM regressors/classifiers and scikit-learn Ridge models. Inference runs 100% locally from serialized joblib artifacts.
- **No Low-Code / AutoML Platforms:** No automated AutoML systems (e.g., Vertex AutoML, DataRobot, AutoKeras) were used. All loss functions, feature architectures, cross-validation splits, and integer programs were handcrafted in Python.
- **Pair-Programming & Code Auditing:** AI tools acted as high-rigor static analysis partners, helping identify edge cases, review code diffs, verify boundary conditions, and draft boilerplate. Every finding was evaluated, validated, and approved by the engineering team.

---

## 2. Granular Stage-by-Stage Disclosure

| Pipeline Stage | AI Assistant Contribution | Engineering Team Decisions & Validation |
| :--- | :--- | :--- |
| **Problem Formulation & Label Construction** | Fast text extraction from the challenge PDF; helped identify early-arrival patterns across the 92,307 order rows. | Formulated the mathematical definition of effective service start time: $\text{effective\_start} = \max(\text{arrival}, \text{window\_open})$ to isolate unloading duration from driver wait time. |
| **Feature Engineering & Leakage Boundary** | Assisted in drafting vectorized pandas expressions for geospatial speed indices and temporal features. | Defined and enforced the mandatory runtime leakage gate (`assert_no_leakage`), designed out-of-fold target encoding splits, and normalized disruption/traffic indices to physical $[0, 1]$ scales. |
| **Task 2A Demand Forecasting** | Static code review flagged that initial code used `dispatch_date.fillna(order_date)`. | Accepted the audit finding and aligned demand aggregation strictly with `order_date` per Booklet p. 17. Designed the 70/30 LightGBM+Ridge ensemble with cold-chain zero constraints for Style and Tech. |
| **Task 2B Combinatorial Fleet Optimization** | Syntax formatting of PuLP decision variables and constraint matrices. | Formulated the linear trip-time equation matching `check_allocation.py`, parameterized the fairness multi-objective weights, and derived the 8-vs-9 reefer slot impossibility proof. |
| **Verification & Submission Packaging** | Automated bash packaging commands and template alignment scripts. | Ran manual validations against official templates, verified `check_allocation.py` outputs, and confirmed zero competition data in git. |

---

## 3. Local Verification & Reproducibility
All deliverables were compiled, trained, and executed locally on local workstations under Python 3.12:
- Dual LightGBM models trained and evaluated via 5-fold cross-validation with out-of-fold target encodings.
- HiGHS MILP solver executed to provable global optimality within a $0.0099\%$ duality gap (below the $0.01\%$ MIP tolerance).
- Master notebook `Nexora_FinalNotebook.ipynb` executed top-to-bottom via `jupyter nbconvert` producing deterministic, reproducible outputs.
