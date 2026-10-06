PY := .venv/bin/python
export PYTHONPATH := src
DATA := $(HOME)/Development/TechTriathlon2026_Datasets/Tech-Triathlon 2026 - Datasets
ART := $(HOME)/Development/TechTriathlon2026_Datasets/artifacts

guard:
	bash scripts/no_data_in_git.sh

labels:
	TT2026_DATA="$(DATA)" $(PY) -m nexora_dt.labels_task1 --qa

alloc:
	mkdir -p "$(ART)"
	TT2026_DATA="$(DATA)" TT2026_ARTIFACTS="$(ART)" $(PY) -m nexora_dt.alloc2b \
	  --scenario S1 --out "$(ART)/submission_task2b.csv"

verify: alloc
	$(PY) "$(DATA)/check_allocation.py" "$(ART)/submission_task2b.csv"
