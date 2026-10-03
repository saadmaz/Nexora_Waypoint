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
| `/loader`, `/loader/dock` | Loader root, always Dark · pre-dawn. L1 Dock is built (loader prompt); see "Waypoint Load" below |
| `/loader/vehicles/:vehicleId/trips/:trip`, `/loader/changes` | Placeholders for L2 and L4 |
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

## 🔐 App shell (sign-in, role picker, sessions, presenter control)

The frames every role passes through before its own screens: sign-in (G1), the role picker (G2), per-role sessions and the one presenter control the judge walkthrough drives. Branch: `feature/auth`, cut from `develop`, frontend only. There is no backend yet, so everything runs against a mock. The brief is [`claude/field-build/06-app-shell.md`](claude/field-build/06-app-shell.md).

**Status:** A0, A1 and A3 built (`tsc -b`, `oxlint`, `vitest run`, `vite build` all clean; 39 tests, 18 of them in `screens/auth`). A3 landed before A1 and A2 because the Figma connection was down; `/start` and `/auth/_states` answer with placeholders until A2 and A6 replace them. A2 and A4 to A6 are not started.

### Accounts

One demo password for all four accounts. PRD v3 section 4c leaves passwords to A40 and the README. The password is the backend's `DEMO_PASSWORD` (`.env.example`, seeded by `backend/seed/accounts.py`); the mock uses the same value so signing in behaves the same in mock and API mode. The default is `waypoint-demo` in `.env.example`, `backend/app/config.py` and `docker-compose.yml`. Anyone whose own `.env` still sets `DEMO_PASSWORD=waypoint` must change it, or sign-in against the real backend fails. The backend tests set their own password and are unaffected.

| Role | Email | Shown as | Lands on |
|---|---|---|---|
| Dispatcher | `dispatcher@waypoint.demo` | Kumari | `/dispatcher/queue` |
| Loader | `loader@waypoint.demo` | Dock tablet (a shared device, not a person) | `/loader/dock` |
| Driver | `driver@waypoint.demo` | Nimal | `/driver/run` |
| Store | `store@waypoint.demo` | Anusha | `/store/orders` |

Password for all four: `waypoint-demo`. The loader still enters a PIN per action after signing in; `PinSheet` from the field foundation does that and is not rebuilt here.

### Sessions (`src/screens/auth/session.ts`)

Stored per role under `wp.session.dispatcher`, `wp.session.loader`, `wp.session.driver` and `wp.session.store`, so one browser holds all four roles in four tabs. Signing out clears one role only. A session holds the role, email, display name, an opaque token and the sign-in time; the token is a demo string in mock mode and is shaped so a real JWT is a swap.

- Every read and write is wrapped. A blocked or cleared `localStorage`, or a quota error, never breaks sign-in: a failed read means "not signed in", a failed write leaves a session that lasts the tab.
- The tab-lifetime fallback answers only for a role whose write failed. A role that saved normally is dropped from it, so a session cleared in another tab or by clearing site data reads as signed out.
- Nothing clears a session on a failed network call, so the driver token survives going offline and the outbox can sync later (PRD v3 section 15).
- `readAnySession()` backs the `/` redirect and returns the first role in picker order (dispatcher, loader, driver, store); `readAllSessions()` backs the signed-in state on the `/start` cards.

### Sign-in API (`AuthApi.ts`, `mockAuthApi.ts`)

`signIn(email, password)`, `signOut(role)` and `getSession(role)`. A wrong password returns `{ ok: false, reason: "invalid_credentials" }` and being offline returns `{ ok: false, reason: "offline" }`; neither throws. An unknown email and a wrong password give the same answer. The mock answers in 300 to 600 ms like the field transport, and at once under vitest.

`VITE_AUTH_API=mock|api` picks the implementation, defaulting to the mock. PRD v3 section 9 principle 7 names the pattern `VITE_<ROLE>_API` for the four roles only, so this is a small extension of it, not something the PRD already says.

### Figma nodes

File `0qCle1zCrSImSou4lVlvmL`, page "Nexora (main)" `0:1`. The G frames are one contiguous block at `442:67xxx`.

| Node | Frame |
|---|---|
| `442:67261` | G1.1 Sign-in, desktop (1440 x 900) |
| `442:67336` | G1.2 Sign-in, phone, Light (390 x 844) |
| `442:67411` | G1.3 Sign-in, phone, Dark · pre-dawn (390 x 844) |
| `442:67486` | G1.4 Sign-in, wrong password (390 x 844) |
| `442:67568` | G1.5 Sign-in, offline (390 x 844) |
| `442:67656` | G2.1 Role landing, Dispatcher (480 x 560) |
| `442:67672` | G2.2 Role landing, Loader (480 x 560) |
| `442:67688` | G2.3 Role landing, Driver (480 x 560) |
| `442:67704` | G2.4 Role landing, Store (480 x 560) |
| `442:67720` | G3 Presenter mode over D6.4 (1440 x 900) |
| `442:68072` | G4 "Why this screen" over D7.1 (1440 x 900) |

There are five G1 and four G2 frames, as PRD v3 section 3 says. The conventions table once listed `175:2174`, `175:2456` and `175:2472`. They render the same frames as their `442:67xxx` counterparts but are an older copy outside this block; build from the table above.

### Notes from reading the frames

- **The sign-in frames already read "Waypoint".** The brief expected "Waypoint Dispatch" and a departure to fix it. G1.3 prints the neutral wordmark already, which is what PRD v3 section 6 asks for, so no departure was needed. Each role's own app name still appears in its chrome.
- **G1.4 and G1.5 are drawn.** The brief expected no retry and no offline frame. Both exist, taller than the base phone frame because they carry extra content, so they are copied as drawn. The retry behaviour (inline error, password cleared, focus back on it, email kept, no attempt counting) is still built, and only where the frames stop short.
- **G1.5's offline text, in full.** The warning alert reads "You're offline" (Archivo SemiBold 14) over "Sign-in needs a connection once. After that, field screens work offline." (Archivo Regular 13, line height 18). That is the whole string; the earlier metadata dump cut it at "After t...". The rest of the frame: the Sign in button at 40% opacity, the email field showing the placeholder "name@waypoint.lk", the password field empty, and below a divider the "Demo accounts" helper with a "Prototype" tag and four rows ("Kumari · Dispatcher", "Dock tablet · Loader", "Nimal · Driver", "Anusha · Store manager", each over its `@waypoint.demo` address in Plex Mono 12). The brief suggested "Your orders and deliveries are safe. Nothing was changed." for offline sign-in; Figma wins, so that line is not used.
- **PRD section 3's G2 card copy is abbreviated against the frames.** The frames add "· synced" to the Loader and Driver cards, plus a context line above and a target line below each card (for example "Peliyagoda dock · enter PIN per action" above and "Opens L1 Dock board" below). The frames are what gets built.
- **The G2 corner labels** (`DISPATCHER · LIGHT`, `LOADER · DARK`, `DRIVER · DARK`, `STORE · LIGHT`) name the theme of the role app each card opens, which is the per-role table in PRD v3 section 6. `/start` itself stays Light · office, and `/sign-in` is Light on desktop and Dark at phone width.
- **G2.1 names two screens** ("Opens D1 Queue / D6 Operations") but the card goes to `/dispatcher/queue`. The line is kept as drawn because it is descriptive text.

### Sign-in (A1)

`/sign-in` is one screen, `SignInScreen`, that draws every G1 frame from props: the layout (desktop or phone), a wrong password, offline and busy. `SignInRoute` owns the state and talks to the AuthApi through `getAuthApi()`, which is where `VITE_AUTH_API` is read. In `api` mode it returns the real client (`apiAuthApi`), so nobody signs in against the mock by accident; see "API mode" below.

- **Files** (`src/screens/auth/`): `SignInScreen.tsx` and its CSS module, `SignInRoute.tsx`, `signInStrings.ts` (every string, copied from Figma), `useIsPhone.ts`, `useSignInConnectivity.ts`, `authClient.ts`, and `gallery/` (the frame registry and the page).
- **Gallery and compare.** `/auth/_states` lists the five frames at their Figma size; `?frame=G1.4` draws one. `npm run compare -- auth G1.1 G1.2 G1.3 G1.4 G1.5` screenshots them beside `.figma/<id>.png` (it needs `npm run dev` running).
- **Retry.** A wrong password or an unknown email shows "Email or password is wrong. Check both and try again." under the password, keeps the email, clears the password and puts focus back on it. Attempts are not counted and nothing locks.
- **Offline.** `navigator.onLine` events are fed into the field `connectivity` store by `useSignInConnectivity`, because the field runtime that normally does this does not run on `/sign-in`. Offline shows the G1.5 notice and disables Sign in; an existing session is never touched.
- **Loading.** The form is a disabled `fieldset` and the button is busy. The button keeps its box, so nothing moves.
- **Demo accounts.** Tapping a row signs in at once with the demo password. Offline it only fills the fields.

