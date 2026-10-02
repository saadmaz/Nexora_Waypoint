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

---

## 🏭 Waypoint Load (Loader)

L1 Dock and L2 Load plan, built in `frontend/`, branch `feature/loader` from `feature/field-foundation`. Binding rules: [`docs/build/field-conventions.md`](docs/build/field-conventions.md) and the loader prompt. L3 and L4 are not built yet; `/loader/vehicles/:vehicleId/trips/:trip/flag` and `/loader/changes` still answer with the foundation's placeholder.

**Status:** L0 (types, fixtures, `LoaderApi`, mock server), L1 (Dock: every state, PIN acknowledgement, countdowns, held vehicle, plan-changed banner, offline cache, empty, loading, error) and L2 (Load plan: checks, count confirm, short units, the gate, loaded, held, the VEH003 → VEH036 swap reload) built, checked and compared against Figma. L1.7 (tablet master-detail) is phase L5 and lands with L3 and L4.

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

- **Priya, Peliyagoda.** Open `/loader/dock?dock=peliyagoda`. Acknowledge plan v3 (PIN `1234`), open VEH003 or VEH035's load plan, check each order (the count stepper is prefilled, lower it for a shortfall), confirm the gate with a PIN. L3 (flag exception) is not built yet, so the "Vehicle check failed" flag that drives the VEH003 → VEH036 swap cannot be raised from the UI yet; `mockLoaderApi`'s `devResolveExceptionNow` and the 03:00 scenario-clock path exist for when L3 lands, and L2 already renders VEH036's swapped load plan (capacity bars, "Replaces VEH003") from literal state-gallery props.
- **Ruwan, Kandy.** Open `/loader/dock?dock=kandy`. Acknowledge plan v3 (PIN `5678`) first (so there is a version to compare against), then once Peliyagoda's plan reaches v4 the Kandy dock shows "Plan v4: no change to your vehicles" and asks for a fresh acknowledgement (L1.6 A/B), then load VEH039 (L2.1 to L2.4) and confirm the gate.

### Demo PINs

Priya `1234`, Ruwan `5678` (PRD v3 assumption A36). Both are offered at both docks (their `dock` in `fixtures.ts` is their home dock, informational only). "Other…" takes a typed name plus the guest PIN `0000` and is recorded as the actor under that name.

### `LoaderApi` and the mock server (`src/screens/loader/`)

- `fixtures.ts`: docks, people, PINs and the guest PIN, plan v3 and v4 trips for VEH003, VEH035, VEH036, VEH011 (Peliyagoda) and VEH039 (Kandy), copied from PRD v3 §4c's "Plan v3 trips" and "Pinned orders" tables.
- `LoaderApi.ts` / `mockLoaderApi.ts`: one in-memory server per app session. `getDock`, `getLoadPlan`, `getPlanDiff`, `getException`, `getCurrentVersion` read it; `acknowledgePlan`, `recordCheck`, `confirmLoaded`, `flagException` write it. Every write applies to the mock server at once (so the screen never waits on the network to show a check as saved) and is also enqueued under `loader.ack`, `loader.check`, `loader.confirmLoaded` or `loader.exception`, so the outbox, the sync engine and the connectivity chip all see it the same way a real write would behave. The VEH003 "Vehicle check failed" exception (once L3 can raise one) resolves into plan v4 at the scenario's 03:00, or at once via `devResolveExceptionNow` (a dev control, not yet wired to a button — it lands with the L3 state gallery).
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

### State gallery

`/loader/_states` registers 13 of L1's 15 frames (L1.1 to L1.6 B, the four L1.S states; L1.7 tablet is L5) and all 13 of L2's frames (L2.1 A to L2.6 B, the four L2.S states). It also registers all 8 of L3's frames (L3.1, L3.2 A and B, L3.3 A and B, L3.4 A to C). `npm run compare -- loader <id>` matches each against its Figma screenshot; `PinSheet`'s `demoPhase`/`demoDigits` props and `LoadPlan`'s `demoExpanded` prop freeze a sheet or a row open for the frames that need it (L1.2 B/C, L2.1 B, L2.2, L2.3 B).

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

### Shared files this role has changed

- `field/components/PinSheet.tsx`: two new optional props, `demoPhase` and `demoDigits`, so the state gallery can freeze the sheet on its success or wrong-PIN frame without a fake timer. No existing prop or behaviour changed.
- `field/components/LoaderCheckCard.tsx`: a `planned` state (L2.5's read-only pill), a `protectedOrder` flag (a lock tag in place of the brand tag), and a `"{n} short"` tag next to the position tag when `state` is `short`. No existing prop or behaviour changed.
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
- [ ] L4 Plan changed
- [ ] L5 L1.7 tablet master-detail
- [ ] L6 Playwright run of both stories, final README pass

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
