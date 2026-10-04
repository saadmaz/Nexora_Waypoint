<!-- Build log moved out of README.md so the README reads as the deliverable. -->

# 🏬 Store Manager (Waypoint Store)

The store manager role, built in `frontend/`. Branch: `feature/store-manager-frontend`.

**Status:** done for the hackathon scope: all four phases of the store frontend (S1 to S4) are built, verified and documented. Folder layout follows PRD v3 (see "Folder layout").

## How to run

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

## Folder layout

Follows PRD v3 (migrated at the end of phase 8, in one commit of renames):

| Path | What |
|---|---|
| `frontend/src/screens/store/` | The store's screens: `orders` (S1), `deliveries` (S2), `receipt` and `issues` (S3), `updates` (S4), `gallery` |
| `frontend/src/shared/` | Cross-role UI: `ui/` (primitives) and `chrome/` (top bar, tab bar, app bar, bell, connectivity bar) |
| `frontend/src/domain/`, `api/`, `hooks/`, `app/` | Rules and types, the `StoreApi` and its mock, `useNow` and friends, the provider, clock and routes |

Older entries below name the files by the paths they had when the phase landed;
`components/` is now `shared/` and `screens/<name>/` is now `screens/store/<name>/`.

## Phase list

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

## The store's part of the judge walkthrough

The steps below are written for mock mode, which needs no backend. In API mode the same steps play the same
way; what differs is under "The store against the real API" just after.

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

## The store against the real API

All twelve `StoreApi` routes are built, so the store runs on the real backend. Mock mode is still the
default; `VITE_STORE_API=api` switches over.

```bash
CORS_ORIGINS='["http://localhost:8080","http://localhost:5173"]' docker compose up -d --build db api
cd frontend
VITE_AUTH_API=api VITE_STORE_API=api npm run dev -- --port 5173 --strictPort
# then sign in as store@waypoint.demo (password waypoint-demo)
```

Two scripts prove it. Each runs against the API in Docker and the app above, and each resets the demo at the
start and the end, so run them on a database you do not mind re-seeding:

| Command | Proves |
|---|---|
| `npm run test:api-store` | The data. Drives the app's own `createApiStoreApi` through the hero day (S1 to S4), so a reply the mappers reject fails it. Asserts on the values the PRD fixes, not on HTTP 200 |
| `npm run test:store-live` | The product. Plays the store's part of PRD §16 through the rendered screens: place and review (S1.1 to S1.3), Edit order and Cancel order offered, Edit withdrawn after 16:00, S1.4 rolled to Wed, S2.1 to S2.8 with Got it reaching D4 and the S2.7 question answered, the receipt with the report sheet and a short count, S3.7, S4.1 with Mark all read, S4.2. Then the browser goes offline, the `api` container is really stopped (the error state and its Try again), and the screen recovers. `--skip-offline` leaves out the part that stops the container |

Pass `--base` when the app is not on `:5173`, and add that origin to `CORS_ORIGINS`.

**Both scripts currently report failures against `develop`** (10 from `test:api-store`, 1 from
`test:store-live`). They are differences between the backend and the contract the mock and the PRD set, not
faults in the scripts, and they are listed in the pull request. The four that matter:

- **Timestamps carry an offset.** `receivedAt` and `updatedAt` come back as `2026-09-28T15:40:00+05:30`; §19
  and the mock both say naive local ISO with no offset. `clockTime()` renders with `getHours()`, so the store
  shows the right time only in Asia/Colombo: in Europe/London the same reply reads `11:10` instead of `15:40`.
- **A shortfall is accepted with no reason.** PRD A50 says "Confirm with a shortfall" asks for a reason before
  it sends. The sheet does ask, but `POST /store/receipts` takes a 9 of 12 with no reason and returns Partial,
  so the rule lives only in the screen (§19: the frontend never re-implements a rule).
- **The review question appears before Dispatch asks.** PRD A51 says the explanation ("Why you're seeing this")
  shows on its own, and the question ("Did you receive this delivery?" with its two buttons) only once Dispatch
  has asked. At 06:41, before any ask, the reply carries the `review` block and S2.7 draws the question.
- **The journey can read Departed pending while Delivered is done**, and the proof's `driver` comes back empty.

**What differs from the mock.**

- **Two clocks.** In API mode the store still runs its own `?at=` clock and does not read the server's
  `/clock` (the dispatcher does). The server decides what each reply says, so its clock has to be moved with
  the presenter control or `/demo/advance`. A screen opened at an `?at=` the server has not reached shows the
  earlier state. Both scripts move the two together. Reading `/clock` in `StoreProvider`, as the dispatcher
  does, would remove the problem; it was left alone because it changes the shared provider and the mock path.
- **`?state=`, `?preset=` and `?preview=` do nothing**, as "API mode" says. Every state is reached by the day
  actually happening on the server. The gallery stays a mock-mode tool.
- **The outlet name.** The top bar reads "OUT084 · Waypoint Fresh Kandy" from the frontend's own `OUTLET`
  constant. S2 and S3 print `outletName` from the reply, which is `OUT084` on the fallback seed because
  `outlets.name` is NULL there. With the competition CSVs both show the real name.
- **S2.4 and S2.5 on the fallback seed.** The planner puts OUT084 on VEH040 there, and the demo phone is
  bound to VEH039, so in the scripts the truck never departs and those two states are skipped with a message.
  On the competition data, or on the small world the backend tests use, they run.
- **No neutral values.** Unlike the driver and loader clients, `apiStoreApi` fills nothing in.
  `storeMappers.ts` fails a reply that lacks a field as `unexpected_reply`. Both scripts ran without hitting
  one, so the store has no gap list.

**Open points.**

- `Outlet.units_to_kg` / `units_to_m3` is one pair per outlet, not one per temperature. It is unpopulated in
  the seed, so the A14 and A42 fallbacks ship and chilled and dry differ correctly. If it were filled, both
  temperatures would collapse to one factor. A `feature/backend-foundation` question.
- `outlets.name` is NULL in the fallback seed, so `outletName` is the outlet id there (see above).
- "A store account with no outlet is 403" is implemented but untested, because the seed has no such account.

## Checks run (phase 8)

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

## Departures from the Figma design

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

## Notes from pulling the S1 Figma frames (30 Sep, before phase 4)

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

## Assumptions and data notes

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

## Shared files this role has changed

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