**Decisions confirmed (2 Oct).** Demo rows sign in at once; desktop controls are 40 px as drawn and 44 px on touch; the wrong-password message names what to do. Where Figma is silent or contradicts the brief on a UX point, the stronger experience is chosen and any visible difference from a frame is recorded under "Departures from the brief".

**How it was checked.** Each frame was captured at 1x and diffed against its Figma PNG: every frame has the exact Figma size, every box edge (card, inputs, button, rows, notice) is within 1 px, and what remains is text and icon anti-aliasing plus a 1 px offset on the Prototype tag. The behaviour was driven in Chromium: wrong password then retry, no lockout, unknown email, no layout shift while loading, the four demo rows, four roles in four tabs of one browser, `/` redirecting a signed-in browser, the Dark phone theme and offline blocking and recovery. That script is scratch; the permanent four-role Playwright check comes in A6.

### Departures from the brief

- **Offline detection** reads the field `connectivity` object, not `navigator.onLine` directly. It wraps the browser's online state and adds "Simulate offline", which the walkthrough uses, so sign-in agrees with the rest of the app about being offline.
- **The API pattern** follows `api/StoreApi.ts` and `mockStoreApi.ts`. The brief points at `LoaderApi` and `mockLoaderApi.ts`, which live on the unmerged `feature/loader`.
- **`Role`** is the existing union in `domain/status.ts`; no second one was declared.
- **The wrong-password message names what to do.** G1.4 draws "Email or password is wrong." The brief asked for an error that says what to do next, so the live message adds "Check both and try again." The drawn sentence is verbatim and still does not say which of the two was wrong. This is a visible difference from G1.4, chosen deliberately, so the gallery frame and the compare for G1.4 show the longer text.
- **Line height is 1.08**, not the project's fixed 34 and 24. The frames set the sign-in text to automatic line height, and the browser's own `normal` (1.088) drifts 2 px down the card. 1.08 was measured against G1.2 and lines every box up exactly.
- **The desktop button is the shared `Button`**, medium, with its height and label size overridden through the `--size-button-md` and `--text-button-md` tokens inside the sign-in screen (40 px and 14 px, as G1.1). No second button was built and no shared file changed.
- **The disabled Sign in is the shared Button's 50%**; G1.5 draws 40%.
- **The demo row icons are 18 px**, as drawn. The shared `Icon` has no 18 size, so the SVG is sized in the sign-in CSS.
- **The email value is set in Plex Mono**, as G1.4 draws it, with the placeholder in Archivo.
- Sign-in assumptions where Figma is silent (demo row behaviour, the live theme, desktop control height, focus on load, empty submit) are in PRD section 4d under "App shell assumptions", unnumbered for central numbering.

### Shared files this role has changed

- **`frontend/src/app/App.tsx`** (A3, its own commit; a shared contract under Contributing section 18). It now routes `/` (a redirect), `/sign-in`, `/start`, `/auth/_states`, `/loader/*`, `/driver/*`, `/dispatcher/*`, `/field/_components` and `/store/*`. The route components live in `screens/auth/` under their final names, so sign-in, the role picker and the gallery replace their placeholders without touching this file again.
  - **The Store is no longer the catch-all.** Unknown paths go back to `/`, which sends a signed-in person to their role home and everyone else to `/sign-in`. The Store keeps every `/store/...` URL it had. It cannot sit under a `/store/*` parent, because `StoreRoutes` uses absolute `/store/...` paths and React Router would resolve them relative to `/store`, so it stays at the catch-all and answers only for its own prefix.
  - **Dispatcher slot.** `feature/dispatch-planning` is not merged, so `/dispatcher/*` renders a placeholder. The route has to exist: a signed-in dispatcher is sent from `/` to `/dispatcher/queue`, and without it that path would bounce back to `/` forever. The slot is marked in `App.tsx`. When the dispatcher branch merges, replace that line with `<Route path="/dispatcher/*" element={<DispatcherApp />} />` and delete `DispatcherSlot`.
- The presenter control (`app/PresenterControl.tsx`) and the Store top bar change in A4 and A5, each in its own commit, and will be listed here.

### Phases

- [x] A0 `AuthApi`, mock, `session.ts`, types (10 tests)
- [x] A1 G1 sign-in, five states, desktop and phone, retry, offline (8 new tests)
- [ ] A2 G2 `/start`, four role cards
- [x] A3 router: `/sign-in`, `/start`, `/` redirect, `/auth/_states` (`/start` and `/auth/_states` are placeholders until A2 and A6)
- [ ] A4 one shared presenter panel in `app/presenter/`, replacing the Store's copy
- [ ] A5 avatar menu, mounted in the Store top bar
- [ ] A6 gallery, Figma compare, Playwright four-role sign-in, this section completed, `docs/ai-disclosure.md` line

### Still to check

- The Store keeps `app/scenarioClock.ts` and the field apps keep `field/clock/clock.ts`. Two clocks, not unified here; whoever wires the real API should merge them.
- The vitest session tests stub `window.localStorage` because the test environment is `node`. A browser-level check of the four-tab sign-in comes with the Playwright script in A6.
- **Real client, wire format.** Over the wire the backend sends camelCase (`accessToken`, `expiresAt`, `displayName`), because its `ApiModel` has a camelCase alias generator. The real `AuthApi` maps those to `Session`; the field names in `types.ts` already match.
- **A server error has no frame.** `SignInFailureReason` is `invalid_credentials` or `offline`. A `5xx`, or a `429` if the backend adds rate limiting, would need a third reason and copy, and Figma draws neither. Decide with the real client.
- **Sign-in button weight and disabled opacity.** The label renders at the shared token's 600 where the Figma dump says Bold, and the disabled button is the shared 50% where G1.5 draws 40%. Check both against the Store's buttons in the A6 compare pass.
- **G1.4 compare.** The live message is longer than the frame's by design, so the G1.4 compare will differ on that one line.

---

## 🏭 Waypoint Load (Loader)

L1 Dock, L2 Load plan, L3 Flag exception and L4 Plan changed, built in `frontend/`, branch `feature/loader` from `feature/field-foundation`. Binding rules: [`docs/build/field-conventions.md`](docs/build/field-conventions.md) and the loader prompt. The tablet layout (L1.7) is built and a Playwright run plays both stories (L6).

**Status:** L0 (types, fixtures, `LoaderApi`, mock server), L1 (Dock: every state, PIN acknowledgement, countdowns, held vehicle, plan-changed banner, offline cache, empty, loading, error) and L2 (Load plan: checks, count confirm, short units, the gate, loaded, held, the VEH003 → VEH036 swap reload), L3 (flag exception sheet, the outbox-driven sent, saved and failed states) and L4 (what changed between plan versions, acknowledge, begin loading) built, checked and compared against Figma. L1.7 (tablet master-detail at 1024 px and wider) is built as L5. The state gallery holds every frame the loader prompt lists (42), all compared against Figma, and `npm run test:loader-stories` plays both stories in a browser.

