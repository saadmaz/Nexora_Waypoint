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

**Status:** in progress. Phases 1 to 3 are done; phases 4 to 8 are not started.

### How to run

```bash
cd frontend
npm install
npm run dev
```

The store role is not yet routed (phase 7). Once routed, it will live at
`/store/orders`, `/store/deliveries`, `/store/deliveries/:date/receipt`,
`/store/issues` and `/store/updates` (S4, phase 6b), with a dev-only state
gallery at `/store/_states` and a `?at=HH:MM` scenario clock.

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
| 4 | S1 Place order: all 15 frames (S1.1, S1.1 B, S1.2, S1.3, S1.3 B-D, S1.4, S1.4 B, S1.5 A-D, S1.6, S1.6 B), edit and cancel until 16:00, after cutoff, offline, error, sending, empty, desktop form, review modal and desktop recent-orders table. Pulled from Figma section `442:22594` on 30 Sep before starting; see the note below | Not started |
| 5 | S2 Deliveries: every state, Under review card, deferral notices, OUT009, recent orders, desktop | Not started |
| 6 | S3 Receipt and the Issues tab: confirm, shortfall, issue sheet, Dispatch asks, the open-review branch, states | Not started |
| 6b | S4 Updates and history: unread feed grouped by day (Order/Plan/Delivery/Deferral/Review tags, each row opens its source S1/S2 frame), History tab with All/Deferred/Partial filters, bell-icon entry point with unread count, states. Added to the phase plan 30 Sep after finding it built in Figma but missing from the PRD text (gap G-10) | Not started |
| 7 | Routes, the state gallery, the scenario clock | Not started |
| 8 | README update and a final lint, type and build pass | Not started |

### Departures from the Figma design

None yet in the sense of a built screen rendering differently from its
frame — no store screens are built (phases 4 to 6b are not started). One
spec-vs-prototype gap was found and corrected in the docs, not the design:

- **S4 "Updates and history" was missing from the PRD text.** The screen
  is fully built in Figma (section node `589:32`: frames S4.1, S4.1 B,
  S4.2, S4.S, with its own rationale card) but PRD v2.1's screen inventory,
  section 5 handoffs and the store tab-bar description never mentioned it.
  This is logged as gap G-10 in `waypoint-prd-v2.1.md` section 7, with a
  30 Sep addendum reconciling it from the Figma frames directly (two tabs:
  Updates, an unread-first feed grouped by day; History, past delivery
  days Mon-Sat with All/Deferred/Partial filters; entered from a bell
  icon, not the tab bar). That reconciliation has **not** had spec-owner
  sign-off — flag it alongside the other section-7 gaps. Added to this
  branch's phase list as phase 6b.

This section will otherwise list every visual or copy difference between a
built screen and its Figma frame as each screen lands, with its reason,
per the booklet's fidelity requirement.

### Notes from pulling the S1 Figma frames (30 Sep, before phase 4)

Pulled Figma section `442:22594` ("S1 · Place order: Anusha · OUT084 ·
Kandy", all 15 frames plus its rationale card) to check the PRD table's
frame list against the actual designs before writing phase 4 code. Two
findings that change scope:

- **The bell icon (Updates entry point for S4) is in the topbar on every
  S1 frame**, not just on S4. It belongs in the shared `TopBar` / `AppBar`
  component from phase 2, with an unread-count dot, and should render on
  S1, S2 and S3 too once they're built. Phase 2's `TopBar` will need a
  small addition (an optional bell slot) when phase 4 starts, rather than
  being S4-only as first assumed.
- **S1.6 (desktop) shows a "Recent orders" table** (Sat 26 Sep down to
  Tue 22 Sep, Sunday skipped, one row per day with order count and status)
  that duplicates data S4's History tab will also need. `StoreApi`
  (phase 3) has no method for this yet — phase 4 needs to add one (e.g.
  `listRecentOrders`) rather than inventing a second, separate data path
  for phase 6b later.

Exact copy worth preserving verbatim in the build (not paraphrasing):
"Orders close at 16:00 · N min left", "Received HH:MM", "Counts for Tue
29 Sep.", "You can edit until 16:00", "Arrival time is shown after the
plan is released", the "What happens next" timeline (Confirmed 16:00 →
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
- **Scenario clock deferred to phase 7.** `createMockStoreApi` (phase 3)
  takes a `now: () => Date` function so its cutoff and arrival-release
  checks can be driven by the `?at=HH:MM` scenario clock later, but nothing
  reads that query param yet — the mock defaults to real time until routing
  (phase 7) wires it up.

### Shared files this role has changed

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
