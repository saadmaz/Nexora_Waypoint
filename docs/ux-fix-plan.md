# UX and cross-flow fix plan

A work order for an AI coding assistant. Every item below was found by driving the real API (migrated +
seeded database, `CLOCK_RATE=0`) through all 19 walkthrough steps and the branches the README names, then
reading the source. Nothing here is inferred from the mocks.

Read `Contributing.md` first (sections 2, 8, 9, 17, 18, 19, 24, 29) and `waypoint-prd-v3.md`. Several items
touch shared contracts (section 18): the API contract, `waypoint_rules`, `frontend/src/domain`. Each task
below says when it does, and that needs a note in the PR description.

## How to work

Work the tasks in the order given. P0 first: those are the ones a judge sees.

```bash
# backend
cd backend && uv venv && uv pip install -e ".[dev]"
ruff check . && mypy waypoint_rules && pytest && alembic heads   # one head

# frontend
cd frontend && npm ci
npm run lint && npm run typecheck && npm test && npm run build && npm run check:bundle

# whole system
docker compose up --build        # then http://localhost:8080
```

Rules for this plan:

- One commit per task, Conventional Commits, scope included: `fix(live): anchor the ETA on the actual departure`.
- **No AI attribution lines** in commits or the PR body (`Contributing.md` section 9). Add a line to
  `docs/ai-disclosure.md` instead.
- Stage by path, never `git add .`.
- Add the acceptance test named in each task. The backend suite needs PostgreSQL; point
  `TEST_DATABASE_URL` at a disposable database.
- Any change to a response shape means regenerating the client types in the same commit:
  `npx openapi-typescript http://localhost:8000/api/openapi.json -o frontend/src/api/schema.ts`.
- After each task, re-run the checks above before moving on.

---

## P0 — before the feature freeze

### 1. Fix the two wrong README claims

`README.md`, no code.

**1a. The Datathon paragraph.** The "Predictive Intelligence" section says the notebook "explores delivery
service-time prediction, late-arrival probability, future demand forecasting and peak-day fleet
allocation". `analytics/waypoint-task-2b.ipynb` has 12 cells, imports no ML library, and contains no
`predict` or train/test split. It covers trip minutes, what breaks a trip, and the planner's draft against
the hand-made plan. Rewrite the paragraph to describe that, using `analytics/README.md` as the source of
truth, and keep the existing honest sentence about the D9 outlook being a labelled baseline.

**1b. The mock/live explanation.** The "Seeded accounts" section says:

> a production build cannot serve mock data, because `roleApiMode` in `frontend/src/api/http/config.ts`
> returns `api` whenever the build is not a dev build.

That is not what the code does. `frontend/src/api/dataSource.ts`:

```ts
export const DATA_SOURCE: DataSource = import.meta.env.VITE_DATA_SOURCE === "live" ? "live" : "mock";
```

Mock is the default and dev-vs-production is never consulted. Live data works only because
`frontend/.env.production` is committed with `VITE_DATA_SOURCE=live`. Replace the sentence with that
mechanism, and:

- add `VITE_DATA_SOURCE` to the README's Configuration table (`live` | `mock`, default `mock`);
- add it to "Running the hosted demo" as a third required build variable beside `VITE_API_BASE`.

**1c. The e2e claim.** "Every step below is played in a real browser by `e2e/` on each push" is wrong on
both halves. 14 of the 19 `walkthrough.spec.ts` tests take only `{ request }` and never open a page (steps
4, 5, 7–13, 15, 17, 18), and CI runs on pushes to `develop` and `main` and PRs targeting them, not every
push. Reword to something true, e.g. "played by `e2e/` against `docker compose up` on every push to
`develop` and `main`; the store and dispatcher screens, and the driver's and loader's offline runs, are
driven in a real browser, the rest through the same API calls the screens make."

**1d. Two stale spec rows.** In the "Spec: PRD v3.1" table:

- the row claiming "The tablet caches salted hashes for every PIN person and the guest PIN" contradicts
  `frontend/src/screens/loader/apiLoaderApi.ts` line 47, which states the tablet caches no hashes and the
  guest PIN has no server counterpart. Mark the row as spec-not-yet-built, or move it to known gaps.
- "One check is still open" (A55, whether Priya is offered at both docks) is settled: `seed/accounts.py`
  gives each dock one person, and `GET /loader/docks/{dock}` returns Priya at Peliyagoda and Ruwan at
  Kandy only. Delete the paragraph or record the answer.

**Acceptance:** no claim in `README.md` contradicts the code. No test.

---

### 2. Settle the release time on 23:40

The README's step 6 says "Go to 23:35". Everything else uses 23:40: `e2e/walkthrough.spec.ts`,
`backend/app/jobs.py`, `frontend/src/domain/schedule.ts`, `ReceivedView.tsx`, `CapacityRoute.tsx`,
`DockContainer.tsx`, `mockDeliveries.ts`. Releasing at 23:35 makes the store's Orders screen say the plan
is not released while its Deliveries screen already shows the arrival time (see task 7).

Change `README.md` step 6 to `Go to 23:40`. Leave
`frontend/src/screens/dispatcher/chrome/PresenterControl.tsx`'s `{ time: "23:35", label: "Ready to release" }`
as it is — that step is "ready to release", which is correct; the release is the next action.

**Acceptance:** `grep -rn "23:35" README.md` returns nothing.

---

### 3. Anchor every live ETA on the actual departure

**This is the defect most likely to be seen.** `waypoint_rules/calc.planned_clock` anchors every arrival at
`trip.depart_at`, the *planned* departure, and nothing shifts it once the run starts. The plan has VEH039
leaving Kandy at 03:30 and reaching OUT084 at 04:07; the walkthrough has the driver start at 05:10. At
05:17 the dispatcher's live board reads `OUT087 · ETA 03:46` and `ETA 04:07 · window 05:30-08:00`, and the
store reads `Arrives about 04:07`.

Do **not** change `planned_clock`. It is correct for planning, it is pure, `mypy` is strict on the package,
and `tests/rules/test_golden.py` pins its output. Shift its input at the three read sites instead.

**3a. Dispatcher live board.** `backend/app/services/live_views.py`.

`_rules_trip` (line 41) builds the rules `Trip` from a `TripRow`. Add a run-aware variant and use it at all
three `planned_clock` call sites (lines 165, 210, 225):

```python
def _actual_trip(f: _Facts) -> Trip:
    """The trip as it is being driven: the planned legs, re-anchored on the real departure (A27)."""
    t = f.trip
    departed = f.run.departed_at if f.run is not None else None
    depart_at = max(t.depart_at, departed) if departed is not None else t.depart_at
    return Trip(t.vehicle_id, t.trip_no, depart_at, list(t.order_ids))
```

`_Facts` already carries `run`, so no plumbing is needed. Use `max(...)` so an early departure never
reports an ETA before the plan's — the plan is the commitment. Replace
`planned_clock(_rules_trip(f.trip), ...)` with `planned_clock(_actual_trip(f), ...)` in `_next_stop`,
`_risk` and `_live_stops`.

This also repairs `_risk`. `waypoint_rules.schedule.lateness_risk` documents itself as "predicted arrival =
last event + remaining planned legs (A27)", but `_risk` feeds it `st.arrival` straight off the planned
clock, so `At risk` can only fire for a plan that was *planned* late, which `R-WINDOW` refuses to create.
With the shift, a late departure makes remaining arrivals cross `window_close` and `At risk` starts
meaning something. Leave `lateness_risk` itself alone.

**3b. Store.** `backend/app/services/store_views.py`.

`Placement` (line 123) already carries `depart_at`, and `facts.runs` is keyed by
`(service_date, vehicle_id, trip_no)`. Add a helper beside `arrival_range`:

```python
def actual_arrival(placement: Placement, run: f.Run | None) -> datetime | None:
    """The planned arrival shifted by how late the truck actually left."""
    if placement.planned_arrival is None:
        return None
    departed = repo.naive(run.departed_at) if run is not None and run.departed_at is not None else None
    planned = repo.naive(placement.depart_at)
    if departed is None or planned is None or departed <= planned:
        return placement.planned_arrival
    return placement.planned_arrival + (departed - planned)
```

Use it at both sites that currently read `placement.planned_arrival` for a live time:

- line 439: `arrival = arrival_range(actual_arrival(placement, run), outlet)` — move the `run` lookup
  (currently line 427) above it;
- line 440: `predicted = hm(actual_arrival(placement, run))`, which feeds `on_the_way["arrivesAbout"]`.

Leave `order_out` (line 292) on `placement.planned_arrival`: that is the committed window the store was
promised, not a live ETA.

**3c. Driver.** `backend/app/services/driver_views.py` line 96 maps `planned_arrival` per stop onto the run
screen. Apply the same shift there, using the run the view already loads. If the run row is not reachable
at that point, leave it and note it in the PR — the driver can see the clock, so this is the least urgent
of the three.

**Acceptance:** add `backend/tests/api/test_live_views.py::test_a_late_departure_moves_every_remaining_eta`
— release the plan, confirm loaded, `driver.startRoute` 100 minutes after `departAt`, then assert
`GET /dispatcher/live` reports a next-stop ETA after the actual departure, that no `stopsDetail[].eta`
precedes it, and that `GET /store/deliveries` reports `onTheWay.arrivesAbout` after it too.

---

### 4. Stop calling a connected driver offline

`waypoint_rules/schedule.py` sets `OFFLINE_AFTER_MINUTES = 3`, and `frontend/src/field/offline/sync.ts`
only posts when the outbox has work ("every 30 s while anything waits") — there is no heartbeat. So
`last_heard_at` advances only when the driver does something, and a driver simply driving between stops
reads as `Unknown · offline` after three minutes. In my run the board said offline from 05:03, which also
flattens the step-12 beat where the phone is meant to drop off at 05:19.

Pick the cheap fix for today: raise `OFFLINE_AFTER_MINUTES` to `20`. Update the docstring, which currently
explains the 3-minute choice. Check `backend/tests/api/test_live_views.py` and
`test_dispatcher_live.py` for tests that assume 3 and adjust the scenario times, not the assertions.

The better fix, if there is time: have the driver app post an empty `/sync` batch on a timer so
`last_heard_at` tracks connectivity rather than activity. That is a new record type or an allowance for
`records: []` (currently `Field(min_length=1)`), so it is a contract change — do it after the deadline.

**Acceptance:** a test that a vehicle heard from 10 minutes ago is not offline and keeps a real risk label,
and one that at 25 minutes it is `Unknown · offline`.

---

### 5. Give a driver problem its own D6 item

A `driver.problem` record opens a `FieldException(kind=DRIVER_PROBLEM)` carrying the driver's
`vehicle_id`, and `live_views._exception_decision` (line 321) has no branch for it, so D6 renders every
exception as a held vehicle. Reporting a road problem from VEH039 produces:

- an inbox item titled `VEH039 held: road blocked`, with `0 min to departure` and the planned 03:30
  departure, for a driver already on the road;
- a single action, `Review → /dispatcher/exceptions/2`, which is the D8 swap screen and returns
  `VEH039 held: replace it before 03:30` with `replacement: null`, `recommendation: null`, `candidates: []`;
- `409 no_replacement` from its one button, and no way to acknowledge, so the item sits open forever.

This contradicts the README's own PRD v3.1 row: "Non-vehicle loader flags and driver problems reach D6, are
listed, and are marked seen when opened... Only 'Vehicle check failed' has a Dispatch screen (D8)."

**5a.** In `_exception_decision`, branch on `e.kind`. For `ExceptionKind.DRIVER_PROBLEM`:

- `kind="info"` and `info_only=True` — it is news, not a decision;
- title `f"{e.vehicle_id}: {e.type}"`, no "held";
- text from `e.detail` and `hm(e.device_time or e.raised_at)` — use the driver's own `device_time` when
  present, since `raised_at` is the sync time and reads as 07:31 for a problem recorded at 06:05;
- no `countdown` and no planned departure;
- no `action`, until there is a screen for it.

Keep the existing held/D8 shape only for `LOADER_SHORTFALL` with `e.type == "Vehicle check failed"`.

**5b.** In `backend/app/services/exceptions.py`, make `review()` refuse a non-swap exception the way it
already refuses one with no vehicle. It currently guards only `row.vehicle_id is None`:

```python
if row.kind is not ExceptionKind.LOADER_SHORTFALL or row.type != "Vehicle check failed":
    raise ApiError(409, "not_a_vehicle_flag", "This exception is not about a vehicle, so there is no swap to review.")
```

`ExceptionRow` carries `kind` as a string, so compare on that. Apply the same guard in `decide()`.

**Acceptance:** `backend/tests/api/test_dispatcher_exceptions.py` — a `driver.problem` sync produces an
inbox item with `kind == "info"`, no `countdown`, no `action`, a title without "held", and the driver's own
time; and `GET /dispatcher/exceptions/{id}` on it answers 409 `not_a_vehicle_flag`.

Contract note: `Decision.kind` stays `Literal["conflict", "held", "info"]`, so no schema change. Check
`frontend/src/screens/dispatcher/live` renders an `info_only` row without an action — the spare-vehicle row
already does.

---

### 6. Tell the store and the dispatcher about a loader shortfall

The loader loading 10 of 12 units reaches the driver (`loaderConfirmation.shortfalls`) and nobody else.
`sync._loader_check` writes a `plans.LoadCheck` row and stops; `sync._confirm_loaded` sends the store
"Your orders are loaded on VEH039 at Kandy dock" with the units unchanged at 12. The system knows at 04:40
that two crates are missing, 50 minutes before the window opens, and tells neither the dispatcher who
could re-plan nor the store rostering receivers for twelve.

**6a. Store.** In `sync._confirm_loaded` (line 613), read the trip's `LoadCheck` rows — the same query as
`driver_repo` lines 177-179 — into a `{order_id: short_by}` map and pass it to `store_notices.loaded`.
Extend that function to append a sentence per short order:

```python
def loaded(db, orders, vehicle_id, place, at, short=None):
    short = short or {}
    for outlet_id, rows in _by_outlet(orders).items():
        body = f"Your orders are loaded on {vehicle_id} at {place}."
        missing = [(o, short[o.id]) for o in rows if short.get(o.id)]
        if missing:
            body += " " + " ".join(
                f"{o.id} is short {n} of {o.units} units; Dispatch has been told." for o, n in missing
            )
        tell(db, outlet_id, NoticeTag.DELIVERY, "Loaded", body, ...)
```

Also surface it on the delivery row so the Deliveries screen can show it, not just the feed: add
`loaded_units: int | None` to `s.DeliveryOrderOut` and fill it in `store_views` from the `LoadCheck` rows
(a `facts.load_checks` map alongside `facts.gates`). That is a response-shape change — regenerate
`schema.ts` in the same commit, and render it in
`frontend/src/screens/store/deliveries/DeliveryCard.tsx` as a short line, not a scary banner. Store copy
rules apply (`Contributing.md` section 29): no em dashes, no bracketed placeholders.

**6b. Dispatcher.** Add a D6 info row for a shortfall. In `live_views.decision_entries`, after the
exception rows, emit one `Decision(kind="info", info_only=True)` per trip whose `LoadCheck` rows are short,
titled `f"{vehicle_id} loaded short"` with the order ids and units. `LiveDay` will need the checks: add
them in `live_repo` beside the runs.

**Acceptance:** `backend/tests/api/test_loader.py` — after a `loader.check` of 10 of 12 and a
`loader.confirmLoaded`, the store's `GET /store/updates` body names the shortfall, the delivery row reports
`loadedUnits: 10`, and `GET /dispatcher/live` carries an info decision naming the vehicle. Keep the
existing driver assertion.

