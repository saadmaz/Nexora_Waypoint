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

**Status:** in progress. Phases 1 to 6 are done; phases 6b, 7 and 8 are not started.

### How to run

```bash
cd frontend
npm install
npm run dev
```

`/store/orders` (S1, phase 4), `/store/deliveries` and
`/store/deliveries/:date` (S2, phase 5), and `/store/deliveries/:date/receipt`
and `/store/issues` (S3, phase 6) are routed so far. The rest of the route set
lands in phase 6b (`/store/updates`, `/store/history`, S4) and phase 7, with a
dev-only state gallery at `/store/_states` and the scenario clock.

Until then the screens take interim query params, read once when the app opens
(`frontend/src/app/StoreProvider.tsx`; phase 7 replaces them):

- `?at=HH:MM` starts the clock at that time and lets it tick, so the cutoff
  countdown moves, 16:00 flips S1 to the after-cutoff frames and every S2
  status follows the hero timeline. Without it the clock is real time.
- `?date=YYYY-MM-DD` is the day the clock starts on. Default Mon 28 Sep 2026,
  so `?at=16:01` is the hero evening; the early-morning frames need
  `&date=2026-09-29`.
- `?state=` picks an S1 frame. Absent: the hero orders are already received
  (S1.3). `form` starts with nothing placed (S1.1). `offline`, `queued`,
  `error`, `sending` and `empty` force S1.5 A, B, C and D; `empty` also leaves
  S2 with no orders (S2.S A).
- S2, S3 and the Issues tab: `?preview=loading|error|offline` forces S2.S B, D
  and C and S3.S B, D and C. S2 also takes `?outlet=OUT009` (S2.9). The receipt
  takes `?preview=asked` (S3.5) and `?report=1` (opens the report sheet).

S1 examples: `?at=15:38&state=form` (S1.1), `?at=15:48&state=form` (S1.1 B),
`?at=16:07&state=form` (S1.4), `?at=15:40` (S1.3). S1.6 is the same URL in a
window 1024 px or wider.

S2 examples (each frame is a clock time, not a page; D = `2026-09-29`):

| Frame | URL |
|---|---|
| S2.10 list | `/store/deliveries?at=23:41` |
| S2.1 confirmed | `/store/deliveries/D?at=16:01` |
| S2.2 planned + arrival | `/store/deliveries/D?at=23:41` |
| S2.3 loaded | `/store/deliveries/D?at=04:51&date=D` |
| S2.4 on the way | `/store/deliveries/D?at=05:11&date=D` |
| S2.5 driver out of coverage | `/store/deliveries/D?at=05:19&date=D` |
| S2.6 deferred at your request | `/store/deliveries/D?at=05:22&date=D` |
| S2.7 under review | `/store/deliveries/D?at=06:41&date=D` |
| S2.8 delivered + deferral withdrawn | `/store/deliveries/D?at=06:45&date=D` |
| S2.9 OUT009 deferred by policy | `/store/deliveries/D?at=03:01&date=D&outlet=OUT009` |
| S2.11 desktop | `/store/deliveries/D?at=07:28&date=D` in a window 1024 px or wider |

S3 examples (R = `/store/deliveries/D/receipt`; the flows are taps, not URLs):

| Frame | URL and taps |
|---|---|
| S3.1 to confirm | `R?at=07:28&date=D` |
| S3.1 B shortfall | the same, then tap minus twice on ORD2001 (10 of 12) |
| S3.2 confirmed | the same, then Confirm receipt |
| S3.3 report sheet | the same, then Report issue |
| S3.4 issue reported | the sheet, then Send to Dispatch |
| S3.5 Dispatch asks | `R?at=06:41&date=D&preview=asked` |
| S3.6 confirmed, review open | `R?at=06:41&date=D`, then Confirm receipt |
| S3.7 Issues tab | `/store/issues?at=07:35&date=D` (after an issue: the Issues tab) |
| S3.S A empty | `R?at=16:01` (nothing delivered yet) |
| S3.S B, D, C | `R?at=07:28&date=D&preview=loading`, `error`, `offline` |

This branch tracks **PRD v3** (`waypoint-prd-v3.md` at the repo root, which
supersedes v2.1) and its companion `waypoint-central-context-v3.md`. Where
the Figma frames and the spec differ, v3's source ranking applies (Figma wins
on UI and copy, the spec on behaviour and data), and every visible difference
is listed under "Departures" below with its v3 register number where there
is one.

