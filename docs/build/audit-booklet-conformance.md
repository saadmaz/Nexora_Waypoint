# Audit: booklet conformance and the "nothing actually works" report

Audited 2026-10-04 against the Challenge Booklet, reading code only. README, CLAUDE.md and the PRD
were deliberately ignored as evidence; they describe intent, not behaviour.

## Verdict

**Corrected after testing.** The first version of this audit said the shipped app ran on fixtures and
that two packaging blockers explained it. Both claims were wrong, and the real causes are narrower.

What was actually wrong:

1. **A 15 s client timeout.** Drafting runs the planner over the whole fleet and takes 11 s to 19 s on
   a full day, so `POST /plan/redraft` was aborted mid-flight and the screen said "No connection"
   while the server was answering and the draft was being saved. This is the one that made the app
   look inert. Fixed by giving the four planner routes their own 120 s budget.
2. **A latent uniqueness bug** in the deferral carry-over (see finding 3), which turned the 16:00
   cutoff job into a 500 as soon as the planner had enough orders to defer two from one outlet.
3. **Scenario clock drift**, which is behaviour rather than a bug, but reads as a failure: the field
   apps follow `runDate`, which rolls to the next operating day at 12:00, so a plan released for
   Tuesday stops being visible once scenario time passes Tuesday noon. The clock refuses to go
   backwards, so only Reset demo recovers, and that clears the plan.

What was **not** wrong, contrary to the first draft:

* **The Docker build was already live.** `frontend/.env.production` carries `VITE_DATA_SOURCE=live`
  and is already on `develop`; `vite build` reads it, so the web image was never serving mocks.
  `npm run check:bundle` passes on a plain `npm run build`. An earlier check here was a
  case-insensitive grep that matched the identifier `createMockDispatcherApi` and was read as fixture
  data; no fixture payload or persona name is in the bundle. The `ARG VITE_DATA_SOURCE` added to the
  Dockerfile was redundant and has been reverted.
* **`SEED_ON_START` was already `true`**, so the seed does run.
* **`SEED_GENERATED_ORDERS=false` is correct, not a bug.** `README.md` already documents that `true`
  makes "the walkthrough's named moves differ". Defaulting it on, as the first draft of this work did,
  broke three e2e tests and would have broken the judge walkthrough itself, which names ORD1007,
  VEH037 trip 2, ORD1020 and ORD1017. It has been reverted to `false`, and the e2e job pins it off
  explicitly so the suite does not inherit whatever Compose defaults to.

The remaining substance of the original audit stands: the rules, the planner, the offline outbox and
the order lifecycle are all implemented and tested, and the mock `redraftPlan` really does only clear
accepted moves and re-read a fixture, so in mock mode no allocation happens. That matters for anyone
running with `VITE_DATA_SOURCE=mock`, but it was not what the Compose stack was doing.

## What is genuinely implemented (verified in code and tests)

The booklet's requirements are met on the backend. This is not stub code.

| Booklet requirement | Where | Status |
|---|---|---|
| Capture and confirm the order before cutoff | `services/store_writes.py:place` | Real. Server-side service-day resolution, one-order-per-kind guard, `already_ordered` 409, server-computed kg/m³ from outlet factors |
| Bring confirmed orders into one queue | `routers/dispatcher.py:121 getQueue` | Real |
| Assign orders to vehicles and trips, identify deferrals | `waypoint_rules/planner.py` (530 lines), `services/planning.py:289 draft` | Real allocation engine |
| Weight **and** volume limits | `waypoint_rules/constraints.py` (`trip_load`) | Enforced |
| Reefer-only for chilled/frozen | `constraints.py:43` | Enforced |
| `van_only` outlets | `constraints.py:45` | Enforced |
| Delivery and mall windows | `constraints.py:121-127` | Enforced, mall window distinguished from outlet window |
| Weekly fuel quota | `constraints.py:181` | Enforced across the week, not per trip |
| Max two trips per vehicle per day | `constraints.py:168 check_vehicle_day` | Enforced |
| Deferral with a recorded reason | `waypoint_rules/deferrals.py`, `DeferReasonDialog` | Real, typed `capacity` vs `policy` |
| Load for the planned stop sequence, flag shortfalls | `routers/loader.py`, `LoaderApi.flagException` | Real |
| Record stops offline, reconcile on reconnect | `field/offline/` outbox, `routers/sync.py`, `waypoint_rules/reconcile.py` | Real, idempotent by `clientId` |
| Confirm receipt and report issues | `routers/store.py` `/receipts`, `/issues` | Real |
| Demand forecasting | `services/forecast.py`, `routers/dispatcher.py:250` | Present |

Evidence the planner really allocates: `pytest tests/rules -q` passes and prints a genuine
multi-trip, multi-vehicle plan with typed deferrals:

