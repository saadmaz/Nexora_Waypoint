"""Dataset path resolution. Data lives OUTSIDE the git repo, always."""
from __future__ import annotations

import os
from pathlib import Path

_DATASET_DEFAULT = (
    Path.home()
    / "Development"
    / "TechTriathlon2026_Datasets"
    / "Tech-Triathlon 2026 - Datasets"
)

DATASET_ROOT = Path(os.environ.get("TT2026_DATA", _DATASET_DEFAULT)).expanduser()
DATA = DATASET_ROOT / "data"
TRAIN = DATA / "Training Data"
TEST = DATA / "Test Data"
GENERAL = DATA / "General Data"
TEMPLATES = DATA / "Submission Templates"
CHECKER = DATASET_ROOT / "check_allocation.py"
ARTIFACTS = Path(
    os.environ.get(
        "TT2026_ARTIFACTS",
        Path.home() / "Development" / "TechTriathlon2026_Datasets" / "artifacts",
    )
).expanduser()

REPO_ROOT = Path(__file__).resolve().parents[2]  # .../Nexora_Waypoint/datathon


def assert_data_external() -> None:
    """Hard guard: dataset must never resolve inside the git repo."""
    root = DATASET_ROOT.resolve()
    repo = REPO_ROOT.parent.resolve()  # Nexora_Waypoint
    if str(root).startswith(str(repo)):
        raise RuntimeError(
            f"Dataset root {root} is inside the git repo {repo}. "
            "Move it to ~/Development/TechTriathlon2026_Datasets and set TT2026_DATA."
        )
    if not CHECKER.is_file():
        raise RuntimeError(f"Official checker not found at {CHECKER}")
