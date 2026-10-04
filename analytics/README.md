# Analytics

`waypoint-task-2b.ipynb` is the Datathon notebook. It imports the same `waypoint_rules` package the API uses and plays the PRD's reference
day (section 4c): the trip-minutes formula for Task 2B, `check_trip` on each trip of plan v3, the dispatcher's three refusals, and the
planner's own draft next to the hand-made plan. It reads no competition files; the outputs are saved in the notebook.

```bash
pip install -e "backend[dev]" jupyter
cd analytics && jupyter notebook waypoint-task-2b.ipynb
```

Run it from this folder: it adds `../backend` to the import path.
