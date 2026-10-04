# Audit: booklet conformance and the "nothing actually works" report

Audited 2026-10-04 against the Challenge Booklet, reading code only. README, CLAUDE.md and the PRD
were deliberately ignored as evidence; they describe intent, not behaviour.

## Verdict

The functionality is **built and correct**. It is **not reachable** in the app as it is built and run.

One line decides it, `frontend/src/api/dataSource.ts:17`:

```ts
export const DATA_SOURCE: DataSource = import.meta.env.VITE_DATA_SOURCE === "live" ? "live" : "mock";
```

Mock is the fallback. `docker-compose.yml` passes **no build args** to the `web` service, and
`deploy/web/Dockerfile` runs a bare `npm run build`, so `VITE_DATA_SOURCE` is unset in the image.
There is no `frontend/.env.local` either. Every role therefore runs on in-browser fixtures, and the
backend, the part that implements the booklet, is never contacted by the UI.

This explains the reported symptom precisely. In mock mode the only thing with real behaviour is the
scenario clock, so advancing time appears to "move the scenes" while ordering and planning do nothing.

### Why drafting a plan appears to do nothing

`frontend/src/screens/dispatcher/mock/mockDispatcherApi.ts:105`:

```ts
redraftPlan() {
  return write(() => {
    world.moves = [];
    return planView(world, m(), "peliyagoda");
  });
}
```

No allocation runs. It clears accepted moves and re-reads a hardcoded fixture. `mock/plan.ts` serves
`TRIPS_V3` / `TRIPS_V4` from `fixtures.ts` and, in its own words, scripts the refusals "the design
draws (D3.3 to D3.6)". So a judge clicking Draft plan sees a pre-written plan appear, identical every
time, with canned refusal text. Nothing is allocated and no constraint is evaluated.

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

Three real gaps, in priority order.

### 1. The shipped build runs on mocks (blocker)

Fix: pass `VITE_DATA_SOURCE=live` as a build arg in `docker-compose.yml` and declare it as an `ARG`
before `npm run build` in `deploy/web/Dockerfile`. Confirm with `npm run check:bundle`, which exists
to assert the mocks are absent from a live bundle.

Until this is done, nothing else in this audit is observable, and a judge following the README sees a
scripted demo.

### 2. The seeded day was too small to plan (blocker, booklet-explicit)

**Correction to the first draft of this audit:** `SEED_ON_START` *is* already `true` in
`docker-compose.yml`. The seed does run. The real problem was the line next to it:
`SEED_GENERATED_ORDERS: ${SEED_GENERATED_ORDERS:-false}`.

Without the competition CSVs (git-ignored, absent from a fresh clone) the seed uses the PRD section 4c
fallback, which is only **6 vehicles, 25 outlets and 24 pinned orders**. `seed/generated.py` exists to
fill the day out to a realistic size, but it was off by default. So the planner had almost nothing to
allocate and nothing to defer, which is why no efficient plan ever appeared.

With `SEED_GENERATED_ORDERS=true`, a fresh `docker compose up` seeds **60 vehicles, 84 outlets and 274
orders** (24 pinned + 250 generated), which is what the booklet means by "at least one realistic
delivery day". With the CSVs present they supply the reference data and this flag does nothing.

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

On a clean `docker compose down -v && docker compose up --build`, with no CSVs in `data/`:

```
seed: reference: fallback (PRD 4c) + generated: 54 vehicles, 59 outlets
seed: pinned: 24 orders      seed: generated_orders: peliyagoda 189, kandy 61
```

Then, driving only the real API as the dispatcher, loader and driver personas:

| Step | Result |
|---|---|
| `GET /dispatcher/queue` before cutoff | 212 Peliyagoda, 62 Kandy, `closed=false` |
| `POST /demo/advance` to 16:30 | cutoff job ran clean (was a 500 before fix 4) |
| `GET /dispatcher/queue` after | `closed=true`, 212 confirmed |
| `GET /dispatcher/plan` | **plan v1 drafted: 23 lanes, 29 trips, 134 stops, 17 deferred** |
| `GET /dispatcher/deferrals` | "17 orders wait for Wed 30 Sep": 1 capacity, 16 policy |
| a deferral's reason | `ORD1020` - "Van-only access: van_only and 1,250 kg" |
| `POST /dispatcher/plan/release` | plan v1 released at Mon 16:31 |
| `GET /loader/docks/peliyagoda` | planVersion 1, **29 vehicles to load** |
| `GET /driver/runs/2026-09-29` | **VEH039, 12 stops**, planVersion 1 |

The deferral reasons are derived from the constraints, not written by hand, which is the booklet's
"decide which orders move to the next run and record the reason".

Also confirmed both directions on the bundle: a default build still contains mock personas, and the
live build does not (`npm run check:bundle`: "none of 14 forbidden literals are in dist/"). The
running `web` container serves the live bundle.

Note `GET /loader/docks/{dock}` already returns a `vehicles` list, so the extra loader endpoint
proposed in earlier planning is not needed.

## Bottom line

This was a packaging and seeding failure, not a functionality failure. The allocation engine, the
constraint rules, the offline outbox and the order lifecycle were all implemented and tested; they sat
behind a build that never switched them on and a seeded day too small to plan.

Four changes, on `fix/live-build-and-seed`:

1. `deploy/web/Dockerfile`: `ARG VITE_DATA_SOURCE=live` before `npm run build`.
2. `docker-compose.yml`: pass that build arg, overridable with `VITE_DATA_SOURCE=mock`.
3. `docker-compose.yml`: `SEED_GENERATED_ORDERS` defaults to `true`.
4. `services/planning.py`: no colliding deferral carry-over copy.

Plus the on-demand **Draft plan** button on the dispatcher's queue (`QueueRoute.tsx`), so the first
plan does not wait for the 16:05 job. That matches what `feature/dispatch-driver-fix` does; this
branch carries its own copy because that branch is 21 commits behind `develop`.

### Still open

- **The real CSVs are not in `data/`.** The generated fallback is a stand-in: "six story vehicles"
  copied out to 60, and outlets invented around the pinned ones. For the submission the competition
  CSVs should be dropped into `data/` so the 120 outlets and 60 vehicles are the real ones, and
  `seed/checks.py` can validate them. The fallback is what makes a fresh clone work, not what the
  judges should see if the CSVs are available.
- **`SEED_GENERATED_ORDERS` only applies on the fallback path.** With CSVs present, order volume comes
  from the CSVs; `generated.py` notes the `deliveries_train.csv` sampler is not written because the
  column names are not in the repo. Worth confirming the CSV path produces a full day before Sunday.
- The store, loader and driver manual entry points discussed separately are still worth doing, but
  they were never the reason the system looked inert.
