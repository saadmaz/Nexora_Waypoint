# Nexora · Waypoint

> **Smarter decisions. Better deliveries.**

Waypoint is an intelligent delivery planning and operations platform built for **Waypoint Group** by team **Nexora**
for **Tech-Triathlon 2026**. It connects the whole delivery day in one system:

**Order → Plan → Allocate → Load → Deliver → Confirm**

Instead of spreadsheets, phone calls and printed run sheets, store managers, dispatchers, dock loaders and drivers
work from one shared, live operational picture, and every planning decision says **why**.

---

## 🔗 Quick links

| | |
|---|---|
| 🌐 **Live app** | **https://app.nexorax.live** |
| 💻 **Run it locally** | `cp .env.example .env && docker compose up` → http://localhost:8080 |
| 🎯 **Judge walkthrough** | [19 steps, below](#-judge-walkthrough) |
| 🏗️ **Architecture** | [docs/architecture.md](docs/architecture.md) |
| 🗄️ **Data model** | [docs/data-model.md](docs/data-model.md) |
| 🔌 **API reference** | [docs/api.md](docs/api.md) · interactive docs at http://localhost:8000/api/docs |
| 🎨 **Departures from the Designathon** | [below](#-departures-from-the-designathon) |
| 🤖 **AI disclosure** | [docs/ai-disclosure.md](docs/ai-disclosure.md) |

---

## 🔑 Demo accounts

Four seeded accounts, one per role. **The password for all four is `waypoint-demo`.**

| Role | Email | Signs in as | Lands on | Best on |
|---|---|---|---|---|
| 🧑‍💼 Dispatcher | `dispatcher@waypoint.demo` | Kumari | `/dispatcher/queue` | Laptop |
| 🏪 Store manager | `store@waypoint.demo` | Anusha (OUT084, Kandy) | `/store/orders` | Phone |
| 📦 Loader | `loader@waypoint.demo` | Dock tablet (shared device) | `/loader/dock` | Phone or tablet |
| 🚚 Driver | `driver@waypoint.demo` | Nimal (VEH039, Kandy) | `/driver/run` | Phone |

**Loader PINs.** The dock tablet is shared, so the loader enters a PIN for each action:

| Dock | Loader | PIN |
|---|---|---|
| Peliyagoda | Priya | `1234` |
| Kandy | Ruwan | `5678` |

Open **`/start`** to sign in as each role in its own tab. The password is the backend's `DEMO_PASSWORD`
(`.env.example`, seeded by `backend/seed/accounts.py`).

> **Before you start on the hosted demo:** it is one shared database and one shared clock. Sign in as the
> dispatcher, open the presenter control (avatar menu, or add `?presenter=1`) and press **Reset demo**, so the clock
> reads **Monday 15:30** and step 1 matches what you see.

---

## 🚚 The problem

Waypoint Group delivers from two depots (Peliyagoda and Kandy) to Fresh, Style and Tech outlets with a limited
fleet. Every night's plan has to respect, all at once:

- vehicle **weight** and **volume** capacity
- **chilled** orders on **reefers** only
- outlets that take **vans only**, and mall docks with their own hours
- **delivery windows**
- one **depot**, one **brand** and one **district** per trip
- at most **two trips** per vehicle, and daily **minute budgets** (Fresh 270, Style and Tech 480)
- a weekly **fuel quota** per vehicle
- a 16:00 **order cutoff**, and outlets that were **deferred yesterday**

When demand is bigger than the fleet, some orders must wait. Today that decision is made by phone and spreadsheet,
and nobody can say afterwards why a store was skipped. Then, on the road, drivers lose signal.

---

## 👥 Four roles, one workflow

```text
  🏪 Store manager ──► 🧑‍💼 Dispatcher ──► 📦 Loader ──► 🚚 Driver ──► 🏪 Store manager
     places orders     plans, allocates,    acknowledges,   delivers,       sees proof,
     before 16:00      defers with reasons, checks, loads,  captures POD,   confirms
                       releases, monitors   confirms gate   works offline   receipt
```

| Role | What they do | Screens |
|---|---|---|
| 🏪 **Store manager** | Places chilled and dry orders for the outlet's window, edits or cancels before 16:00, follows status and arrival time, hears about deferrals with a reason and the next run, checks the proof of delivery, confirms receipt, reports issues | S1 to S4 |
| 🧑‍💼 **Dispatcher** | Watches the order queue, reviews the planner's draft, moves orders between trips (every move is checked by the rules), reads why each order was deferred, releases the plan, swaps a failed vehicle, monitors the live board, settles what drivers synced offline, views the capacity outlook | D1 to D9 |
| 📦 **Loader** | Acknowledges each plan version with a PIN, checks orders onto the vehicle, flags missing, damaged or wrong items and failed vehicle checks, confirms the load gate. Works with no network | L1 to L4 |
| 🚚 **Driver** | Acknowledges the run, starts the route, arrives at each stop, records the outcome with photo and receiver name, reports problems, finishes the run. Keeps working with no network and syncs later | R1 to R10 |

Every action feeds the next role through the same PostgreSQL database: an order placed by the store appears in the
dispatcher's queue, a released plan appears on the dock and the driver's phone, a delivery recorded by the driver
appears on the store's updates feed.

---

## 🧠 Intelligent planning

The planner is a pure Python package, [`backend/waypoint_rules`](backend/waypoint_rules), that the API calls
in-process. It drafts the plan at 16:05, and it checks **every** move the dispatcher makes. A refused move names
every rule it breaks, not just the first.

```text
  Orders ──► Rules ──► Allocation ──┬──► Served   (vehicle, trip, stop sequence, planned arrival)
                                    └──► Deferred ──► Typed reason
                                                       ├─ capacity: no vehicle can legally carry it
                                                       ├─ policy:   a vehicle could, but the plan chose not to
                                                       └─ store request
```

**Rules the backend enforces** (on the draft, on every move, again at release, and on a vehicle swap):

| Rule | What it means |
|---|---|
| Weight and volume | Σ kg and Σ m³ on a trip stay within the vehicle's capacity |
| Temperature | Chilled orders only on reefers |
| Van access | Van-only outlets only by vans |
| Depot | A vehicle serves only its home depot's outlets |
| Whole orders | One order, one vehicle, one trip, never split |
| Brand and district | One brand and one district per trip |
| Trips | At most two trips per vehicle per day |
| Turnaround | Trip 2 leaves only once trip 1 is back at the depot |
| Minute budgets | Fresh ≤ 270 min, Style and Tech ≤ 480 min per vehicle per day |
| Availability | Workshop or held vehicles cannot be allocated |
| Fuel | This week's fuel plus tonight's planned fuel stays within the weekly quota |
| Windows | Planned arrival before the outlet's window closes (and the mall dock's, where it applies) |
| Continuity guard | An outlet deferred yesterday cannot be deferred by policy again while a legal vehicle exists |
| Cutoff and operating days | Orders after 16:00 go to the next operating day (Monday to Saturday) |

**Trip minutes** follow the booklet formula, counted per order with no return leg:

```text
trip_minutes = depot_to_district_freeflow_min
             + inter_stop_freeflow_min × (orders − 1)
             + Σ service_allowance_min(brand, dock_type)

VEH003 trip 1: 24 + 8 × 4 + (15 + 16 + 15 + 15 + 15) = 132 min
```

The frontend never re-implements a rule: it shows what the API computed, or asks `/validate-move`.

---

## 📡 Offline-first field apps

The driver and the loader keep working when the network drops. This is the walkthrough's degradation scenario.

```text
  Online ──► Signal lost ──► Work on the phone ──────────────► Signal back ──► Sync ──► Server updated
                             ├─ arrive at a stop                              ├─ accepted
                             ├─ record outcome, photo, receiver               ├─ duplicate (ignored)
                             ├─ report a problem                              └─ conflict ──► "sent for review"
                             └─ saved in IndexedDB (the outbox)                               Dispatch decides
```

- **Storage:** an outbox, a run cache and a photo store in IndexedDB (Dexie), plus a service worker for the app shell,
  so the run survives a page reload with no signal.
- **Sync:** `POST /sync` and `POST /attachments`, idempotent by `clientId`, so a retry never records twice.
- **Conflicts:** when Dispatch changed the plan while the phone was offline, the record goes to Dispatch's inbox.
  The driver is told "sent for review" and the store sees "Under review"; nobody is shown the word "conflict".

---

## 🎯 Judge walkthrough

One Tuesday morning of deliveries, played across the four roles. The scenario clock starts at **Monday 15:30**.
Jump ahead with **Go to next step** in the presenter control; it never goes backwards.

### Act 1 · Monday evening: orders and planning

| # | Clock | Who | Do this | You should see |
|---|---|---|---|---|
| 1 | 15:40 | Store | Orders tab: Chilled 12, Dry 8, review, **Place orders** | "Received 15:40", "Counts for Tue 29 Sep", "You can edit until 16:00" |
| 2 | 15:40 | Dispatcher | Queue, Kandy | ORD2001 and ORD2002 under OUT084, still Ordered |
| 3 | Go to 16:05 | (the system) | Nothing to press | The 16:00 cutoff closes the queue and plan v1 is drafted; the store sees "Confirmed" |
| 4 | 16:06 | Dispatcher | Trips, Peliyagoda: drag **ORD1007** to **VEH037 trip 2**, then **ORD1016** to **VEH037 trip 1**, then **ORD1001** to the pool | All three are refused, each naming every rule it breaks: over volume and "arrives 11:54, after OUT015 closes at 11:00"; "needs a reefer" and "two brands on one trip"; "OUT012 was deferred yesterday; the continuity guard protects it" |
| 5 | 16:06 | Dispatcher | Deferrals: open **ORD1020** (capacity) and **ORD1017** (policy) | Type, what binds it, impact on the store, what it frees, next run |
| 6 | Go to 23:40 | Dispatcher | **Release plan** (it is ready to release; the release itself is yours) | Plan v3 released; each dock waits for its acknowledgement; the store sees an arrival time |

### Act 2 · Tuesday night: the docks

| # | Clock | Who | Do this | You should see |
|---|---|---|---|---|
| 7 | 00:10, then 02:55 | Loader, Peliyagoda | At 00:10 acknowledge v3 with PIN `1234`. At 02:55 open VEH003, **Flag issue**, **Vehicle check failed** | The dock shows acknowledged; then VEH003 is **Held** and Dispatch has a decision to make |
| 8 | 03:00 | Dispatcher | Open the exception in the inbox and accept the swap | Plan v4: VEH036 stands in for VEH003 |
| 9 | 03:04 | Loader, Peliyagoda | Review what changed, acknowledge v4 (`1234`), load VEH036, confirm the gate | The changes screen names VEH036; the vehicle shows loaded |
| 10 | Go to 04:10 | Loader, Kandy | Switch dock to Kandy, acknowledge v4 (`5678`), load VEH039, confirm the gate | The dock shows acknowledged; the driver will see "Confirmed by Ruwan · 04:50" |

### Act 3 · Tuesday morning: on the road, and offline

| # | Clock | Who | Do this | You should see |
|---|---|---|---|---|
| 11 | 05:00 to 05:10 | Driver | Acknowledge v4 (two taps), then **Start route** | "Departed"; the store's delivery says it is on the way |
| 12 | Go to 05:19 | Driver | Nothing: the phone drops off the network (or turn on **Simulate offline** in the outbox sheet) | "Offline · last sync"; Dispatch sees the vehicle as unknown while offline |
| 13 | 05:21 | Dispatcher | Live board: **Defer stop** OUT084, reason store request | The dialog warns the driver is offline; plan v5; the driver still holds v4 |
| 14 | Go to 05:30 | Driver (offline) | Arrive at OUT084, wait for 05:30, **Record outcome**: Delivered, photo, receiver S. Fernando; then OUT087, receiver M. Perera | The outbox counts 1, 3, then 5 waiting |
| 15 | Go to 06:40 | Driver | Network returns; open the run | "3 synced · 1 stop (2 orders) sent for review"; the store sees **Under review** |

### Act 4 · Closing the loop

| # | Clock | Who | Do this | You should see |
|---|---|---|---|---|
| 16 | 06:44 | Dispatcher | Inbox, the reconciliation, **Keep delivery** | The driver gets a notice; the store sees Delivered and the deferral withdrawn |
| 17 | Go to 07:31 | Store | Bell, Updates; open the delivery, check the proof, **Confirm receipt** | The updates feed tells the whole story, and Dispatch sees the receipt |
| 18 | 07:31 | Driver | **Finish run** | The run lands in History |
| 19 | any | Dispatcher | Presenter control: **Reset demo** | Back to Monday 15:30 |

**Branches worth showing:** a short delivery (keep 10 of 12 at step 16), editing or cancelling an order before 16:00,
an order placed after the cutoff, a road problem reported by the driver, and any hand move of your own on the Trips
board: the rules check it the same way.

**The dock is a device setting.** `?dock=kandy|peliyagoda` works in the live app and is remembered; presenter mode
adds "Change dock" to the loader's top bar menu.

### The scenario clock

Scenario time starts at 15:30 the day before the delivery day and **ticks in real time**, so countdowns and
"last heard" ages move on their own, and the 16:00 cutoff and 16:05 draft fire when the clock reaches them. The
dispatcher's presenter control can **Pause**, **Resume**, **Go to next step** and **Reset demo**.

| Setting | Effect |
|---|---|
| `CLOCK_RATE=1` | Real time (default) |
| `CLOCK_RATE=60` | A minute a second |
| `CLOCK_RATE=0` | Held still; only the presenter moves it |
| `SCENARIO_SERVICE_DATE=2026-09-29` | The delivery day. It must be an operating day (not a Sunday) |

---

## ⚡ Run it locally

**Requirements:** Docker with Compose v2. Nothing else: Node and Python run inside the images.

```bash
git clone https://github.com/saadmaz/Nexora_Waypoint.git
cd Nexora_Waypoint
cp .env.example .env     # optional: every value has a working default
docker compose up
```

Open **http://localhost:8080** and sign in with any [demo account](#-demo-accounts). The API's interactive docs are
at http://localhost:8000/api/docs.

One command brings up the whole stack in order, with the schema migrated and the data seeded:

```text
db    postgres:18.6, waits until pg_isready
  └─> api   alembic upgrade head  →  python -m seed.run  →  uvicorn   (:8000)
        └─> web   nginx: static bundle + /api proxy                   (:8080)
```

`api` waits for `db` to be healthy and `web` waits for `api`. The seed is **idempotent**, so a restart does not
duplicate rows. A fresh start runs migrations `0001` through `0005`.

### Configuration

Everything is set in `.env`; [`.env.example`](.env.example) carries the full list and the defaults.

| Variable | Default | What it does |
|---|---|---|
| `DEMO_PASSWORD` | `waypoint-demo` | The one password for the four seeded accounts |
| `SEED_ON_START` | `true` | Migrate then seed when the API starts |
| `SEED_GENERATED_ORDERS` | `false` | `true` adds a full-size day (60 vehicles, about 270 orders). The walkthrough's named moves then differ |
| `CLOCK_RATE` | `1` | Scenario seconds per wall second |
| `SCENARIO_SERVICE_DATE` | `2026-09-29` | The delivery day |
| `DEMO_MODE` | on in `dev`, off elsewhere | Mounts the presenter routes (`/demo/*`). The walkthrough needs them |
| `JWT_SECRET` | dev default | Required outside `dev`: the API refuses to start with the published value |
| `CORS_ORIGINS` | localhost | Origins allowed to call the API from a browser |
| `VITE_DATA_SOURCE` | `live` in `frontend/.env.production` | A frontend build variable: `live` puts every role on the database, anything else on the in-browser mocks |

**Competition data.** The CSVs are read from `data/` at runtime: mounted read-only, git-ignored, never committed.
Without them the seed falls back to the smaller PRD §4c reference set, so the stack still comes up and the
walkthrough still plays.

<details>
<summary><b>Running the hosted demo</b> (Cloudflare + Railway)</summary>

The live demo at **https://app.nexorax.live** splits the same build across managed hosts: the Vite bundle on
Cloudflare, the API and PostgreSQL on Railway. Four things differ from Compose: the first three because there is no
nginx in front to proxy `/api`, the fourth because the host does not run in `dev`.

1. The bundle is built with `VITE_API_BASE` set to the API's origin, with no trailing slash.
2. The API's `CORS_ORIGINS` must list `https://app.nexorax.live`, or every role fails to sign in from a browser while
   working fine from `curl`.
3. `VITE_DATA_SOURCE=live` must be set at build time. `frontend/.env.production` carries it, but a host that builds in
   another Vite mode or passes the variable through empty would serve the mocks and say nothing.
4. The API must have `DEMO_MODE=true`. Outside `ENVIRONMENT=dev` the presenter routes are not mounted at all, so
   **Reset demo** and **Go to next step** answer 404, the clock runs on past the story day, and the walkthrough cannot
   start. Check that `/api/openapi.json` on the API lists the four `/demo` routes after each deploy.

`docker compose up` needs none of the four and remains the reference deployment. More:
[docs/build/api-mode.md](docs/build/api-mode.md).

</details>

<details>
<summary><b>Upgrading an old PostgreSQL 16 volume</b></summary>

Local Hackathon data is disposable. Stop Compose and remove only this project's old `pgdata` volume, then start
again. Do not attach the PG16 data directory to PG18 or attempt an in-place upgrade, and keep the separate uploads
volume.

```bash
docker compose down
docker volume ls                   # find this project's <project>_pgdata volume
docker volume rm <project>_pgdata  # the exact name you found
docker compose up --build
```

Startup and seed scripts never delete Docker volumes. See [docs/database-validation.md](docs/database-validation.md).

</details>

---

## 🏗️ Architecture

One React app with four role areas, one FastAPI service, one PostgreSQL database. The planner is a pure Python
package imported in-process, not a separate service.

```text
Browser · one SPA, four role areas            Loader and driver also keep an
  store · dispatcher · loader · driver        outbox in IndexedDB when offline
      |                                                    |
      v                                                    v
  web · nginx  (static bundle, proxies /api)       POST /sync, /attachments
      |                                            idempotent by clientId
      v                                                    |
  api · FastAPI  <-----------------------------------------+
      |  routers /api/v1 -> services -> waypoint_rules (planner, constraints, lifecycle)
      |  scenario clock · job loop (16:00 cutoff, 16:05 draft)
      v
  db · PostgreSQL 18.6
     reference data · orders · plan versions · field records · audit_events
```

- **Rules live in one place.** Every constraint, calculation and refusal message is in `waypoint_rules`, with no
  FastAPI or SQLAlchemy imports. The API, the tests and the Datathon notebook all import the same package, so they
  cannot disagree about a rule.
- **Every role is checked on the server.** Each route checks the role, and the account's outlet, vehicle or depot.
- **Every state change is audited.** It writes an `audit_events` row in the same transaction.

Full component diagram, the order-to-delivery sequence, the clock and the offline design:
**[docs/architecture.md](docs/architecture.md)**. Every route: **[docs/api.md](docs/api.md)**.

### Data model

38 tables in five areas. Full ER diagram: **[docs/data-model.md](docs/data-model.md)**.

| Area | Main tables |
|---|---|
| Reference | `depots`, `districts`, `outlets`, `vehicles`, `service_allowances`, `calendar_days`, `traffic_speed` |
| People | `users` (one role each, bound to an outlet, vehicle or depot), `drivers`, `pin_people` |
| Orders and plans | `orders`, `plan_versions`, `trips`, `trip_orders` (the stop sequence and planned times), `deferrals`, `outlet_service_history` |
| Field | `acknowledgements`, `load_checks`, `load_gates`, `runs`, `device_records` (the synced outbox), `attachments` (POD photos and signatures), `receipts`, `exceptions`, `conflicts` |
| Operations | `notices`, `notice_reads`, `audit_events`, `clock`, `job_runs`, `scenario_events` |

---

## 📊 Predictive intelligence

The Task 2B notebook in [`analytics/`](analytics/) answers "is this route feasible?" against the PRD's reference day:
the trip-minutes formula, `check_trip` on each trip of plan v3, the dispatcher's three refusals, and the planner's
own draft next to the hand-made plan. It imports the same `waypoint_rules` package the API uses.

The running system ships the **D9 capacity outlook**: for each of the next four ISO weeks it weighs the reefer
minutes a normal day asks for, scaled by the calendar (payday, festival ramp), against what each depot's reefers can
give, and labels the week 🟢 **OK**, 🟡 **Tight** or 🔴 **Short**. It is a transparent baseline, not a trained model,
and the screen says so: the eight weeks of delivered orders the PRD builds demand from are not in the repository, so
demand comes from the live queue (`backend/app/services/forecast.py`).

---

## 🧪 Testing and quality gates

CI runs on every pull request and push to `develop` and `main`. A failure blocks the merge.

| Job | What it runs |
|---|---|
| Frontend | oxlint, `tsc -b`, Vitest (in two time zones), `vite build`, a bundle check that no mock or fixture ships |
| Backend | ruff, mypy (strict on `waypoint_rules`), a fresh migration chain and seed on PostgreSQL 18.6, `alembic check`, pytest, exactly one Alembic head |
| Compose | `docker compose up --build` on a clean runner, health checks, the seed, the web proxy |
| End to end | Playwright against that clean stack: this walkthrough, the driver offline run and the loader offline check, plus axe accessibility checks |

Play the walkthrough yourself:

```bash
CLOCK_RATE=0 docker compose up --build -d
cd e2e && npm ci && npx playwright install chromium && npm test
```

Steps 1, 2, 15 (the store's view) and 17 are driven through the screens in a real browser. The driver's offline run
(steps 12, 14 and 15: offline, photos, reload, sync) and the loader's offline vehicle check (steps 7 and 9) have their
own browser specs. The other steps, including the dispatcher's refused moves, release, swap, defer and keep-delivery,
are checked through the same API calls those screens make.

---

## 🎨 Departures from the Designathon

Where the built system differs from the Designathon design, the PRD wins and the difference is recorded. The full
register is `waypoint-prd-v3.md` section 18 (rows `A*`, `DP-*`, `O-*`). The changes that alter the shape of the
system rather than one screen:

- **No separate allocation or prediction service.** The Designathon diagram showed them as their own deployables. The
  planner is a deterministic pure function, so it ships as `backend/waypoint_rules`, imported in-process: no network
  hop, no second deployable, and the same package serves the notebook and the tests.
- **The scenario clock ticks (DP-26).** The PRD had time move only on a presenter action. It now runs at `CLOCK_RATE`,
  so countdowns move on their own and the cutoff and draft fire when the clock crosses them.
- **Two display mirrors remain on the client (DP-27).** The store mirrors the 16:00 cutoff and the 23:40 release, and
  the dispatcher's exception screen sums kg and m³. The API remains the authority.
- **The walkthrough's refused moves changed (DP-30).** The PRD's step 4 named moves with no target in the 16:06
  draft. The three above are refused by the rules package instead, each naming every rule it breaks.
- **A turnaround rule was added (DP-31).** Trip 2 may not leave before trip 1 is back at the depot, so a hand move
  that lengthens trip 1 too far is refused.

Per-role detail:

| Area | Departures |
|---|---|
| Store manager (S1 to S4) | [docs/build/store.md](docs/build/store.md#departures-from-the-figma-design) |
| Field apps foundation | [docs/build/field-foundation.md](docs/build/field-foundation.md#departures-from-the-designathon-design-foundation) |
| Sign-in and role picker | [docs/build/app-shell.md](docs/build/app-shell.md#departures-from-the-brief) |
| Loader (L1 to L4) | [docs/build/loader.md](docs/build/loader.md#departures-from-the-designathon-design-loader) |
| Driver (R1 to R10) | [docs/build/driver.md](docs/build/driver.md#departures-from-the-designathon-design) |
| Dispatcher (D1 to D9) | [docs/build/dispatcher.md](docs/build/dispatcher.md#departures-from-the-prd-and-the-design) |

---

## 🚧 Known gaps

What the build does not do yet, in one place. The full list is `G-1` to `G-15` in `waypoint-prd-v3.md` section 18.

| Gap | What you will see |
|---|---|
| Loader item flags | A missing, damaged or wrong item, or a warehouse shortage, flagged at the dock reaches Dispatch's inbox as a report with the order and units, but has no decision screen: only **Vehicle check failed** opens the swap review (D8). A shortfall is settled at delivery instead (keep 10 of 12) |
| Deferral count | The seeded day defers the orders the planner computes, which can differ from the PRD's fixed figure of 19 at Peliyagoda. The screen shows the computed number (DP-01) |
| D9 capacity outlook | A labelled baseline, not the Datathon model (see above) |
| Loader "Other…" PIN | The guest PIN works on the mocks only, and the tablet caches no PIN hashes, so a load gate needs a connection (A55) |
| Other dates | Only the demo day has a seeded run. Another date answers `no_run` with its reason |
| Sinhala and Tamil | The driver strings are a machine draft, not reviewed by a native speaker (O-8) |
| Dispatcher screens in `e2e/` | The refused moves, release, swap, defer and keep-delivery are checked through the API, not by dragging on the screen |
| Bundle size | One 957 kB script (283 kB gzipped), not split per role |

---

## 🛠️ Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router; PWA service worker |
| Offline | IndexedDB via Dexie: outbox, run cache, photo store |
| Backend | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, uvicorn |
| Database | PostgreSQL 18.6 |
| Allocation engine | `backend/waypoint_rules`, pure Python, imported in-process |
| Prediction | Datathon Task 2B notebook in `analytics/`; D9 baseline in `backend/app/services/forecast.py` |
| Tests | pytest, Vitest, Playwright, axe |
| Tooling | ruff, mypy, oxlint, tsc |
| Infrastructure | Docker Compose (db + api + web); hosted on Cloudflare (bundle) and Railway (API + PostgreSQL) |

---

## 📁 Repository structure

```text
frontend/        React + TypeScript (Vite), one app with four role areas
  src/screens/     store · dispatcher · loader · driver
  src/field/       offline outbox and sync shared by the loader and driver
  src/api/         generated schema.ts and the typed client per role
backend/
  app/             FastAPI: routers, services, models, schemas, clock, auth
  waypoint_rules/  the planner and every rule, pure Python
  alembic/         migrations
  seed/            reference data, the story day, the four accounts
  tests/           rules/ and api/
analytics/       Datathon Task 2B notebook
e2e/             Playwright judge walkthrough
deploy/          web Dockerfile and nginx config
docs/            architecture, API, data model, AI disclosure, build notes
data/            competition CSVs: local only, git-ignored
```

> Competition datasets are kept out of the public repository, in line with the Tech-Triathlon data rules.

---

## 📚 Documentation

| Document | What it covers |
|---|---|
| [Architecture](docs/architecture.md) | Components, the order-to-delivery sequence, the clock, offline design |
| [Data model](docs/data-model.md) | ER diagram of all 38 tables |
| [API reference](docs/api.md) | Every route, its role and what it does |
| [AI disclosure](docs/ai-disclosure.md) | Where AI tools did meaningful work and what a person checked |
| [Build notes](docs/build/) | Per-role screens, states and departures |
| [Database validation](docs/database-validation.md) | How the schema and seed are validated |
| `waypoint-prd-v3.md` | The build spec, with the assumptions, departures and gaps register (section 18) |

---

## 🤖 AI disclosure

AI assistants (Claude and Claude Code) did a meaningful part of this build. [`docs/ai-disclosure.md`](docs/ai-disclosure.md)
records it as a dated log: for each piece of work, which tool, what it produced, and what a person checked. It also
lists the invented data register and the machine-drafted Sinhala and Tamil driver strings. No competition CSV row
was pasted into an AI tool.

---

## 🏆 Tech-Triathlon 2026

| Stage | What we did |
|---|---|
| 🎨 **Designathon** | Designed the four-role experience |
| 💻 **Hackathon** | Built this platform |
| 📈 **Datathon** | Feasibility and capacity analysis in `analytics/` |

<p align="center"><b>Order. Plan. Allocate. Load. Deliver. Confirm.</b><br>Built by Nexora for Waypoint Group · Tech-Triathlon 2026</p>