```
VEH003 trip 1  dep 03:30  132 min  stops ['ORD1014','ORD1016','ORD1011','ORD1002','ORD1001']
VEH003 trip 2  dep 06:09  109 min  stops ['ORD1013','ORD1015','ORD1018','ORD1012']
VEH035 trip 1  dep 03:30  125 min  stops ['ORD1023','ORD1024','ORD1022','ORD1021']
Deferred (planner): [('ORD1017','policy','reefer_minutes'), ('ORD1020','capacity','van_access')]
```

Those deferral reasons are derived from the constraints, not written by hand.

## What is actually missing

Sections 1 and 2 of the first draft (a mock build, a seed too small to plan) were withdrawn; see the
corrected verdict above.

### 3. The first draft waits for a timed job

`_require_open_draft` says "There is no plan yet. The first draft appears at 16:05." Drafting is
otherwise driven by the 16:05 job in `app/jobs.py`. `feature/dispatch-driver-fix` (unmerged) adds an
on-demand **Draft plan** button to the queue, which is the right fix; `POST /plan/redraft` already
exists on `develop` and is reachable. Worth merging for exactly this reason.

### 4. Deferral carry-over copies could collide (500 on the cutoff job)

Found while testing fix 2, and fixed here. `services/planning.py:sync_rerun_copies` writes a next-run
copy `ORD####-R` for every deferred order, with `placed_by="system"`. The partial unique index
`uq_orders_live_outlet_day_temp` exempts rows whose `placed_by` is `'seed'`, so seeded orders may
legitimately double up on one (outlet, day, temp) key, but a `system` copy may not. Two deferrals from
the same outlet and temperature therefore violated the index and the whole 16:00 cutoff job returned
500, leaving the queue stuck open.

This was pre-existing and latent: it only fires when the planner has enough orders to defer two from
one outlet, which fix 2 is what made possible. The fix skips a copy whose (outlet, next run, temp) key
is already taken. The order stays deferred and still shows in the deferred pool, so nothing is lost.

## Secondary findings

- **`tests/api` cannot run on the default database URL.** They error at setup against
  `localhost:5432`; they need `TEST_DATABASE_URL` on port 55433 (PostgreSQL 18.6). Port 5432 here is
  an older server. Nothing is wrong with the tests, but CI and contributor setup should pin this.
- **The suite is not self-cleaning between aborted runs.** A first pass reported three failures
  (`test_an_order_placed_after_the_cutoff_waits_for_the_following_run`,
  `test_the_planner_plans_another_day_legally[2026-10-10]`, `test_migrated_database_matches_metadata`).
  All three were residue from an earlier interrupted run. The first failed on
  `duplicate key ... (OUT001, 2026-09-30, chilled)` for a fixture order `ORD9001` left behind. After
  `DROP DATABASE` / `CREATE DATABASE` all 30 tests in those files pass. No product defect, but it
  means an interrupted run poisons later ones and can look like broken code.
- **Store order placement assumes a draft form.** `GET /order-form` returns a prefilled draft. Worth
  confirming a store manager can enter quantities from scratch for an arbitrary outlet, which is what
  a judge will try.
- **Loader needs a vehicle list.** `routers/loader.py` is five GETs; the load plan is fetched by
  `vehicleId` + `trip`, with no endpoint listing a dock's vehicles for the day. A loader at a dock
  cannot discover what to load without knowing a vehicle ID in advance.
- **Driver dead-ends when the current day has no run.** `GET /runs/{day}` is per-date; `GET /driver/history`
  exists and could back a day picker.

## Verified after the fixes

With `SEED_GENERATED_ORDERS=true` (the full-size day, opt-in), driving the real API: 212 orders queued
at Peliyagoda; plan v1 drafted with 23 lanes, 29 trips, 134 stops and 17 deferrals whose reasons come
from the constraints (ORD1020 "Van-only access: van_only and 1,250 kg"); released; the loader dock then
showed 29 vehicles and the driver run VEH039 with 12 stops. Before the carry-over fix the 16:00 job
returned 500 on that day. Through nginx, `POST /plan/redraft` took 11.3 s, 14.9 s and 18.8 s, which is
why the 15 s client timeout failed it intermittently.

On the default pinned day the Playwright walkthrough passes (19 of 19 locally).

## Bottom line

The rules, the planner, the offline outbox and the order lifecycle were built and correct. What made
the app look inert was a client timeout shorter than a full-day draft, plus a uniqueness bug that only
a large day exposes, plus a scenario clock that rolls the field apps onto the next day at noon.

On `fix/live-build-and-seed`:

1. `services/planning.py`: no colliding deferral carry-over copy.
2. `api/http`: a per-request `timeoutMs`, 120 s for the four planner routes.
3. The dispatcher's queue gets a Draft plan button when the cutoff has closed and no plan exists.
4. The e2e job pins `SEED_GENERATED_ORDERS=false` explicitly.

`docker-compose.yml` and `deploy/web/Dockerfile` are unchanged from `develop`.

### Still open

- The real competition CSVs are not in `data/`; with them, `seed/checks.py` validates the reference data.
- `deliveries_train.csv` order sampling is not written (`seed/generated.py` says so), so the CSV path
  does not yet produce a full-size day of orders.