### Phase list

| Phase | What lands | Status |
|---|---|---|
| 1 | Vite, React and TypeScript scaffold; tokens.css; base.css; fonts; Radix and fontsource dependencies | Done |
| 2 | Shared primitives: Button, StatusPill, Tag, Alert, Card, Sheet, Modal, Toast, TopBar, AppBar, TabBar, ConnectivityBar, StateScreen, JourneyTimeline, Facts, DataTable | Done |
| 3 | Order types, the 11 statuses and `statusLabel`, the `StoreApi` interface and mock with the hero fixture, cutoff and arrival-range rules | Done |
| 4 | S1 Place order: all 15 frames (S1.1, S1.1 B, S1.2, S1.3, S1.3 B-D, S1.4, S1.4 B, S1.5 A-D, S1.6, S1.6 B), edit and cancel until 16:00, after cutoff, offline, error, sending, empty, desktop form, review modal and desktop recent-orders table. Pulled from Figma section `442:22594` on 30 Sep before starting; see the note below | Done |
| 5 | S2 Deliveries: all 15 frames (S2.1 to S2.11, S2.S A to D), each derived from the scenario clock along the hero timeline; Under review card, deferral notices, OUT009's view, Recent, desktop with proof of delivery. Pulled from Figma section `442:24402` on 30 Sep | Done |
| 6 | S3 Receipt and the Issues tab: all 12 frames (S3.1, S3.1 B, S3.2 to S3.7, S3.S A to D) at `/store/deliveries/:date/receipt` and `/store/issues`: confirm, shortfall with a reason, report-an-issue sheet, Dispatch asks, confirmed while the review is open, offline confirmation saved on the phone. The `Issue` type now uses the store's issue types. Pulled from Figma section `442:26109` on 30 Sep | Done |
| 6b | S4 Updates and history: unread feed grouped by day (Order/Plan/Delivery/Deferral/Review tags, each row opens its source S1/S2 frame), History tab with All/Deferred/Partial filters, bell-icon entry point with unread count, states. Added to the phase plan 30 Sep after finding it built in Figma but missing from the PRD text (gap G-10) | Not started |
| 7 | Routes, the state gallery, the scenario clock | Not started |
| 8 | README update and a final lint, type and build pass | Not started |

### Departures from the Figma design

S1 to S3 (phases 4 to 6) are built; S4 is not. Every visual or copy
difference between a built frame and its Figma frame, with its reason:

- **The Updates bell is on every S1 screen (v3 DP-06, gap G-12).** Figma
  draws "Bell · Updates · plain" on S1.1, S1.1 B and S1.3 only (the other 12
  phone frames and the desktop app bar on S1.6 have none). v3 settles this:
  the bell is on every store screen, phone and desktop. It is drawn plain (no
  unread dot), as in Figma, until S4 (phase 6b) supplies a count. It links to
  `/store/updates`, which is not routed until phase 7.
- **The cutoff countdown is live, so it differs from two static frames
  (v3 Q14).** S1.3 B (15:42) and S1.3 D (15:45) both read "20 min left" in
  Figma; 16:00 minus those times is 18 and 15. Built as computed from the
  clock. Not yet in the v3 departures register; suggest DP-16.
- **Recent orders follows A35, not the frame (v3 DP-05, V25).** S1.6 draws Thu
  24 Sep as "Deferred · policy" (1 order) and Fri 25 Sep as Delivered. A35
  says Fri 25 was the deferred day and Thu 24 was delivered, and v3 says A35
  wins, so the mock lists Fri 25 as Deferred · policy and Thu 24 as
  Delivered. Order counts are the frame's, moved with their rows (Fri 25 shows
  1, Thu 24 shows 2). The frame shows only date, order count and status, so
  A35's delivery times are not used here.
- **Desktop has frames for the form and the review modal only.** After
  placing, editing, cancelling or after the cutoff on desktop, the phone
  content is shown in a centred 480 px column under the app bar, since no
  wide frame exists for those states.
- **Primitive-level differences, inherited from phase 2:** Sheet and Modal
  carry a close button that S1.2 and S1.6 B do not draw. *Fixed in phase 5,
  once, in the shared primitives (see "Shared files"):* the sync chip is now
  outlined; alert body text is 15 px; the journey dots are 12 px with an amber
  current marker; the pinned bar is white; the connectivity bar is the dark
  bar with an amber icon; state screens use the 64 px tile; the desktop nav
  is text with an amber underline; the top bar's outlet line is 22 px so the
  bar is 56 px tall.