### How to run

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173/loader/dock?dock=peliyagoda        Priya's dock
# http://localhost:5173/loader/dock?dock=kandy&at=04:14     Ruwan's dock, v4 no change
# http://localhost:5173/loader/vehicles/VEH003/trips/1/flag?dock=peliyagoda&date=2026-09-29&at=02:55&dev=1   Priya's flag
npm run compare -- loader L1.1 L1.3 L2.1-A L2.3-A L2.4 L2.5 L2.6-A L2.6-B --base http://localhost:5173
```

`?dock=peliyagoda|kandy` sets which dock this tablet is at and saves it (`settings` table); without it, or on a first run with nothing saved, a plain dock picker asks once. This picker is not a designed screen (loader prompt section 3 allows it) and is kept out of the main UI.

### The two stories

- **Priya, Peliyagoda.** Open `/loader/dock?dock=peliyagoda`. Acknowledge plan v3 (PIN `1234`), open VEH003 or VEH035's load plan, check each order (the count stepper is prefilled, lower it for a shortfall), confirm the gate with a PIN. To play the swap, open `/loader/dock?dock=peliyagoda&date=2026-09-29&at=02:55&dev=1`, acknowledge v3, open VEH003, **Flag issue**, **Vehicle check failed**, **Send to Dispatch** (PIN `1234`), then tap **Dispatch decides now** (the tab on the top edge) instead of waiting for 03:00. **Review change** opens L4: what changed (ORD1002 removed, VEH003 → VEH036), **Acknowledge and load VEH036** (PIN), then **Begin loading VEH036** opens VEH036's load plan.
- **Ruwan, Kandy.** Open `/loader/dock?dock=kandy`. Acknowledge plan v3 (PIN `5678`) first (so there is a version to compare against), then once Peliyagoda's plan reaches v4 the Kandy dock shows "Plan v4: no change to your vehicles" and asks for a fresh acknowledgement (L1.6 A/B), then load VEH039 (L2.1 to L2.4) and confirm the gate.

### Demo PINs

Priya `1234`, Ruwan `5678` (PRD v3 assumption A36). Both are offered at both docks (their `dock` in `fixtures.ts` is their home dock, informational only). "Other…" takes a typed name plus the guest PIN `0000` and is recorded as the actor under that name.

### `LoaderApi` and the mock server (`src/screens/loader/`)

- `fixtures.ts`: docks, people, PINs and the guest PIN, plan v3 and v4 trips for VEH003, VEH035, VEH036, VEH011 (Peliyagoda) and VEH039 (Kandy), copied from PRD v3 §4c's "Plan v3 trips" and "Pinned orders" tables.
- `LoaderApi.ts` / `mockLoaderApi.ts`: one in-memory server per app session. `getDock`, `getLoadPlan`, `getPlanDiff`, `getException`, `getCurrentVersion` read it; `acknowledgePlan`, `recordCheck`, `confirmLoaded`, `flagException` write it. Every write applies to the mock server at once (so the screen never waits on the network to show a check as saved) and is also enqueued under `loader.ack`, `loader.check`, `loader.confirmLoaded` or `loader.exception`, so the outbox, the sync engine and the connectivity chip all see it the same way a real write would behave. The VEH003 "Vehicle check failed" exception resolves into plan v4 at the scenario's 03:00, or at once via `devResolveExceptionNow`, which the **Dispatch decides now** tab (`?dev=1`) calls.
- `LoaderProvider.tsx` / `LoaderContext.ts`: creates the one `LoaderApi` for the session, resolves the dock, and remembers the last person to enter a PIN this session (`currentPerson`) as the actor for a write the frames never re-prompt for, such as a per-order count confirm.
- Reads go through `useFieldQuery` (`field/offline/query.ts`): cache-then-network, falling back to the last cached value on a `NetworkError` and marking it stale (L1.S-3, L2.S-3).

### L1 Dock (`src/screens/loader/dock/`)

`Dock.tsx` is presentational (a `view`, an `alert`, a list of vehicle cards, a pinned acknowledge button); `DockContainer.tsx` wires it to `LoaderApi`, the scenario clock and connectivity for the live route, and the state gallery builds the same `Dock` and `VehicleCard` straight from literal fixture props, per frame. `VehicleCard.tsx` is the vehicle row (L1.1 to L1.6), including the held variant with its "Go to VEH0xx" shortcut.

### L2 Load plan (`src/screens/loader/loadplan/`)

`LoadPlan.tsx` is presentational and covers every L2 phase: the in-progress checklist with each order's inline count-confirm (no sheet: the row itself expands, matching L2.1 B's taller frame), the gate, two different "loaded" layouts (L2.4's plain summary with "Who already knows" for a normal vehicle, L2.6 B's capacity bars and full order list for the swap), the held/frozen read-only list (L2.5), and the empty, loading, offline and error states. `LoadPlanContainer.tsx` wires it to `LoaderApi`. The reverse-stop-order check row reuses `LoaderCheckCard` (field conventions LIB1), extended this phase with a `planned` state (the held list's read-only pill) and a `protectedOrder` flag (OUT012's lock tag in place of its brand tag).

### L3 Flag exception (`src/screens/loader/flag/`)

`FlagSheet.tsx` is the bottom sheet over the load plan: **What's wrong?** (L3.1, the six types), the details for the chosen type (L3.2 A for a failed vehicle check, L3.2 B for an order), then it follows the flag: **sending** (L3.4 C), **sent, Kumari reviewing** (L3.3 A) and **decision made, plan v4** (L3.3 B). `FlagStatus.tsx` draws the two full screens that replace the sheet: **saved on this tablet** (L3.4 A, offline) and **couldn't send** (L3.4 B). `FlagContainer.tsx` wires them to `LoaderApi` and the outbox.

The flow runs at `/loader/vehicles/:vehicleId/trips/:trip/flag` (the load plan stays behind the sheet). "Flag issue" opens the type chooser; "Flag shortage" on L2.2 opens Missing item with that order and the units short already filled in. **Send to Dispatch** asks for a PIN (`PinSheet`), then saves the flag in the outbox. What the sheet shows comes from that outbox record, not a timer: waiting while online is "sending", waiting while offline is "saved on this tablet", an error is "couldn't send" (Retry runs `runSync({ force: true })`), accepted is "sent". A failed vehicle check holds the vehicle at once (L1.4, L2.5) and Dispatch decides it into plan v4 at 03:00 on the scenario clock; **Review change** then opens L4.

**Every other flag only reaches Dispatch** (PRD v3.1 G-14, no designed resolution): the sheet stays at "sent", the status line becomes "Kumari has seen this" once Dispatch opens it, and no plan version follows. Add `?dev=1` (or `?presenter=1`) to show a **Dispatch decides now** button, which decides the VEH003 check or marks any other flag seen, so the flow can be played without waiting for 03:00. In API mode the real dispatcher does this at D8 (PRD v3.1 section 13).

An optional photo (Vehicle check failed, Damaged item, Wrong item, Other) uses the device camera where there is one and the file picker where there is not (A58), compressed to JPEG at 1600 px and quality 0.7 (A57), and uploads after its record.

### L4 Plan changed (`src/screens/loader/changes/`)

`PlanChanged.tsx` is presentational: the diff in the order the prompt asks for (Removed, loudest; Changed; Unchanged; the new trip 1 capacity; the vehicles with no change, collapsed), the pinned **Acknowledge and load** with its "You'll enter your PIN" helper, and the states around it: **acknowledged** (L4.2), **no change for this dock** (L4.3, still needs acknowledging), **up to date** (L4.S 1), **loading** (L4.S 2), **offline, may be missing a newer version** (L4.S 3) and **couldn't load, Retry** (L4.S 4). `ChangesContainer.tsx` wires it to `getDock` and `getPlanDiff` at `/loader/changes`. The diff runs from the version the dock last acknowledged to the current one; once this screen acknowledges, it keeps showing that same diff (L4.2) instead of reading the new version as the old one. **Begin loading** goes to the first changed vehicle's load plan.

### L5 Tablet master-detail (`src/screens/loader/tablet/`)

At 1024 px and wider the dock and load plan share one screen (frame L1.7, 1024 x 768). `TabletShell.tsx` draws the app bar (Waypoint Load, tabs, date line, sync chip), a 360 px master pane and the detail pane. `TabletDock.tsx` owns the dock query and passes it to `DockContainer` (`embedded`, so a card selects its vehicle and has no action button); the detail pane is `LoadPlanContainer` in `embedded` mode. The selected vehicle comes from the URL (`/loader/vehicles/:id/trips/:n[/flag]`); on `/loader/dock` it is the next vehicle to load once the dock is acknowledged, and a placeholder while the dock is locked. `LoaderApp.tsx` uses a layout route (`DockRoutes`) that renders `TabletDock` on wide screens and an `Outlet` on phones, so the phone screens are unchanged. `WideColumn.tsx` centres L4 at 720 px.

### Playwright run of both stories

`npm run test:loader-stories` (`scripts/loader-stories.ts`, needs the dev server; `-- --base http://localhost:5199` for another port, `-- --headed` to watch) plays both stories at 390 x 844 in Chromium. Mock state lives in memory, so each story stays in one page session after its first load and every later step is a tap.

