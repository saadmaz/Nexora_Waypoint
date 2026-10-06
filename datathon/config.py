import sys
import os
from pathlib import Path

# Add project root to sys.path
DATATHON_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = DATATHON_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(DATATHON_DIR) not in sys.path:
    sys.path.insert(0, str(DATATHON_DIR))

# Datasets directory (stored safely outside the git repo)
DATA_ROOT = Path(os.path.expanduser("~/Development/TechTriathlon2026_Datasets/Tech-Triathlon 2026 - Datasets"))
DATA_DIR = DATA_ROOT / "data"

TRAIN_DIR = DATA_DIR / "Training Data"
TEST_DIR = DATA_DIR / "Test Data"
GENERAL_DIR = DATA_DIR / "General Data"
TEMPLATES_DIR = DATA_DIR / "Submission Templates"

# Output directories (ignored by git)
OUTPUT_DIR = DATATHON_DIR / "output"
MODELS_DIR = DATATHON_DIR / "models"
SUBMISSIONS_DIR = DATATHON_DIR / "submissions"

for d in [OUTPUT_DIR, MODELS_DIR, SUBMISSIONS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# File paths
FILES = {
    # Training
    "deliveries_train": TRAIN_DIR / "deliveries_train.csv",
    "route_legs_train": TRAIN_DIR / "route_legs_train.csv",
    # Test
    "task1_test_inputs": TEST_DIR / "task1_test_inputs.csv",
    "route_legs_test": TEST_DIR / "route_legs_test.csv",
    "task2a_test_inputs": TEST_DIR / "task2a_test_inputs.csv",
    "task2b_peak_day_scenarios": TEST_DIR / "task2b_peak_day_scenarios.csv",
    "task2b_peak_day_fleet": TEST_DIR / "task2b_peak_day_fleet.csv",
    # General / Reference
    "calendar": GENERAL_DIR / "calendar.csv",
    "district_travel": GENERAL_DIR / "district_travel.csv",
    "outlets": GENERAL_DIR / "outlets.csv",
    "road_conditions": GENERAL_DIR / "road_conditions.csv",
    "service_allowance": GENERAL_DIR / "service_allowance.csv",
    "traffic_speed": GENERAL_DIR / "traffic_speed.csv",
    "vehicles": GENERAL_DIR / "vehicles.csv",
    # Templates
    "submission_task1_template": TEMPLATES_DIR / "submission_task1.csv",
    "submission_task2a_template": TEMPLATES_DIR / "submission_task2a.csv",
    "submission_task2b_template": TEMPLATES_DIR / "submission_task2b.csv",
    # Verifier script
    "check_allocation": DATA_ROOT / "check_allocation.py",
}

# Operational constants from Challenge Booklet
PREDAWN_BUDGET_MIN = 270   # Fresh window: 03:30 - 08:00
DAYTIME_BUDGET_MIN = 480   # Style & Tech window: Trading day
MAX_TRIPS_PER_VEHICLE = 2