- **S2.10 and the Fri 25 / Thu 24 swap (v3 DP-05, G-10, A35).** Figma S2.10
  draws Thu 24 as "Deferred · policy" and Fri 25 as "Delivered 05:38"; the
  build swaps them, and moves the order count and delivery time with their
  rows: Fri 25 Sep is "1 order, Deferred · policy → served next day", Thu 24
  Sep is "2 orders, Delivered 05:38".
- **S2.10 summary card wraps.** "ORD2001 · ORD2002 · arrives from 05:30" sits
  on the pill's row in Figma but overflows the card at 390 px, so it wraps to
  a second line here.
- **The Updates bell shows on S2.9, S2.S A to D and the S2 desktop bar (v3
  DP-06, G-12).** Figma omits it there. It is drawn plain; the unread count
  (S2.6 to S2.8 draw a dot with no number) lands with S4 in phase 6b.
- **The Offline sync chip is in Archivo, not Plex Mono.** With the bell (DP-06)
  a mono "Offline" pushes the outlet name into an ellipsis on a 390 px bar.
- **S2.S C shows the saved summary only.** Offline, the card keeps the orders and
  the "On the way" tile and drops the receivers cue, the coverage line and
  the journey, as the frame does; the bar reads "Showing deliveries as of
  HH:MM, reconnect for updates." with the time the screen last loaded.
- **S2.11 has no Recent table in Figma.** The build adds the S1.6 table under the
  delivery card. Where the phone has a frame the desktop lacks (deferral, the
  review question, the states), the phone content is shown in a centred
  480 px column under the app bar, as on S1.
- **The receipt's top bar truncates its title.** "Receipt · ORD2001 + ORD2002"
  fits Figma's bar, which has no bell; with the Updates bell on every screen
  (DP-06) it shows "Receipt · ORD2001 + O…". Both IDs are on the page.
- **The unit stepper's plus is disabled at the expected count** (S3.1 draws it
  enabled). You cannot receive more than was delivered.
- **The Issues tab lists reported issues, which Figma does not draw** (S3.7 is
  the empty tab only). A row shows the order IDs, the issue tag, "2 units short"
  and "Dispatch will follow up."; it opens that day's receipt. The "Issues"
  heading shows only when there is a list, as the empty frame has none.
- **"Confirm with a shortfall" opens a small reason sheet** (Missing, Damaged,
  Wrong item, Other) before it sends. The S3 rationale says it asks for a reason;
  no frame draws it.
- **The photo is a placeholder.** The POD photo is the camera tile, and "Add
  photo" on the report sheet only marks a photo as attached; the prototype has
  no photo store.
- **S3.5 needs Dispatch to have asked.** That is the dispatcher's "Review with
  store first", which this build does not have, so S3.5 is shown with
  `?preview=asked` and in the gallery. S2.7's own "Yes, we received it" and
  "Report issue" do the same job on the phone.
- **S2.9's headline is kept as drawn.** "Tomorrow's chilled order moved to
  Wednesday" is shown at 03:01 on the run day, where "today's" would read
  more naturally; Figma wins on copy.
- **Times in body text are Plex Mono at the surrounding weight.** Figma sets
  them at 500; the shared `Mono` inherits, so a time in 400-weight text looks
  a little lighter.
- **Confirm receipt and Report issue lead to the S3 route,** which is not built
  until phase 6; until then they land on `/store/orders`.
- **Frames with no inbound link stay that way.** S1.5 B (error) and S1.5 D
  (no orders yet) are orphans in Figma (PRD gap G-3). Error is reachable for
  real when the API rejects; "no orders yet" appears via `?state=empty` and
  the phase 7 gallery. Cancelling shows S1.3 D, the same screen with its own
  wording.

Copy and behaviour Figma does not draw, added because the flow needs it (also
in PRD v3 4d, A43 for S1 and A44 to A48 for S2, listed under "Assumptions"): "Orders closed at 16:00 / This order can no longer be edited
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
  (phase 3) had no method for this; phase 4 added `listRecent` (the v3 name),
  so phase 6b reads the same data instead of a second data path.

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
- **Estimates scale from per-unit factors the API supplies.** `getOrderDraft`
  returns kg and m³ per unit for each kind; the screen multiplies by the
  stepper's count, kg rounded to a whole number and m³ to 0.1. The mock's
  factors spread the hero orders evenly (70 kg / 0.7 m³ per 12 chilled units,
  45 kg / 0.6 m³ per 8 dry), which reproduces S1.3 B (10 units is about
  58 kg / 0.6 m³). Recorded as A42 in PRD v3 4d; the real backend supplies
  per-outlet factors (A14).