- **Priya, Peliyagoda, from 02:55:** acknowledge v3 (PIN 1234), open VEH003, flag Vehicle check failed, send with PIN, Kumari reviewing; the tablet goes offline (the chip says Offline) and back online; Dispatch decides, the sheet reads plan changed to v4; review the change (ORD1002, VEH036), acknowledge v4 with PIN, begin loading VEH036.
- **Ruwan, Kandy, from 04:14:** acknowledge with PIN 5678, open VEH039, check ORD2003, ORD2002 and ORD2001 (the progress reads 1, 2, 3 of 3), confirm loaded with PIN, and see it cleared.

It checks there is no horizontal overflow on the offline step and the change screen, fails on any uncaught page error, and saves `.compare/loader-stories-fail.png` when a step fails.

### State gallery

`/loader/_states` registers all 14 of L1's frames (L1.1 to L1.7, the four L1.S states) and all 13 of L2's frames (L2.1 A to L2.6 B, the four L2.S states). It also registers all 8 of L3's frames (L3.1, L3.2 A and B, L3.3 A and B, L3.4 A to C) and all 7 of L4's (L4.1 to L4.3, L4.S 1 to 4): 42 frames in all. `npm run compare -- loader --all` renders every one beside its Figma screenshot. `npm run compare -- loader <id>` matches each against its Figma screenshot; `PinSheet`'s `demoPhase`/`demoDigits` props and `LoadPlan`'s `demoExpanded` prop freeze a sheet or a row open for the frames that need it (L1.2 B/C, L2.1 B, L2.2, L2.3 B).

### Departures from the Designathon design (loader)

- **L1.1 / L1.5 locked cards.** A locked card with no diff shows no action at all; a locked card with a diff shows "Acknowledge vN first" and its own disabled button. The build shows the detail line and button only when the card carries a Changed/No change tag, so one rule reproduces both L1.1 (bare) and L1.5 (detailed) exactly.
- **VEH035's checked count.** L1.3 reads "3 of 4 orders checked" at 00:10, L1.4 reads "3 of 5" at 02:56, with no event between them that checks a 5th order. The state gallery keeps both numbers verbatim (literal per-frame fixtures); the live dock computes VEH035's progress for real, starting at 0, since it is not part of either hero story and the two frame numbers are not reconcilable with one running total.
- **L2.4 vs L2.6 B's "loaded" layout.** The frames draw two different confirmations: L2.4 is a plain icon-tile summary with a "Who already knows" reassurance list, L2.6 B is a green banner with capacity bars and the full checked order list. The build keeps both, switching on whether the vehicle is a swap (`swap` prop present).
- **Per-order checks carry no PIN step**, matching L2.1 B exactly (stepper, then "Confirm N units", no keypad); the record's actor is the last person who entered a PIN this session (`currentPerson`), falling back to `"unknown"` if nobody has yet. Only the dock acknowledgement and the L2 gate ask for a PIN, as drawn.
- **L3's four types with no details frame** (Damaged item, Wrong item, Warehouse shortage, Other). Figma draws details only for Vehicle check failed (L3.2 A) and Missing item (L3.2 B). The first three reuse the Missing item layout with their own heading, icon and "Units damaged / wrong / short" label; Damaged item and Wrong item also offer the photo tile as evidence. Other asks "What happened?" with a typed note. Wording the frames do not give: "Tell Dispatch in a sentence.", the PIN sheet title "Send flag for VEH003", "Who's flagging?" and "Flag from Priya", the sent line for a non-vehicle flag ("Dispatch has your flag. You can keep loading the other orders.") and "Kumari has seen this".
- **L3.2 B lists three orders; the live sheet lists every order on the trip.** The frame shows ORD1001, ORD1011 and ORD1014 of VEH003 trip 1's five. The gallery frame keeps those three, with ORD1011 drawn without its Chilled tag; the live sheet draws the tag on every chilled order, as PRD 4c has them.
- **"Flag shortage" opens Missing item.** The Figma link from L2.2 goes to L3.2 B (Missing item), so that is the type prefilled, not Warehouse shortage.
- **Type labels.** Figma draws "Warehouse shortage" and "Vehicle check failed" on one line, running into the tile's padding. That is what 390 px and wider does; on a narrower screen the label wraps instead of leaving its tile.
- **No phone number.** "Call Dispatch" (L3.4 A) has no number to dial and does nothing yet: the app holds no phone numbers (field conventions section 12), only "Peliyagoda dispatch desk" as drawn.
- **L3.4 A and B have no back chevron**, as drawn; "Keep waiting" returns to the dock. Their top bar reads "Peliyagoda", without "dock", as the frames do.
- **Esc or a scrim tap on the details step returns to the type list** rather than closing the sheet, so a wrong type is one step to undo; Cancel on the type list closes it.
- **L4's deferral pill icon.** The Removed card's "Deferred · policy → Wed" pill is drawn with a curved arrow; the shared icon set has no matching glyph, so it uses `calendar-clock`, which says the same thing (moved to a later day).
- **L4 titles are links to the dock.** The screens have no back chevron, as drawn, so the title ("Plan v3 → v4") is the way back.
- **Wording the L4 frames do not give.** The v3-to-v4 case of "no change" for a dock other than Kandy reads "v4 did not change your vehicles."; the acknowledged-but-no-diff case returns to the dock instead of showing an empty diff; the expanded "no change" list reads "VEH035: same trips, same orders as v3".
- **The phone's gate has only the confirm button once every order is checked.** L2.3 A draws no Flag issue button there, only "Confirm loaded: clear to depart" and "You'll enter your PIN". Flag issue returns if an order is unchecked again, and the tablet detail pane keeps it as L1.7 draws.
- **The tablet's Issues tab is drawn but inert.** L1.7 shows it; the loader has no designed Issues screen, so it does nothing.
- **No visible gate helper in the tablet detail pane.** L1.7 draws the pinned gate row without the helper line; it stays in the page for screen readers.
- **Compact checked rows.** On L1.7 a loaded row drops its brand tag and zone line; `LoaderCheckCard` takes `compact` for it.
- **L4 on a wide screen.** There is no tablet frame for L4, so it is centred in a 720 px column.
- **Long order-ID lines wrap** with a trailing dot on a long list, rather than being cut.
- **Sheets stay a centred bottom sheet at tablet width**; no tablet frame draws one.
- **The dev control is a tab on the top edge.** It used to sit in a corner and covered the pinned action on L4 and the dock; no loader screen puts anything on the top edge, centre.

### Shared files this role has changed

- `field/components/PinSheet.tsx`: two new optional props, `demoPhase` and `demoDigits`, so the state gallery can freeze the sheet on its success or wrong-PIN frame without a fake timer. No existing prop or behaviour changed.
- `field/components/LoaderCheckCard.tsx`: a `compact` prop (L1.7's loaded row), a `planned` state (L2.5's read-only pill), a `protectedOrder` flag (a lock tag in place of the brand tag), and a `"{n} short"` tag next to the position tag when `state` is `short`. No existing prop or behaviour changed.
- `field/format.ts`: added `formatCountdown(minutes)` ("in 3 h 45 min", "in 56 min").
- `field/offline/query.ts` (new) and `field/offline/index.ts`: `useFieldQuery`, the cache-then-network read hook every field screen's offline state needs. Exported alongside the rest of `field/offline`.
- `vite.config.ts`: `server.fs.allow` now adds the real parent of `node_modules` only when it resolves outside the project directory (a worktree with a symlinked `node_modules`); a normal checkout is unaffected.
- `shared/ui/Icon.tsx`: two new names, `archive` and `wrench`, which L3.1 draws. Additive.
- `field/components/BottomSheet.tsx`: a gallery (non-modal) sheet now draws the 60 percent scrim Radix leaves out and no longer pulls focus into its frame, so the L1.2, L2.3 B and L3 frames dim their screen as Figma does; a tap on anything carrying `data-keeps-sheet-open` (the dev controls, and the presenter control when it lands) no longer dismisses an open sheet. The live modal behaviour is otherwise unchanged.
- `field/offline/query.ts`: `useFieldQuery` also returns `refresh()`, a background re-read that keeps the current screen, alongside `retry()`, which resets to loading. Polling and refreshing after a write used `retry`, which blanked the whole screen and unmounted an open sheet every 15 seconds; they use `refresh` now.
- `scripts/compare-frames.ts`: waits 500 ms before capturing, so a sheet is shown settled rather than sliding in.
- `docs/ai-disclosure.md` (new): the table Contributing.md section 29 asks for, with this branch's row.

