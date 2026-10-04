# Nexora - Waypoint

> **Smarter decisions. Better deliveries.**

Waypoint is an intelligent delivery planning and operations platform built for Waypoint Group as part of **Tech-Triathlon 2026**.

It connects the complete delivery workflow in one system:

**Order → Plan → Allocate → Load → Deliver → Confirm**

Instead of relying on spreadsheets, phone calls, and printed run sheets, Waypoint gives dispatchers, loaders, drivers, and store managers a shared operational view.

---

## 🔗 The deliverable

| | |
|---|---|
| **Live app** | **https://app.nexorax.live** |
| **Run it locally** | `cp .env.example .env && docker compose up` → http://localhost:8080 |
| **API docs (local)** | http://localhost:8000/api/docs |
| **Docs** | [architecture](docs/architecture.md) · [API reference](docs/api.md) · [data model](docs/data-model.md) · [AI disclosure](docs/ai-disclosure.md) |
| **Judge walkthrough** | [19 steps, below](#-judge-walkthrough) (played by [`e2e/`](e2e/) on every push to `develop` and `main`) |
| **Departures from the Designathon** | [below](#-departures-from-the-designathon-submission) |

### Seeded accounts

Four accounts, one per role. **Password for all four: `waypoint-demo`.**

| Role | Email | Signs in as | Lands on |
|---|---|---|---|
| Dispatcher | `dispatcher@waypoint.demo` | Kumari | `/dispatcher/queue` |
| Store manager | `store@waypoint.demo` | Anusha (OUT084, Kandy) | `/store/orders` |
| Loader | `loader@waypoint.demo` | Dock tablet (a shared device) | `/loader/dock` |
| Driver | `driver@waypoint.demo` | Nimal (VEH039, Kandy) | `/driver/run` |

Open `/start` to sign in as each role in its own tab. The loader enters a PIN for each action:
**Priya `1234`** at Peliyagoda, **Ruwan `5678`** at Kandy.

The password is the backend's `DEMO_PASSWORD` (`.env.example`, seeded by `backend/seed/accounts.py`).

Every role reads and writes PostgreSQL through the API. One build variable decides that:
`VITE_DATA_SOURCE=live` puts every role on the database, and anything else (including unset) puts every
role on the in-browser mocks, so **mock is the fallback**. `frontend/.env.production` is committed with
`VITE_DATA_SOURCE=live`, which is why `npm run build`, the Docker web image and the hosted demo all serve
the database; `npm run check:bundle` then proves the mocks and their fixtures are not in the bundle. A host
that builds in another Vite mode, or injects an empty `VITE_DATA_SOURCE`, would serve mocks without
complaining, so set it explicitly anywhere other than Compose. Per-role overrides
(`VITE_<ROLE>_API=mock|api`) are for working on one role against the API while the rest stay on mocks.
See [docs/build/api-mode.md](docs/build/api-mode.md).

---

## 🚚 What Waypoint Solves

Waypoint helps manage a delivery network where capacity is limited and every decision matters.

The platform considers:

- Vehicle weight & volume capacity
- Refrigerated / ambient requirements
- Outlet access restrictions
- Delivery windows
- Depot & district constraints
- Vehicle trip limits
- Order deferrals
- Delivery progress
- Offline field operations

When demand exceeds capacity, Waypoint doesn't just defer an order — it records **why** and keeps the decision traceable.

---

## 👥 Four Roles. One Connected Workflow.

```text
Store Manager
      ↓
    Order
      ↓
  Dispatcher
      ↓
 Plan & Allocate
      ↓
    Loader
      ↓
 Load & Dispatch
      ↓
    Driver
      ↓
 Deliver & Capture POD
      ↓
 Store Manager
      ↓
 Confirm Receipt
```

Every action feeds the next stage of the operation.

---

## 🧠 Intelligent Planning

Waypoint's allocation engine evaluates operational constraints before assigning orders to vehicles and trips.

```text
Orders
  ↓
Constraints
  ↓
Allocation
  ├── Served
  └── Deferred
        ↓
     Reason
```

The goal is not simply to find a plan — but to create a **feasible and explainable plan**.

---

## 📡 Built for the Real World

Drivers may lose connectivity while on the road.

Waypoint supports offline delivery operations, allowing drivers to record delivery events and proof of delivery locally before synchronizing when connectivity returns.

```text
Online → Offline → Work Locally → Reconnect → Sync
```

---

## 📊 Predictive Intelligence

The Task 2B notebook in [`analytics/`](analytics/) answers "is this route feasible?" against the PRD's
reference day (§4c): the trip-minutes formula, `check_trip` on each trip of plan v3, the dispatcher's three
refusals, and the planner's own draft next to the hand-made plan. It imports the same `waypoint_rules`
package the API uses, so the notebook and the running system cannot disagree about a rule.

**What the running system ships:** the **D9 capacity outlook**, a transparent baseline rather than a
trained model. For each of the next four ISO weeks it weighs the reefer minutes a normal day asks for,
scaled by the calendar (payday, festival ramp), against what the depot's reefers can give, and labels the
week **OK**, **Tight** or **Short**. The screen says it is a baseline. The eight weeks of delivered orders
the PRD builds demand from are not in the repository, so demand comes from the live queue
(`backend/app/services/forecast.py`).

---

## 🏗️ Architecture

One React app with four role areas, one FastAPI service, one PostgreSQL database. The planner is a pure
Python package the API imports in-process, not a separate service.

```text
Browser · one SPA, four role areas            Loader and driver also keep an
  store · dispatcher · loader · driver        outbox in IndexedDB when offline
      |                                                    |
      v                                                    v
  web · nginx  (static bundle, proxies /api)       POST /sync, /attachments
      |                                            idempotent by clientId
      v                                                    |
  api · FastAPI  <---------------------------------------- -+
      |  routers /api/v1 -> services -> waypoint_rules (planner, constraints,
      |  scenario clock · job loop (16:00 cutoff, 16:05 draft)     lifecycle)
      v
  db · PostgreSQL 18.6
     reference data · orders · plan versions · field records · audit_events
```

Full component diagram, the order-to-delivery sequence, the clock and the offline design:
**[docs/architecture.md](docs/architecture.md)**. Routes: **[docs/api.md](docs/api.md)**.
Schema and ER diagram: **[docs/data-model.md](docs/data-model.md)**.

---

## 📁 Repository Structure

```text
frontend/      React + TypeScript (Vite), one app with four role areas
backend/       FastAPI app, Alembic migrations, waypoint_rules (pure rules), seed, tests
analytics/     Datathon Task 2B notebook
docs/          architecture.md, api.md, data-model.md, ai-disclosure.md, build/
e2e/           Playwright judge walkthrough
deploy/        web Dockerfile and nginx config
data/          competition CSVs, local only, git-ignored
```

> Competition datasets are intentionally excluded from the public repository in accordance with the Tech-Triathlon data rules.

---

## ⚡ Getting Started

**Requirements:** Docker with Compose v2. Nothing else: Node and Python run inside the images.

```bash
git clone https://github.com/saadmaz/Nexora_Waypoint.git
cd Nexora_Waypoint

cp .env.example .env     # optional: every value has a working default

docker compose up
```

Then open **http://localhost:8080** and sign in with any of the [seeded accounts](#seeded-accounts).
The API's own docs are at http://localhost:8000/api/docs.

One command brings up the whole stack, in order, with the schema migrated and the data seeded:

```text
db    postgres:18.6, waits until pg_isready
  └─> api   alembic upgrade head  →  python -m seed.run  →  uvicorn   (:8000)
        └─> web   nginx: static bundle + /api proxy                   (:8080)
```

`api` waits for `db` to be healthy and `web` waits for `api`, so the order is handled for you. The seed is
**idempotent**, so restarting does not duplicate rows. A fresh start runs migrations `0001` through `0004`.

### Configuration

Everything is set in `.env`; [`.env.example`](.env.example) carries the full list and the defaults.

| Variable | Default | What it does |
|---|---|---|
| `DEMO_PASSWORD` | `waypoint-demo` | The one password for the four seeded accounts |
| `SEED_ON_START` | `true` | Migrate then seed when the API starts |
| `SEED_GENERATED_ORDERS` | `false` | `true` adds a full-size day (60 vehicles, ~270 orders). The walkthrough's named moves then differ |
| `CLOCK_RATE` | `1` | Scenario seconds per wall second. `0` pauses, `60` is a minute a second |
| `SCENARIO_SERVICE_DATE` | `2026-09-29` | The delivery day. Must be an operating day (not a Sunday) |
| `JWT_SECRET` | dev default | Required outside `dev`: the API refuses to start with the published value |
| `CORS_ORIGINS` | localhost | Origins allowed to call the API from a browser |
| `VITE_DATA_SOURCE` | `live` in `frontend/.env.production`, else `mock` | A frontend build variable, not an API one: `live` puts every role on the database, anything else on the in-browser mocks |

The competition CSVs are read from `data/` at runtime (mounted read-only, git-ignored, never committed).
Without them the seed falls back to the smaller PRD 4c reference set, so the stack still comes up.

### Running the hosted demo

The live demo at **https://app.nexorax.live** splits the same build across managed hosts: the Vite bundle
on Cloudflare, the API and PostgreSQL on Railway. Three things differ from Compose, because there is no
nginx in front to proxy `/api`:

1. The bundle is built with `VITE_API_BASE` set to the API's origin, with no trailing slash.
2. The API's `CORS_ORIGINS` must list the site's origin, `https://app.nexorax.live`, or every role fails to
   sign in from a browser while working fine from `curl`.
3. `VITE_DATA_SOURCE=live` must be set at build time. `frontend/.env.production` carries it, so a plain
   `npm run build` has it, but a host that builds in another Vite mode or passes the variable through empty
   would serve the mocks and say nothing. Set it in the host's build settings as well.

`docker compose up` needs none of the three and remains the reference deployment.

### Local database notes

**Upgrading an old PostgreSQL 16 local volume:** local Hackathon data is disposable. Stop Compose
and remove only your project's old `pgdata` volume, then run the normal first-run command again.
Do not attach the PG16 data directory to PG18 or attempt an in-place upgrade. Inspect the exact
volume name before removing it; keep the separate uploads volume.

```bash
docker compose down
docker volume ls  # identify this project's old <project>_pgdata volume
docker volume rm <project>_pgdata  # replace with the exact name you identified
docker compose up --build
```

These are manual development steps. Startup and seed scripts never delete Docker volumes.
See [the v3 data model](docs/data-model.md) and [database validation](docs/database-validation.md).

---

## 🎯 Judge Walkthrough

The demo is one Tuesday morning of deliveries, played across the four roles. `e2e/` plays every step below against
`docker compose up` on each push to `develop` and `main`: the store and dispatcher screens, and the driver's and
loader's offline runs, are driven in a real browser, and the rest through the same API calls those screens make.

**Accounts.** All four use the password `waypoint-demo`: `store@waypoint.demo`, `dispatcher@waypoint.demo`, `loader@waypoint.demo`, `driver@waypoint.demo`. Open `/start` to sign in as each role in its own tab. The loader enters a PIN for each action: **Priya `1234`** at Peliyagoda, **Ruwan `5678`** at Kandy. Use phone width for the store, loader and driver, and a laptop for Dispatch.

**Start from a clean day.** The hosted demo is one shared database and one shared clock: anyone signed in as the dispatcher can move the clock or reset it for everybody. Before you begin, open the presenter control (the dispatcher's avatar menu, or `?presenter=1`) and press **Reset demo**, so the clock reads Monday 15:30 and step 1 matches. If a step does not match what you see, reset and start again.

| # | Clock | Who | Do this | You should see |
|---|---|---|---|---|
| 1 | Mon 15:40 | Store | Orders tab: Chilled 12, Dry 8, review, **Place orders** | "Received 15:40", "Counts for Tue 29 Sep", "You can edit until 16:00" |
| 2 | 15:40 | Dispatcher | Queue, Kandy | ORD2001 and ORD2002 under OUT084, still Ordered |
| 3 | Go to 16:05 | (the system) | Nothing to press | The 16:00 cutoff closes the queue and plan v1 is drafted; the store sees "Confirmed" |
| 4 | 16:06 | Dispatcher | Trips, Peliyagoda: drag **ORD1007** to **VEH037 trip 2**, then **ORD1016** to **VEH037 trip 1**, then **ORD1001** to the pool | Each refusal names every rule it breaks: over volume and "arrives 11:54, after OUT015 closes at 11:00"; "needs a reefer" and "two brands on one trip"; "OUT012 was deferred yesterday; the continuity guard protects it" |
| 5 | 16:06 | Dispatcher | Deferrals: open **ORD1020** (capacity) and **ORD1017** (policy) | Type, what binds it, impact on the store, what it frees, next run |
| 6 | Go to 23:40 | Dispatcher | **Release plan** (it is ready to release; the release itself is yours) | Plan v3 released; each dock waits for its acknowledgement; the store sees an arrival time |
| 7 | Tue 00:10, then 02:55 | Loader, Peliyagoda | At 00:10 acknowledge v3 with PIN `1234`. At 02:55 open VEH003, **Flag issue**, **Vehicle check failed** | The dock shows acknowledged; then VEH003 is **Held** and Dispatch has a decision to make |
| 8 | 03:00 | Dispatcher | Open the exception in the inbox and accept the swap | Plan v4: VEH036 stands in for VEH003 |
| 9 | 03:04 | Loader, Peliyagoda | Review what changed, acknowledge v4 (`1234`), load VEH036, confirm the gate | The changes screen names VEH036; the vehicle shows loaded |
| 10 | Go to 04:10 | Loader, Kandy | Switch dock to Kandy, acknowledge v4 (`5678`), load VEH039, confirm the gate | The dock shows acknowledged; the driver will see "Confirmed by Ruwan · 04:50" |
| 11 | 05:00 to 05:10 | Driver | Acknowledge v4 (two taps), then **Start route** | "Departed"; the store's delivery says it is on the way |
| 12 | Go to 05:19 | Driver | Nothing: the phone drops off the network (or turn on **Simulate offline** in the outbox sheet) | "Offline · last sync"; Dispatch sees the vehicle as unknown while offline |
| 13 | 05:21 | Dispatcher | Live board: **Defer stop** OUT084, reason store request | The dialog warns the driver is offline; plan v5; the driver still holds v4 |
| 14 | Go to 05:30 | Driver (offline) | Arrive at OUT084, wait for 05:30, **Record outcome**: Delivered, photo, receiver S. Fernando; then OUT087, receiver M. Perera | The outbox counts 1, 3, then 5 waiting |
| 15 | Go to 06:40 | Driver | Network returns; open the run | "3 synced · 1 stop (2 orders) sent for review"; the store sees **Under review** |
| 16 | 06:44 | Dispatcher | Inbox, the reconciliation, **keep delivery** | The driver gets a notice; the store sees Delivered and the deferral withdrawn |
| 17 | Go to 07:31 | Store | Bell, Updates; open the delivery, check the proof, **Confirm receipt** | The updates feed tells the whole story, and Dispatch sees the receipt |
| 18 | 07:31 | Driver | **Finish run** | The run lands in History |
| 19 | any | Anyone | Presenter control: **Reset demo** | Back to Monday 15:30 |

Branches worth showing: a shortfall (keep 10 of 12 at step 16), editing or cancelling an order before 16:00, an order after the cutoff, a road problem from the driver. A driver is told "sent for review", never "conflict", and a store never sees the word either.

**The clock.** Scenario time starts at 15:30 the day before the delivery day and **ticks in real time**, so countdowns and
"last heard" ages move on their own, and the 16:00 cutoff and the 16:05 draft happen when the clock reaches them. You do not
have to wait: open the presenter control from the dispatcher's avatar menu (or add `?presenter=1`) to **Pause clock** and
**Resume clock**, jump with **Go to next step** (it never goes backwards), or **Reset demo**. Set `CLOCK_RATE=60` in `.env` for
a minute a second, or `0` to hold still. `SCENARIO_SERVICE_DATE` picks the delivery day (it must be an operating day). See
departure DP-26 in `waypoint-prd-v3.md`.

**Play it automatically.** `e2e/` plays this walkthrough in a real browser, including a driver who loses the network, records two deliveries with photos, reloads the page offline and syncs when the network returns:

```bash
CLOCK_RATE=0 docker compose up --build -d
cd e2e && npm ci && npx playwright install chromium && npm test
```

More: [architecture](docs/architecture.md), [API reference](docs/api.md), [data model](docs/data-model.md), [AI disclosure](docs/ai-disclosure.md).

---

## 🎨 Departures from the Designathon submission

Where the built system differs from the Designathon design, the PRD wins and the difference is recorded.
The register is `waypoint-prd-v3.md` section 18 (rows `A*`, `DP-*`, `O-*`); the per-role detail is in the
build notes:

| Area | Departures |
|---|---|
| Store manager (S1 to S4) | [docs/build/store.md](docs/build/store.md#departures-from-the-figma-design) |
| Field apps foundation | [docs/build/field-foundation.md](docs/build/field-foundation.md#departures-from-the-designathon-design-foundation) |
| Sign-in and role picker | [docs/build/app-shell.md](docs/build/app-shell.md#departures-from-the-brief) |
| Loader (L1 to L4) | [docs/build/loader.md](docs/build/loader.md#departures-from-the-designathon-design-loader) |
| Driver (R1 to R10) | [docs/build/driver.md](docs/build/driver.md#departures-from-the-designathon-design) |
| Dispatcher (D1 to D9) | [docs/build/dispatcher.md](docs/build/dispatcher.md#departures-from-the-prd-and-the-design) |

The four that change the shape of the system rather than one screen:

- **No separate allocation or prediction service.** The Designathon diagram showed an allocation engine and
  prediction services as their own deployables. The planner is a deterministic pure function, so it ships
  as `backend/waypoint_rules`, imported in-process by the API: no network hop, no second deployable, and
  the same package is importable by the Datathon notebook and the tests. See
  [docs/architecture.md](docs/architecture.md).
- **The scenario clock ticks (DP-26).** The PRD had scenario time move only on a presenter action. It now
  runs at `CLOCK_RATE` (default real time), so countdowns and "last heard" ages move on their own and the
  16:00 cutoff and 16:05 draft fire when the clock crosses them. Jumps still refuse to go backwards.
- **Two display mirrors remain on the client (DP-27).** The store mirrors the 16:00 cutoff and the 23:40
  release, and the dispatcher's exception screen sums kg and m³. The API remains the authority; moving the
  last two copies onto it is left for after the deadline.
- **The walkthrough's refused moves changed (DP-30).** The PRD's step 4 named moves with no target in the
  16:06 draft. The three in the walkthrough above are refused by the rules package instead, each naming
  every rule it breaks.

**D9 is a labelled baseline, not the Datathon model.** The eight weeks of delivered orders the PRD builds
demand from are not in the repository, so the capacity outlook scales the live queue by the calendar and
the screen says so.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router; IndexedDB (Dexie) for the offline outbox; service worker (PWA) |
| Backend | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, uvicorn |
| Database | PostgreSQL 18.6 |
| Allocation engine | `backend/waypoint_rules`, a pure Python package the API imports in-process (no framework imports, no separate service) |
| ML / prediction | Datathon Task 2B notebook in `analytics/`; the running D9 outlook is a labelled baseline (`backend/app/services/forecast.py`) |
| Tests | pytest, Vitest, Playwright (`e2e/`), axe for accessibility |
| Tooling | ruff, mypy (strict on `waypoint_rules`), oxlint, tsc |
| Infrastructure | Docker Compose (db + api + web); hosted demo on Cloudflare (bundle) and Railway (API + PostgreSQL) |

---

## 🧱 Build notes per role

The build log for each role (screens, states, Figma notes, phases and that role's departures)
lives in [`docs/build/`](docs/build/), so this README stays the deliverable:

| Area | Notes |
|---|---|
| Store manager (S1 to S4) | [docs/build/store.md](docs/build/store.md) |
| Field apps foundation | [docs/build/field-foundation.md](docs/build/field-foundation.md) |
| App shell and sign-in | [docs/build/app-shell.md](docs/build/app-shell.md) |
| Loader (L1 to L4) | [docs/build/loader.md](docs/build/loader.md) |
| Driver (R1 to R10) | [docs/build/driver.md](docs/build/driver.md) |
| Dispatcher (D1 to D9) | [docs/build/dispatcher.md](docs/build/dispatcher.md) |
| API mode and the typed clients | [docs/build/api-mode.md](docs/build/api-mode.md) |

Field conventions shared by the loader and driver: [docs/build/field-conventions.md](docs/build/field-conventions.md).

---

## 📋 Spec

`waypoint-prd-v3.md` is the build spec and `waypoint-central-context-v3.md` is the team context. The register of assumptions
(`A1` to `A58`), departures (`DP-*`) and known gaps (`G-1` to `G-15`) is section 18 of the PRD.

**Two planned distances, both used where the PRD says.** `planned_fuel` stays per order (VEH039 trip 1 is 22 km, which is where
the "fuel 75.4 / 370 L" figure comes from) and feeds the dispatcher's fuel meters and the driver's fuel line. `planned_run_legs`
counts legs per stop, so an outlet with two orders is one stop, and the driver's run summary (R9) reads 19 km from it.

**The dock is a device setting.** `?dock=kandy|peliyagoda` works in the live app and is remembered; presenter mode adds
"Change dock" to the loader top bar menu.

**AI disclosure.** [`docs/ai-disclosure.md`](docs/ai-disclosure.md) records where AI assistants did a meaningful part of the work,
the invented data register, and the machine-drafted Sinhala and Tamil driver strings.


---

## 🏆 Tech-Triathlon 2026

Waypoint is built across the three stages of the challenge:

**Designathon** → Design the experience
**Hackathon** → Build the platform
**Datathon** → Predict and optimize

---

### Waypoint

**Order. Plan. Allocate. Load. Deliver. Confirm.**

```
Order. Plan. Allocate. Load. Deliver. Confirm.
```