- **S2 follows the clock and the record (PRD v3 handoff 14).**
  `listDeliveries` derives each day's status from the scenario clock along the
  hero timeline: 16:00 Confirmed, 23:40 Planned with the arrival range,
  04:50 Loaded, 05:10 Departed, 05:17 driver out of coverage (a muted line),
  05:21 Deferred · store request, 06:40 Under review, 06:44 Delivered with
  Deferral withdrawn. The timeline applies to ORD2001 and ORD2002 for Tue 29
  Sep; any other day advances only to Confirmed and Planned. Nothing uses a
  timer: the screen re-reads on each minute of the clock. The store's own
  writes (Got it, "Yes, we received it", the receipt) are held per delivery
  day in the mock.
- **S3 keeps the receipt with the delivery (PRD v3 handoff 10).** `confirmReceipt`
  takes the count per order and an optional reason; fewer than delivered makes
  that order Partial (A28: 10 of 12). `reportIssue` takes an issue type, the
  affected orders and units, an optional note and photo; the order becomes Issue
  with its tag. Neither changes the delivery's stage, so the clock still decides
  Delivered. While the review is open (Under review) the status stays Dispatch's
  and only the "Receipt confirmed" tag and the issue tag are added.
- **The `Issue` type was replaced in phase 6.** Phase 3 had the driver's R6 road
  and breakdown reasons; the store's are Missing, Short, Damaged, Wrong item,
  Late, Arrived warm and Other (PRD v3 4b). "Short" is not a button on the
  sheet: a Missing report on part of an order tags it Short.
- **A49 (30 Sep, store build, phase 6).** The report sheet opens with Missing
  chosen, the first order selected and 2 units (S3.3 draws 2 of 12); "Missing"
  on part of an order is tagged Short (S3.4).
- **A50.** "Confirm with a shortfall" asks for a reason on a sheet (Missing,
  Damaged, Wrong item, Other) before sending. The order becomes Partial, and the
  receipt shows "ORD2001 · 10 of 12 units received · Missing".
- **A51.** S3.5 appears only when Dispatch has asked the store. On the receipt
  route under review, with no ask, the store sees S3.1 with "Why you're seeing
  this" and can Confirm receipt, which shows S3.6 ("No action needed from you");
  the review stays open. S2.7's "Yes, we received it" settles the delivery for
  the store (A47).
- **A52.** A receipt confirmed offline is saved on the phone with the phone's
  time (S3.S C) and sent when the connection returns; reporting an issue needs a
  connection. The Issues tab rows (S3.7 draws only empty) are described under
  Departures.
- **A44 (30 Sep, store build, phase 5).** The delivery day the Deliveries tab
  looks at is today until 08:00 (the run is over) and otherwise the next
  operating day (`deliveryDayFor`); S2.S A's "No deliveries scheduled for Tue
  29 Sep" uses it. The interim clock takes `?date=`.
- **A45.** The journey shows only the steps reached, behind "Show all steps",
  while two or fewer are reached (S2.1); from Planned every step is listed
  (S2.2 to S2.8). Ordered and Confirmed are green; the amber marker starts at
  Planned; once Delivered, Receipt confirmed is the amber step (it waits on
  the store), as S2.8 and S2.11 draw it.
- **A46.** After Got it on a deferral, the button becomes a disabled "Dispatch
  has seen this" (Figma draws no after-state). The S2.6 caption "Dispatch sees
  when you tap Got it." is shown for store-request deferrals only, as the
  frames do.
- **A47.** Answering "Yes, we received it" on S2.7 settles the delivery for
  the store at once: Delivered 05:42 with Deferral withdrawn (S2.8), without
  waiting for Dispatch at 06:44. The review stays Dispatch's to close.
- **A48.** S2 wording Figma does not draw: an Ordered day reads "Confirmed at
  16:00 when orders close." (S1's line); the S2.10 summary card's second line
  reads "arrives from HH:MM", "delivered HH:MM", "next run Wed 30 Sep",
  "Dispatch is reviewing" or "arrival time follows" by status; a deferred
  day's pill on that card carries its type and next run.
