# Nexora - Waypoint

> **Smarter decisions. Better deliveries.**

Waypoint is an intelligent delivery planning and operations platform built for Waypoint Group as part of **Tech-Triathlon 2026**.

It connects the complete delivery workflow in one system:

**Order → Plan → Allocate → Load → Deliver → Confirm**

Instead of relying on spreadsheets, phone calls, and printed run sheets, Waypoint gives dispatchers, loaders, drivers, and store managers a shared operational view.

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
````

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

The Datathon component explores:

* Delivery service-time prediction
* Late-arrival probability
* Future demand forecasting
* Peak-day fleet allocation

These capabilities can help Waypoint plan ahead instead of reacting after problems occur.

---

## 🏗️ Architecture

```text
Web Application
      ↓
     API
      ↓
 ┌────┴─────┐
 ↓          ↓
Database   Allocation Engine
              ↓
        Prediction Services
```

Detailed architecture and data-model documentation can be found in `/docs`.

---

## 📁 Repository Structure

```text
apps/          → Web application
services/      → API, allocation & prediction services
docs/          → Architecture & documentation
scripts/       → Setup & seed scripts
tests/         → Automated tests
data/          → Local competition data
```

> Competition datasets are intentionally excluded from the public repository in accordance with the Tech-Triathlon data rules.

---

## ⚡ Getting Started

```bash
git clone <REPOSITORY_URL>
cd <REPOSITORY_NAME>

cp .env.example .env

docker compose up
```

Docker Compose starts the application, database, and seed data.

---

## 🎯 Judge Walkthrough

The complete workflow can be demonstrated using the seeded accounts:

1. **Store Manager** → Create an order
2. **Dispatcher** → Plan and allocate deliveries
3. **Loader** → Load the assigned vehicle
4. **Driver** → Complete the delivery
5. **Store Manager** → Confirm receipt

See the deployed application and `/docs` for the full walkthrough.

---

## 🛠️ Tech Stack

* Frontend: `<TECHNOLOGY>`
* Backend: `<TECHNOLOGY>`
* Database: `<TECHNOLOGY>`
* Allocation Engine: `<TECHNOLOGY>`
* ML / Prediction: `<TECHNOLOGY>`
* Infrastructure: Docker

---

## 🏬 Store Manager (Waypoint Store)

The store manager role, built in `frontend/`. Branch: `feature/store-manager-frontend`.

**Status:** in progress. Phases 1 to 4 are done; phases 5 to 8 are not started.

### How to run

```bash
cd frontend
npm install
npm run dev
```

Only `/store/orders` (S1, phase 4) is routed so far. The full route set lands in
phase 7: `/store/orders`, `/store/deliveries`,
`/store/deliveries/:date/receipt`, `/store/issues` and `/store/updates` (S4,
phase 6b), with a dev-only state gallery at `/store/_states` and the scenario
clock.

Until then `/store/orders` takes two interim query params (see
`frontend/src/screens/orders/OrdersRoute.tsx`, to be replaced by phase 7):

- `?at=HH:MM` starts the clock at that time on Mon 28 Sep 2026 and lets it tick,
  so the cutoff countdown moves and 16:00 flips the screen to the after-cutoff
  frames. Without it the clock is real time.
- `?state=` picks a frame. Absent: the hero orders are already received (S1.3).
  `form` starts with nothing placed (S1.1). `offline`, `queued`, `error`,
  `sending` and `empty` force S1.5 A (before and after tapping), B, C and D.

Examples: `?at=15:38&state=form` (S1.1), `?at=15:48&state=form` (S1.1 B),
`?at=16:07&state=form` (S1.4), `?at=15:40` (S1.3). S1.6 is the same URL in a
window 1024 px or wider.

This branch tracks **PRD v2.1** (`waypoint-prd-v2.1.md` at the repo root,
which supersedes `claude/waypoint-prd-v2.md`) and its companion
`waypoint-central-context-v2.1.md`. See "Departures" below for the one gap
(S4) found while reconciling this branch against v2.1.

### Phase list

| Phase | What lands | Status |
|---|---|---|
| 1 | Vite, React and TypeScript scaffold; tokens.css; base.css; fonts; Radix and fontsource dependencies | Done |
| 2 | Shared primitives: Button, StatusPill, Tag, Alert, Card, Sheet, Modal, Toast, TopBar, AppBar, TabBar, ConnectivityBar, StateScreen, JourneyTimeline, Facts, DataTable | Done |
| 3 | Order types, the 11 statuses and `statusLabel`, the `StoreApi` interface and mock with the hero fixture, cutoff and arrival-range rules | Done |
| 4 | S1 Place order: all 15 frames (S1.1, S1.1 B, S1.2, S1.3, S1.3 B-D, S1.4, S1.4 B, S1.5 A-D, S1.6, S1.6 B), edit and cancel until 16:00, after cutoff, offline, error, sending, empty, desktop form, review modal and desktop recent-orders table. Pulled from Figma section `442:22594` on 30 Sep before starting; see the note below | Done |
| 5 | S2 Deliveries: every state, Under review card, deferral notices, OUT009, recent orders, desktop | Not started |
| 6 | S3 Receipt and the Issues tab: confirm, shortfall, issue sheet, Dispatch asks, the open-review branch, states | Not started |
| 6b | S4 Updates and history: unread feed grouped by day (Order/Plan/Delivery/Deferral/Review tags, each row opens its source S1/S2 frame), History tab with All/Deferred/Partial filters, bell-icon entry point with unread count, states. Added to the phase plan 30 Sep after finding it built in Figma but missing from the PRD text (gap G-10) | Not started |
| 7 | Routes, the state gallery, the scenario clock | Not started |
| 8 | README update and a final lint, type and build pass | Not started |

