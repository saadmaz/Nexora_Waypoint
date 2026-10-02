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

**Status:** done for the hackathon scope: all four phases of the store frontend (S1 to S4) are built, verified and documented. Folder layout follows PRD v3 (see "Folder layout").

### How to run

```bash
cd frontend
npm install
npm run dev
```

Routes (PRD v3 section 15), everything else goes to `/store/orders`:

| Route | Screen |
|---|---|
| `/store/orders` | S1 Place order |
| `/store/deliveries`, `/store/deliveries/:date` | S2 Deliveries (the list, S2.10; one day) |
| `/store/deliveries/:date/receipt` | S3 Receipt |
| `/store/issues` | S3.7 Issues tab |
| `/store/updates`, `/store/history` | S4 Updates and history, entered from the bell |
| `/store/_states` | The state gallery (dev only; nothing links to it) |

**The state gallery.** `/store/_states` shows every frame of S1 to S4 at its Figma
size, labelled with its frame name, each in its own iframe so its media queries
and clock are its own. `/store/_states?frame=s2.3` renders one frame full screen
(ids are lower case: `s1.3b`, `s2.sc`, `s3.1b`, `s4.1`). A frame is a state of its
screen, not a page: each is a route, a scenario time, and where a tap cannot be
avoided a preview or preset, listed in
`frontend/src/screens/store/gallery/frames.ts`.

**The scenario clock.** One clock for the whole app
(`frontend/src/app/scenarioClock.ts`), read through one `useNow()`; nothing else
reads the wall clock. Mock mode reads two query parameters when the app opens,
and the clock then ticks from there:

- `?at=HH:MM` starts the clock at that time. The hero timeline runs Mon 15:30
  to Tue 07:35, so a bare time belongs to one day: **before 08:00 is Tue 29 Sep,
  08:00 and later is Mon 28 Sep**. `?at=16:01` is the evening the orders
  close; `?at=05:22` is the morning the delivery is deferred.
- `?date=YYYY-MM-DD` overrides the day.
- Without `?at=` the clock is real time.

Other parameters, all interim to the mock and read by
`frontend/src/app/StoreProvider.tsx`:

- `?state=` (S1 and the empty frames): absent, the hero orders are already
  received (S1.3); `form` starts with nothing placed (S1.1); `review`, `edit`
  (10 units), `cancelled`, `offline`, `queued`, `error`, `sending` and `empty`
  force S1.2 and S1.6 B, S1.3 B, S1.3 D and S1.5 A to D. `empty` also leaves S2,
  S3 and S4 with no orders.
- `?preview=loading|error|offline` forces the loading, error and offline
  states of S2, S3, the Issues tab and S4. S2 also takes `?outlet=OUT009`
  (S2.9); the receipt takes `?preview=asked` (S3.5), `?preview=shortfall`
  (S3.1 B) and `?report=1` (opens the report sheet).
- `?preset=a,b` performs store writes before the first screen draws, so a frame
  that needs a tap can be opened from an address: `order-edited`,
  `order-cancelled`, `after-cutoff-placed`, `receipt-confirmed`,
  `receipt-confirmed-review`, `issue-reported`, `deferral-seen`, `read-all`.

Each of these has an equivalent in the real flow: the URLs below are shortcuts.
D is `2026-09-29`.

| Frame | URL |
|---|---|
| S1.1 before cutoff, S1.6 desktop | `/store/orders?at=15:38&state=form` |
| S1.3 received | `/store/orders?at=15:40` |
| S1.4 after cutoff | `/store/orders?at=16:07&state=form` |
| S2.10 list | `/store/deliveries?at=23:41` |
| S2.1 confirmed, S2.2 planned, S2.3 loaded | `/store/deliveries/D?at=16:01`, `?at=23:41`, `?at=04:51` |
| S2.4 on the way, S2.5 out of coverage | `/store/deliveries/D?at=05:11`, `?at=05:19` |
| S2.6 deferred at your request | `/store/deliveries/D?at=05:22` |
| S2.7 under review, S2.8 delivered | `/store/deliveries/D?at=06:41`, `?at=06:45` |
| S2.9 OUT009 deferred by policy | `/store/deliveries/D?at=03:01&outlet=OUT009` |
| S2.11 desktop | `/store/deliveries/D?at=07:28` in a window 1024 px or wider |
| S3.1 to confirm, S3.1 B shortfall | `/store/deliveries/D/receipt?at=07:28`, `?preview=shortfall` |
| S3.3 report sheet, S3.5 Dispatch asks | `.../receipt?at=07:31&report=1`, `?at=06:41&preview=asked` |
| S3.7 Issues tab | `/store/issues?at=07:35` |
| S4.1 updates, S4.2 History | `/store/updates?at=06:45&preset=deferral-seen`, `/store/history?at=07:31` |

The states after a tap (S3.2 confirmed, S3.4 issue reported, S3.6, S4.1 B) are in
the gallery, or reached by tapping Confirm receipt, Send to Dispatch and Mark
all read.

This branch tracks **PRD v3** (`waypoint-prd-v3.md` at the repo root, which
supersedes v2.1) and its companion `waypoint-central-context-v3.md`. Where
the Figma frames and the spec differ, v3's source ranking applies (Figma wins
on UI and copy, the spec on behaviour and data), and every visible difference
is listed under "Departures" below with its v3 register number where there
is one.

### Folder layout

Follows PRD v3 (migrated at the end of phase 8, in one commit of renames):

| Path | What |
|---|---|
| `frontend/src/screens/store/` | The store's screens: `orders` (S1), `deliveries` (S2), `receipt` and `issues` (S3), `updates` (S4), `gallery` |
| `frontend/src/shared/` | Cross-role UI: `ui/` (primitives) and `chrome/` (top bar, tab bar, app bar, bell, connectivity bar) |
| `frontend/src/domain/`, `api/`, `hooks/`, `app/` | Rules and types, the `StoreApi` and its mock, `useNow` and friends, the provider, clock and routes |

Older entries below name the files by the paths they had when the phase landed;
`components/` is now `shared/` and `screens/<name>/` is now `screens/store/<name>/`.

### Phase list

| Phase | What lands | Status |
|---|---|---|
| 1 | Vite, React and TypeScript scaffold; tokens.css; base.css; fonts; Radix and fontsource dependencies | Done |
| 2 | Shared primitives: Button, StatusPill, Tag, Alert, Card, Sheet, Modal, Toast, TopBar, AppBar, TabBar, ConnectivityBar, StateScreen, JourneyTimeline, Facts, DataTable | Done |
| 3 | Order types, the 11 statuses and `statusLabel`, the `StoreApi` interface and mock with the hero fixture, cutoff and arrival-range rules | Done |
| 4 | S1 Place order: all 15 frames (S1.1, S1.1 B, S1.2, S1.3, S1.3 B-D, S1.4, S1.4 B, S1.5 A-D, S1.6, S1.6 B), edit and cancel until 16:00, after cutoff, offline, error, sending, empty, desktop form, review modal and desktop recent-orders table. Pulled from Figma section `442:22594` on 30 Sep before starting; see the note below | Done |
| 5 | S2 Deliveries: all 15 frames (S2.1 to S2.11, S2.S A to D), each derived from the scenario clock along the hero timeline; Under review card, deferral notices, OUT009's view, Recent, desktop with proof of delivery. Pulled from Figma section `442:24402` on 30 Sep | Done |
| 6 | S3 Receipt and the Issues tab: all 12 frames (S3.1, S3.1 B, S3.2 to S3.7, S3.S A to D) at `/store/deliveries/:date/receipt` and `/store/issues`: confirm, shortfall with a reason, report-an-issue sheet, Dispatch asks, confirmed while the review is open, offline confirmation saved on the phone. The `Issue` type now uses the store's issue types. Pulled from Figma section `442:26109` on 30 Sep | Done |
| 6b | S4 Updates and history: all 7 frames (S4.1, S4.1 B, S4.2, S4.S A to D) at `/store/updates` and `/store/history`: feed grouped by day (Order/Plan/Delivery/Deferral/Review tags, each View opens its source S1/S2 state), Mark all read and All caught up, a settled review marked Resolved 06:44, History with All/Deferred/Partial filters, and the bell's unread dot on every screen. Added to the phase plan 30 Sep after finding it built in Figma but missing from the PRD text (gap G-10). Pulled from Figma section `585:40956` on 30 Sep | Done |
| 7 | Routes, the state gallery and the scenario clock: the full route set, `/store/_states` (48 frames, each openable full screen with `?frame=`), one clock (`?at=` infers the day, `?date=` overrides) read through one `useNow()`, `data-theme="light"` on the store root, no clipping at 320 px | Done |
| 8 | README (walkthrough, departures, run and gallery), accessibility pass, a full browser pass of every gallery frame against Figma, the hero flow end to end, typecheck, lint and build | Done |