### Phases

- [x] L0 types, fixtures, `LoaderApi` and mock server
- [x] L1 Dock: every state, PIN acknowledgement, countdowns, offline cache
- [x] L2 Load plan: checks, count confirm, short units, gate + PIN, loaded, held, swap reload
- [x] L3 Flag exception sheet
- [x] L4 Plan changed
- [x] L5 L1.7 tablet master-detail
- [x] L6 Playwright run of both stories, final README pass

---

## 🚚 Driver (Waypoint Driver)

Nimal's app: today's stops, offline-first, one decision at a time. Built in `frontend/`. Branch: `feature/driver`, cut from `develop` after `feature/field-foundation` merged. Driver prompt 3 (`claude/field-build/03-driver-core.md`) covers the shell and the hero delivery path (R1 Route, R2 Stop detail, R3 Record outcome, the Me tab); the outbox sheet, sync, conflicts and notifications (R4, R5, R8) are prompt 4, and problems, history, the GPS tracker, finish run and calendar days (R6, R7, R9, R10) are prompt 5.

**Status:** R1 to R3, the Me tab and driver prompt 4 (R4 Outbox, R5 Sync result, R8 Notifications, the conflict and its resolution) are built, checked and pushed. D0 to D5 and O1 to O6 (below) are done, except the physical-phone check, which needs a person with a phone (see "Real devices").

