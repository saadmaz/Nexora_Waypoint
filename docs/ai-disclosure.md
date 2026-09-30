# AI tool disclosure

Waypoint was built with AI coding tools. This file is where we say so, once, as the booklet and PRD v3 §4d ask
(no per-screen "Mock data" chips). Add a line to the log when an AI tool does a meaningful part of a PR.

## Invented data

The competition CSVs are the only real data. Everything below was invented or inferred, and is registered in
PRD v3 §4d (the assumption register, A1 to A43):

- The hero-day orders, times, history, plan versions and live-board rows.
- The four demo accounts, the loader PINs (Priya 1234, Ruwan 5678) and all driver names other than those named in the PRD.
- The scripted background events (`backend/seed/scenario_events.yaml`), which the README says are simulated.
- The fallback reference set in `backend/seed/` used when `data/*.csv` is absent (PRD §4c figures and a generated calendar).
- Generated orders (A41), once the generator lands.

No competition CSV row was given to any AI tool.

## Log

| Date | Branch / PR | Tool | What the AI did | What a person did |
| --- | --- | --- | --- | --- |
| 2026-10-01 | `feature/backend-foundation` (PR #5) | Claude Code (Claude Sonnet 5.5) | Wrote the FastAPI app core, SQLAlchemy models, the initial Alembic migration, the section 19 route contract, the seed, Docker and CI files, and the API tests | Set the brief, reviewed the generated migration, and owns the merge |

Work merged before this file existed (for example the rules package and the frontend base) is not recorded here.
Its owners: please add your rows.