---

### 7. Take the release time and the cutoff off the client clock

`frontend/src/domain/schedule.ts` hardcodes `RELEASE_HOUR = 23`, `RELEASE_MINUTE = 40`, `CUTOFF_HOUR = 16`,
and `isPlanReleased()` is a pure clock comparison. `screens/store/orders/ReceivedView.tsx` line 39 gates on
it, so the store's Orders screen decides the plan is released by wall-clock time rather than by the API.
Task 2 removes the visible symptom; this removes the cause. DP-27 discloses the mirror, so this closes a
known departure.

**7a.** In `ReceivedView.tsx`, replace `isPlanReleased(first.deliveryDate, now)` with the fact the API
already sends. `OrderOut.arrival` is set only from a **released** plan version
(`store_views.load_facts` filters `PlanVersion.state == RELEASED`), so:

```ts
const released = orders.some((o) => o.arrival != null);
```

Then at line 92 replace "Arrival time is shown after the plan is released at `23:40`" with wording that
names no time — "Arrival time is shown once Dispatch releases tonight's plan" — and at line 113 drop the
`<Mono>23:40</Mono>` meta from the "Arrival time shared" row, or fill it from `first.arrival.start` once
released. Update the docstring on `Order.arrival` in `frontend/src/domain/order.ts` line 54, which says
"only present once the plan is released (23:40 the day before)".

**7b.** The "Confirmed `16:00`" row in the same timeline is also hardcoded. The server already knows the
real cutoff (`planning_repo.cutoff_at`), so add it to the order-form payload: `cutoff_at: str` and
`editable_until: str | None` on `s.OrderDraftOut`, filled in `store_views.order_draft`. Render those
instead of the literals in `ReceivedView.tsx` and `OrdersPage.tsx`. Regenerate `schema.ts`.

**7c.** `frontend/src/screens/loader/dock/DockContainer.tsx` line 81 hardcodes
`emptyReleaseLabel="23:40"`. `DockOut` already carries `planReleasedAt`; use it when present and drop the
label when it is not.

**7d.** In `domain/schedule.ts`, mark `RELEASE_HOUR`, `RELEASE_MINUTE`, `releaseFor` and `isPlanReleased`
as mock-only in the docstring, and confirm nothing outside `api/mock*.ts` still imports them:

```bash
grep -rn "isPlanReleased\|releaseFor" frontend/src --include=*.ts --include=*.tsx | grep -v mock | grep -v '\.test\.'
```

Leave the cutoff helpers: `isAfterCutoff` and `operatingDayFor` are still used for the live countdown and
the order-form default, and the server recomputes the day in `place()` anyway. Note them for task 14.

**Contract note:** 7b changes `OrderDraftOut` (section 18, API contract) and 7a touches
`frontend/src/domain` (section 18, shared frontend types). Say so in the PR.

**Acceptance:** extend `frontend/src/screens/store/orders/*.test.tsx` — an order with `arrival` set shows
the arrival row done and no "released at 23:40" line; an order without it shows the pending row and no
hardcoded time. Then re-run `e2e/walkthrough.spec.ts` step 6 with a release at 23:35 and confirm the store
agrees with itself.

---

### 8. Recompute kg and m³ on the server

`store_writes.place` stores `weight_kg=line.line.estimated_kg` and `volume_m3=line.line.estimated_m3`
straight from the request; `edit` (line 140) does the same. The API publishes the conversion factors in
`GET /store/order-form` and then trusts the client's multiplication. I placed 500 chilled units declaring
0.1 kg and 0.001 m³: accepted, and the dispatcher's queue shows it as 0.1 kg, so `R-KG` and `R-M3` would
pack it onto any vehicle. `Contributing.md` section 19 says the frontend never re-implements a rule; the
unit conversion is one.

There is a second-order problem: the factors are derived from the outlet's last order
(`store_views.order_draft`, `last.weight_kg / last.units`), so one bad order poisons the factor for the
next.

