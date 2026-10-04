<!-- Build log moved out of README.md so the README reads as the deliverable. -->

# 🧭 Dispatcher (Waypoint Dispatch)

Branch: `feature/dispatcher`. Screens D1 to D9 and the whole `/api/v1/dispatcher` surface behind them.

## What is real

All 20 dispatcher routes answer from the database. Nothing a dispatcher sees in `api` mode comes from a fixture.

- **The planner** (`backend/waypoint_rules/planner.py`) is a pure, deterministic function: the same orders give the same plan. It tries four orderings per depot and keeps the one with the fewest continuity warnings, then deferrals, then trips. Every trip it builds passes `check_trip` and `check_vehicle_day`.
- **Plan versions.** v1 is drafted by the system 5 minutes after the cutoff, v2 (21:15) and v3 (23:30) by the scripted events, and Release makes the latest draft live in place. Later changes (the reefer swap, a deferred stop) release the next number.
- **The scenario clock drives the day.** `app/jobs.py` runs inside `POST /demo/advance`, in the same transaction: cutoff (Ordered to Confirmed, notices to stores), the draft, the scripted events in `backend/seed/scenario_events.yaml`.
- **Every move is checked by the rules package.** `validate-move` returns the refusal text from `waypoint_rules`; the screens show it and never re-derive it.
- **Every state change writes an `audit_events` row** in the same transaction.
- **The day.** With no `data/*.csv` the seed generates the rest of the day (`backend/seed/generated.py`, A41): 60 vehicles, Peliyagoda 212 orders and Kandy 62 for Tue 29 Sep, the same on every run. That full-size day is opt-in (`SEED_GENERATED_ORDERS=true`); the default is the small story world the walkthrough and the API tests use, because the walkthrough names pinned orders and vehicles that the planner places differently once 274 more orders compete for the same trips (DP-29).

## Run it

```bash
docker compose up -d --build db api
cd frontend
VITE_AUTH_API=api VITE_DISPATCHER_API=api npm run dev      # http://localhost:5173
```

Sign in as `dispatcher@waypoint.demo` (password in the API mode section). The presenter control advances the server clock and resets the demo in seconds.

## The dispatcher's part of the judge walkthrough

| Clock | What to do | What you see |
|---|---|---|
| Mon 15:30 | Open Queue (D1). The store places ORD2001 and ORD2002 | Both under OUT084 in the Kandy queue, status Ordered |
| Mon 16:00 | Advance the clock past the cutoff | Orders turn Confirmed; the queue locks; stores get their notices |
| Mon 16:05 | Open Trips (D3) | Plan v1, drafted by the system, with its deferrals and the capacity bars (D2) |
| | Drag a stop to a vehicle that breaks a rule (window 08:06, reefer plus two brands, continuity) | A refusal naming the rule; nothing changes |
| Mon 21:15 and 23:30 | Advance | Drafts v2 and v3 appear |
| Mon 23:45 | Release (D5) | "Plan v3 is live"; deferrals can be sent to the stores; acknowledgements fill in |
| Tue 02:55 | Loader flags VEH003 (D8) | Review the exception: swap to VEH036 releases plan v4 and defers ORD1002 |
| Tue 05:17 | Live board (D6) | The driver is shown offline after 3 quiet minutes; Defer stop releases the next version |
| Tue 06:40 | Inbox and Conflicts (D7) | The conflict from the driver's sync; Keep delivery withdraws the deferral and closes it |
| Any time | Forecast (D9) | A baseline outlook for the next four weeks, labelled as such |

Steps 3 to 6 and 13 to 16 of PRD §16 are the dispatcher's. Rows that need a loader, driver or store action depend on those roles' backend routes (see the table below).

## Departures from the PRD and the design

- **Peliyagoda defers 17 on the generated day, not 19.** The count moves in steps of two to four as one more chilled order appears, so 19 is not reachable by tuning the chilled share alone. The screens show the computed number (DP-01).
- **The refused moves are found on the generated day, not fixed in the PRD.** On the generated day VEH003 has no trip 2, so the PRD's example move (ORD1009 to VEH003 trip 2) is answered `no_such_trip`. `tests/api/test_seed_generated.py::test_the_walkthrough_has_a_refused_move_of_each_kind_on_the_generated_day` searches the v1 plan in a fixed order for the first move of each kind (a window, a reefer plus a second rule, the continuity guard) and prints them. Run it with `pytest -s` to get the order and trip to drag.
- **D9 lists all four weeks.** A week under 90% shows as OK instead of being left out, so the screen always has four rows to compare.
- **A Fresh first trip leaves just in time.** It leaves at `max(03:30, first window opens - outbound - 4 min)`, so VEH039 leaves at 05:10 for OUT084 when that is its first stop (A5). A trip whose first stop opens earlier, such as OUT087 at 03:00, still leaves at 03:30.
- **Stop order inside a trip** is: window open, window close, outlet id, with orders for one outlet adjacent. Load order is the reverse of stop order.
- **D9 is a baseline, not the Datathon model.** Demand is today's own chilled Fresh queue scaled by the calendar (payday +6%, a festival ramp its own factor); the screen says so in its label. The PRD builds it from `deliveries_train.csv`, which is not in the repository.
- **Generated order sizes are invented** (A41). Sampling them from `deliveries_train.csv` needs its column names, which the data owner has to supply.
- **The presenter control's step times** are the hero script's, not the planner's own; the planner releases v3 at its own pace.

## Shared files this branch touches

`backend/app/routers/dispatcher.py` (all of it), `backend/app/schemas/dispatcher.py`, `backend/app/jobs.py`, `backend/app/clock.py` (calls the jobs), `backend/app/config.py` (`seed_generated_orders`), `backend/seed/` (`run.py`, `generated.py`, `accounts.py`, `scenario_events.yaml`, `fixtures/vehicle_day.yaml`) and `backend/waypoint_rules` (`planner.py`, `schedule.py`, `reconcile.py`, `messages.py`). These are shared contracts (Contributing §18): the backend-foundation owner needs to approve them.

## Checks

```bash
cd backend && ruff check . && mypy && pytest && alembic heads
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
```

No migration was added. The database-backed API tests need PostgreSQL (`docker compose up -d db`).

---