### The store's part of the judge walkthrough (mock mode)

PRD v3 section 16 steps 1, 2, 3, 6, 8, 13, 15, 16 and 17, the Anusha (store) side, in one browser
tab with no backend. The scenario clock starts at Mon 28 Sep 15:40 and the **presenter control**
(the floating panel, `?presenter=1`) jumps it forward to the next moment without a reload, so
the orders placed in step 1 are still there at 07:28. It never goes backwards; Reset demo reloads.

Open `http://localhost:5173/store/orders?at=15:40&state=form&presenter=1` (Vite's default port;
`state=form` starts with nothing placed).

1. **Step 1, Mon 15:40.** Orders tab: Chilled 12, Dry 8 are already set. Tap **Place 2 orders**, then
   **Place orders**. You see S1.3: "Received 15:40", "Counts for Tue 29 Sep.", "You can edit until
   16:00", "Arrival time is shown after the plan is released at 23:40", and the two orders
   ORD2001 (chilled, 12 units) and ORD2002 (dry, 8 units), both Ordered. Try **Edit order** (S1.3 B,
   C) and **Cancel order** (S1.3 D) now if you want; place the orders again to continue.
2. **Step 2, Dispatcher.** Nothing on the store side: ORD2001 and ORD2002 are in the record the
   dispatcher reads.
3. **Step 3, Go to 16:01.** Deliveries tab, tap the Tue 29 Sep card: **S2.1** "Confirmed for Tue 29
   Sep.", "Plan not released yet, arrival time follows." Both orders read Confirmed; Orders no
   longer offers Edit order (S1 is after cutoff).
4. **Step 6, Go to 23:41.** S2.2: arrival "from 05:30", "Truck may arrive 05:26 and wait", "Have
   receivers ready by 05:30", Planned, on VEH039.
5. **Step 8.** OUT009's store, deferred by policy at 03:00: open
   `/store/deliveries/2026-09-29?at=03:01&outlet=OUT009` in a second tab (S2.9: "Tomorrow's chilled
   order moved to Wednesday", decided by Kumari 03:00, next run Wed 30 Sep).
6. **Steps 10 to 12, Go to 04:51, 05:11, 05:19.** S2.3 Loaded at Kandy dock 04:50 · 12 + 8 units on
   board; S2.4 On the way, arrives about 05:26, unloading from 05:30; S2.5 the same with the muted
   line "Last update 05:17: records arrive when the driver is back in coverage." (no alert).
7. **Step 13, Go to 05:22.** S2.6 **Deferred at your request**: "Next run Wed 30 Sep.", Reason
   "Receiving staff unavailable (your call at 05:20)", Decided by Kumari · 05:21, New ETA Wed 30 Sep
   · from 05:30. The bell shows one unread. Tap **Got it**: the bell clears.
8. **Step 15, Go to 06:41.** S2.7 **Under review** (stores never see "Conflict") with "Why you're
   seeing this", the 05:42 proof of delivery, and "Did you receive this delivery?" (Yes, we
   received it / Report issue).
9. **Step 16, Go to 06:45.** S2.8 Delivered 05:42 · received by S. Fernando · 12 + 8 units, tag
   **Deferral withdrawn**, "Wed 30 Sep re-run removed." The bell shows 2 unread.
10. **Step 17, Go to 07:28.** Tap **Confirm receipt**: S3.1 shows the photo, S. Fernando, 05:42,
    Nimal · VEH039 and 12 / 12, 8 / 8. Tap **Confirm receipt**: S3.2 "Receipt confirmed 07:30 ·
    Anusha", "Who already knows: Dispatch", the whole journey done. Tap the **bell**: S4.1 lists the
    updates from Mon 15:40 to Tue 06:44 (the review row reads "Resolved 06:44"); **Mark all read**
    gives "All caught up". **History** (S4.2) lists Tue 29 Sep 05:42 Delivered with its tags and the
    days before it.

Branches worth showing: lower ORD2001 to 10 before confirming (S3.1 B, **Confirm with a shortfall**
asks for a reason and the order reads Partial), **Report issue** (S3.3, S3.4, then the Issues tab
S3.7), an order placed after 16:00 (S1.4, placed for Wed), going offline while ordering or
confirming (S1.5 A, S3.S C; both send on reconnect), and every state in the gallery at
`/store/_states`.

### Checks run (phase 8)

- `npm run typecheck`, `npm run lint` and `npm run build` are clean.
- Every frame in the gallery (48) was rendered at its Figma size in real Chrome and compared with
  its Figma screenshot; what still differs is under "Departures".
- The hero flow above was run end to end through the UI in one session (place, Go to each moment,
  Got it, Confirm receipt, the feed and History) and asserted on the visible text.
- Accessibility: every colour pair the screens use in the Light theme is at least 4.5:1 (text) and
  the borders at least 3:1 (script over `tokens.css`; the lowest text pair is 5.07:1); no text is
  smaller than 12 px; interactive targets are at least 44 px (list of the exceptions under
  "Departures"); keyboard order follows the layout, every control has a visible 3 px focus ring,
  dialogs are Radix (focus trapped, Esc closes, focus returns); the cutoff countdown, the delivery
  card and the S3 pages are `aria-live="polite"` regions; status never rests on colour alone (icon
  and word on every pill; dots and tint on unread rows).
- Nothing breaks at 320 px (no horizontal scroll; rows and chips wrap; the outlet name in the top
  bar truncates with an ellipsis beside the bell and sync chip).

### Departures from the Figma design

S1 to S4 (phases 4 to 6b) are built. Every visual or copy
difference between a built frame and its Figma frame, with its reason:

- **The Updates bell is on every S1 screen (v3 DP-06, gap G-12).** Figma
  draws "Bell · Updates · plain" on S1.1, S1.1 B and S1.3 only (the other 12
  phone frames and the desktop app bar on S1.6 have none). v3 settles this:
  the bell is on every store screen, phone and desktop. It carries an unread dot
  from the S4 feed (phase 6b) and links to `/store/updates`.