Extract the factor logic from `order_draft` into a reusable function and use it on write:

```python
def unit_factors(db: Session, outlet: reference.Outlet) -> dict[Temp, s.UnitFactor]:
    """The kg and m³ one unit means for this outlet (PRD A14, A42). The authority for every order's weight."""
```

Call it from `order_draft` (unchanged output) and from `place` and `edit`:

```python
factors = views.unit_factors(db, outlet)
f = factors[line.line.kind]
weight_kg = round(line.line.units * f.kg, 3)
volume_m3 = round(line.line.units * f.m3, 3)
```

Keep `estimated_kg` and `estimated_m3` in the request schema so no client breaks, but ignore them for
storage. Document that in the field docstrings, since the OpenAPI schema is the contract. If the client's
figure differs from the server's by more than a rounding margin, log it at `info` — do not refuse, the
client may hold a stale factor.

**Acceptance:** `backend/tests/api/test_store_field.py::test_the_server_sets_the_weight_not_the_client` —
POST 12 chilled units with `estimatedKg: 0.1` and assert the stored order and the dispatcher's queue both
report `12 * factor`, and that `PATCH` behaves the same.

**Contract note:** behaviour change on a shared contract (section 18, API contract). Mention it.

---

### 9. Two one-line cleanups

**9a.** `frontend/src/screens/loader/dock/DockContainer.tsx` line 110:

```ts
} else if (ack.version >= 4 && !diffMatters) {
```

A plan-version threshold from this one scenario decides production copy. The condition it is reaching for
is "acknowledged, and nothing at this dock changed", which `!diffMatters` already says. Drop
`ack.version >= 4` and check `frontend/src/screens/loader/**/*.test.*` and `gallery/frames.tsx` for
anything that depended on the old split.

**9b.** `git rm e2e/probe-driver-run.png` — a 51 KB debug screenshot. `e2e/camera.png` is a real fixture;
keep it. Confirm nothing references the removed file.

---

## P1 — after the freeze, before the final merge if there is room

### 10. Keep the store's journey timeline from rewinding past facts

`store_views` lines 423 and 428 gate the Loaded and Departed steps on the order's *current* status:

```python
if placement and any(shown[o.id] in LOADED_OR_LATER for o in orders):   # line 423
if run and run.departed_at and any(shown[o.id] in DEPARTED_OR_LATER for o in orders):   # line 428
```

After the 05:21 deferral the status becomes `deferred`, which is in neither set, so `Loaded 04:50` and
`Departed 05:10` both drop and the store reads "Planned" while the goods are on a truck that has left.

A confirmed load gate and a run's `departed_at` are past facts. Gate them on the record existing, not on
the current status: keep the `placement` / `run and run.departed_at` conditions and drop the
`any(shown[...])` clauses. Leave `Delivered` as it is — a delivery that went to conflict and was resolved
the other way genuinely did not happen.

**Acceptance:** `backend/tests/api/test_store_field.py` — after a confirmed load, a departure and then a
`store_request` deferral, the journey still reports `Loaded` and `Departed` with their times, and
`Delivered` stays pending.

### 11. One confirmation notice per outlet, not per order

`backend/app/jobs._close_queue` adds a `Notice` inside the per-order loop, so placing two orders gives one
grouped "Order received" and then two separate "Your order is confirmed" — three unread for one action.

Group by outlet before writing, and reuse the phrasing `store_writes.place` already builds
("ORD2001 (chilled, 12 units) and ORD2002 (dry, 8 units)"). Lift that into
`store_notices` as a helper so both callers share it.

**Acceptance:** `backend/tests/api/test_store_field.py` — two orders placed together produce exactly one
`Order` notice at the cutoff, naming both.

### 12. Say which day an edit deadline falls on

`store_writes.place` line 122:

```python
editable = f" You can edit until {closes:%H:%M}." if now.replace(tzinfo=None) < closes else ""
```