- **OUT009 (S2.9).** The mock holds one order for OUT009, ORD1002 (chilled, 35
  units, window 04:00 to 07:45, PRD v3 4c), deferred by policy at 03:00 by
  Kumari. Only OUT084 can place orders.
- **`createMockStoreApi(now, { seed })`.** `seed: "placed"` (default) holds the
  hero orders already received at 15:40; `seed: "empty"` holds nothing, so S1.1
  can be walked through, and the first chilled and dry orders placed for the
  outlet take the hero IDs ORD2001 and ORD2002.

### Shared files this role has changed

Phase 6:

- `components/ui/UnitStepper.tsx`: `expected` reads "/ 12" (was "of 12"), the
  amber shortfall fill is gone (S3.1 B draws none), and a `compact` size (44 px
  buttons) for the receipt row.
- `components/ui/Sheet.tsx` and `.module.css`: the close button is out of the
  flow, so the header is as tall as the title as in Figma, and focus goes to the
  sheet on open (no ring on the close button).
- `components/ui/Facts.module.css`: no default `dl`/`dd` margins.
  `components/ui/Icon.tsx`: `inbox` and `store`.
- `components/chrome/TopBar.tsx`, `PhoneLayout.tsx`: optional `placeMono` (the
  receipt's second line in Plex Mono).
- `domain/issue.ts` (new), `domain/delivery.ts` (`issues`, per-order `issue` and
  `received`, `receiptBy`), `api/StoreApi.ts` and `mockStoreApi.ts`:
  `confirmReceipt`, `reportIssue` and `listIssues` take and return the S3 shapes;
  the phase 3 `Issue` and `ConfirmReceiptInput` types are gone.

Phase 5 (each in its own commit, before the screens that use it):

- `components/ui/JourneyTimeline.tsx` and `.module.css`: 12 px dots (green
  reached, amber current with an ink ring, hollow pending), short connectors,
  meta in Archivo so callers wrap times in `<Mono>`; the horizontal variant
  (S2.11) lines the dots up on one rail. `ReceivedView` (S1) wraps its times.
- `components/ui/Icon.tsx`: added `info`, `image`, `arrow-right`.
- `components/ui/Alert.module.css`: body text 15 px. `Facts.tsx`: `ruled`
  variant. `StateScreen.module.css`: 64 px tile, 22 px title, centred action.
- `components/chrome/PhoneLayout.tsx`: optional `outlet` and `place` (S2.9 is
  OUT009's view). `PhoneLayout.module.css`: white pinned bar.
- `components/chrome/TopBar.module.css`: outlined sync chip (Offline keeps it
  outlined with an amber icon), 22 px outlet line. `ConnectivityBar`: dark
  bar with an amber icon, and its text is one flex item so inline times do not
  split. `AppBar`: text nav with an amber underline, "Waypoint" in bold.
- `domain/delivery.ts` (new), `domain/order.ts` (`RecentOrderDay` gains
  `deliveredAt`, `shortUnits`, `servedNextDay`), `domain/schedule.ts`
  (`deliveryDayFor`).
- `api/StoreApi.ts`, `mockStoreApi.ts`, new `mockDeliveries.ts`:
  `listDeliveries`, `acknowledgeDeferral` and `answerReceivedQuestion`;
  `listRecent(outletId, { limit, before })` now lists Mon 28 to Mon 21 per A35
  (S1.6 passes `before` = today so its list is unchanged).
- `app/StoreContext.ts`, `StoreProvider.tsx`, `scenarioClock.ts`, `App.tsx`,
  `screens/orders/OrdersRoute.tsx`: one API and one clock for every route.

Phase 4:

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
  StoreApi now uses the PRD v3 operation names where v3 fixes them:
  `getOrderDraft` (window, dock, unit factors, starting quantities and the
  day's placed orders, in place of `listOrders` and `getOrder`), `placeOrders`
  (chilled and dry go in together or not at all; replaces `placeOrder`) and
  `listRecent` (for S1.6 now, S4 History later). `editOrder`, `cancelOrder`,
  `confirmReceipt`, `reportIssue` and `listIssues` are unchanged; the rest of
  v3's StoreApi arrives with its phase. Also `Order.updatedAt` and the mock's
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