### How to run

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
npm run dev:https        # self-signed HTTPS on the LAN: the real camera needs a secure context on a phone
npm run compare -- driver R1.1 R3.1   # frame screenshots beside Figma (needs the dev server and .figma/<id>.png)
npm run test:hero        # the hero path end to end against a running dev server (see "Checks run")
npm run test:hero -- --partial   # the same, ending with the presenter's "Keep as Partial (10 of 12)"
npm test                 # vitest, 55 tests
npm run build && npm run preview   # then, in another terminal:
npm run test:offline -- --base http://localhost:4173   # the production build opens with no network
```

Add `?presenter=1` to any driver URL to get the presenter controls in the Outbox sheet (see "The Outbox").

| Route | Screen |
|---|---|
| `/driver`, `/driver/run` | R1 Route |
| `/driver/stops/:stopId` | R2 Stop detail |
| `/driver/stops/:stopId/outcome` | R3 Record outcome |
| `/driver/me` | R1.9 Me tab |
| `/driver/issues` | R6 Issues (placeholder; driver prompt 5) |
| `/driver/history` | R7 History (placeholder; driver prompt 5) |
| `/driver/notifications` | R8.1 Notifications, R8.4 when empty |
| `/driver/notifications/photo/:blobId` | R8.3 Photo failure detail |
| `/driver/sync-result?view=conflict`, `synced`, `resolved` | R5 Sync result |
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

`DriverProvider` runs a real connectivity gate (`field/offline`'s `connectivity.setGate`) that closes at Tue 29 Sep 05:17 and reopens at 06:40, the **coverage profile**: the Kandy gap. The presenter's "Kandy corridor coverage gap" switch (under `?presenter=1`) turns the profile on and off, and **Simulate offline** in the Outbox holds the phone offline whatever the clock says. This is independent of a real network drop: the Playwright hero walkthrough exercises both, dropping the browser's own connection with `context.setOffline(true)` as well as letting the scripted gate do its job, and both agree once the clock passes 05:17.

`getRun` reads the phone's own cache and never throws offline, since the route has to be usable with no signal by design; writes (`acknowledgePlan`, `startRoute`, `recordArrival`, `recordOutcome`) update that same cache at once, so the screen reflects them immediately, and queue an outbox record (`driver.ack`, `driver.startRoute`, `driver.arrival`, `driver.outcome`) that the shared sync engine sends once it can. The mock server applies the v5 conflict rule from driver prompt 4 (see "Sync result and the conflict").

**Known gap, a team call:** records already waiting when the app opens online are sent by the 30 s timer or the next `online` event, not at once. Nothing is lost, but a reload leaves them for up to 30 s. Syncing at start would be friendlier on a phone, but it would also change the hero walkthrough's offline reloads, which load a page online for a moment, so it is left as is until the team decides.

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
- **R8.3, the detail** (`sync/PhotoFailureScreen.tsx`, route `/driver/notifications/photo/:blobId`): what failed, what is safe, when it was taken, the last try, when the delivery record synced, and the reference WP-SYNC-409. Try again sends now; View outbox opens the sheet, whose bar reads "1 photo didn't send. Retrying automatically every 30 s." When the photo gets through the driver is taken back to the run and the alert is gone. The notifications list links its "Sync failed" entry to the same route.
- **One notice per photo.** The phone retries every 30 s, so the "Sync failed" notice is kept once per photo with the time of the latest try, and names the real stop from the photo's record (it used to say stop 1 for every photo).
- **A failed photo is not a failed sync.** The R5.S 2 "Sync failed" screen is for records that did not send; a photo that will not send is the run's alert, and R5.1 still shows the records that got through.

### Notifications and the bell (driver prompt 4, O5)

R8.1 (`notices/NotificationsScreen.tsx`, route `/driver/notifications`) lists only the changes that affect the driver's own run, newest first, and R8.4 is its empty state. The notices live in the phone's own cache, so they are there offline and survive a reload. The bell on every driver screen counts the unread ones; it is a number, never a bare dot.

- **What it holds:** Dispatch resolved a stop; sync failed (a photo); delivery sent for review; N records synced (what went out, listed); plan v5 received (the first time a sync reaches the server); you went offline (once per spell of no coverage); orders on board (the load confirmed); plan released. Filters: All, Sync, Dispatch, Run.
- **Opening one** marks it read and leads where the navigation map says: resolved to R5.3, sent for review to R5.1, sync failed to R8.3, records synced to the Outbox. Plan and load entries are information only. "Mark all read" clears the count and the bell badge.
- **Born read:** the plan release and the load confirmation are things the server told the phone before the day began, so they arrive read; the bell counts what needs a look. The same goes for "You went offline".
- **A batch, not every record:** "N records synced" appears when two or more arrivals or deliveries go out together. One record sent from the road a moment after it is saved raises nothing.

### Real devices, the service worker and the iOS note (driver prompt 4, O6)

- **Offline after one visit.** The production build registers a service worker (`vite-plugin-pwa`). `npm run test:offline` checks it: after one visit it sets the browser offline, reloads, and checks that the cached run is on screen, that a departure recorded offline survives a reload, and that the Me tab shows storage used. This passes on desktop Chromium.
- **Storage.** `startFieldRuntime` asks `navigator.storage.persist()` at first run; the browser decides, and desktop Chromium usually says no for a new origin. The Me tab shows "N MB used" from `navigator.storage.estimate()`.
- **iOS has no Background Sync API.** Safari on iPhone will not wake the app to send records. Syncing happens only while the app is open: on the `online` event, on the 30 s timer, and on "Send now". A driver who records a stop in a dead zone and closes the app sends nothing until the app is opened again with coverage. The app does not register a background sync on Android either, so it behaves the same way there.
- **The physical-phone check has not been done.** It needs a person with a phone. Checklist, on a production build served over HTTPS (`npm run build`, then any HTTPS host):
  1. Android (Chrome) and iPhone (Safari): open the app once with coverage, then Add to Home Screen and open it from the icon.
  2. Acknowledge plan v4 and start the route, with coverage.
  3. Turn airplane mode on at "05:17" (or turn on Simulate offline in the Outbox).
  4. Record the whole of stop 1 with a real photo from the real camera, a receiver name and Delivered for both orders, then stop 2.
  5. Kill the app from the app switcher. Reopen it with airplane mode still on: the run, the five waiting records and the Outbox must all be there.
  6. Turn airplane mode off. Open the app and press "Send now" if nothing moves within 30 s. Watch R4.2, then R5.1.
  7. Note anything that differs: the camera permission prompt, the keyboard covering the receiver name, the bars sitting under the browser chrome, the storage reading on the Me tab.

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
- [x] O6 gallery, compare, remaining tests, the offline production-build check, README. The physical-phone check is written down above and still needs a person with a phone

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
- **No prototype timers.** Figma's "Times out to" links (R4.2 to R5.1 after 2.5 s, R1.7 to R5.3 after 5 s, R8.2 to R5.3 after 5 s, R5.S 4 to R5.2, R1.3 B to R1.4, R1.5 to R1.6) are not built as timers. Each screen follows the data instead: R5.1 opens when a catch-up sync finishes, R5.3 when Dispatch's decision reaches the phone, and R8.2 stays until the photo sends.
- **R1.3 A, R1.3 B and R1.4 were compared in O6 and are not pixel-matched.** Their copy and order match, but Figma draws the plan card with a bold title and a smaller button, the loader line as a green card with a check (R1.3 B, R1.4) or as a clock line above an amber Start route (R1.3 A), amber "Will wait" tags and, on R1.4, Navigate after the tags. The build keeps the shared Card, Button and Tag components from the foundation as they are. Left as a departure rather than reworked at the end of the build.
- **The run's progress bar is teal and plain,** where Figma draws amber segments and, on R1.5, an "All synced" pill (see also the "All synced" line above).
- **Icons fixed in O6:** Arrive has the map-pin, Problem the alert triangle, and the Issues tab the alert circle, as drawn. The Issues tab's red count badge (R3.5 C) is not built, since Issues is prompt 5.
- **Behind the R4 sheet** Figma draws the run's subtitle as "2 of 2 stops done · Kandy" and a collapsed stop card; the build's dimmed run reads "All recorded · Plan v4" with the real cards. Both are behind the scrim.
- **Mono text is regular weight where Figma draws Medium** (IBM Plex Mono is loaded in regular only).
- **The live app now fills the screen** (`DriverShell`: `height: 100dvh` outside the gallery), so a long screen such as R5.1 scrolls inside the main area and the pinned bar and tab bar stay at the bottom. Gallery frames keep a minimum height so a tall frame grows, as the compare script expects.
- **The chip says "Synced HH:MM" after a catch-up with news, and "Online" otherwise.** R1.7, R1.8, R4.3 1, R4.3 3, R5.1 and R5.3 draw "Synced" with a time; R5.2 and R5.S 3 draw "Online". The build shows "Synced" with the last sync time on the run, R5.1 and R5.3 while a stop is under review or resolved, and "Online" everywhere else once departed. The Figma frames do not state a rule, so this is inferred.
- **Syncing and Failed are the plain muted outline on the phone chip,** as R5.S 2 and R5.S 4 draw them, not amber or red. The loader's tablet chip is unchanged.

### Shared files this role has changed

- `frontend/src/domain/field.ts`: `Stop` gains optional `parkingNote` and `unloadMinutes` (additive; R1 and R2's "Rear dock, normal parking. Allow about 15 min to unload.").
- `frontend/package.json`: two new scripts, `test:hero` and `test:offline`. No dependency or version change.
- `frontend/src/field/components/BottomSheet`: a `flush` variant (full-bleed body, 40 px grabber) and a `headerAside` slot, a z-index so the sheet and scrim sit above the shell's bars, a plain scrim in the non-modal gallery case (Radix draws none), and the flush sheet opens focused on itself. Existing sheets are unchanged.
- `frontend/src/field/components/ConnectivityChip`: `progress` ("3 / 5") and a `retrying` status ("Retrying 1"). Additive.
- `frontend/src/field/offline/blobs.ts` and `db.ts`: `useBlobs()` (null until the first read) and `lastAttemptAt` on a blob, for "Last try". Additive.
- `frontend/src/field/offline/sync.ts`: photos upload in the order they were taken (the table is keyed by a random id, so they went in a random order), and a failed upload records the time of the try.
- `frontend/src/field/components/NotificationBell`: the badge is the danger colour, 18 px, top left of the icon (R1.7, R1.8, R8.2). Additive to the count it already took.
- `frontend/src/field/components/PinnedActionBar`: `helperPosition` ("above" for R1.7, R1.8, R3.9, R3.10). Additive.
- `frontend/src/field/components/ConnectivityChip.module.css`: the phone chip's Syncing and Failed are the muted outline (R5.S 2, R5.S 4).
- `frontend/src/field/offline/sync.ts`: a call that joins a run already in flight now makes the run go round once more when it finishes. A record saved while a run was sending was never in that run's list and waited for the 30 s timer, which left "Departed" unsent in the hero walkthrough about one run in three. One new unit test.
- `frontend/src/field/offline/sync.ts`: `requeueInterrupted()`, called when the engine starts. A record left `sending` by a reload or a killed app was never retried; it now goes back to `waiting` and is sent (the server answers `duplicate` if the first send landed). One new unit test.

### Checks run (D5 and O6)

- `npm run typecheck`, `npm run lint` and `npm run build` are clean on every commit. `npm test`: 55 tests in 6 files (the conflict rule, grouping by stop, duplicates, the counts on R5 equal the outbox, a photo failure keeps its record Synced, resolution and partial resolution, notices, the outbox mode precedence, the requeue and rerun engine fixes).
- `npm run test:hero` plays 04:45 to 06:46 at 390 x 844 and passes with 64 checks (10 of 10 runs earlier in O6, plus the runs after the final changes): the offline spell, the five waiting records, the 06:40 reconnect, R5.1, the WP-SYNC-409 photo failure and its recovery, R1.7, the 06:44 resolution, R5.3, R1.8 and R8.1. `-- --partial` ends with the presenter's partial resolution instead and passes with 63. The photo failure is one section of the hero script, not a second script: it needs the same 05:42 record and the same 06:40 sync, so splitting it would only repeat them.
- `npm run test:offline` passes against the production build (service worker, cached run, a record saved offline survives a reload, storage on the Me tab).
- Pixel-compared with `npm run compare` against Figma screenshots: R1.1, R1.3 A, R1.3 B, R1.4, R1.5, R1.6, R1.7, R1.8, R2.1, R2.2 B, R2.S 1, R3.1, R3.5 B, R3.5 C, R3.7, R3.9, R3.10, R4.1, R4.2, R4.3 1 to 3, R5.1 to R5.3, R5.S 1 to 4 and R8.1 to R8.4. R4, R5 and R8 match apart from the accepted items above; R1.3 A, R1.3 B, R1.4, R1.5, R1.6, R3.5 C and R3.7 differ as listed under the departures. The other R2 and R3 frames were text-verified in D5, not pixel-compared again.
- Earlier, in D5: every registered R1 to R3 frame was read against the Figma file's own text; the sunlight switch, text size and language settings were checked for persistence across a reload.
- **Not done:** the physical-phone check (see "Real devices"); the live camera viewfinder has only run through the file-input fallback; no vitest covers `useSyncWatcher` itself (there is no React testing library in the project), and the hero script is what shows R5.3 queued once.

---

## 🔌 API mode (`feature/api-wiring`)

Every role runs on its mock by default. Each can be switched to the real backend on its own, so a role goes live the day its backend routes do and not before. Branch: `feature/api-wiring`, cut from `develop`, frontend only apart from three backend lines for the demo password (below).

### Flags

All are read at build time, none is required, and every one defaults to `mock`. Set them in the shell that starts Vite (or in `frontend/.env.local`, which is git-ignored).

| Variable | Values | What it switches |
|---|---|---|
| `VITE_AUTH_API` | `mock` (default), `api` | Sign-in and sessions: `apiAuthApi` instead of the mock |
| `VITE_STORE_API` | `mock` (default), `api` | `StoreApi`: `createApiStoreApi` instead of the mock. `?state=` and `?preset=` do nothing in `api` |
| `VITE_DRIVER_API` | `mock` (default), `api` | `DriverApi` and the driver's sync handlers |
| `VITE_LOADER_API` | `mock` (default), `api` | `LoaderApi` and the loader's sync handlers |
| `VITE_DISPATCHER_API` | `mock` (default), `api` | `DispatcherApi`: `createHttpDispatcherApi` instead of the mock, plus the server's scenario clock and the presenter control's `/demo` routes. `?state=`, `?preset=`, `?at=` and `?date=` do nothing in `api` |
| `VITE_API_BASE` | an origin, no trailing slash | Where the API is. Unset: `http://localhost:8000` in `npm run dev`, the same origin in a production build (nginx proxies `/api` in Docker) |

The two field roles share one transport. With neither on `api` nothing changes. With either on `api`, `startFieldRuntime()` installs a routing transport that sends each operation to the real `fetch` transport only when that operation's own role is on `api`, and to the mock otherwise, so a loader on the API and a driver on the mock can share a page.