The logic is right — an order placed Monday 16:20 for Wed 30 Sep really is editable until Tue 16:00 — but a
bare "16:00" read at 16:20 on Monday looks like it has passed. Add the day when
`closes.date() != now.date()`: "You can edit until Tue 16:00." Use `dispatcher_views.day_label` for
consistency. Check the same wording in `frontend/src/screens/store/orders/ReceivedView.tsx` (task 7b
already touches it).

### 13. Stop telling the dispatcher that a rolled order will roll again

`backend/app/services/queue_views.py` lines 99-101:

```python
if r.after_cutoff:
    tags.append("After cutoff")
    note = f"Moves to the following run ({day_label(day.following_run)})"
```

`store_writes.place` has already rolled the order to the next operating day and stamped
`after_cutoff=True`, so the Wed queue row for a Wed order says "Moves to the following run (Thu 1 Oct)"
while the store was told "count for Wed 30 Sep". It never moves again.

Keep the `After cutoff` tag — it correctly means "this order missed the previous day's cutoff" — and change
the note to say what happened, not what will: "Placed after the 16:00 cutoff, so it counts for this run."
Only keep the forward-looking wording for an order whose `service_date` is still the queue's current
service date and whose cutoff has passed, if that state is reachable at all.

**Acceptance:** `backend/tests/api/test_queue_views.py` — an order placed after the cutoff shows the
`After cutoff` tag and a note that names the queue's own service date, not the day after.

### 14. Serve the raw dock enum as a label

`store_views.order_out` line 297 sends `dock=outlet.dock_type.value` (`"rear_dock"`), while
`order_draft` (line 334) and `delivery_out` (line 491) both send `dock_label(outlet.dock_type)`
(`"Rear dock"`). Change line 297 to `dock_label(outlet.dock_type)` and check no frontend code maps the raw
value: `grep -rn '"rear_dock"\|rear_dock' frontend/src`.

---

## P2 — after the deadline

Open an issue per item; none is demo-visible.

### 15. A notifications feed for the dispatcher

The store reads `/store/updates`, the driver reads `/driver/notices`, the loader reads the dock view. The
dispatcher reads nothing. Four code paths write `notices` rows with `audience_kind = 'dispatcher'` and no
endpoint selects them:

| Writer | Notice |
| --- | --- |
| `store_writes.report_issue` line 298 | `"{outlet}: {type} reported"` |
| `sync._problem` line 525 | `"{vehicle}: {type}"` |
| `sync._loader_exception` line 652 | `"{vehicle}: {type}"` |
| `sync._outcome` line 445 | `"{outlet}: delivery and deferral disagree"` |

Add `GET /dispatcher/notices` modelled on `field_views` lines 115+ and `driver_repo` line 210, plus a
read-all route, and a bell in the dispatcher chrome. Then D6 can stay a decision queue rather than being
the only inbound channel.

### 16. A store-reported problem must reach Dispatch

`live_views.decision_entries` filters exceptions to those with a vehicle:

```python
open_exc = [e for e in live.exceptions
            if e.status is ExceptionStatus.OPEN and e.vehicle_id
            and any(t.vehicle_id == e.vehicle_id for t in day.trips)]
```

`ExceptionKind.STORE_ISSUE` is created with `vehicle_id=None` (`store_writes.report_issue` line 283), so a
store reporting Damaged goods is dropped. Its only consumer anywhere is `store_views` line 211 — the
store's own list. Add a separate pass for store issues keyed on the outlet's depot, as an info decision
until there is a screen, and acknowledge the report back to the store, which currently gets no
confirmation at all. Task 15 covers the notice half.

### 17. `seen_at` and `parent_id` on `exceptions`

The README's PRD v3.1 table promises that non-vehicle flags and driver problems "are marked seen when
opened", and that "R6 problems are threads: `driver.problem` gains `updatesClientId`; `exceptions` gains
`parent_id` and `seen_at`". Neither column exists in `app/models/field.FieldException` or in any migration
(only `deferrals.notice_seen_at` does). Add migration `0005` with both columns, a `POST
/dispatcher/exceptions/{id}/seen` route, and thread rendering for R6. One migration per PR, `alembic heads`
must print one head, and set `down_revision` to the head that came from `develop`.