### Departures from the Figma design

S1 (phase 4) is built; S2 to S4 are not. Every visual or copy difference
between a built S1 frame and its Figma frame, with its reason:

- **The Updates bell is on every S1 screen, not just the three that have it.**
  Figma draws "Bell · Updates · plain" on S1.1, S1.1 B and S1.3 only (the other
  12 phone frames and the desktop app bar on S1.6 have none). That looks like
  a partial patch when S4 was added, not a decision, and a bell that vanishes
  on the error and offline screens would strand the entry point to S4, so it
  is in the shared top bar and app bar everywhere. It is drawn plain (no
  unread dot), as in Figma, until S4 (phase 6b) supplies a count. It links to
  `/store/updates`, which is not routed until phase 7. The earlier note below
  that said the bell is on every S1 frame was wrong. Needs a spec-owner call.
- **The cutoff countdown is live, so it differs from two static frames.**
  S1.3 B (15:42) and S1.3 D (15:45) both read "20 min left" in Figma; 16:00
  minus those times is 18 and 15. Built as computed from the clock.
- **Recent orders follows the frame, not PRD A35.** S1.6 shows Thu 24 Sep as
  "Deferred · policy" (1 order) and Fri 25 Sep as Delivered. PRD 4d A35 says
  Fri 25 was the deferred day and lists delivery times and a Mon 21 partial;
  the frame shows only date, order count and status. Figma is judged, so the
  frame wins; A35 needs correcting (noted in the PRD register).
- **Desktop has frames for the form and the review modal only.** After
  placing, editing, cancelling or after the cutoff on desktop, the phone
  content is shown in a centred 480 px column under the app bar, since no
  wide frame exists for those states.
- **Primitive-level differences, inherited from phase 2:** the sync chip is
  filled where Figma outlines it; alert body text is 13 px where Figma uses
  15 px; the "What happens next" dots are 24 px with regular-weight pending
  labels where Figma's are smaller and heavier; Sheet and Modal carry a close
  button that S1.2 and S1.6 B do not draw. Each is a small change in the
  primitive if the team wants an exact match, and would then apply to S2 and
  S3 as well.
- **Frames with no inbound link stay that way.** S1.5 B (error) and S1.5 D
  (no orders yet) are orphans in Figma (PRD gap G-3). Error is reachable for
  real when the API rejects; "no orders yet" appears via `?state=empty` and
  the phase 7 gallery. Cancelling shows S1.3 D, the same screen with its own
  wording.

Copy and behaviour Figma does not draw, added because the flow needs it (also
in PRD 4d, A37): "Orders closed at 16:00 / This order can no longer be edited
or cancelled." when an edit or cancel is refused as the cutoff passes; "Place 1
order" and a disabled "Place orders" when fewer than two, or no, orders are
filled in; a line lowered to 0 is cancelled on Save changes, and Save is
disabled when both are 0; "Cancel order" cancels both orders with no confirm
step, as drawn. After the cutoff the order form shows the hero quantities (12
and 8) read-only, as S1.4 draws it, with no stepper.

### Notes from pulling the S1 Figma frames (30 Sep, before phase 4)