### Run both halves

```bash
# 1. the API on http://localhost:8000 (Docker Desktop must be running)
docker compose up -d --build db api

# 2. the app, every role in api mode, on port 5173 (the API allows :5173 and :8080 by default)
cd frontend
VITE_AUTH_API=api VITE_STORE_API=api VITE_DRIVER_API=api VITE_LOADER_API=api VITE_DISPATCHER_API=api npm run dev
```

**CORS.** The API only allows `http://localhost:5173` and `http://localhost:8080`. On any other port the browser blocks the call and sign-in shows the offline notice, which looks like a bug and is not. Use `:5173`, or start the API with the origin added:

```bash
CORS_ORIGINS='["http://localhost:8080","http://localhost:5173","http://localhost:5191"]' docker compose up -d api
```

**Accounts.** `dispatcher@`, `loader@`, `driver@` and `store@waypoint.demo`, all with the password `waypoint-demo` (the backend's `DEMO_PASSWORD`).

### Checks

| Command | Needs | Proves |
|---|---|---|
| `npm test` | nothing | The HTTP client, the fetch transport, the four role clients and the mappers, all against a stubbed `fetch` (244 tests, 42 of them the dispatcher client) |
| `npm run test:api-auth -- --base http://localhost:5191` | the API, the app with `VITE_AUTH_API=api` | Sign-in against the real backend: four accounts, four real tokens, wrong password, server down, a rejected token, a real 501 (32 checks) |
| `npm run test:api-roles -- --base http://localhost:5192` | the API (with `:5192` in `CORS_ORIGINS`), the app with all four flags | Each role's first screen read goes to the real route with that role's own token; the transport gets a live 200 from `/me`, the typed 501 from `driver.getRun`, keeps an unsent record in the outbox as an error, and makes no request offline |
| `npm run test:api-dispatcher -- --base http://localhost:5173` | the API, the app with `VITE_AUTH_API=api VITE_DISPATCHER_API=api` | All 20 dispatcher operations: 401 with no token, 403 with a driver token, the typed 501 with a dispatcher token (or the real answer, compared with the mock's view, for a route that has landed); the same 20 through the app's client; the 501 on each of the nine screens' own error states; offline and recovery on the live board; the presenter control against `/demo/advance` and `/demo/reset`; a rejected token. It resets the demo at the end |
| `npm run test:hero`, `npm run test:offline` | the app in mock mode | The mock path is unchanged |

### What the backend answers today (3 Oct)

| Route | Status | Client that calls it | Proven |
|---|---|---|---|
| `GET /health`, `POST /auth/login`, `GET /me`, `GET /clock`, `POST /demo/advance`, `POST /demo/reset` | built | `apiAuthApi`, the field transport (`driver.getMe`) | live |
| `GET /store/order-form`, `POST /store/orders`, `PATCH /store/orders/{id}`, `POST /store/orders/{id}/cancel` | 501 | `StoreApi` | stubbed `fetch`; live 501 |
| `GET /store/deliveries`, `/deliveries/{day}`, `/history`, `/issues`, `/updates`; `POST /store/receipts`, `/issues`, `/deferrals/{id}/seen`, `/reviews/{id}/answer`, `/updates/read-all` | 501 | `StoreApi` | stubbed `fetch`; live 501 |
| `GET /driver/runs/{day}`, `/driver/notices`, `/driver/history` | 501 | `DriverApi` (`history` has no caller yet) | stubbed `fetch`; live 501 |
| `GET /loader/docks/{dock}`, `/docks/{dock}/diff`, `/vehicles/{id}/trips/{trip}`, `/exceptions/{id}`; `POST /loader/pins/verify` | 501 | `LoaderApi` | stubbed `fetch`; live 501 |
| `POST /sync`, `POST /attachments` | 501 | the field transport | stubbed `fetch`; live 501 |
| `GET /dispatcher/queue`, `/orders/{id}/history` (`feature/order-management`) | 501 | `DispatcherApi` (`getQueue`, `getOrderHistory`) | stubbed `fetch`; live 401, 403 and 501 |
| `GET /dispatcher/capacity`, `/plan`, `/deferrals`, `/acknowledgements`; `POST /dispatcher/plan/redraft`, `/plan/validate-move`, `/plan/moves`, `/plan/release`, `/deferrals/notify` (`feature/allocation-engine`) | 501 | `DispatcherApi` (`getCapacity`, `getPlan`, `listDeferrals`, `listAcknowledgements`, `redraftPlan`, `validateMove`, `saveMoves`, `releasePlan`, `notifyDeferrals`) | stubbed `fetch`; live 401, 403 and 501 |
| `GET /dispatcher/live`, `/inbox`, `/conflicts/{id}`, `/exceptions/{id}`; `POST /dispatcher/stops/defer`, `/conflicts/{id}/ask-store`, `/conflicts/{id}/resolve`, `/exceptions/{id}/decide` (`feature/offline-sync`) | 501 | `DispatcherApi` (`getLiveBoard`, `deferStop`, `getInbox`, `getConflict`, `askStore`, `resolveConflict`, `getExceptionForReview`, `decideException`) | stubbed `fetch`; live 401, 403 and 501 |
| `GET /dispatcher/forecast` (`feature/analytics`) | 501 | `DispatcherApi.getForecast` | stubbed `fetch`; live 401, 403 and 501 |

A 501 reaches a client as `NotImplementedApiError`, which names the backend's operation (the dispatcher client turns it into the dispatcher's own `ApiError` with code `not_implemented`). Nothing falls back to the mock. Until the routes land, a role in `api` mode shows its error or loading state.

### How the clients behave

- **Offline.** A device that is offline, simulated offline or behind a closed coverage gate fails with the `NetworkError` the outbox already handles, before any request is made. A request that gets no answer (unreachable, 15 s timeout) becomes the same `NetworkError`. A network failure never ends a session; only a real 401 does, and it clears only that role.
- **Writes** are saved on the device first and sent through `POST /sync`, one record at a time, each keyed by its own `clientId`. A replay after a dropped connection is answered `duplicate` and counted once. Photos upload after their record through `POST /attachments`, keyed by the photo's id.
- **The driver** keeps the route package on the phone: `getRun` answers from that copy, refreshes one older than 30 s when online, and never fails once the route has been downloaded. Server notices are merged with the ones the phone makes itself.
- **The loader** reads from the server with the tablet's unsent counts, acknowledgement and confirmation laid on top. A flag has no server id until it syncs, so its id is the record's `clientId` until then.
- **The store** sends no outlet id; the server takes it from the token. A 409 on an order edit or cancel is the cutoff and a 404 a missing order.
- **Vocabulary.** The backend writes `store_request`, `pending_sync` and `ambient`; the frontend's shared types say `store request`, `Pending sync` and `dry`. `frontend/src/api/vocab.ts` is the one place that translates, as full tables over the generated types, so a new backend value fails the build.

### The dispatcher client (`feature/api-wiring-dispatcher`)

`createHttpDispatcherApi` (`frontend/src/api/httpDispatcherApi.ts`) implements all 20 `DispatcherApi` operations through `apiClient("dispatcher")`. `dispatcherContract.ts` already proves at compile time that the wire field names match the screens' view types; `dispatcherMappers.ts` is the one place for what that check leaves out:

- **Enum values, both ways.** Wire `store_request`, `keep_delivery`, `keep_partial`, `swap_vehicle` and `ordered` are the screens' `"store request"`, `"keep delivery"`, `"keep as partial"`, `"swap vehicle"` and `"Ordered"`. Converted in responses (queue and history order status, every deferral kind, the conflict recommendation, an exception's recommendation kind) and in requests (`QueueFilters.status`, `DeferStopIn.kind`, `ResolveConflictIn.resolution`, `DecideExceptionIn.decision`). The wire's `keep_deferral` has no screen value, so a conflict recommending it fails as `unexpected_reply` instead of drawing a guess. Fields the backend already sends as display text (the history `step`, a live stop's `status`, a queue tag) are not touched.
- **Ids.** A conflict or exception id is `"7"` in the views and `7` in the URL. A non-numeric id fails as `unexpected_reply` before any request.
- **The move target.** `{ vehicleId, trip } | "deferred"` on the screens, `{ vehicleId, trip, deferred: false }` or `{ deferred: true }` on the wire, in `validateMove`, `saveMoves` and the result's `to`.
- **Null versus absent.** The server sends every empty optional field as `null`; the views declare them optional and the screens test `!== undefined` (`newInVersion`, `daysSinceServed`, `matching`, a preview row's `before`). `compact` drops those nulls. Five fields are null on purpose and stay null: `CapacityView.plan` and `binding`, `AcknowledgementsView.banner`, a trip's `kgCap` and `m3Cap`. `dispatcherContract.ts` does not cover this: it compares kinds of value with `null` removed.
- **Query and body shapes.** `getQueue`'s filters are repeated params (`brand`, `temp`, `status`, `window`, `tags`, `district`) and an empty filter sends nothing; `getLiveBoard` sends `depot` (including `both`) and `all=true` only when on; `releasePlan` sends `sendNotices` and the server reads it as `send_notices`.
- **Depot on plan writes.** `redraftPlan`, `saveMoves` and `releasePlan` take a `depot` query param (the depot whose view comes back; they act on the whole service day). `DispatcherApi` has none there, so the client uses the depot of the last `getPlan` call and `peliyagoda` before that. `listAcknowledgements` takes no depot.
- **Errors.** The dispatcher keeps its own `ApiError(code, message)` and `NetworkError` (`DispatcherApi.ts`), and the screens catch those. The client maps the HTTP layer's `ApiError`, `NotImplementedApiError` and `NetworkUnavailableError` onto them with the server's message: a 404 is `not_found` (the conflict and exception screens test for it), a 409 on `redraftPlan`, `saveMoves` or `releasePlan` is `read_only`, `illegal_transition` or `illegal_move` on `saveMoves` is `illegal_move`, a 501 is `not_implemented`. The 409 and `illegal_transition` mapping is a guess from the mock's codes: no plan route is built, so no real code has been seen.
- **The clock.** `GET /clock` is read once when the dispatcher opens and the app's clock holds that time. It does not tick, because the server's clock does not and every time the server computes (minutes to the cutoff, an ETA) is for that instant. Only the presenter control moves it.
- **The presenter control** is kept in `api` mode. "Go to next step" is `POST /demo/advance` (a bare wall-clock time, which the server reads as Asia/Colombo) and "Reset demo" is `POST /demo/reset`; each re-reads the clock and reloads the screens. `?presenter=1` and the avatar menu still switch it on. The server refuses to go backwards (409 `clock_backwards`); the control then leaves the clock where it was.
- **Offline.** A request that gets no answer sets the provider's `offline`, the same flag `useOnline()` and `?state=offline` set: the screens keep what they last loaded and switch writes off. While it is set the provider asks `GET /clock` every 8 s, and the first answer ends it and reloads the screens.

### Contract gaps the clients work around

The backend's replies do not carry everything the screens show. Each missing field is filled with a visibly neutral value, never a plausible-looking one, and listed in `RUN_GAPS` (`screens/driver/api/runMapper.ts`) and `LOADER_GAPS` (`screens/loader/apiLoaderMapper.ts`). These need backend changes before `driver` and `loader` can be demoed on the API:

| Reply | Missing | Owner |
|---|---|---|
| `RunOut` (driver) | the loader's confirmation (who, when, shortfalls), each stop's brand, district, dock type and parking note, each order's weight and volume, when the plan version was released and its note, the vehicle's capacities. "Loaded" is read from the order statuses; brand is read from the outlet name | `feature/driver` (backend read endpoints) |
| `NoticeOut` (driver) | the `tag` vocabulary. The backend's `NoticeTag` is `Order`, `Plan`, `Delivery`, `Deferral`, `Review`, `Change`; the driver's list has eight kinds (`resolved`, `plan_released`, ...). Only an exact match is shown, so every server notice is dropped today | `feature/driver` |
| `DockOut`, `LoadPlanOut` (loader) | vehicle capacities and temperature class, loading progress, why a vehicle is held, who acknowledged the plan, each load line's brand, temperature, dock, weight and volume, who confirmed a load | `feature/loader` |
| `PlanDiffOut` (loader) | the outlet, deferral type and next run of a removed order, and the new totals | `feature/loader` |
| `DeliveryOut.review` (store) | the conflict id. `POST /store/reviews/{conflict_id}/answer` is keyed by it; the client reads `review.conflictId` and refuses to send without it | `feature/store-receipt` |
| `SyncResultOut.serverPayload` | the keys of a conflict's detail. The client reads `serverVersion`, `change`, `changedAt` and `changedBy`, and `exceptionId` on a flag, none of which the contract names | `feature/offline-sync` |
| `SyncRecordIn.payload` | a schema per record type. It is a free dict; the client sends the payload shapes the mocks already use | `feature/offline-sync` |
| `LoaderExceptionOut.type` | its vocabulary. The client accepts the six names on the flag sheet and refuses any other as `unexpected_reply` | `feature/loader` |

### Known limits

- **Dispatcher: an expired token fires the redirect once per rejected request.** `sessionTokens.onUnauthorized` dispatches `wp:session-expired` on every 401, and the dispatcher reads several things at once, so `SessionExpiryListener` calls `navigate("/sign-in", { replace: true })` once per request (six in the live check). Every call is a `replace`, so there is one history entry and the person lands on sign-in, but the call is repeated.
- **Dispatcher: the Capacity error banner** says "Capacity couldn't be calculated, fleet data missing." for every failed read, a 501 or a dropped connection included. The other eight screens say "Couldn't load ...".
- **Dispatcher: no route is built**, so the view types are checked against the contract and a stubbed `fetch`, not against a real reply. The enum, id, move and null conversions are proven only in `httpDispatcherApi.test.ts`.

- **Screens without a read-error state.** The Store's read pages and the driver's run screen render a loading skeleton forever when a read fails (they only handle write errors). Only the loader shows an error with Retry. With the backend at 501 this is what Store and Driver show in `api` mode. Fixing it means an error state on each of those screens.
- **The loader draws its PIN people from fixtures** (`peopleFor(dockId)`), not from the API, so in `api` mode the people and the ids the server knows do not match. The PIN check only accepts a server id, the offline PIN hashes and the guest PIN are not built, and `LoaderApi` has no `getPeople`.
- **Time.** The Store and the field apps still run on the app's own scenario clock, not on `GET /clock`.
- **The driver's run date** is the fixture constant, and the photo-failed notice reads the stop number from the fixture.
- **Mixed roles in one tab.** The sync engine has one photo uploader. When one tab visits a role on the API and then one on the mock, the provider that mounted last owns it.
- **A session lasts 12 hours** (`JWT_TTL_HOURS`) and there is no logout endpoint, so sign-out is local. A driver working past 16:45 from a 04:45 sign-in is sent to sign in; the outbox survives it.
- **Sync at app start.** Records waiting when the app opens online still wait up to 30 s for the first run.
- **The server-unreachable sign-in notice** reuses the G1.5 offline text, which is not quite true here. No Figma frame draws it (a departure to record).

### Files

- `frontend/src/api/http/`: the typed client, error classes, token handling, config.
- `frontend/src/api/vocab.ts`, `storeMappers.ts`, `apiStoreApi.ts`: the Store.
- `frontend/src/field/offline/fetchTransport.ts`, `apiSync.ts`: the field transport, the sync handlers, the photo uploader.
- `frontend/src/screens/driver/api/apiDriverApi.ts`, `runMapper.ts` and `frontend/src/screens/loader/apiLoaderApi.ts`, `apiLoaderMapper.ts`.
- `frontend/src/screens/auth/apiAuthApi.ts`, `SessionExpiryListener.tsx`.
- `frontend/src/api/httpDispatcherApi.ts`, `dispatcherMappers.ts` and `httpDispatcherApi.test.ts`: the Dispatcher client, its conversions and its tests; `frontend/scripts/api-dispatcher-check.ts`: the live check.
- Edited outside this branch's own files: `App.tsx` (mounts the session-expiry listener), `StoreProvider.tsx`, `DriverProvider.tsx` and `LoaderProvider.tsx` (pick the client by flag), `mockDriverApi.ts` (five helpers exported for reuse), `SignInScreen.tsx` (an optional `serverDown` prop). The dispatcher client also edits `DispatcherProvider.tsx` (picks the client by flag, reads the server clock), `context.ts` (an optional `resetDemo`) and `PresenterControl.tsx` (Reset demo calls it when present; the mock still reloads the page).

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