- **The cutoff countdown is live, so it differs from two static frames
  (v3 Q14).** S1.3 B (15:42) and S1.3 D (15:45) both read "20 min left" in
  Figma; 16:00 minus those times is 18 and 15. Built as computed from the
  clock. Recorded as DP-16 in PRD v3 section 18 (30 Sep).
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
- **S4 History is drawn in light colours.** Figma's S4.2 draws the Delivered and
  Partial pills and the tab bar in the dark theme's colours; the store is
  Light (PRD v3 section 6), so the build uses the light pills and the light tab
  bar. Everything else on S4.2 is as drawn.
- **S4.S C shows the saved feed.** The frame is the offline bar and the "Updates"
  title with nothing under it, and its chip still reads Synced. The build shows
  the feed it last loaded under the bar, "You are offline. Showing updates saved
  on this phone. Last updated HH:MM." (the frame's words; PRD v3 leaves out
  "You are offline."), with the chip Offline and "Mark all read" disabled.
- **S4 has a back arrow instead of the bell.** As drawn: the bell opens S4, so
  S4's own bar carries a back arrow (back to where the bell was tapped, or to
  the orders when opened by address). The desktop bar keeps the bell.
- **The bell's unread dot has no number** (Figma's "Unread dot", a 10 px amber
  dot); the count is in its accessible label, "Updates, 2 unread". Phase 4
  drew a number.
- **S1 steppers stay disabled while an order is queued offline** (S1.5 A draws them
  enabled): editing a queued order would change what is about to be sent.
- **S1.3's "2 orders received." toast appears only after placing,** not on a direct load
  of the frame, because it confirms an action.
- **Sheet and Modal keep a close button** that S1.2 and S1.6 B do not draw, for touch and
  screen-reader users; it sits out of the flow, so the sheet is as tall as Figma's.
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
- **S4 is the same record, read another way (PRD v3 handoff 14).** `getUpdates`
  builds the feed from the orders and the clock: the rows are the PRD v3
  section 3 S4 table, appearing as their times pass (Order received at the
  order's own time, Confirmed 16:00, Arrival time set 23:40, then the hero
  Delivery, Deferral and Review rows and the 06:44 resolution). `markAllRead`
  reads everything sent so far. The copy is Figma's, including the typographic
  apostrophe in "tomorrow’s queue".
- **A53 (30 Sep, store build, phase 6b).** What the store has read: everything
  sent by 05:20 on the hero morning (when Anusha rang Dispatch, H10), and the
  deferral once Got it is tapped. So S2.6 at 05:22 has one unread (the bell
  dot the frame draws), and 06:45 has two, the 06:40 review and the 06:44
  resolution (A37), *when Got it was tapped*; a direct load of 06:45 without it
  shows three. Mark all read reads everything up to now.
