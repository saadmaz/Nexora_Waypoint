# data/

Put the competition CSVs here on your own machine. They are git-ignored and must never be committed,
pasted into AI tools or uploaded anywhere public (team rule; PRD open decision O-1).

The seed expects these files (names as supplied in the competition pack):

| File | Loaded into |
|---|---|
| `outlets.csv` | `outlets` |
| `vehicles.csv` | `vehicles` |
| `calendar.csv` | `calendar_days` |
| `district_travel.csv` | `districts` |
| `service_allowance.csv` | `service_allowances` |
| `traffic_speed.csv` | `traffic_speed` |
| `deliveries_train.csv` | order size sampling and history (A41) |

Column names are mapped in `backend/seed/load_reference.py` (`COLUMNS`). If a header differs, fix the
mapping there, not the CSV. `backend/seed/checks.py` then fails loudly if any value in PRD §4c disagrees
with the CSV.