### 18. Notices for an order edit and a cancellation

`store_writes.edit` and `cancel` write audit rows and no notice. The store's own feed therefore has no
record of either, while placing an order does — and the README's step 17 says "the updates feed tells the
whole story". Add an `Order` notice to both, grouped like task 11. Consider whether the dispatcher queue
should show a "changed since you looked" marker for an order edited before the cutoff.

### 19. A heartbeat for `last_heard_at`

The real fix behind task 4. `/sync` currently requires `records: Field(min_length=1)`. Either allow an
empty batch as a ping or add a `driver.ping` record type, and have `startSyncEngine` post one every few
minutes while a run is in progress. Then `last_heard_at` tracks connectivity rather than activity, and the
3-minute threshold becomes defensible again.

### 20. Browser coverage for D6 to D9

No spec opens the dispatcher's live board, reconciliation, exception or forecast screens in a browser.
`a11y.spec.ts` covers D1 to D4; `walkthrough.spec.ts` drives D6, D7 and D8 through the API only. Those are
the screens a judge spends the most time in, and task 5 changes what D6 renders. Add them to
`a11y.spec.ts`'s `PLAN_SCREENS`, and convert walkthrough steps 8, 13 and 15 to drive the screens.

### 21. Offline PIN checks and the guest PIN

`apiLoaderApi.ts` line 47: "a guest PIN has no server counterpart, so a person who is not a numeric server
id cannot be verified in api mode", and the tablet caches no PIN hashes. So "Other…" with PIN `0000` works
only on the mocks, and a loader cannot pass a load gate offline — `loader-offline.spec.ts` encodes the
limitation. Deliver the PRD v3.1 row: salted hashes on the dock payload, a guest path on
`POST /loader/pins/verify` that takes a typed name, and the name stored as the actor. Task 1d documents it
in the meantime.

### 22. Make D9 show something

`GET /dispatcher/forecast?depot=peliyagoda` returns all four weeks at 62% and `OK`, with no flags, on the
PRD 4c fallback set, so a judge sees four identical rows and `Tight` and `Short` never appear. The screen's
"Baseline forecast: Datathon Task 2A model not wired in" label matches the PRD, so this is a seed-data
question, not a code one: give the fallback calendar a payday and a festival ramp so the scaling has
something to bite on, or document that D9 needs the competition CSVs.

### 23. Times that assume one calendar day

Two places break for a trip crossing midnight. `store_views.arrival_range` compares arrival and window-open
as `"HH:MM"` strings (`arrives < opens`), and `calc.planned_clock._on_day` places every outlet's window on
the departure's calendar day. Nothing in this scenario departs late enough to hit either. Compare datetimes
and carry the date through the clock. `planned_clock` is pinned by `tests/rules/test_golden.py`, so pin the
new behaviour there too.

---

## Not a defect, do not "fix"

- **"Truck may arrive 04:07 and wait"** on a 05:30 window is correct. The plan legitimately has VEH039
  idle 83 minutes, `planned_clock` models the wait, and the release notice says so well. Task 3 fixes the
  number going stale once the run diverges from the plan; it must not remove the early-arrival wording.
- **`decide` with `deferOrderIds: []` deferring the recommended orders** is deliberate and documented:
  "the rules' recommendation when empty". The replacement van cannot carry the truck's load, so something
  must give. If the ambiguity bothers you, make the empty list explicit in the schema docstring rather
  than changing the behaviour.
- **The wire status `conflict`** reaching `/store/deliveries` is correct. What matters is the label, and
  the store never reads the word anywhere in its screens or its feed. `walkthrough.spec.ts` step 14 pins
  this; keep it.
- **The server rolling an order's delivery date in `place()`** regardless of the client's
  `deliveryDate` is the cutoff rule working (R-CUTOFF). Task 13 fixes the dispatcher's note about it, not
  the roll.