- **A54.** For a day other than the hero's, the feed has only Order received,
  Confirmed and Arrival time set ("Arrival from 05:30. Have receivers ready by
  05:30.", with no "may arrive" clause). History lists the current day once it is
  delivered (or Partial), with its order IDs, "Deferral withdrawn" and "Receipt
  confirmed HH:MM"; a day that is still under review or deferred is not there
  yet.
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
- **Phase 7 replaced the interim clock.** `?at=` alone now infers the day (before
  08:00 is Tue 29 Sep, later is Mon 28 Sep), which is what lets every frame's
  time stand by itself; `?date=` overrides. The answer to the question of how
  v3's `?date=` default (Tue 29 Sep) squares with S1 needing Mon 28 Sep was
  agreed on 30 Sep.
- **`createMockStoreApi(now, { seed })`.** `seed: "placed"` (default) holds the
  hero orders already received at 15:40; `seed: "empty"` holds nothing, so S1.1
  can be walked through, and the first chilled and dry orders placed for the
  outlet take the hero IDs ORD2001 and ORD2002.

### Shared files this role has changed

Phase 7:

- `app/scenarioClock.ts` (day inferred from the time), `hooks/useNow.ts` (reads
  the clock from the provider; no `now` prop on any screen), `app/StoreProvider.tsx`
  (inside the router; `?preset=`), new `app/presets.ts`, `StoreRoutes.tsx`,
  `StoreRoot.tsx` (`data-theme="light"`), `App.tsx`; `screens/store/gallery/`.
  `createMockStoreApi` requires its clock.

Phase 6b:

- `shared/chrome/BellButton.tsx` and `.module.css`: a plain 10 px unread dot,
  the count in the label. `TopBar.tsx`, `PhoneLayout.tsx`: optional `onBack`
  (S4's back arrow).
- New `shared/ui/Segmented.tsx`, `FilterChip.tsx`, `MonoText.tsx` (IDs and
  times inside a sentence in Plex Mono); `Tag.tsx`: `info` and `review` kinds.
- `domain/update.ts` (new), `domain/order.ts` (`RecentOrderDay` gains
  `orderIds`, `deferralWithdrawn`, `receiptConfirmedAt`, `current`),
  `api/StoreApi.ts`, `mockStoreApi.ts`, new `mockUpdates.ts`: `getUpdates` and
  `markAllRead`; `listRecent` includes the current day once delivered.
- `app/StoreContext.ts`, `StoreProvider.tsx`: the unread count for every bell
  (`unread`, `refreshUnread`); `OrdersPage`, `DeliveriesPage`, `ReceiptPage` and
  `IssuesPage` pass it to their bell.

Phase 6:

- `shared/ui/UnitStepper.tsx`: `expected` reads "/ 12" (was "of 12"), the
  amber shortfall fill is gone (S3.1 B draws none), and a `compact` size (44 px
  buttons) for the receipt row.
- `shared/ui/Sheet.tsx` and `.module.css`: the close button is out of the
  flow, so the header is as tall as the title as in Figma, and focus goes to the
  sheet on open (no ring on the close button).
- `shared/ui/Facts.module.css`: no default `dl`/`dd` margins.
  `shared/ui/Icon.tsx`: `inbox` and `store`.
- `shared/chrome/TopBar.tsx`, `PhoneLayout.tsx`: optional `placeMono` (the
  receipt's second line in Plex Mono).
- `domain/issue.ts` (new), `domain/delivery.ts` (`issues`, per-order `issue` and
  `received`, `receiptBy`), `api/StoreApi.ts` and `mockStoreApi.ts`:
  `confirmReceipt`, `reportIssue` and `listIssues` take and return the S3 shapes;
  the phase 3 `Issue` and `ConfirmReceiptInput` types are gone.

Phase 5 (each in its own commit, before the screens that use it):

- `shared/ui/JourneyTimeline.tsx` and `.module.css`: 12 px dots (green
  reached, amber current with an ink ring, hollow pending), short connectors,
  meta in Archivo so callers wrap times in `<Mono>`; the horizontal variant
  (S2.11) lines the dots up on one rail. `ReceivedView` (S1) wraps its times.
- `shared/ui/Icon.tsx`: added `info`, `image`, `arrow-right`.
- `shared/ui/Alert.module.css`: body text 15 px. `Facts.tsx`: `ruled`
  variant. `StateScreen.module.css`: 64 px tile, 22 px title, centred action.
- `shared/chrome/PhoneLayout.tsx`: optional `outlet` and `place` (S2.9 is
  OUT009's view). `PhoneLayout.module.css`: white pinned bar.
- `shared/chrome/TopBar.module.css`: outlined sync chip (Offline keeps it
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
  `screens/store/orders/OrdersRoute.tsx`: one API and one clock for every route.

Phase 4:

- `frontend/src/shared/chrome/TopBar.tsx`, `AppBar.tsx`,
  `PhoneLayout.tsx` and new `BellButton.tsx`: an optional `bell` slot (the
  Updates bell with an unread-count dot). Additive; omit it and nothing changes.
- `frontend/src/shared/chrome/PhoneLayout.module.css`: the pinned action
  bar now sticks above the tab bar (it overlapped it on long pages).
- `frontend/src/shared/ui/JourneyTimeline.tsx`: optional
  `metaAlign="right"` (default unchanged), for S1's timeline times.
- `frontend/src/shared/ui/UnitStepper.tsx`: `disabled || at limit` in place
  of `disabled ?? at limit`, which never stopped the stepper at its min or max
  when a caller passed `disabled={false}`.
- `frontend/src/shared/ui/Toast.module.css`: on the phone the toast floats
  above the tab bar, as on S1.3.
- `frontend/src/shared/ui/Icon.tsx`: added `bell` and `circle-check`.
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

## 🚛 Field apps foundation (Loader and Driver)

What the Loader (`/loader`) and Driver (`/driver`) apps share, built in `frontend/`. Branch: `feature/field-foundation`, cut from `feature/store-manager-frontend` (the only Vite scaffold on the remote when this started) and meant to merge to `develop` before `feature/loader` and `feature/driver` start. The binding rules for this work are in [`docs/build/field-conventions.md`](docs/build/field-conventions.md).

**Status:** F1 to F6 built, checked and pushed (`tsc -b`, `oxlint`, `vitest run`, `vite build` all clean). F7 is this section. Not done yet: a pixel comparison of every field component against Figma (the Figma connection dropped mid-session; see "Still to check").

### How to run

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
npm run dev:https      # self-signed HTTPS on the LAN, for camera and GPS on a phone
npm test               # vitest: offline core and clock
npm run compare -- loader L2.1-A L2.1-B   # frame screenshots beside Figma (needs the dev server)
```

On a phone, open the `Network` address `npm run dev:https` prints, accept the certificate warning once, then use the app. `npx playwright install chromium` is needed once for `npm run compare`.

| Route | What |
|---|---|
| `/loader`, `/loader/dock`, `/loader/vehicles/:vehicleId/trips/:trip`, `/loader/changes` | Loader root, always Dark · pre-dawn. Placeholders for L1, L2, L4 |
| `/driver`, `/driver/run`, `/driver/stops/:stopId`, `/driver/stops/:stopId/outcome`, `/driver/issues`, `/driver/history`, `/driver/notifications`, `/driver/finish`, `/driver/me` | Driver root, Dark for now (the theme rule lands with driver prompt 3). Placeholders for R1 to R9 |
| `/loader/_states`, `/driver/_states` | State galleries, dev only, empty until the role prompts register their frames. `?frame=ID` renders one frame at its Figma size |
| `/field/_components` | Every field component in Dark, Field and Light side by side (dev only) |
| anything else | Waypoint Store, unchanged |

### Scenario clock

`?at=HH:MM` starts the clock at that time and lets it tick; `?date=YYYY-MM-DD` picks the day (default `2026-09-29`, so Monday evening needs `?date=2026-09-28`). Without `?at=` the Loader starts at 23:45 on Monday and the Driver at 04:45 on Tuesday, then run in real time. Everything is read and shown in Asia/Colombo whatever the browser's zone (`src/field/clock/`). Use `useNow()` from `field/clock/useClock`; never call `new Date()` in a component. The Store keeps its own clock, which reads the browser's zone, so the two are separate until someone merges them.

### Offline core (`src/field/offline/`)

Import from `field/offline`. One IndexedDB, `waypoint-field`: `outbox`, `cache`, `blobs`, `settings`.

- **Save a write:** `await enqueue({ type: "driver.arrival", payload, actor, planVersionOnDevice })`. The screen shows "Saved to phone" at once. The record has a `clientId` (idempotency key), the scenario `deviceTime` and `status`. Accepted records stay, so a screen can show "Synced".
- **Plug in a record type:** `registerSyncHandler("driver.arrival", async (record) => ({ result: "accepted" | "duplicate" | "conflict" | "error", groupKey, serverPayload }))`. Throw a `NetworkError` when the device cannot reach the server; the engine puts the record back and stops. `groupKey` (for example the stop) is how R5 says "1 conflict (2 orders)".
- **Photos and signatures:** `compressImage` (JPEG, longest edge 1600 px, quality 0.7), `saveBlob({ kind, blob, recordClientId })`, then `registerBlobUploader(...)`. A photo uploads after its record; a failed upload never fails the record.
- **Read state:** `useConnectivity()` gives `status` (`online | offline | syncing | failed`), `lastSyncAt`, `waitingCount`, `simulatedOffline`; `useOutbox()` gives the records; `connectivity.setSimulatedOffline(true)` is the R4 "Simulate offline" switch; `connectivity.sendNow()` is "Send now" and "Retry now"; `connectivity.setGate(name, open)` adds a condition such as the Kandy coverage gap.
- **Engine:** runs on the `online` event, every 30 s while anything waits (errors retry 30 s after they fail) and on Send now; sends in order; one run at a time, so pressing Send now repeatedly sends nothing twice; emits a grouped `SyncResult` through `onSyncResult`. A conflict is recorded and never retried. There is no Background Sync API: iOS Safari lacks it, so sync only runs while the app is open.
- **Mock API:** go through `request(op, payload)` (`transport.ts`): 300 to 600 ms latency, `NetworkError` when offline, answers from `registerMockHandler`. Swap `setTransport` for a `fetch` transport when a role is wired to the real API. No screen calls `fetch` or reads a fixture directly.

### Components (`src/field/components/`)

`FieldTopBar`, `ConnectivityChip` (Online, Synced 04:54, Offline · 5, Syncing, Failed 06:42), `NotificationBell`, `OfflineBanner` (five tones), `FieldTabBar`, `BottomSheet`, `PinSheet`, `PinnedActionBar`, `UnitsStepper`, `LoaderCheckCard` and `DriverStopCard` (the two densities of the Master Order Component), `FieldSwitch`, `ChoiceChips` (Text size and Language on R1.9). `PinSheet` takes an async `verify(personId, pin)` and an `onConfirmed` callback and knows nothing about plans. Pills, tags, alerts, state screens and toasts are the shared ones, extended where a field frame needed it. Sheets read their role's theme from `RoleRoot`'s context, because Radix portals render outside the role root.

### Departures from the Designathon design (foundation)

| Frame | Day 5 | Build | Why |
|---|---|---|---|
| L1.2 A to C, L2.3 B | "Other…" has no design | Selecting it shows a "Your name" field above the keypad | A person who is not Priya or Ruwan needs a name for the record (loader prompt, README departures) |
| L1.2 A | The sheet shows no vehicle card inside it | `PinSheet` takes an optional `context` card, off by default | Matches the frame; L2.3 B's prompt text names a context card, so it is there when a screen wants it |
| L1.2 C | Dots fill red, message shown, nothing clears | Dots fill in the danger colour, shake for 120 ms (none under reduced motion), then clear after 450 ms; the message stays until the next digit | Prompt 1 asks for the shake and the clear |
| LIB6 | The library draws the PIN sheet as "Store PIN for OUT084" | The frame L1.2 wins | Where the library and a frame differ, the frame wins |
| Top bars | L1 draws a 24 px title line, R1 a 22 px one | 22 px for both | Within the 2 px tolerance |
| Notification bell | No count badge drawn on R1.6 and R3.1 | A small signal count badge when the count is above 0 | The prompts and R8 call for an unread count on the bell |
| Sheets | 390 px wide | Centred, at most 430 px wide on wider screens | Field conventions section 12 |

### Shared files this role has changed

- `styles/tokens.css`: `--font-sans` falls back to Noto Sans Sinhala and Tamil; `--shadow-1` and `--shadow-2` are `none` under `data-theme="field"`. The Dark and Field colour blocks already matched conventions section 6, so no value changed. Light is untouched.
- `shared/ui/Icon.tsx`: new names (`flag`, `history`, `map-pin`, `navigation`, `delete`, `phone`, `package`, `pen`, `sun`, `type`, `globe`, `database`, `wifi`) and sizes 22 and 28. `shared/ui/Alert.tsx` and `.module.css`: `issue` and `conflict` tones. Nothing existing changed.
- New `shared/RoleRoot.tsx` and `shared/theme.ts` (the theme context).
- `app/App.tsx`: the router. `/loader/*` and `/driver/*` go to their roots; the Store tree moved into a `StoreApp` component inside the same providers, behaviour unchanged. The Dispatcher root joins here when its branch merges.
- `main.tsx`: Sinhala and Tamil font imports (400, 600, 700).
- `vite.config.ts`: PWA plugin, vitest, `dev:https`. `package.json` and the lockfile: dexie, vite-plugin-pwa, vitest, fake-indexeddb, @playwright/test, @vitejs/plugin-basic-ssl, @radix-ui/react-switch, the two Noto fonts. `tsconfig.node.json` includes `scripts/`.
- New `domain/field.ts` (Depot, Vehicle, PlannedOrder, Stop, Trip, PlanVersion, Person). It reuses the Store's `OrderStatus` and `DeferralType`; the Store's `Order` is a store order line, so the field type is named `PlannedOrder`.

### Phases

- [x] F1 fonts, tokens, `RoleRoot`
- [x] F2 field components and `/field/_components`
- [x] F3 offline core and tests (21 tests across the offline core and the clock)
- [x] F4 clock, state gallery harness, compare script
- [x] F5 service worker, manifest, HTTPS dev
- [x] F6 domain types, role roots, placeholder routes
- [x] F7 this section

### Still to check

- Compare each component with its Figma frame once the role screens register frames in the galleries (`npm run compare`). `.figma/` and `.compare/` are git-ignored.
- `Mono` renders at the surrounding weight; the frames use Plex Mono Medium (500) for IDs. Compare when the first screens land and set it if it differs.
- Sign-in: no sign-in exists on this branch, so `loader@waypoint.demo` and `driver@waypoint.demo` do not land anywhere yet.

---

## 🚚 Driver (Waypoint Driver)

Nimal's app: today's stops, offline-first, one decision at a time. Built in `frontend/`. Branch: `feature/driver`, cut from `develop` after `feature/field-foundation` merged. Driver prompt 3 (`claude/field-build/03-driver-core.md`) covers the shell and the hero delivery path (R1 Route, R2 Stop detail, R3 Record outcome, the Me tab); the outbox sheet, sync, conflicts and notifications (R4, R5, R8) are prompt 4, and problems, history, the GPS tracker, finish run and calendar days (R6, R7, R9, R10) are prompt 5.

**Status:** R1 to R3 and the Me tab are built, checked and pushed. D0 to D5 (below) are done.

### How to run

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
npm run dev:https        # self-signed HTTPS on the LAN: the real camera needs a secure context on a phone
npm run compare -- driver R1.1 R3.1   # frame screenshots beside Figma (needs the dev server and .figma/<id>.png)
npm run test:hero        # the hero path end to end against a running dev server (see "Checks run")
```

| Route | Screen |
|---|---|
| `/driver`, `/driver/run` | R1 Route |
| `/driver/stops/:stopId` | R2 Stop detail |
| `/driver/stops/:stopId/outcome` | R3 Record outcome |
| `/driver/me` | R1.9 Me tab |
| `/driver/issues` | R6 Issues (placeholder; driver prompt 5) |
| `/driver/history` | R7 History (placeholder; driver prompt 5) |
| `/driver/notifications` | R8 Notifications (placeholder; driver prompt 4) |
| `/driver/finish` | R9 Finish run (placeholder; driver prompt 5) |
| `/driver/_states` | The state gallery (dev only; `?frame=ID` renders one frame full screen) |

**The scenario clock.** `?at=HH:MM` starts the clock there and lets it tick in real time; `?date=YYYY-MM-DD` picks the day (default Tue 29 Sep 2026). Without `?at=` the driver starts at 04:45, the first frame's own time. There is no presenter control on this role (that is the Store's): to move through the hero timeline quickly, re-open a route with a later `?at=` rather than waiting in real time; the phone's local state (acknowledged, departed, each stop's arrival and outcome) is in IndexedDB and survives the navigation, so this is how the hero walkthrough script moves between H5 and H14.

**The hero path** (PRD H5 to H14, driver prompt 3 section 2): 04:45 route known, not yet downloaded (R1.3 A) → tap Acknowledge v4, downloads (R1.2 A), ready offline (R1.2 B) → tap again, acknowledged, Ruwan's gate confirmation shows once past 04:50 (R1.3 B / R1.4) → 05:10 Start route (R1.5) → 05:17 the Kandy corridor drops coverage for real (R1.6) → 05:26 arrive OUT084 before its window, wait for 05:30 (R2.2 A) → window open, record Delivered for ORD2001 and ORD2002 with a photo and a receiver name (R3.1 → R3.7, which turned out to be the Run screen itself, see "Departures") → 05:48 arrive OUT087, already inside its window → 05:58 record Delivered for ORD2003 → 05:59 all stops recorded, five records waiting on the phone (R3.9 / R3.10).

### The theme rule and text size

The sunlight switch (R1.9) wins when it is on, forcing Field; otherwise the phone's own `prefers-color-scheme` decides Dark or Light, per the R1.9 copy ("Dark mode follows your phone's setting"). Verified in a real browser: toggling the switch flips the role root's `data-theme` at once and the choice survives a reload (`DriverProvider`, backed by the field database's `settings` table).

Text size (Standard / Large) scales the body content, not the chrome: `DriverShell` applies CSS `zoom: 1.15` to the scrollable `<main>` when Large is chosen, so the top bar and tab bar stay their fixed size while everything else — type and the spacing around it together — grows. `zoom` is Chromium and WebKit only (not Firefox); the project's own tooling (Playwright, the compare script) and real phones (Chrome, Safari) are both covered, so this was the pragmatic choice over rewriting every driver stylesheet's fixed-px type scale into a parallel rem-based one.

### Language

The `t(key, params)` dictionary (`i18n.ts`) is complete in English and routes every driver string, as the brief asks. Sinhala and Tamil are still empty and fall back to English, exactly as driver prompt 3 scoped it ("filled in prompt 5"); when they are filled they will be a machine draft needing a native-speaker review (open decision O-8), not reviewed as of this PR. Language labels in the Me tab picker are always shown in their own script regardless of the chosen language.

### Offline and the Kandy corridor

`DriverProvider` runs a real connectivity gate (`field/offline`'s `connectivity.setGate`) that closes at Tue 29 Sep 05:17 and does not reopen in this prompt's scope (driver prompt 4 adds the 06:40 reconnect and the sync result screens). This is independent of a real network drop: the Playwright hero walkthrough exercises both, dropping the browser's own connection with `context.setOffline(true)` as well as letting the scripted gate do its job, and both agree once the clock passes 05:17.

`getRun` reads the phone's own cache and never throws offline, since the route has to be usable with no signal by design; writes (`acknowledgePlan`, `startRoute`, `recordArrival`, `recordOutcome`) update that same cache at once, so the screen reflects them immediately, and queue an outbox record (`driver.ack`, `driver.startRoute`, `driver.arrival`, `driver.outcome`) that the shared sync engine sends once it can. The mock server simply accepts everything in this prompt; driver prompt 4 adds the conflict rule.

Known gap: records already waiting when the app opens online are sent by the 30 s timer or the next `online` event, not at once. Nothing is lost, but a reload leaves them for up to 30 s. Whether opening the app should sync at once is a call for the team; it would also change the walkthrough's offline reloads, which load a page online for a moment.

### The Outbox (driver prompt 4, O2)

The connectivity chip on every driver screen opens the R4 Outbox sheet (`screens/driver/outbox/`). It is a read of the phone's own outbox (`useOutbox()`) and connectivity (`useConnectivity()`), so it never touches the network. One bar says what the device is doing, in this order: sending ("Sending 5 records…", with "3 / 5" also on the chip), offline ("Offline · 5 saved on phone", "Last sync 05:17"), failed and retrying, sent for review ("1 stop (2 orders) sent for review. Nothing for you to do."), or all synced (the empty state). The rows are the driver's own events in save order: Departed, Arrival, and one outcome per order. The plan acknowledgement is not listed. A conflict row reads Synced again once Dispatch has resolved its stop.

- **Simulate offline** (the "Prototype" row) is the foundation's real `connectivity.setSimulatedOffline`: it persists, and every screen reacts.
- **Send now** and **Retry now** call `connectivity.sendNow()`, which forces a run past the 30 s wait. Pressing it repeatedly joins the run in flight, so nothing is sent twice. Offline it sends nothing and loses nothing.
- **Presenter controls** appear in the sheet only under `?presenter=1`: the Kandy corridor coverage gap switch, "Fail next photo upload", and "Dispatch resolves now: Keep delivery" or "Keep as Partial (10 of 12)" while a conflict is open.
- The chip gains two drawn variants: "3 / 5" while syncing, and "Retrying 1" while a failed record waits for its automatic retry.

### Sync result and the conflict (driver prompt 4, O3)

R5 (`screens/driver/sync/SyncResultScreen.tsx`, route `/driver/sync-result?view=conflict|synced|resolved`) says plainly how the run stands after a sync. It is one screen with seven frames: what went out and what went to Dispatch (R5.1), all synced (R5.2), Dispatch's decision (R5.3), and offline again, sync failed, nothing to sync and loading (R5.S). Every count is read from the same rows the Outbox shows (`outboxRows`), so the two cannot disagree. R5.1's two conflicting orders are one row, "Delivered ORD2001 + ORD2002", and the 05:21 and "store's request" wording comes from the conflict the mock server returned (`ConflictDetail.changedAt` and `changedBy`, added for this).

**When it shows** (`sync/syncView.ts`). Only a catch-up run counts: the phone had been offline with records waiting, the run was not cut short, something went out, and nothing failed. A single record sent from the road a moment after it is saved is not a "sync result". The result is queued once and shown the next time the driver is on the Run screen, or over an open Outbox. The outcome screens never enable it, so it can never interrupt R3 while recording. It survives a reload while unseen, and so does "the phone was offline", so an app killed offline still tells the driver once it syncs. A resolution from Dispatch queues R5.3 once per stop.

**While a conflict is open** and the phone is online, `useSyncWatcher` (mounted by the shell, so on every driver screen) asks `getNotices` every 30 s of scenario time and after every sync. When Dispatch's decision lands on a stop the run switches from R1.7 to R1.8 by itself and R5.3 shows once.

**R1.7 and R1.8 are real.** The run screen's all-recorded layout reads the stops: a stop with an open conflict is "Sent for review" with the amber bar and View (which opens the Outbox on the conflict); a resolved stop reads Delivered, or Partial, with the green bar. While records still wait it is R3.9 and R3.10, the same layout with "5 on phone" and Saved on phone pills. `RunScreen`'s gallery-only `reviewNotice` prop is gone. Frames R1.7, R1.8 and R5.1 to R5.S 4 are in `/driver/_states` and were compared against Figma with `npm run compare`.

### Photos after records, and the failure branch (driver prompt 4, O4)

A stop's photo and signature belong to its first record and upload only after that record has reached the server, one at a time in the order they were taken. `recordOutcome` ties them to the record before it is queued: queueing starts a sync at once, and until now nothing called `attachBlob`, so a photo had no owner and the engine would have sent it ahead of the delivery it proves.

A failed upload never fails its record. The record reads Synced, the photo stays on the phone, and the phone retries it every 30 s (or at once on Retry or Try again).

- **R8.2, the alert on the run.** "Couldn't send photo of stop 1. Kept on phone." with Retry. The alert text opens R8.3; Retry sends now. The progress pill reads "1 on phone", and the stop reads "Delivered 05:42 · photo still on phone" with a "Photo on phone" pill. The alert takes the bar's slot ahead of the under-review notice, since it is the one the driver can act on; the stop's own pill still shows a stop under review.
- **R8.3, the detail** (`sync/PhotoFailureScreen.tsx`, route `/driver/notifications/photo/:blobId`): what failed, what is safe, when it was taken, the last try, when the delivery record synced, and the reference WP-SYNC-409. Try again sends now; View outbox opens the sheet, whose bar reads "1 photo didn't send. Retrying automatically every 30 s." When the photo gets through the driver is taken back to the run and the alert is gone. The notifications list (O5) will link its "Sync failed" entry to the same route.
- **One notice per photo.** The phone retries every 30 s, so the "Sync failed" notice is kept once per photo with the time of the latest try, and names the real stop from the photo's record (it used to say stop 1 for every photo).
- **A failed photo is not a failed sync.** The R5.S 2 "Sync failed" screen is for records that did not send; a photo that will not send is the run's alert, and R5.1 still shows the records that got through.

### Notifications and the bell (driver prompt 4, O5)

R8.1 (`notices/NotificationsScreen.tsx`, route `/driver/notifications`) lists only the changes that affect the driver's own run, newest first, and R8.4 is its empty state. The notices live in the phone's own cache, so they are there offline and survive a reload. The bell on every driver screen counts the unread ones; it is a number, never a bare dot.

- **What it holds:** Dispatch resolved a stop; sync failed (a photo); delivery sent for review; N records synced (what went out, listed); plan v5 received (the first time a sync reaches the server); you went offline (once per spell of no coverage); orders on board (the load confirmed); plan released. Filters: All, Sync, Dispatch, Run.
- **Opening one** marks it read and leads where the navigation map says: resolved to R5.3, sent for review to R5.1, sync failed to R8.3, records synced to the Outbox. Plan and load entries are information only. "Mark all read" clears the count and the bell badge.
- **Born read:** the plan release and the load confirmation are things the server told the phone before the day began, so they arrive read; the bell counts what needs a look. The same goes for "You went offline".
- **A batch, not every record:** "N records synced" appears when two or more arrivals or deliveries go out together. One record sent from the road a moment after it is saved raises nothing.

### Camera, signature and receiver name

`CameraCapture` opens a real `getUserMedia({ video: { facingMode: "environment" } })` viewfinder with a shutter; if the camera is unavailable or permission is refused it falls back to `<input type="file" accept="image/*" capture="environment">`, per field conventions and PRD A58. Headless Chromium has no camera, so every photo in the gallery, the hero walkthrough and this PR's own testing went through the file-input fallback; the live viewfinder path has not been tried on a physical phone in this PR (do that over `npm run dev:https` before the judge walkthrough). Captured photos are compressed with the shared `compressImage` (JPEG, longest edge 1600 px, quality 0.7, PRD A57) and stored with `saveBlob`. `SignaturePad` is a pointer-events canvas saved as a PNG blob. `ReceiverNameForm` offers per-outlet recent-name chips from the fixtures.

### Phases

- [x] D0 types, fixtures, `DriverApi` and mock, sync handlers
- [x] D1 shell: top bar, banner, tab bar, theme rule, text size, the `t()` dictionary, Me tab
- [x] D2 R1 Route, every state (R1.1 to R1.6, R1.10, R1.S)
- [x] D3 R2 Stop detail, every state (R2.1 to R2.3, R2.S 1 to 4)
- [x] D4 R3 Record outcome: all five outcomes, the per-order grid, camera, receiver name, signature, validation (R3.1 to R3.11)
- [x] D5 state gallery, a compare pass against Figma, the hero-path Playwright walkthrough, this section

Driver prompt 4 (`claude/field-build/04-driver-offline.md`):

- [x] O1 mock server: plan v5, the conflict rule, grouping by stop, notices, the 06:44 resolution, dev controls, the coverage profile
- [x] O2 R4 Outbox sheet, Simulate offline, Send now and Retry now (frames R4.1, R4.2, R4.3 1 to 3)
- [x] O3 R5 Sync result (R5.1 to R5.3, R5.S 1 to 4), R1.7 and R1.8 on real data, the 30 s conflict poll
- [x] O4 photo upload after records (attached before queueing, in capture order), R8.2 and R8.3 failure branch with retry
- [x] O5 R8 Notifications list (R8.1), empty (R8.4), the bell count, mark read
- [ ] O6 gallery, compare, remaining tests, real-device check

### Departures from the Designathon design

Figma wins on UI and copy (field conventions section 2); where it was silent or where building exactly what it drew was impractical, this is what was built instead, and why. Numbered departure rows now collide across parallel branches, so these are prose, not register rows; HH numbers them centrally.

- **R1.3 B and R1.4 are one state, not two.** Both show the plan acknowledged and the loader confirmed, not yet departed; the only difference Figma draws (R1.4 additionally shows the Will-wait and Chilled tags and the Navigate button on the first stop card) reads as the same moment captured a little further along, so the build shows those consistently in both rather than toggling them off for a few minutes after acknowledging.
- **The connectivity chip's wording is inferred, not drawn as a rule.** Every pre-departure frame's chip time equals that frame's own clock time exactly ("Synced 04:54" at 04:54, "Synced 05:08" at 05:08 and so on), so the build reads it as "Synced `now`" while not yet departed, and "Online" once departed (R1.5, R1.10) or on an error/empty screen (R2.S 3, R2.S 4) — never a stored last-sync timestamp pre-departure.
- **R3.7, R3.9, R3.10 and R3.5 C are the Run screen, not separate screens.** Reading their frames side by side, all four are the same "Run 1 · VEH039" layout with a done stop shown as a compact row instead of its full card (`CompletedStopRow`), worded for the moment: "{outcome} HH:MM · saved on phone, syncs later" or "{outcome} · issue sent to Dispatch when you reconnect" mid-run (R3.5 C, R3.7), "{outcome} HH:MM · signed {name}" plus a "Saved on phone" tag once every stop is done (R3.9, R3.10). Saving an outcome in `OutcomeScreen` always just navigates to `/driver/run`, which renders the right one from the data.
- **R2's "Arrived" and "Window opened" facts are two stat tiles,** not Figma's two-row list with an inline tag on each row. Same information, a different shared-component shape; not worth a new row-list component for two call sites.
- **"All synced" and "Nothing to send" are a plain line,** not the pill Figma draws next to "N of 2 stops done". A stops-done progress bar was still added under that line once it was clear from a pixel comparison that Figma draws one.
- **Call store has no action.** The dataset has no outlet phone numbers, and field conventions section 8 bars inventing one ("use Peliyagoda dispatch desk" is the pattern for a dispatch contact, not a store's). The button is drawn but does nothing yet.
- **One shared Proof of delivery section, even in the per-order grid (R3.4).** Figma draws a single photo, receiver name and optional signature for the whole stop in every outcome layout, including when orders have different outcomes, so a Damaged order's "take a photo of the damage" instruction points at that same single capture rather than a second one.
- **Other reuses the Refused pattern exactly** (reason chips, a name field, "Dispatch will decide"), as driver prompt 3 section 6 directs, since no frame draws it.
- **(Superseded by O3) R1.7 and R1.8 were gallery-only layouts.** Both are registered in `/driver/_states` with fixture data shaped the way driver prompt 4's sync result will supply it (`RunScreen`'s `reviewNotice` prop), but nothing in this prompt produces a real review or resolution notice, since that needs the conflict rule and a plan v5 the phone does not yet know about (by design: "the phone never learns about plan v5 in this prompt").
- **ORD2003's weight and volume are not drawn anywhere** (only its 9-unit count is, on R1.2 and R2.3). Estimated from ORD2002's per-unit rate (45 kg / 0.6 m³ for 8 ambient units) as 51 kg / 0.68 m³ for 9 units.
- **R3.9 and R3.10 were realigned in O3.** Prompt 3 built them as a plain list with a green "Saved on phone" tag. The Figma frames are the same card layout as R1.7: progress row with a "5 on phone" pill, two segments, an uppercase "In trip history" label, and cards with a cloud icon, the outcome and a Saved on phone pill. The helper line sits above Finish run, and the "Delivery saved on this phone" toast is the dark card with an amber cloud after the list. It now shows only when the last outcome was just saved, not on every reopen.
- **R5.1's rows are in save order,** not Figma's (Arrival OUT084, Delivered ORD2003, Arrival OUT087, then the conflict). The order in the frame follows no rule the data has.
- **R5.3 for a Partial resolution** has no frame. It reuses the layout with the title "Kept as Partial at OUT084", the body "Dispatch kept your delivery at OUT084 as Partial · 07:05." (the prompt's copy), a Partial pill on each order, and R1.8's bar reads "OUT084 - resolved: delivered as Partial. Kumari kept your delivery at 07:05."
- **"Call Dispatch" on R5.S 2 has no action,** like "Call store": the dataset has no dispatch desk number and none is invented. The failed screen reuses the reference WP-SYNC-409 that R8.3 uses for a photo.
- **R8.3 has no bell, chip or tab bar, as drawn.** It opens from the alert on the run and from the list.
- **"You went offline" is timed when the phone notices,** not at the scripted 05:17: with a real disconnect in the walkthrough it reads 05:20. The Kandy gate frame draws 05:17; with the coverage gap switch on the two agree.
- **The bell badge is the danger colour at 18 px,** as R1.7, R1.8 and R8.2 draw it, not the amber count the foundation had.
- **R5.1 opened from an old "sent for review" entry after Dispatch has decided shows the decision (R5.3),** since the conflict it describes is gone.
- **Camera and Receiver name drop the tab bar; Signature keeps it**, matching what each frame actually draws (R3.2, R3.3 omit it; R3.11 does not).
- **The Prototype row stays on the live Outbox in every state.** R4.2 and R4.3 draw the sheet without it, but it is the only way to turn Simulate offline on while online, so the app always shows it. Their gallery frames pass `showSimulate: false` so they still match Figma.
- **"Send now" is pressable offline.** Figma draws it enabled on R4.1 (offline), and the prompt says it is only possible online; it stays enabled and does nothing until coverage returns, rather than greying out a button the frame shows live.
- **The chip says "Synced HH:MM" after a catch-up with news, and "Online" otherwise.** R1.7, R1.8, R4.3 1, R4.3 3, R5.1 and R5.3 draw "Synced" with a time; R5.2 and R5.S 3 draw "Online". The build shows "Synced" with the last sync time on the run, R5.1 and R5.3 while a stop is under review or resolved, and "Online" everywhere else once departed. The Figma frames do not state a rule, so this is inferred.
- **Syncing and Failed are the plain muted outline on the phone chip,** as R5.S 2 and R5.S 4 draw them, not amber or red. The loader's tablet chip is unchanged.

### Shared files this role has changed

- `frontend/src/domain/field.ts`: `Stop` gains optional `parkingNote` and `unloadMinutes` (additive; R1 and R2's "Rear dock, normal parking. Allow about 15 min to unload.").
- `frontend/package.json`: one new script, `test:hero`. No dependency or version change.
- `frontend/src/field/components/BottomSheet`: a `flush` variant (full-bleed body, 40 px grabber) and a `headerAside` slot, a z-index so the sheet and scrim sit above the shell's bars, a plain scrim in the non-modal gallery case (Radix draws none), and the flush sheet opens focused on itself. Existing sheets are unchanged.
- `frontend/src/field/components/ConnectivityChip`: `progress` ("3 / 5") and a `retrying` status ("Retrying 1"). Additive.
- `frontend/src/field/offline/blobs.ts` and `db.ts`: `useBlobs()` (null until the first read) and `lastAttemptAt` on a blob, for "Last try". Additive.
- `frontend/src/field/offline/sync.ts`: photos upload in the order they were taken (the table is keyed by a random id, so they went in a random order), and a failed upload records the time of the try.
- `frontend/src/field/components/NotificationBell`: the badge is the danger colour, 18 px, top left of the icon (R1.7, R1.8, R8.2). Additive to the count it already took.
- `frontend/src/field/components/PinnedActionBar`: `helperPosition` ("above" for R1.7, R1.8, R3.9, R3.10). Additive.
- `frontend/src/field/components/ConnectivityChip.module.css`: the phone chip's Syncing and Failed are the muted outline (R5.S 2, R5.S 4).
- `frontend/src/field/offline/sync.ts`: a call that joins a run already in flight now makes the run go round once more when it finishes. A record saved while a run was sending was never in that run's list and waited for the 30 s timer, which left "Departed" unsent in the hero walkthrough about one run in three. One new unit test.
- `frontend/src/field/offline/sync.ts`: `requeueInterrupted()`, called when the engine starts. A record left `sending` by a reload or a killed app was never retried; it now goes back to `waiting` and is sent (the server answers `duplicate` if the first send landed). One new unit test.

### Checks run (D5)

- `npm run typecheck`, `npm run lint` and `npm run build` are clean on every commit.
- Every registered gallery frame (1 × R1.1 to R1.S, 9 × R2, 13 × R3) was read by hand against the Figma file's own text (the read-only `use_figma` dump script, field conventions section 3) and matches, including the exact wording of every banner, stat tile and pinned-bar helper.
- Eight frames across R1, R2 and R3 (R1.1, R1.5, R1.6, R2.1, R2.2 B, R3.1, R3.5 B, R3.9) were pixel-compared against real Figma screenshots with `npm run compare`. Three real mismatches turned up and were fixed: the connectivity chip and the bell were in the wrong order, "Departed" was a plain label instead of the shared status pill (and was stretching full width before `align-self: flex-start`), and the chosen outcome chip had no check mark. The remaining frames were not pixel-compared, only text-verified as above.
- The hero path (PRD H5 to H14) was played twice: once by hand in a real browser, and once as `npm run test:hero` (`scripts/driver-hero-walkthrough.ts`), 18 checks, all green, including a genuine `context.setOffline(true)` disconnect at 05:17 on top of the scripted Kandy gate.
- The sunlight switch, text size and language settings were checked for persistence across a reload.
- Not done, and worth knowing before the judge walkthrough: the live camera viewfinder has only been exercised via the file-input fallback (no camera in headless Chromium or in this session's environment), not on a physical phone over `npm run dev:https`; and R1.7/R1.8 have no live trigger, only the gallery layout.

---

## 📋 Spec: PRD v3.1 (2 Oct)

`waypoint-prd-v3.md` is the build spec and `waypoint-central-context-v3.md` is the team context. v3.1 settles ten contradictions and gaps the field build found when v3 was read against the loader and driver prompts. Changes are logged as V32 to V42 in the PRD change log. The ones other roles need to know about:

| What changed | Who it affects |
|---|---|
| **Two planned distances, both correct.** `planned_fuel` stays per order (VEH039 trip 1 is 22 km, which is where 4c's "fuel 75.4 / 370 L" comes from) and belongs to D2, D3 and R-FUEL. A new `planned_run_legs` counts legs per stop, where an outlet with two orders is one stop, so R9 reads 19 km. R9 is no longer served by `planned_fuel` | Backend rules module, driver, dispatcher |
| **The dock is a device setting.** `?dock=kandy\|peliyagoda` works in the live app, is remembered, and presenter mode adds "Change dock" to the loader top bar menu. Walkthrough step 10 now says to switch dock | Loader, app shell |
| **"Other…" has a PIN:** a typed name plus the guest PIN `0000`, with the typed name stored as the actor. The tablet caches salted hashes for every PIN person and the guest PIN, not only its own dock's people | Loader, auth, backend |
| **R10's three dates** have no plan in the seeded database, so in API mode they serve the driver fixture. `GET /driver/runs/{date}` returns a run, a `no_run` reason, or a run plus a monsoon calendar block | Driver, backend |
| **Mock to real is `VITE_<ROLE>_API=mock\|api`** per role. The field transport has a mock and a `fetch` implementation behind one function with the same connectivity behaviour; in API mode each sync handler posts its record to `POST /sync` as a batch of one | Every frontend role |
| **Non-vehicle loader flags and driver problems** reach D6, are listed, and are marked seen when opened. No plan version is created. Only "Vehicle check failed" has a Dispatch screen (D8) | Dispatcher, loader, driver |
| **R6 problems are threads.** `driver.problem` gains `updatesClientId`; `exceptions` gains `parent_id` and `seen_at` | Driver, backend |
| **The app shell has no owner.** Build stage 2b covers `/sign-in`, `/start`, per-role sessions, the avatar menu, the presenter panel and Change dock. It is about half a day and blocks stage 7 (open decision O-11) | Whoever takes it |

Also added: assumptions A55 to A58 (the guest PIN, text size Large at 1.15 ×, photo compression at JPEG / 1600 px / 0.7, the camera fallback to the file picker), departures DP-19 to DP-25, known gaps G-14 and G-15, and open decisions O-8 to O-11.

**One check is still open.** A55 says Priya and Ruwan are offered at both docks, as drawn on L1.2 A (`442:27454`). The Figma connection was unavailable when v3.1 was written, so the row says to confirm it: if only Ruwan and Other… appear on that Kandy frame, drop Priya from Kandy and keep the rest of the row.

**Departure numbering.** Role branches list their departures in their own README section in prose and do not number DP rows, because parallel branches would collide. HH merges them into the PRD section 18 register on Sat 3 Oct.

**AI disclosure.** `docs/ai-disclosure.md` records where AI assistants did a meaningful part of the work, the invented data register, and the machine-drafted Sinhala and Tamil driver strings. Add a line when AI does a meaningful part of your PR, as `Contributing.md` section 24 asks.

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
