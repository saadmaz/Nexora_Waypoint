# Tech-Triathlon 2026 Datathon: AI Tool Disclosure Statement
**Team:** Nexora  
**Competition:** Tech-Triathlon 2026  
**Document Purpose:** Compliance with Challenge Booklet Section "AI Tool Disclosure" (p. 22)

---

## 1. Overview of AI Assistance
Team Nexora utilized modern developer tooling and AI coding assistants (including Antigravity, Claude, and local Python Linters) during the development of our competition submission. In strict adherence to competition rules:
- **No Proprietary AI API Endpoints in Models:** All trained models are standalone LightGBM and Ridge regressors executing locally via scikit-learn and joblib. No proprietary remote LLM or external black-box prediction APIs are queried at inference time.
- **No Low-Code / No-Code AutoML Tools:** All feature transformations, target encodings, loss functions, and optimization formulations were authored, vetted, and verified in custom Python scripts without automated AutoML platforms (e.g., DataRobot, AutoKeras, Vertex AutoML).

---

## 2. Granular Breakdown by Pipeline Stage

| Pipeline Stage | AI-Assisted Activities | Human-Directed Decisions & Verifications |
| :--- | :--- | :--- |
| **Problem Formulation & Label Construction** | Fast text search of Challenge Booklet PDF to extract quotes and constraints. | **100% Human Decision:** The mathematical definition of effective start time: $\text{effective\_start} = \max(\text{arrival}, \text{window\_open})$ to strip waiting time, and identifying that 17,991 late arrivals were serviced. |
| **Feature Engineering & Leakage Boundary** | Syntactic drafting of feature dictionary mappings and vectorized pandas code. | **100% Human Decision:** Definition of strict leakage boundary (`assert_no_leakage`), blocking actual travel columns, and designing 5-fold out-of-fold target encoding logic. |
| **Task 2A Demand Forecasting** | Drafting boilerplates for multi-series iteration across 6 series. | **100% Human Decision:** Recognizing that demand must aggregate by `order_date` (not `dispatch_date`), including all 3 dispatch statuses (`attempted`, `deferred`, `not_run`), enforcing zero chilled volume for Style/Tech, and modeling the Sri Lankan Sinhala/Tamil New Year calendar shift. |
| **Task 2B Combinatorial Fleet Optimization** | Syntax formatting for PuLP / HiGHS integer programming variables and constraints. | **100% Human Decision:** Formulating the linear trip-time equation matching `check_allocation.py`, setting the multi-objective weights prioritizing perishables and neglected outlets, and proving that order `S1-078` is physically impossible ($40.66\,\text{m}^3 > 38.0\,\text{m}^3$). |
| **Verification & Submission Packaging** | Automated bash verification scripts and Makefile orchestration. | **100% Human Decision:** Manual validation of submission file headers, verification against official `check_allocation.py`, and ensuring zero data files are committed to git. |

---

## 3. Verification & Local Reproducibility
All deliverables were compiled, verified, and executed locally on local workstations under Python 3.12:
- Dual LightGBM models trained and evaluated via 5-fold cross-validation.
- HiGHS solver executed locally to global optimality ($0.00\%$ gap).
- Full master notebook executed end-to-end via `jupyter nbconvert` producing deterministic outputs.