Pulled Figma section `442:22594` ("S1 · Place order: Anusha · OUT084 ·
Kandy", all 15 frames plus its rationale card) to check the PRD table's
frame list against the actual designs before writing phase 4 code. Two
findings that change scope:

- **The bell icon (Updates entry point for S4) belongs in the shared `TopBar` /
  `AppBar`**, not in S4 alone, with an unread-count dot, and should render on
  S2 and S3 too once they're built. Phase 4 added the optional bell slot.
  *Correction (phase 4):* this note first said the bell is in the topbar on
  every S1 frame. Checking the frames again, only S1.1, S1.1 B and S1.3 draw
  it; see "Departures" above.
- **S1.6 (desktop) shows a "Recent orders" table** (Sat 26 Sep down to
  Tue 22 Sep, Sunday skipped, one row per day with order count and status)
  that duplicates data S4's History tab will also need. `StoreApi`
  (phase 3) has no method for this yet — phase 4 needs to add one (e.g.
  `listRecentOrders`) rather than inventing a second, separate data path
  for phase 6b later.

Exact copy worth preserving verbatim in the build (not paraphrasing). Figma
layer names are cut at about 40 characters, so a long string read from the
layer list can be missing its end ("...plan is released" is really "...plan is
released at 23:40"); check long strings against the rendered frame:
"Orders close at 16:00 · N min left", "Received HH:MM", "Counts for Tue
29 Sep.", "You can edit until 16:00", "Arrival time is shown after the
plan is released at 23:40", the "What happens next" timeline (Confirmed 16:00 →
Arrival time shared 23:40 → Delivery window 05:30-08:00), and the
per-order estimate line "≈ NN kg · N.N m³" which scales with the unit
stepper (12 units ≈ 70 kg / 0.7 m³ down to 10 units ≈ 58 kg / 0.6 m³ on
S1.3 B), confirming kg/m³ must be computed live from the stepper, not
just carried as static fixture values.

### Assumptions and data notes

- **PRD v2 assumption A1** (operating day Tue 29 Sep 2026) cannot be checked
  against the shipped `calendar.csv`: that file runs 2024-01-01 to
  2026-06-28 and does not reach September 2026. Every non-operating day in
  the covered range is a Sunday, which matches the booklet's Monday to
  Saturday schedule, so the hero date is treated as an operating day on
  that basis rather than a dataset lookup. See PRD v2 section 4d, A1, for
  the full note. This does not affect any screen or rule, since operating
  days follow the weekday rule, not a calendar row.
- **Scenario clock is interim until phase 7.** `createMockStoreApi` takes a
  `now: () => Date` function so its cutoff and arrival-release checks follow
  a scenario clock. Phase 4 needed the clock to check the frames, so
  `frontend/src/app/scenarioClock.ts` reads `?at=HH:MM` (Mon 28 Sep 2026,
  ticking) on `/store/orders` only; phase 7 owns the real one and replaces it.
- **Estimates scale from the hero orders.** kg and m³ are computed from the
  unit count at 70 kg / 0.7 m³ per 12 chilled units and 45 kg / 0.6 m³ per 8
  dry units, kg rounded to a whole number and m³ to 0.1. This reproduces S1.3
  B (10 units is about 58 kg / 0.6 m³). Recorded as A36 in the PRD register.
- **`createMockStoreApi(now, { seed })`.** `seed: "placed"` (default) holds the
  hero orders already received at 15:40; `seed: "empty"` holds nothing, so S1.1
  can be walked through, and the first chilled and dry orders placed for the
  outlet take the hero IDs ORD2001 and ORD2002.

### Shared files this role has changed

- `frontend/src/components/chrome/TopBar.tsx`, `AppBar.tsx`,
  `PhoneLayout.tsx` and new `BellButton.tsx`: an optional `bell` slot (the
  Updates bell with an unread-count dot). Additive; omit it and nothing changes.
- `frontend/src/components/chrome/PhoneLayout.module.css`: the pinned action
  bar now sticks above the tab bar (it overlapped it on long pages).
- `frontend/src/components/ui/JourneyTimeline.tsx`: optional
  `metaAlign="right"` (default unchanged), for S1's timeline times.
- `frontend/src/components/ui/UnitStepper.tsx`: `disabled || at limit` in place
  of `disabled ?? at limit`, which never stopped the stepper at its min or max
  when a caller passed `disabled={false}`.
- `frontend/src/components/ui/Toast.module.css`: on the phone the toast floats
  above the tab bar, as on S1.3.
- `frontend/src/components/ui/Icon.tsx`: added `bell` and `circle-check`.
- `frontend/src/domain/schedule.ts`: exported `addDays` and `toIsoDate`; added
  `isAfterCutoff` and `nextOperatingDayAfter`. Existing rules unchanged.
- `frontend/src/domain/order.ts`, `api/StoreApi.ts`, `api/mockStoreApi.ts`:
  `listRecentOrders` (for S1.6 now, S4 History later), `placeOrders` (chilled
  and dry go in together or not at all), `Order.updatedAt`, and the mock's
  `seed` option. The `afterCutoff` field now means "placed after the cutoff
  for its day, so it rolled to the following run"; the mock previously set it
  from the wrong date.

- `frontend/src/styles/tokens.css`: copied from `feature/dispatcher-frontend`
  unchanged, then checked against the live Figma variable collection. No
  values changed. Appended the type, space and size scale from PRD v2
  section 6, additive only.
- `frontend/tsconfig.app.json`: matches the dispatcher branch's strictness
  settings (no `noUncheckedIndexedAccess` or `exactOptionalPropertyTypes`,
  which fight CSS Modules' generated types).
- `frontend/tsconfig.node.json`: **not yet reconciled.** This branch sets
  `"module": "esnext"` with `"moduleResolution": "bundler"`; the dispatcher
  branch sets `"module": "nodenext"` with no resolution override. Both
  compile `vite.config.ts` today, so this is not blocking, but the two
  should be aligned before the branches share a `tsconfig.node.json`.

Dependency versions in `frontend/package.json` are pinned to match
`feature/dispatcher-frontend` exactly where both branches use a package, so
the two merge without a version conflict. Two exceptions: this role adds
`@radix-ui/react-dialog` and `@radix-ui/react-toast` (not yet used on the
dispatcher branch), and uses `@fontsource-variable/archivo` in place of the
dispatcher's `@fontsource/archivo`, per this build's font requirement.

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
