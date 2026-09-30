# Waypoint: Product Requirements and Build Spec (v3)

Version 3.0 · Wed 30 Sep 2026, 16:00 · Team Nexora · owner: HH (spec owner: ________)

This is the single source of truth for the **Hackathon build** of Waypoint. One order record moves through four roles, the system drafts tomorrow's plan, and every deferral is typed and explained.

**v3 supersedes v2.1** (29 Sep, 19:00). It has two parts:

- **Part A, Product** (sections 1 to 7): what the Day 5 design promised. It carries every v2.1 decision forward, adds what changed on the "Nexora (main)" Figma page after v2.1 was written, and re-checks the known gaps against the page as it stands on Wed 30 Sep.
- **Part B, Build** (sections 8 to 19): how the Hackathon implements it. Architecture, database, API, the shared rules module, the planner, offline sync and reconciliation, the scenario clock and seed, frontend routes, the judge walkthrough, tests, the departures register and the deliverables checklist.

**Why the design still rules.** The booklet says the Designathon submission is the Hackathon's implementation specification and judges assess how faithfully we deliver it (Fidelity to the Day 5 design, 10%). The Day 5 design is the "Nexora (main)" page as submitted on 29 Sep. Where the build must differ from it, the difference goes in the departures register (section 18) and in the README.

**Source ranking** (same as the field-build conventions, `claude/field-build/00-field-conventions.md`):

1. **Challenge Booklet** decides operating rules.
2. **Nexora (main)** decides **everything a user sees**: layout, copy, states, and which control leads where. Build teams copy frames exactly.
3. **This spec** decides behaviour and data the frames do not show: rules, status meanings, handoffs, the hero timeline, the backend.

Where Figma breaks a booklet rule, or is plainly wrong (a Sunday delivery, two frames disagreeing on the same fact, a prototype shortcut), the build follows the booklet or this spec and records the case in section 18. Where this spec's wording and a frame's copy differ, the frame wins and this spec gets corrected.

**How to use this spec.** Frontend: find your screens in section 3 and your routes in section 15, copy every ID, time and number from section 4c, and check every handoff in section 5. Backend: sections 9 to 14. Everyone: section 16 is the walkthrough the whole team builds towards. If a number you need is missing, ask the spec owner. If you must invent one, add it to 4d the same day.

---

## Change log

### v2.1 to v3 (30 Sep)

| # | Change | Why | Sections |
|---|---|---|---|
| V23 | **New store screen S4 · Updates and history.** A bell in the store top bar opens one feed of every update the order record sends the store, newest first, with unread and read states (S4.1, S4.1 B), and a History segment listing past delivery days Mon to Sat (S4.2). States S4.S A to D. Feed tags are Order, Plan, Delivery, Deferral and Review; they are labels, not statuses | Added to Nexora (main) after v2.1 (section `585:40956`, rationale card) | 3, 5 (handoff 14), 6, 15 |
| V24 | Figma inventory re-counted on 30 Sep: **27 sections and 27 rationale cards** (was 26), **53 flow starts** (was 51), **1,851 prototype reactions** (was 1,758). Node IDs on the main page are now `442:*` (with `527:32` D5.3 B, `527:324` D7.4 B and `585:*` S4). Node IDs quoted in older prompts (for example `claude/store-manager-build-prompt.md`, which points at the Store Manager page `17:4`) are stale | Re-read of page `0:1` | 3, 3b, 7 |
| V25 | **Data clash found:** S2.10 lists Thu 24 Sep as "Deferred · policy" and Fri 25 Sep as "Delivered 05:38". S4.2 and A35 say the opposite (Fri 25 deferred by policy, Thu 24 delivered 05:38). **A35 wins**; the build follows A35 and the departures register notes S2.10 | Cross-check 30 Sep | 4d (A35), 7 (G-10), 18 |
| V26 | **Part B added:** the Hackathon build spec. The stack is decided (Q12). The system runs on a **scenario clock** anchored to the hero day so the walkthrough works on any date (Q13). Screens show **computed** figures from the rules module and the seeded day, never numbers typed into components (Q14) | Hackathon starts | 8 to 19 |
| V27 | The Day 5 prototype gaps (section 7) become build guidance: the build implements the spec's behaviour, and every visible difference from the frozen Figma frames is listed in section 18 | Fidelity is judged against the Day 5 design | 7, 18 |
| V28 | Handoff 14 added: order record → store updates feed (S4). The driver's R8 list and the store's S4 feed are the only notification surfaces. There is still no dispatcher notification centre (X1 stays out of scope) | Follows V23 | 1, 5 |
| V29 | **Aligned with the field-build prompts** (`claude/field-build/00` to `05`, 30 Sep): Figma wins on UI and copy (source ranking above); the Figma file now has only two pages, "Nexora (main)" `0:1` and "Shared Library Framing" `158:2`; routes are `/dispatcher/*`, `/store/*`, `/loader/*`, `/driver/*`; outbox record types and sync results are fixed (section 15, 19); demo PINs Priya `1234`, Ruwan `5678` (A36) | Teammates' prompts are already in use | 3, 4d, 15, 19 |
| V30 | **R6 problem choices follow the frame:** Can't reach the store · Vehicle problem · Goods damaged on the truck · Running late · Something else (v2.1 listed road blocked, breakdown and others) | Figma wins on copy | 3 (R6) |
| V31 | **Driver theme rule** from the R1.9 copy: sunlight switch on → Field; otherwise Dark when the phone prefers dark or states no preference, Light · office when the phone prefers light | R1.9 says "Dark mode follows your phone's setting." | 3 (R1), 6 |

Earlier change logs (v1 to v2, V1 to V14; v2 to v2.1, V15 to V22) are in `waypoint-prd-v2.1.md`. Their decisions are all applied below.

---

## Decisions applied

| # | Topic | Decision |
|---|---|---|
| Q1 | Data, hero, people, date | Hero = ORD2001 (chilled) + ORD2002 (dry) at OUT084, VEH039, Kandy. People = Kumari (dispatcher), Priya and Ruwan (loaders), Nimal (driver), Anusha (store manager). Logins dispatcher@ / loader@ / driver@ / store@waypoint.demo. Operating day Tue 29 Sep 2026, planned Mon 28 Sep [ASSUMPTION A1] |
| Q2 | Hero timeline | Store's call 05:20, deferral 05:21 (plan v5), after coverage drops at 05:17 and before the 05:26 arrival. Delivery 05:42 |
| Q3 | Hero loader | Loader account = dock tablet, one PIN per person. Priya works Peliyagoda; Ruwan loads VEH039 at Kandy [ASSUMPTION A9] |
| Q4 | Secondary scenario | VEH003 (reefer truck) fails its pre-departure check; VEH036 (smaller reefer van) replaces it; ORD1002 is deferred by policy |
| Q6 | One brand + one district per trip | Hard rule, same as Datathon Task 2B |
| Q7 | GPS | Distance only. GPS during the run, works offline; if GPS drops out, the planned distance fills the gap; no odometer entry; no live tracking |
| Q8 | Screen set | 21 v1 IDs + R6 to R10 + **S4** (V23); extra frames are states |
| Q9 | Store edit | Edit quantities or cancel until 16:00 |
| Q10 | Invented data | Disclosed once (4d, AI disclosure, video, README), no per-screen chips |
| Q11 | Driver outcomes | Five: Delivered, Damaged, Refused, Store closed, Other. Partial comes from the store shortfall (S3) or the dispatcher's D7 decision |
| Q12 | **Stack** | Frontend: React + TypeScript (strict), Vite, plain CSS with `tokens.css` and CSS Modules, Radix primitives, fontsource fonts, oxlint, PWA (service worker + IndexedDB via Dexie). Backend: FastAPI (Python), PostgreSQL, a framework-free Python rules module shared with the Datathon Task 2B notebook. One `docker compose up` [TEAM ANSWER 30 Sep] |
| Q13 | **Scenario clock** | Every business rule reads time from one server clock that starts at the seeded checkpoint (Mon 28 Sep 2026, 15:30) and moves forward by user actions or the presenter control. Nothing reads the wall clock [BUILD] |
| Q14 | **Computed figures** | Counts, minutes, kg, m³, fuel, deferral totals and badges come from the database and the rules module. Section 4c figures are the **seed targets**; if the seeded day computes differently, the screen shows the computed value and section 18 records it [BUILD] |

**Origin tags:** [BOOKLET] challenge booklet · [DECIDED] confirmed direction (Part 5 of `Untitled.md`) · [APP] app.html prototype · [PLAN B] the Word plan · [TEAM ANSWER] team decisions above · [BUILT] exists on Nexora (main) · [ASSUMPTION] invented, listed in 4d · **[BUILD] proposed by this spec for the Hackathon; the team can change it, but must update this spec first.**

Rationale paragraphs in Figma use [A] booklet · [B] inference · [C] our choice.

---

# Part A · Product

## 1. Problem and product direction

On most days Waypoint's shared fleet cannot serve all three brands, so the product's job is to make every deferral deliberate, explained and visible to every role [BOOKLET][DECIDED]. Route planning is a small part of the problem: each trip serves one district, so most of the value lies in deciding who is served, who waits and why.

**Who it hurts today** [BOOKLET]

- **Fresh stores** miss the 8 AM opening when chilled capacity runs out, and the same outlet can be skipped on consecutive runs.
- **Store managers** order by phone with no confirmation, no arrival time and no deferral notice.
- **The dispatcher's** plan lives in one head and a spreadsheet, and problems surface only after the driver reaches the outlet.
- **Loaders** work from printed lists that go stale when the plan changes, with no way to flag a shortfall before departure.
- **Drivers** have a paper run sheet, lose coverage on the Kandy corridor, and have no proof when a delivery is disputed.

**What the product does**

- One order record travels from the store's order to the store's receipt. Each role advances its status; nobody re-keys it [BOOKLET][APP].
- The system drafts tomorrow's allocation after the 16:00 cutoff. The dispatcher edits it, and every edit is checked live against every rule; a refused edit names each rule it breaks [DECIDED].
- **Guided Adaptive Allocation**, applied in this order [DECIDED]:
  1. Hard constraints.
  2. Operational priority.
  3. Continuity guard.
  4. Dispatcher-adjustable soft priorities.
  5. Explainable consequences.
- Refrigeration and van_only are resource requirements, never priority [DECIDED].
- **Forced vs chosen.** Capacity forces *how many* orders are deferred; policy chooses *which* [DECIDED]. Each deferral is typed and carries plain reasons: two separate measures (impact on the store, capacity freed on the binding resource), never a score.
- Numbered plan versions reach loaders and drivers, who acknowledge them. A vehicle is cleared to depart only from the loader's gate [APP].
- Field work records offline and reconciles on reconnect. When records disagree, the system recommends and a person confirms [DECIDED].

**Where the design goes deepest** [DECIDED]

- The evening plan (D1 to D5) is designed deepest.
- The morning road hosts the hero failure, *Driver offline, plan changed* (F13, D7).
- A reefer swap at the dock is the secondary failure (F14, D8).
- Weeks-ahead planning is one simple screen (D9 Forecast).

### In scope

| Area | Screens | Why it earns its place |
|---|---|---|
| Evening plan: queue, capacity, trips, deferrals, release | D1 to D5 | Planning engine is 20% of the Hackathon; explaining deferrals is the booklet's objective [BOOKLET] |
| Live operations, exception-first, no map | D6 | Dispatchers need progress and problems after departure [BOOKLET] |
| Offline driver flow and reconciliation | R1 to R5, D7 | "Record work offline and reconcile" [BOOKLET]; hero degradation [DECIDED] |
| Driver run support | R6 to R10 | R6 reports a stop that can't be reached while offline; R7 history; R8 own-run changes; R9 closes the run with a GPS distance for the fuel quota; R10 explains non-standard days |
| Pre-departure gate, plan versions, loading exception | L1 to L4, D5, D8 | "Flag a loading shortfall before departure"; stale printed lists [BOOKLET] |
| Store order (edit until cutoff), arrival, deferral notice, receipt, updates feed | S1 to S4 | Confirmation, arrival time, deferral notice, receipt and issues [BOOKLET]; S4 gathers the notices in one place (V23) |
| One forecast screen | D9 | "Plan future capacity" is a workflow stage [BOOKLET][DECIDED] |

### Out of scope

| Excluded | Reason |
|---|---|
| Live map or live vehicle tracking for Dispatch | No GPS in the data, unreliable coverage, personal phones. Dispatch sees progress from stop events plus a last-heard age [DECIDED]. The driver's phone uses GPS only to measure run distance |
| Chatbot or generative assistant | Unverifiable and not asked for; explanations come from the rule trace [DECIDED] |
| Driver rostering | "Driver availability is not a separate constraint" [BOOKLET] |
| Route-optimisation solver | One district per trip; stop order only has to meet windows [DECIDED] |
| Product catalogue or item picking | The booklet has no product data. Orders are units, kg, m³ and temperature [BOOKLET] |
| Dispatcher notification centre, KPI dashboard, reports, analytics, what-if, plan comparison, fleet and outlet admin, calendar admin, change-request workflow, issue board, audit explorer, user admin, fuel ledger, model monitor, settings | Concept frames X1 to X14 only ("Out of scope: build only if the team reopens Q8"). **Not built in the Hackathon.** The driver's R8 list and the store's S4 feed only list changes to that person's own run or outlet |
| Order changes **after** the cutoff | Late changes are dispatcher actions on D6. Edits **before** 16:00 are in scope (S1) |
| Issue-management engine (owners, severities, lifecycles) | Issues are a status plus tags, followed up by the dispatcher |
| Datathon models wired into the app | Not required [BOOKLET]; D9 uses a baseline forecast |
| Driver-entered odometer readings | Removed 29 Sep (V15) |
| Native apps, blockchain, 3D maps, gamification, voice | Responsive web is required and native is optional [BOOKLET] |

---

## 2. The hero order's journey

The hero story follows ORD2001 (chilled, 12 units, 70 kg) and ORD2002 (dry, 8 units, 45 kg), both for OUT084 (Waypoint Fresh, Kandy, rear_dock, window 05:30 to 08:00). They travel on VEH039 trip 1 with ORD2003 for OUT087. At 05:21 Dispatch defers the stop at the store's request while the driver, already offline, goes on to deliver it. On reconnect the system recommends Keep delivery and Kumari confirms [DECIDED].

**Every screen that shows the hero must use these exact times, IDs and statuses. In the build these are the seeded and scripted values of the walkthrough (section 16), and the end-to-end test asserts them (section 17).**

| # | Time | Role | Action | Screen | Status after (ORD2001 + ORD2002) | What the other roles now see |
|---|---|---|---|---|---|---|
| H1 | Mon 28 Sep 15:40 | Store · Anusha | Places two orders for Tue: ORD2001 chilled 12 units, ORD2002 dry 8 units | S1.3 | Ordered | S1: "Received 15:40 · counts for Tue 29 Sep". D1: both rows under OUT084. S4.1: "Order received 15:40" |
| H2 | 16:00 | System | Cutoff closes; orders enter tomorrow's queue | D1 | Confirmed | S2.1: "Confirmed for Tue 29 Sep". S4.1: "Confirmed for Tue 29 Sep 16:00" |
| H3 | 16:05 | System | Drafts plan v1: both orders on VEH039 trip 1, first stop | D3 (Kandy) | Planned | D2 Kandy pool: 64 orders, 0 deferred |
| H4 | 23:40 | Dispatcher · Kumari | Releases plan v3 (Peliyagoda + Kandy) | D5.2, D5.3 A | Planned | D5.3 A (23:41): 0 of 4 acknowledged. L1 (Kandy dock): plan v3 to acknowledge. R1: route ready to download. S2.2: arrival "from 05:30 (truck may arrive 05:26 and wait)". S4.1: "Arrival time set 23:40" |
| n/a | Tue 29 Sep 03:00 | Dispatcher | Plan v4 released for the Peliyagoda reefer swap (see 2b). VEH039 unchanged | D8, D5.3 B | Planned | D5.3 B (04:10): Ruwan and Nimal acknowledgement pending. Kandy devices show v4 with "No change to your vehicle" (L1.6, L4.3) |
| H5 | 04:15 | Loader · Ruwan (Kandy dock, PIN) | Acknowledges v4 on the Kandy dock tablet | L1.6 B | Planned | D5 acknowledgement list: Ruwan · Kandy dock · v4 ✓ 04:15 |
| H6 | 04:20 to 04:50 | Loader · Ruwan | Loads in reverse stop order (ORD2003, then ORD2002, then ORD2001 in the chilled zone) and confirms at the gate | L2.1 to L2.4 | Loaded | D6: VEH039 loaded 04:50. R1.3 B: "Confirmed by Ruwan · 04:50". S2.3: Loaded. S4.1: "Loaded 04:50" |
| H7 | 04:55 | Driver · Nimal | Acknowledges v4 (route unchanged since v3); route cached for offline | R1.3 B | Loaded | D5.4 A: Nimal · VEH039 · v4 ✓ 04:55 |
| H8 | 05:10 | Driver · Nimal | Taps Start route; VEH039 departs Kandy | R1.4 to R1.5 | Departed | D6: VEH039 departed 05:10. S2.4: on the way, arrives about 05:26, unloading from 05:30. S4.1: "On the way 05:10" |
| H9 | 05:17 | System | Nimal's phone loses coverage; last sync 05:17 | R1.6 | Departed | R1.6: "Offline · last sync 05:17 · 0 waiting". D6.2: last heard 05:17, known coverage gap. S2.5: driver out of coverage. S4.1: "Driver out of coverage 05:17" |
| H10 | 05:20 | Store · Anusha | Phones Dispatch from home: receiving staff unavailable, please defer [ASSUMPTION A10] | n/a | Departed | n/a |
| H11 | 05:21 | Dispatcher · Kumari | Defers ORD2001 + ORD2002 (store request, next run Wed 30 Sep), creating plan v5. The dialog warns the change cannot reach the offline driver | D6.3 | Deferred · store request | S2.6: deferred at your request, next run Wed 30 Sep. S4.1: "Deferred at your request 05:21". D6.4: change pending, driver offline. D5.4 B: v5 released, driver offline 05:22. R1 unchanged, still v4 |
| H12 | 05:26 | Driver · Nimal (offline) | Records arrival at OUT084; window opens 05:30, so tag Waiting | R2.2 | On phone: Pending sync. On server: Deferred | R4: 1 waiting. D6 still last heard 05:17 |
| H13 | 05:42 | Driver · Nimal (offline) | Records Delivered for both orders: POD photo, receiver S. Fernando, 12 + 8 units | R3 | On phone: Pending sync | R4: 3 waiting |
| H14 | 05:48 / 05:58 | Driver · Nimal (offline) | Arrives at OUT087 and records ORD2003 Delivered [ASSUMPTION A11] | R2.3, R3.8, R3.9 | ORD2003: Pending sync | R4: 5 waiting |
| H15 | 06:40 | System | Coverage returns and the outbox syncs. Arrivals and ORD2003 are accepted; ORD2001 + ORD2002 disagree with v5 | R5.1 | Conflict (stores see: Under review) | R5.1: "3 synced · 1 conflict (2 orders) sent to Dispatch". D6.5 inbox: conflict needs a decision. S2.7: Under review, with "Why you're seeing this". S4.1: "Your delivery is under review 06:40" |
| H16 | 06:44 | Dispatcher · Kumari | Opens D7. Recommended: Keep delivery (physically done with proof; the deferral never reached the driver). Kumari confirms | D7.1 to D7.4 A | Delivered | R1.7 then R5.3 (resolved) and R1.8: "Dispatch kept your delivery at OUT084 · 06:44". S2.8: Delivered 05:42 + tag Deferral withdrawn. S4.1: "Delivery kept 06:44", review row marked "Resolved 06:44". Wed re-run removed; the audit keeps both records |
| H17 | 07:30 | Store · Anusha | Checks the POD and confirms receipt | S3.1 to S3.2 | Delivered + tag Receipt confirmed | D6.6: receipt confirmed 07:30. S4.2 (07:31): Tue 29 Sep row "Delivered 05:42 · Deferral withdrawn · Receipt confirmed 07:30" |

**Arithmetic checks**

- **Arrival.** 05:26 = 05:10 departure + 16 min Kandy outbound.
- **Deferral timing.** 05:21 falls after coverage is lost (05:17) and before delivery (05:42).
- **Plan (system view).** Arrive 05:26, wait to 05:30, leave 06:00; OUT087 06:06 to 06:21; 73 of 270 Fresh minutes.
- **Actual delivery.** 05:42 is faster than the 30-minute allowance (15 + 15). The allowance is a planning figure, not an observed time [BOOKLET]; this gap is what Datathon Task 1 predicts.

**Branch states** [BUILT]

- **D7 "Review with store first"** (D7.2 awaiting store). S3.5 asks Anusha "Did you receive this?". "Yes, we received it" resolves to S2.8; "Report issue" escalates to S3.3 and back to D7.3.
- **Store confirms receipt before the review is resolved** (S3.6). S3 records the receipt; the review stays open for Kumari, and the store is told no action is needed.
- **Store reports a shortage during review** (D7.3, 07:04 to 07:05). The recommendation becomes Keep delivery as Partial (10 / 12). "Confirm: keep as Partial" opens **D7.4 B**: status Partial, follow-up created for 2 units, Wed re-run removed, resolved by Kumari 07:05 [ASSUMPTION A28, A32].
- **Sync failure on the driver phone** (R8.2, R8.3, WP-SYNC-409): not part of the H15 to H16 chain. Entered from the notification list.

---

## 2b. Secondary scenario: reefer swap at the dock

The reefer planned for two Colombo Fresh trips fails its check, and the only spare is a smaller reefer van, so one order must be deferred [DECIDED]. The system recommends which one, protects the outlet skipped yesterday, and Kumari confirms.

| # | Time | Role | Action | Screen | Status after | What the other roles now see |
|---|---|---|---|---|---|---|
| X1 | Tue 02:45 | System | VEH036 (reefer van) is released from the workshop [ASSUMPTION A12] | D2.3, D6.7 | n/a | D6.7: "VEH036 available since 02:45" (info only) |
| X2 | 02:55 | Loader · Priya (PIN) | While loading VEH003 trip 1, flags "Vehicle check failed: reefer not holding temperature" [ASSUMPTION A12] | L2.5, L3.1 to L3.3 A | Trip-1 orders stay Planned; VEH003 tagged Held | D6.7: VEH003 held, 34 min to departure, Review. L1.4: VEH003 Held |
| X3 | 03:00 | Dispatcher · Kumari | Opens D8. VEH036 carries 1,040 kg / 7.0 m³; trip 1 holds 1,160 kg / 7.7 m³, so it is **120 kg and 0.7 m³ short**. System recommends deferring ORD1002 (OUT009): frees 210 kg / 1.4 m³, the least surplus of four equal-impact orders. OUT012 protected (deferred yesterday). Kumari confirms: plan v4 | D8.1 to D8.4 | ORD1002: Deferred · policy. Other VEH003 orders: Planned on VEH036 | L3.3 B (03:02): decision made, plan v4. L1.5: plan changed, review. S2.9 (OUT009): moved to Wed, decided by Kumari 03:00. D4: 19 to 20 deferrals |
| X4 | 03:04 to 03:05 | Loader · Priya (PIN) | Reviews the diff (VEH003 to VEH036; ORD1002 removed; stop order otherwise unchanged) and acknowledges | L4.1, L4.2 | n/a | D5: Priya · Peliyagoda dock · v4 ✓ 03:05 |
| X5 | 03:05 to 03:25 | Loader · Priya | Loads VEH036 trip 1 in reverse order (OUT012 first, then OUT005, OUT006, OUT011 last) and confirms at the gate | L2.6 A, L2.6 B | Loaded | D6: VEH036 loaded 03:25 |
| X6 | 03:30 | VEH036's driver, R. Silva (not a persona) | Departs on time [ASSUMPTION A17, A22] | n/a | Departed | D5: R. Silva · VEH036 · departed 03:30 |

**Arithmetic checks**

- **VEH036 trip 1 after the swap:** 4 stops (OUT011 stop 1, OUT006 stop 2, OUT005 stop 3, OUT012 stop 4), 950 / 1,040 kg, 6.3 / 7.0 m³, 109 min. Last stop OUT012 reached 05:04, waits for the 05:30 window.
- **Trip 2:** departs 06:09 after the return leg; last arrival OUT004 at 07:42, before its 08:00 close.
- **Vehicle total:** 218 of 270 Fresh minutes.
- **The deferral type is policy, not capacity:** other Peliyagoda reefers could legally carry OUT009, but they are full.

---

## 3. Screen inventory

Screen IDs are stable; Figma frames are named `<ID>.<n>` for states. "States (frames)" lists what exists on Nexora (main) on Wed 30 Sep [BUILT]. **In the build, a frame is a state of its screen, produced by data and the scenario clock, never a separate page** (section 15).

Everything is on the **"Nexora (main)"** page (`0:1`): role sections D1 to D9, S1 to S4, L1 to L4, R1 to R10 (**27 sections, 27 rationale cards**), sign-in (G1.1 to G1.5), role landing (G2.1 to G2.4), presenter mode (G3, over D6.4), "Why this screen" (G4, over D7.1), and the out-of-scope frames X1 to X14. G1 to G4 are prototype aids.

### Dispatcher · Waypoint Dispatch · large screen, Peliyagoda planning office, stable connectivity, Light theme [BOOKLET]

Top navigation: Plan (D1 to D5) · Live (D6 to D8) · Deferrals (D4, with count) · Forecast (D9). Depot switch Peliyagoda / Kandy. App bar: clock, date, depot, "Live sync", avatar K. Planning stepper: 1 Queue · 2 Capacity · 3 Trips · 4 Deferrals · 5 Release. Frames 1440 × 900.

| ID | Screen | Purpose | Key information | Primary action | States (frames) | Steps |
|---|---|---|---|---|---|---|
| D1 | Order queue | One confirmed queue at cutoff, carry-overs first [BOOKLET] | Rows with order, outlet, brand, district, temp, access/dock, window, units, kg, m³, status, **Received time**. Carry-overs ORD1001 (OUT012) and ORD1005 (OUT029) grouped first. 212 Peliyagoda / 64 Kandy. **ORD1020 flagged "No legal vehicle"** with reason line and amber bar; **At risk chip** (Peliyagoda 1, Kandy 0) opens the filtered view. Sort chevrons. **Capacity button locked before cutoff: "Opens at cutoff, 16:00"** | Go to capacity board | D1.1 before cutoff · D1.2 after cutoff · D1.3 Kandy · D1.4 filters open · D1.5 order history drawer · D1.S empty / loading / offline (cached queue, ORD1020 still flagged) / error | H1, H2 |
| D2 | Capacity | Supply vs demand per scarce resource; names the binding constraint and the forced-vs-chosen headline [DECIDED] | Binding: reefer Fresh minutes, 2,590 demand vs 2,160 supply (8 available reefers × 270), 120%, over by 430 min. Headline "Capacity forces 19 deferrals at Peliyagoda. 1 has no legal vehicle; policy chose the other 18." Cards "busiest vehicle: VEH011" (Style + Tech minutes) and "closest to limit: VEH003" (fuel). Kandy separate pool | Go to trip board | D2.1 Peliyagoda draft · D2.2 Kandy · D2.3 spare reefer appears (released, read-only) · D2.4 released read-only · D2.S | H3, X1 |
| D3 | Trip board | System draft plus live-validated edits [DECIDED] | Trip card per vehicle × trip: order rows, kg and m³ vs caps, trip minutes, vehicle Fresh total vs 270, fuel. One legend line "one brand · one district per trip". Deferred pool cards with order, outlet, brand, temperature tags and the binding tag. Drag, or select and "Move to…" | Move an order / defer | D3.1 draft · D3.2 accepted move with consequence preview · D3.3 refused: window (ORD1009 to VEH003 trip 2, arrival 08:06 after 08:00 close) · D3.4 refused: two rules (ORD1002 to VEH011: needs a reefer; two brands) · D3.5 refused: continuity guard (ORD1001) · D3.6 Move to… dialog (keyboard path) · D3.7 Why this vehicle checklist · D3.8 released read-only · D3.S | H3 |
| D4 | Deferrals | Forced vs chosen, with reasons and store notices [DECIDED] | Headline. Capacity group: ORD1020. Policy group: ORD1009, ORD1017, ORD1006 + 15 more (v4 adds ORD1002). Expanded card: **Impact on store**, **Frees**, **Next run**, binding tag, "Serve instead…" (opens D3.6). Protected: OUT012, OUT029. Store-request group after H11. Notice sent / seen. "Notices also go out automatically on release" | Confirm and release · Notify stores | D4.1 v3 · D4.2 detail drawer (ORD1002) · D4.3 v4 adds ORD1002 · D4.4 store-request group (Kandy, after H11) · D4.5 all stores notified · D4.S | H3, H11, X3 |
| D5 | Release | Lock a version and see who has it [APP] | Checklist gate (no unplaced order without a reason; every vehicle has a driver and dock). Totals (v3: 257 served, 19 deferred of 276). **Acknowledgement table**: person, role, vehicle / dock, plan they have, **Departs in**, **Call** on every row. Version history showing only versions that exist at the clock. Kandy dock warning names what stays blocked (the load gate) | Release plan v3 | D5.1 draft ready to lock (Mon 23:35) · D5.2 confirmation dialog · D5.3 A v3 released 23:40, 0 of 4 acknowledged (23:41) · D5.3 B v4 released 03:00, Ruwan and Nimal pending (04:10) · D5.4 A all acknowledged 04:56 · D5.4 B v5 released, driver offline 05:22 · D5.S (loading = releasing) | H4, H5, H7, X4 |
| D6 | Live operations | Exception-first live board, no map [DECIDED] | "Needs a decision" panel. Stat cards: Departed, Loading, Delivered, Issues. Caption "4 of N shown · needing attention first · Show all". Vehicle rows: trip, driver, plan on device, next stop, **Lateness risk**, stops done, last heard, status; expandable stop pills. "Defer stop" dialog. Refresh only on offline and error states | Review → · Resolve → · Defer stop | D6.1 normal · D6.2 driver offline · D6.3 Defer stop dialog with offline warning · D6.4 change pending · D6.5 conflict in inbox · D6.6 resolved + receipt confirmed (07:31) · D6.7 VEH003 held · D6.8 nothing needs attention · D6.S loading / offline / error (no empty state) | H8 to H17, X2 |
| D7 | Reconciliation | The named hero degradation screen: settle two true records [DECIDED] | Timeline 05:17 / 05:21 / 05:26 / 05:42 / 06:40. Driver record (Delivered 05:42, S. Fernando, POD) beside Dispatch record (Deferred · store request 05:21, v5, "Reached the driver? No: offline since 05:17"). Recommendation with reasons. "Who already knows" list after resolving | Confirm, keep delivery · Review with store first | D7.1 needs decision · D7.2 awaiting store · D7.3 store reported an issue (Partial 10 / 12) · D7.4 A resolved, Delivered (06:44) · D7.4 B resolved as Partial (07:05) · D7.S | H15, H16 |
| D8 | Loading exception | Resolve a pre-departure failure before the vehicle leaves [BOOKLET] | Failed VEH003 (truck, reefer, 5,510 kg, 26.4 m³) vs VEH036 (van, reefer, 1,040 kg, 7.0 m³); gap 120 kg / 0.7 m³; recommendation defer ORD1002 (policy); OUT012 protected; trip after the change; notices sent / not yet seen | Confirm, defer ORD1002, load VEH036 · Adjust manually | D8.1 held, working out options · D8.2 recommendation · D8.3 adjust manually · D8.4 confirmed, plan v4 · D8.S empty / offline / error (no loading state) | X2, X3 |
| D9 | Forecast | Which coming weeks will be short [DECIDED] | 4 ISO weeks labelled by their Monday: reefer demand vs usable capacity (%), over 100% flagged. Levers as notes only. "Baseline forecast: Datathon Task 2A model not wired in" | View only | D9.1 4 weeks · D9.2 short week flagged (expanded) · D9.S | Framing only |

### Loader · Waypoint Load · shared dock tablet, phone width first, Dark (pre-dawn) theme [BOOKLET: judged on phone-sized screens]

Frames 390 × 844 (L2 scroll variants up to 390 × 1,360; L1.7 tablet 1024 × 768).

| ID | Screen | Purpose | Key information | Primary action | States (frames) | Steps |
|---|---|---|---|---|---|---|
| L1 | Dock | Know which plan is current before touching a vehicle [APP] | Dock (Peliyagoda or Kandy), plan version + PIN acknowledgement, vehicles to load sorted by departure with countdown ("2 trips · 9 orders"). Call Dispatch shows "Peliyagoda dispatch desk" (no number) | Acknowledge plan (PIN) · Load | L1.1 plan not acknowledged 23:45 · L1.2 A/B/C PIN entry, success, wrong PIN (shake 120 ms, off under reduced motion) · L1.3 acknowledged 00:10 · L1.4 VEH003 Held 02:56 · L1.5 plan changed, review 03:01 · L1.6 A/B Kandy v4 no change, before / after (04:14, 04:15) · L1.7 tablet master and detail (04:30) · L1.S empty / loading / offline ("plan v4 as of 04:10") / error | H5, X2, X4 |
| L2 | Load plan | Load in reverse stop order and pass the gate [BOOKLET] | Reverse order with load numbers; chilled-zone marker; dock type; one check per order with units expected vs loaded (stepper prefilled). Gate "Confirm loaded: clear to depart" disabled until every order is checked or an issue is flagged. VEH036 after the swap shows four stops numbered 1 to 4 | Confirm loaded (PIN) · Flag issue | L2.1 A in progress (VEH039, 04:30) · L2.1 B count confirm · L2.2 short units entry (VEH036, 03:20) · L2.3 A all checked, gate enabled · L2.3 B PIN confirm · L2.4 loaded / cleared 04:50 · L2.5 held (VEH003, 02:56) · L2.6 A VEH036 reload (03:10) · L2.6 B VEH036 loaded 03:25 · L2.S empty / loading / offline (checks saved on tablet) / error (check not saved) | H6, X2, X5 |
| L3 | Flag exception (sheet) | Report a problem before departure [BOOKLET] | Six types: missing item, damaged item, wrong item, warehouse shortage, vehicle check failed, other; affected orders; units short; PIN. After sending: what is safe, who knows, what Dispatch is doing | Send to Dispatch | L3.1 choose type · L3.2 A details (vehicle check failed) · L3.2 B details (missing item) · L3.3 A sent, Kumari reviewing · L3.3 B decision made, plan v4 (03:02) · L3.4 A queued offline (call Dispatch if departure is under 30 min away) · L3.4 B error · L3.4 C sending | X2 |
| L4 | Plan changed | Show only what changed since the last acknowledged version [APP] | Diff v3 to v4, removed rows first and loudest ("Don't load ORD1002"), then changed (VEH003 to VEH036), then unchanged; new totals 950 / 1,040 kg · 6.3 / 7.0 m³ | Acknowledge (PIN) | L4.1 diff 03:04 · L4.2 acknowledged 03:05 · L4.3 no change for this vehicle (Kandy, 04:14) · L4.S empty / loading / offline (may be missing a newer version) / error | X4 |

### Driver · personal phone, used when safely stopped, Dark (pre-dawn) theme with Field (sunlight) variant [BOOKLET]

Tab bar: Run · Issues · History · Me. Top bar always shows the connectivity chip (Online / Offline · N / Synced HH:MM) and a bell. Frames 390 × 844. Hero-day frames are dated Tue 29 Sep.

| ID | Screen | Purpose | Key information | Primary action | States (frames) | Steps |
|---|---|---|---|---|---|---|
| R1 | Route | Today's stops, available offline [APP] | "Run 1 · VEH039", "Stop 1 of 2 · Kandy", plan version, stops with outlet, ETA, window, dock and parking note, expected wait ("Will wait 4 min"), temp tag, orders on each stop with units; connectivity line with last sync and records waiting; under-review or resolved notice. **Me tab (R1.9):** sunlight screen, text size, language (English, Sinhala, Tamil in native script), Distance tracking ("GPS, always on during a run. Works offline."), offline storage | Acknowledge · Start route · Arrive · Navigate · Problem | R1.1 no route yet · R1.2 A downloading 04:54 · R1.2 B ready offline · R1.3 A waiting for loading 04:45 · R1.3 B loaded and acknowledged 04:55 · R1.4 ready, start route · R1.5 departed online · R1.6 offline, last synced 05:17 · R1.7 under review (after sync) · R1.8 resolved notice · R1.9 Me tab · R1.10 Field sunlight variant · R1.S download failed | H7 to H9, H15, H16 |
| R2 | Stop detail | One stop, one decision at a time [APP] | Window, dock, parking, time to allow for unloading, orders on this stop; full-width Arrive; Call store; loader shortfall shown on the stop | Arrive → Record outcome | R2.1 before arrival (OUT084) · R2.2 A 05:27 waiting for the window · R2.2 B 05:30 window open · R2.3 A OUT087 05:48 · R2.3 B loader shortfall · R2.S offline arrival saved / error / not on your route / loading | H12, H14 |
| R3 | Record outcome | Proof that survives disputes [BOOKLET] | Outcome for the whole stop by default ("Same outcome for both orders"), per-order switch one tap away. **Five outcomes: Delivered, Damaged, Refused, Store closed, Other** (the per-order grid offers Delivered, Damaged, Refused, Other; Store closed is stop-level). Units delivered is a per-order stepper ("12 of 12"); R3.4 records damaged units ("10 of 12") with a photo. Proof: photo + receiver name required, signature optional; Store closed asks for a photo of the closed store and no receiver; Refused asks for a reason | Save delivery record | R3.1 same for the stop · R3.2 A viewfinder · R3.2 B after capture · R3.3 receiver name · R3.4 damaged goods with units · R3.5 A store closed · R3.5 B refused with reason · R3.5 C failed stop card on the run · R3.6 validation, missing photo or name · R3.7 saved to phone · R3.8 OUT087 · R3.9 all stops recorded (offline) · R3.10 05:59 waiting for signal · R3.11 signature pad (optional) | H13, H14 |
| R4 | Outbox (sheet from the chip) | Show that nothing is lost [APP] | Each record with state (waiting, syncing, synced, sent to Dispatch for review); "Simulate offline" switch (judge control, section 13) | Retry now · Close | R4.1 records waiting · R4.2 syncing · R4.3 1 "1 stop (2 orders) sent to Dispatch for review" · R4.3 2 error, "Retrying automatically every 30 s" + Retry now · R4.3 3 all synced | H12 to H15 |
| R5 | Sync result | Close the offline loop [APP] | "3 synced · 1 conflict (2 orders) sent to Dispatch"; nothing for the driver to do; the delivery record is safe | Back to route | R5.1 conflict sent to Dispatch · R5.2 all synced · R5.3 resolved (kept 06:44) · R5.S offline again / sync failed / nothing to sync / loading | H15, H16 |
| R6 | Problem: record what happened | Report a stop that can't be done, offline, and carry on [BUILT] | Choices exactly as drawn: **Can't reach the store · Vehicle problem · Goods damaged on the truck · Running late · Something else** (V30). Affected stop and orders, note, optional photo. Saved on the phone; Dispatch decides. Issues tab lists problems "Waiting for Dispatch" with Update | Save problem record | R6.1 choose what happened · R6.2 record problem · R6.3 saved, back on the run ("You can go on to OUT087") · R6.4 Issues tab (waiting for Dispatch) | Not in the hero line |
| R7 | Trip history | What was recorded on this and earlier runs, read-only [BUILT] | Runs with times, stops, distance, time and sync state; non-operating days as "No run · Depot closed"; run detail with legs and distance; stop detail with proof. Works offline. Rows: Today Tue 29 Sep, Mon 28 Sep, Sun 27 Sep No run, Sat 26 Sep, Fri 25 Sep, Thu 24 Sep (A34) | View | R7.1 trip history · R7.2 run detail with mileage · R7.3 stop in history (OUT084) · R7.4 history while offline mid-run | After H16 |
| R8 | Notifications | Changes that affect the driver's own run [BUILT] | Kept delivery, delivery sent for review, photo retrying, stop changed while offline. Sync issue also shown as an alert on the run (R8.2). Detail shows what failed, what is safe, reference (WP-SYNC-409) | Open | R8.1 notifications · R8.2 sync issue alert on the run · R8.3 detail, sync failed · R8.4 empty | H15, H16 |
| R9 | Finish run | Close the run with a distance for fuel [BUILT] | **Distance · GPS tracked** (19.4 km; legs 8.3 / 3.1 / 8.0 km), fuel used est. 3.9 L, "Planned 19 km · VEH039 at 5.0 km/l". "If it drops out for a stretch, the planned distance fills that gap." Run complete says whether all records have synced | Finish run | R9.2 GPS tracked (online) · R9.2 B GPS tracked (offline) · R9.3 run complete · R9.4 run complete, records still on phone · R9.5 no more runs today (next plan 23:40) | After H16 |
| R10 | Calendar days | Explain non-standard days so the driver never faces an unexplained empty screen [BUILT] | Monsoon day: slower roads, ETAs later (speed index 63 vs 77). Sunday: depot closed. Public holiday: depot closed, next plan when it reopens. Frames keep calendar.csv dates | View | R10.1 monsoon day (Sat 27 Jun) · R10.2 Sunday no run (Sun 28 Jun) · R10.3 public holiday (Tue 14 Apr) [ASSUMPTION A26] | Framing only |

### Store manager · Waypoint Store · outlet counter, phone and desktop, Light theme [BOOKLET]

Tab bar: Orders · Deliveries · Issues. Title bar "OUT084 · Waypoint Fresh" with "Kandy" below, a sync chip and the **Updates bell** (plain or unread). Phone frames 390 × 844 (S4.1 scrolls to 1,563); desktop frames (S1.6, S1.6 B, S2.11) 1280 × 800.

| ID | Screen | Purpose | Key information | Primary action | States (frames) | Steps |
|---|---|---|---|---|---|---|
| S1 | Place order | Order confirmed before the cutoff, editable until then [BOOKLET][TEAM ANSWER Q9] | Delivery date, window and dock, cutoff countdown, chilled and dry as two orders with unit steppers (kg and m³ estimated). Acknowledgement "Received 15:40 · counts for Tue 29 Sep", "You can edit until 16:00", arrival note, "What happens next" timeline. Edit order (quantities, Cancel order) until 16:00. Recent-orders lists skip Sundays | Place orders · Edit order | S1.1 15:38 before cutoff (22 min left) · S1.1 B 15:48 12 min left · S1.2 15:39 review · S1.3 15:40 received · S1.3 B 15:42 edit order · S1.3 C 15:44 order updated · S1.3 D 15:45 order cancelled · S1.4 16:07 after cutoff (For Wed 30 Sep · After cutoff) · S1.4 B 16:08 placed for Wed · S1.5 A offline, not sent · S1.5 B error · S1.5 C sending · S1.5 D no orders yet · S1.6 desktop · S1.6 B desktop review modal | H1 |
| S2 | Deliveries | Know what is coming, and when or why not [BOOKLET] | One card per delivery day for OUT084; status per order; window-aware arrival range; "Have receivers ready by 05:30"; deferral notice with type, reason, who decided, next run; journey (Show all steps); recent orders Mon to Sat. The Deliveries tab opens S2.10, whose Tue 29 Sep card opens S2.2 | Confirm receipt → | S2.1 16:01 confirmed · S2.2 23:41 planned with arrival range · S2.3 04:51 loaded · S2.4 05:11 on the way · S2.5 05:19 driver out of coverage · S2.6 05:22 deferred at your request · S2.7 06:41 **Under review** ("Why you're seeing this"; Yes, we received it / Report issue) · S2.8 06:45 delivered + deferral withdrawn · S2.9 03:01 deferred by policy (OUT009's view) · S2.10 23:41 recent orders · S2.11 07:28 desktop · S2.S empty / loading / offline / error | H2 to H17 |
| S3 | Receipt | Confirm what arrived, or raise an issue tied to the POD [BOOKLET] | POD photo, receiver, time, driver + vehicle; units delivered vs expected with steppers. Reducing a count switches the button to **Confirm with a shortfall**. Neutral "Report issue". Issue sheet: missing, damaged, wrong item, late, arrived warm, other; multi-select orders; units; photo. Issues tab lists reported issues ("No open issues" when empty) | Confirm receipt · Report issue | S3.1 07:28 to confirm · S3.1 B 07:29 confirm with a shortfall · S3.2 07:30 confirmed · S3.3 07:31 report issue sheet · S3.4 07:32 issue reported · S3.5 07:28 Dispatch asks: did you receive this? · S3.6 07:30 receipt confirmed while review still open · S3.7 07:35 Issues tab · S3.S empty / loading / offline / error | H17 |
| **S4** | **Updates and history** (V23) | One place to read every update the order record sends the store, and look back at past delivery days [BUILT] | **Updates segment:** grouped by day ("Today · Tue 29 Sep", "Yesterday · Mon 28 Sep"), newest first. Each row: tag (Order, Plan, Delivery, Deferral, Review), time, title, one-line body, View (opens the matching S1 or S2 state). Unread count; "Mark all read" → "All caught up". A review row shows "Resolved 06:44" once settled. **History segment:** filter All · Deferred · Partial; "Delivery days · Mon to Sat"; rows Tue 29 Sep 05:42 Delivered (ORD2001 + ORD2002 · Deferral withdrawn · Receipt confirmed 07:30), Mon 28 Sep 05:40 Delivered, Sat 26 Sep 05:51 Delivered, Fri 25 Sep Deferred · policy (Served next day), Thu 24 Sep 05:38 Delivered, Wed 23 Sep 05:44 Delivered, Tue 22 Sep 05:36 Delivered, Mon 21 Sep Partial (1 unit short). Only the current day opens a delivery; older rows are display-only | View · Mark all read | S4.1 06:45 updates, 2 unread · S4.1 B 06:46 all read · S4.2 07:31 History · S4.S A empty ("Nothing new. You will see order, plan, delivery and deferral updates here.") · S4.S B loading · S4.S C offline ("Showing updates saved on this phone. Last updated 06:44.") · S4.S D error ("Your orders and deliveries are safe. Nothing was changed." + Try again) · Bell component (plain, unread; accessible label "Updates") | H1 to H17 |

**S4 feed rows on the hero day** (copy exactly):

| Tag | Time | Title | Body |
|---|---|---|---|
| Order | Mon 15:40 | Order received | ORD2001 (chilled, 12 units) and ORD2002 (dry, 8 units) count for Tue 29 Sep. You can edit until 16:00. |
| Order | Mon 16:00 | Confirmed for Tue 29 Sep | Your two orders are in tomorrow's queue. |
| Plan | Mon 23:40 | Arrival time set | Arrival from 05:30 (truck may arrive 05:26 and wait). Have receivers ready by 05:30. |
| Delivery | Tue 04:50 | Loaded | Your orders are loaded on VEH039. |
| Delivery | 05:10 | On the way | VEH039 left Kandy at 05:10, arriving about 05:26, unloading from 05:30. |
| Delivery | 05:17 | Driver out of coverage | The last status is kept. Delivery is still expected from 05:30. |
| Deferral | 05:21 | Deferred at your request | ORD2001 and ORD2002 are deferred (store request). Decided by Kumari. Next run Wed 30 Sep. |
| Review | 06:40 | Your delivery is under review | The driver delivered at 05:42 before your 05:21 deferral reached the phone. Dispatch is choosing which record to keep. |
| Delivery | 06:44 | Delivery kept | Dispatch kept the 05:42 delivery of ORD2001 and ORD2002. Deferral withdrawn, no Wed re-run. |

### 3b. Prototype conventions (Day 5 design, for reference)

- **Sign-in and landing.** G1.1 to G1.5 lead to G2.1 (Kumari, opens D1 queue / D6), G2.2 (loader, opens L1), G2.3 (Nimal, opens R1) and G2.4 (Anusha, opens S1). Cards: "Kumari · 276 orders for Tue 29 Sep · Loaded 15:40 · synced", "Shared tablet · 4 vehicles to load · Loaded 23:45", "Nimal · 2 stops · not downloaded yet · Loaded 23:10", "Anusha · cutoff 16:00 · Loaded 15:38".
- **Flow starts.** 53. Named "Role · n · title" except two: "Flow 1" (G1.1 desktop sign-in) and a duplicate "Store · 7 · Deliveries: load error and retry 1" (opens S4.S D). Store flows run 1 to 12 plus 1b and 4b; S4 is "Store · 12 · Updates and history (H2 to H17)".
- **Present-mode keys.** On dispatcher main frames E opens Error, O Offline, L Loading, N Empty. R steps D3.1 → D3.3 → D3.4 → D3.5. Arrows walk X1 to X14.
- **Auto-advance.** Loading states 1.2 to 1.5 s; S2.1 to S2.5 and S2.7 after 5 s; D5.3 A and B; D6.4 to D6.5 and D6.6 to D6.8 after 5 s; R1.5 to R1.6 after 4 s; R3.10, R9.3 / R9.4 after 6 s.
- **Cross-role link.** Only G3 "Next step" (D6.4 to R2.2 A). In the **build**, cross-role handoffs are real: the receiving screen changes because the shared record changed.
- **Navigate** on driver stops opens a Google Maps search for the outlet in a new tab. This is not tracking.

---

## 4a. Rules and calculations

These rules live in **one shared rules module** (section 11). Every screen that shows a number or a refusal gets it from there [BOOKLET][DECIDED].

### Hard constraints: a plan never breaks these

| Rule ID | Rule | Source |
|---|---|---|
| R-KG / R-M3 | Weight and volume per trip: Σ order kg ≤ weight_cap_kg **and** Σ m³ ≤ volume_cap_m3 | [BOOKLET] |
| R-TEMP | Chilled orders only on reefers. Reefers may carry ambient; ambient vehicles never carry chilled | [BOOKLET] |
| R-VAN | van_only outlets only by vans | [BOOKLET] |
| R-DEPOT | A vehicle serves only its home depot's outlets | [BOOKLET] |
| R-WHOLE | Whole orders: one order = one vehicle, one trip, never split | [BOOKLET Task 2B] |
| R-BRAND / R-DISTRICT | One brand and one district per trip | [BOOKLET Task 2B][TEAM ANSWER Q6] |
| R-TRIPS | At most 2 trips per vehicle per day | [BOOKLET] |
| R-BUDGET-F / R-BUDGET-ST | Fresh trips ≤ 270 min total per vehicle; Style + Tech ≤ 480 min total per vehicle | [BOOKLET] |
| R-AVAIL | Only available vehicles; in_workshop or Held vehicles cannot be allocated | [BOOKLET Task 2B][APP] |
| R-FUEL | Fuel used this ISO week + tonight's planned fuel ≤ weekly_fuel_quota_l | [BOOKLET] |
| R-WINDOW / R-MALL | Planned arrival ≤ the outlet's window close, and ≤ the mall window close for mall_dock outlets | [BOOKLET][DECIDED] |
| R-CUTOFF | Orders after 16:00 go to the following operating day's run | [BOOKLET] |
| R-OPDAY | Waypoint operates Monday to Saturday; `is_operating` in calendar.csv decides | [BOOKLET] |
| R-EDIT | Store edits and cancellations only before 16:00 | [TEAM ANSWER Q9] |
| R-CONT | **Continuity guard** (policy, not physics): an outlet deferred on the previous run cannot be deferred by policy again unless no legal vehicle exists | [DECIDED][APP] |

**In execution**, a late arrival is still delivered and tagged Late; it is never refused [BOOKLET][DECIDED].

### Trip minutes (budget check)

trip min = depot_to_district_freeflow_min + inter_stop_freeflow_min × (orders − 1) + Σ service_allowance_min(brand, dock_type)

Count stops per **order**, not per outlet (OUT084's two orders are two allowances). The return leg is not included [BOOKLET Task 2B]. Worked example, VEH003 trip 1: 24 + 8 × 4 + (15 + 16 + 15 + 15 + 15) = 132 min.

### Planned clock (window check and arrival times)

- Arrival = departure + outbound + inter-stop hops + handling at earlier stops + waiting. Two orders at one outlet share one arrival (no inter-stop hop between them).
- An early arrival waits until the window opens; handling starts at the later of arrival and window open [BOOKLET].
- A second trip departs no earlier than the first trip's last handling end + the outbound time back to the depot.
- The 08:00 wall clock often binds before the 270-minute budget: VEH003's two trips use 241 of 270 min, yet a 5th stop on trip 2 would arrive at 08:06.
- Default departures (A5): Fresh first trips 03:30 (the Fresh operating window opens 03:30 [BOOKLET]), Style and Tech timed to reach the first mall window as it opens.

### Fuel and distance

- **Planned:** km = 2 × depot_to_district_km + inter_stop_km × (orders − 1); litres = km ÷ km_per_l. The return leg counts for fuel only [ASSUMPTION A7].
- **Actual (R9):** distance from the phone's GPS during the run, recorded offline. If GPS drops out for a stretch, the planned distance for that leg fills the gap. The driver enters nothing. Litres = distance ÷ km_per_l (estimate), with the planned distance shown beside it. GPS positions are never sent to Dispatch.

### What the store sees as arrival time

Shown arrival = the later of predicted arrival and window open, as a range, for example "from 05:30 (truck may arrive 05:26 and wait)".

### Lateness risk (D6)

| Value | Meaning |
|---|---|
| On time | Predicted arrival at every remaining stop is before its window closes |
| At risk | A remaining stop is predicted after its window close, or the vehicle is Held |
| Unknown · offline | No event since the vehicle went out of coverage |

Predicted arrival = last event time + remaining planned legs from the planned clock [ASSUMPTION A27]. Not a Datathon model.

---

## 4b. Deferral language, statuses and tags

One vocabulary for all four roles: 11 order statuses, three deferral types, and everything else is a tag [DECIDED]. In the build these are enums shared by the database, the API schema and the TypeScript types (section 10).

### Deferral language

| Type | When it applies | Reason line (example) |
|---|---|---|
| Deferred · capacity | No legal vehicle exists for the whole order today | ORD1020 · OUT001: "van_only and 1,250 kg; the largest Peliyagoda reefer van carries 1,040 kg; whole orders can't split." |
| Deferred · policy | A legal vehicle exists, but policy chose this order to absorb the shortfall | ORD1002 · OUT009: "VEH003 failed its check; replacement VEH036 is 120 kg / 0.7 m³ short on Trip 1." Frees 210 kg / 1.4 m³, the least surplus. Next run Wed 30 Sep |
| Deferred · store request | The store asked not to receive | ORD2001 + ORD2002 · OUT084: "Store request: receiving staff unavailable. Next run Wed 30 Sep." |

**Headline sentence** (D2 and D4): "Capacity forces N deferrals at {depot}. {k} have no legal vehicle; policy chose the other {N − k}." Store-request deferrals are not counted in N.

- v3 Peliyagoda: "Capacity forces 19 deferrals at Peliyagoda. 1 has no legal vehicle; policy chose the other 18."
- v4 adds ORD1002: 20 deferrals, 1 capacity and 19 policy.

**Every deferral shows:** its type; a binding-resource tag; **Impact on store** (deferred yesterday, days since last served, missed Fresh morning sales or the next mall slot); **Frees** (capacity freed on the binding resource); **Next run** date; whether the store notice was sent and seen. Show reasons, never a score. Ties go to the order that frees the least surplus [DECIDED].

### The 11 order statuses

| Status | Enum | Meaning | Set by | Shown on |
|---|---|---|---|---|
| Ordered | `ordered` | Submitted by the store before cutoff (editable until 16:00) | Store (S1) | S1, S2, S4, D1 |
| Confirmed | `confirmed` | In the closed queue after 16:00 | System at cutoff | D1, S2, S4 |
| Planned | `planned` | On a vehicle and trip in the current plan version | System draft; dispatcher (D3, D8) | D3, D5, L1, L2, R1, S2 |
| Deferred | `deferred` | Not in this run. Always has a deferral row (type, reason, next run) | System draft; dispatcher (D3, D4, D6, D8) | D3, D4, D6, D8, L4, S2, S4 |
| Loaded | `loaded` | Loader confirmed it at the L2 gate | Loader (L2) | L1, L2, D6, R1, S2 |
| Departed | `departed` | Driver started the route | Driver (R1) | R1, D6, S2 |
| Delivered | `delivered` | Full delivery recorded with POD and synced, or kept by the dispatcher in reconciliation | Driver (R3); dispatcher (D7.4 A) | R1, D6, D7, S2, S3, S4 |
| Partial | `partial` | Delivered with fewer units than ordered, as reported by the store or confirmed by the dispatcher. The driver has no Partial outcome | Store shortfall (S3); dispatcher (D7.4 B) | D6, D7, S2, S3, S4 |
| Issue | `issue` | A failed stop (refused, store closed), damage recorded by the driver (R3.4), a road problem (R6), or a store-reported problem | Driver (R3, R6); store (S3) | D6, S2, S3 |
| Pending sync | `pending_sync` | Recorded on a device, not yet on the server. **Device-only; never stored as a server status** | Device | R1 to R9, S1.5 A |
| Conflict | `conflict` | A synced device record disagrees with the current plan. Outlined amber. **Store-facing label: Under review** | System on sync | R4, R5, D6, D7; S2, S3, S4 as Under review |

Loader flags do not change order status: the **vehicle** gets the tag Held, and its orders stay Planned until the dispatcher decides.

### Tags (never statuses)

| Group | Tags |
|---|---|
| Order requirements | Chilled · Ambient · van_only · mall_dock · rear_dock / street / mall_bay |
| Planning | Carry-over · Protected · After cutoff · No legal vehicle · At risk · Binding: reefer minutes / weight / volume / van access / window / fuel |
| Execution | Waiting · Late · Deferral withdrawn · Receipt confirmed · Follow-up created |
| Lateness risk (D6) | On time · At risk · Unknown · offline |
| Issue type | Missing · Short · Damaged · Wrong item · Refused · Store closed · Late · Arrived warm · Other |
| Vehicle | Available · In workshop · Held · Replaced |
| Sync and versions | Offline · last sync HH:MM · Last heard HH:MM · Change pending · Plan vN · Acknowledged / Acknowledgement pending |
| Distance (R9) | Tracked (GPS) |
| Store feed (S4) | Order · Plan · Delivery · Deferral · Review |

---

## 4c. Shared data reference

**Reference data** (outlets, vehicles, calendar, district travel, allowances) comes from the competition CSVs at seed time. The values below were copied from them via app.html; **if a CSV disagrees, the CSV wins** and the seed check (section 14) fails until this table is corrected. **Hero-day orders, times and aggregates** are ours (4d) and are the seed targets.

### People and accounts

| Person | Role | Login | Where / what |
|---|---|---|---|
| Kumari | Dispatcher | dispatcher@waypoint.demo | Peliyagoda planning office; plans both depots; evening plan plus an early shift from 02:30 [A8] |
| Priya | Loader (PIN person) | loader@waypoint.demo (dock tablet) | Peliyagoda dock, night shift, PIN per action |
| Ruwan | Loader (PIN person) | same dock-tablet account, Kandy dock | Loads VEH039 [A9] |
| Nimal | Driver | driver@waypoint.demo | VEH039, Kandy, personal phone |
| Anusha | Store manager | store@waypoint.demo | OUT084, Waypoint Fresh, Kandy |
| S. Fernando | OUT084 night receiving staff | n/a | Named on the POD only |
| R. Silva | Driver of VEH036 (not a persona) | n/a | D5, D6 rows [A22] |
| P. Kumara, S. Jayasena | Drivers of VEH035, VEH011 (not personas) | n/a | D6 rows [A22] |

Demo passwords are set in `.env.example` and listed in the README (A40). Loader PINs: Priya `1234`, Ruwan `5678` (A36).

### Fleet by depot [from vehicles.csv]

| Depot | Reefer trucks | Dry-box trucks | Reefer vans | Ambient vans | Total |
|---|---|---|---|---|---|
| Peliyagoda | 7 | 27 | 2 | 2 | 38 |
| Kandy | 5 | 13 | 2 | 2 | 22 |

Network: 60 vehicles, 16 reefer-capable, 8 vans [BOOKLET].

### Vehicles used on screens

| Vehicle | Depot | Type · temp | Weight cap | Volume cap | km/L | Weekly quota | Used before tonight | Role in the story |
|---|---|---|---|---|---|---|---|---|
| VEH003 | Peliyagoda | truck · reefer | 5,510 kg | 26.4 m³ | 4.7 | 480 L | 58 L | Colombo Fresh, 2 trips. Fails its check at 02:55 |
| VEH011 | Peliyagoda | truck · ambient | 7,200 kg | 38.0 m³ | 4.9 | 600 L | 64 L | Style trip to the OUT015 mall |
| VEH035 | Peliyagoda | van · reefer | 1,040 kg | 7.0 m³ | 10.3 | 480 L | 40 L | Gampaha Fresh, 2 trips |
| VEH036 | Peliyagoda | van · reefer | 1,040 kg | 7.0 m³ | 10.3 | 480 L | 22 L | In workshop until 02:45; replaces VEH003 |
| VEH037 | Peliyagoda | van · ambient | 1,100 kg | 8.0 m³ | 11.5 | 340 L | 30 L | Not used in the story |
| VEH039 | Kandy | truck · reefer | 6,180 kg | 29.9 m³ | 5.0 | 370 L | 71 L | Hero vehicle |

"Used before tonight" is week-to-date fuel (A7), seeded into the fuel ledger.

### District travel and handling allowances [from district_travel.csv and service_allowance.csv]

| District | Depot | Outbound | Inter-stop |
|---|---|---|---|
| Colombo | Peliyagoda | 24 min · 12 km | 8 min · 4 km |
| Gampaha | Peliyagoda | 37 min · 28 km | 9 min · 7 km |
| Kandy | Kandy | 16 min · 8 km | 6 min · 3 km |

| Brand | rear_dock | street | mall_bay |
|---|---|---|---|
| Fresh | 15 min | 16 min | 18 min |
| Style | 38 min | 46 min | 59 min |
| Tech | 43 min | 55 min | 55 min |

### Pinned orders for Tue 29 Sep [sizes and history A3, A4]

| Order | Outlet | Brand · district | Temp | Dock · access | Window | Units | kg | m³ | Deferred yesterday | Days since served | Received (Mon) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ORD2001 | OUT084 | Fresh · Kandy | chilled | rear_dock · normal | 05:30 to 08:00 | 12 | 70 | 0.7 | no | 1 | 15:40 |
| ORD2002 | OUT084 | Fresh · Kandy | ambient | rear_dock · normal | 05:30 to 08:00 | 8 | 45 | 0.6 | no | 1 | 15:40 |
| ORD2003 | OUT087 | Fresh · Kandy | ambient | rear_dock · normal | 03:00 to 08:00 | 9 | 55 | 0.6 | no | 1 | 14:48 |
| ORD1014 | OUT011 | Fresh · Colombo | chilled | rear_dock · normal | 03:00 to 08:00 | 40 | 240 | 1.6 | no | 1 | |
| ORD1016 | OUT006 | Fresh · Colombo | chilled | street · normal | 03:00 to 08:00 | 38 | 230 | 1.5 | no | 1 | |
| ORD1011 | OUT005 | Fresh · Colombo | chilled | rear_dock · normal | 04:00 to 07:45 | 43 | 260 | 1.7 | no | 1 | |
| ORD1002 | OUT009 | Fresh · Colombo | chilled | rear_dock · normal | 04:00 to 07:45 | 35 | 210 | 1.4 | no | 1 | 14:02 |
| ORD1001 | OUT012 | Fresh · Colombo | chilled | rear_dock · normal | 05:30 to 08:00 | 37 | 220 | 1.5 | **yes** | 2 | 13:41 |
| ORD1013 | OUT008 | Fresh · Colombo | chilled | rear_dock · normal | 05:00 to 07:30 | 12 | 70 | 0.7 | no | 1 | |
| ORD1015 | OUT013 | Fresh · Colombo | chilled | rear_dock · normal | 05:00 to 07:30 | 12 | 75 | 0.7 | no | 1 | |
| ORD1018 | OUT010 | Fresh · Colombo | chilled | rear_dock · normal | 05:00 to 07:30 | 17 | 100 | 1.0 | no | 1 | |
| ORD1012 | OUT004 | Fresh · Colombo | chilled | street · normal | 05:30 to 08:00 | 16 | 95 | 0.9 | no | 1 | |
| ORD1009 | OUT014 | Fresh · Colombo | chilled | street · normal | 05:30 to 08:00 | 16 | 95 | 0.9 | no | 1 | |
| ORD1017 | OUT007 | Fresh · Colombo | chilled | street · normal | 05:30 to 08:00 | 11 | 65 | 0.6 | no | 1 | |
| ORD1020 | OUT001 | Fresh · Colombo | chilled | street · **van_only** | 05:00 to 07:30 | 208 | 1,250 | 8.6 | no | 3 | 15:12 |
| ORD1023 | OUT026 | Fresh · Gampaha | chilled | rear_dock · normal | 03:00 to 08:00 | 11 | 65 | 0.6 | no | 1 | |
| ORD1024 | OUT028 | Fresh · Gampaha | chilled | street · normal | 03:00 to 08:00 | 17 | 100 | 0.9 | no | 1 | |
| ORD1022 | OUT032 | Fresh · Gampaha | chilled | rear_dock · normal | 04:00 to 07:45 | 15 | 90 | 0.8 | no | 1 | |
| ORD1021 | OUT034 | Fresh · Gampaha | chilled | rear_dock · normal | 05:00 to 07:30 | 12 | 75 | 0.7 | no | 1 | |
| ORD1004 | OUT027 | Fresh · Gampaha | chilled | street · normal | 05:00 to 07:30 | 15 | 90 | 0.8 | no | 1 | |
| ORD1003 | OUT025 | Fresh · Gampaha | chilled | rear_dock · normal | 05:30 to 08:00 | 20 | 120 | 1.0 | no | 1 | |
| ORD1005 | OUT029 | Fresh · Gampaha | chilled | rear_dock · normal | 05:30 to 08:00 | 13 | 80 | 0.7 | **yes** | 2 | 13:48 |
| ORD1006 | OUT033 | Fresh · Gampaha | chilled | rear_dock · normal | 05:30 to 08:00 | 22 | 130 | 1.1 | no | 1 | |
| ORD1007 | OUT015 | Style · Colombo | ambient | mall_bay · **mall_dock** | mall 09:00 to 11:00 | 30 | 450 | 6.5 | no | 7 | 14:27 |

Also pinned: ORD1025 (OUT017) and ORD1026 (OUT023) (A19), ORD2004 to ORD2007 (A20). Every other order on the seeded day is generated (section 14) and keeps IDs outside these ranges.

### Plan v3 trips (released Mon 23:40)

| Vehicle · trip | Departs | Stops in order (planned arrival) | Load | Trip min | Vehicle total |
|---|---|---|---|---|---|
| VEH003 · 1 | 03:30 | OUT011 03:54 → OUT006 04:17 → OUT005 04:41 → OUT009 05:04 → OUT012 05:27 (waits to 05:30) | 1,160 / 5,510 kg · 7.7 / 26.4 m³ | 132 | Fresh 241 / 270 · fuel 74.2 / 480 L |
| VEH003 · 2 | 06:09 | OUT008 06:33 → OUT013 06:56 → OUT010 07:19 → OUT004 07:42 | 340 kg · 3.3 m³ | 109 | (above) |
| VEH035 · 1 | 03:30 | OUT026 04:07 → OUT028 04:31 → OUT032 04:56 → OUT034 05:20 | 330 / 1,040 kg · 3.0 / 7.0 m³ | 125 | Fresh 226 / 270 · fuel 54.3 / 480 L |
| VEH035 · 2 | 06:12 | OUT027 06:49 → OUT025 07:14 → OUT029 07:38 | 290 kg · 2.5 m³ | 101 | (above) |
| VEH011 · 1 | 08:36 | OUT015 09:00 (mall window opens 09:00) | 450 / 7,200 kg · 6.5 / 38.0 m³ | 83 | Style+Tech 83 / 480 · fuel 68.9 / 600 L |
| VEH039 · 1 | 05:10 | OUT084 05:26 (waits to 05:30; ORD2001 + ORD2002) → OUT087 06:06 | 170 / 6,180 kg · 1.9 / 29.9 m³ | 73 | Fresh 73 / 270 · fuel 75.4 / 370 L |

**Deferred in v3:** ORD1020 (OUT001), capacity: no legal vehicle. ORD1009 (OUT014) and ORD1017 (OUT007), policy: a 5th stop on VEH003 trip 2 would arrive at 08:06, after the 08:00 close. ORD1006 (OUT033), policy: a 4th stop on VEH035 trip 2 would arrive at 08:02. Plus 15 policy deferrals among the generated orders.

**Plan v4 (Tue 03:00):** VEH003's orders move to VEH036 (same stops); ORD1002 deferred by policy. VEH036: trip 1 950 kg / 6.3 m³ / 109 min; trip 2 departs 06:09; Fresh 218 / 270; fuel 29.0 / 480 L.

### Hero run actuals (VEH039) [A11, A24]

| Figure | Value |
|---|---|
| Legs (GPS) | Depot to OUT084 8.3 km · OUT084 to OUT087 3.1 km · OUT087 to depot 8.0 km · total 19.4 km |
| Fuel used (estimate) | 3.9 L at 5.0 km/l (planned 19 km) |
| Run times | Departed 05:10 · synced 06:40 to 06:45 · run 05:10 to 06:45, 1 h 35 min |

### Live-board rows at 07:31 (D6.6) [A33]

| Vehicle | Trip | Driver | Plan | Next stop | Stops | Last heard | Status |
|---|---|---|---|---|---|---|---|
| VEH039 | 1 | Nimal | v5 | Returning to Kandy | 2 / 2 | 07:29 | Delivered |
| VEH036 | 2 | R. Silva | v4 | OUT004 · ETA 07:42 | 3 / 4 | 07:29 · 2 min | Departed |
| VEH035 | 2 | P. Kumara | v4 | OUT029 · ETA 07:38 | 2 / 3 | 07:30 · 1 min | Departed |
| VEH011 | 1 | S. Jayasena | v4 | OUT015 · departs 08:36 | 0 / 1 | 07:27 | Planned |

### Aggregates and plan versions [A6]

| Figure | Seed target |
|---|---|
| Peliyagoda orders for Tue | 212. v3: 193 served, 19 deferred (1 capacity, 18 policy). v4: 192 served, 20 deferred (1, 19) |
| Kandy orders for Tue | 64. v3 to v4: 0 deferred. v5: 2 deferred (store request), both back to Delivered at 06:44 |
| Network, v3 | 276 orders · 257 served · 19 deferred |
| Binding resource (Peliyagoda) | Reefer Fresh minutes: 2,590 demand vs 2,160 supply (8 × 270) = 120%, over by 430 |
| Peliyagoda availability | Vehicles 34 / 38 (4 in workshop) · reefers 8 / 9 (VEH036 in workshop until 02:45) |

| Version | Time | State | Change |
|---|---|---|---|
| v1 | Mon 16:05 | Draft | System draft from the closed queue |
| v2 | Mon 21:15 | Draft | Kumari's adjustments after the capacity review |
| v3 | Mon 23:40 | Released | Peliyagoda + Kandy |
| v4 | Tue 03:00 | Released | VEH003 → VEH036; ORD1002 deferred (policy) |
| v5 | Tue 05:21 | Released | ORD2001 + ORD2002 deferred (store request); driver offline since 05:17 |

The 06:44 resolution is a decision on the order record, not a new plan version [A16]. No screen lists a version that does not yet exist at the clock.

---

## 4d. Assumption register

Everything below was invented or inferred. **Disclosure rule:** no per-screen "Mock data" chips; invented data is disclosed once, in the AI disclosure (Figma F17 and the Hackathon `docs/ai-disclosure.md`), in the videos and in the README.

### A1 to A17

| # | Assumption | Used in | How to retire it |
|---|---|---|---|
| A1 | Operating day Tue 29 Sep 2026, planned Mon 28 Sep | Everywhere | Seed check asserts is_operating = 1 in calendar.csv |
| A2 | Order IDs ORD1001 to ORD2007 for pinned orders (tomorrow's orders aren't in the dataset) | All screens | Keep; README |
| A3 | Units, kg and m³ per order; trip-1 weights raised so VEH036 is 120 kg short | D3, D8, L2, S3 | Generated orders sample sizes from deliveries_train.csv (section 14) |
| A4 | deferred_yesterday and days since last served | D1, D4, D8 | Seeded history days (section 14) |
| A5 | Departures: Fresh 03:30, VEH039 05:10, VEH011 08:36; second trips derived | D3, R1, S2 | Keep |
| A6 | Aggregates: 212 / 64 orders, 2,590 demand minutes, 19 deferrals | D1, D2, D4, D5 | **Hackathon: computed from the seeded day** (Q14) |
| A7 | Week-to-date fuel used; fuel includes the return leg | D2, D3, R9 | Seeded fuel ledger |
| A8 | One Peliyagoda office plans both depots; Kumari covers evening + early shift from 02:30 | D6 to D8 | README and video |
| A9 | Loader account = dock tablet with a PIN per person; Ruwan loads at Kandy | L1 to L4 | n/a |
| A10 | Anusha phones Dispatch at 05:20 from home; S. Fernando receives at 05:42 | H10 to H13 | n/a |
| A11 | Hero delivered 05:42; OUT087 arrival 05:48, delivered 05:58 | R3, D7, S2, S3 | n/a |
| A12 | VEH036 leaves the workshop at 02:45; VEH003 failure is "reefer not holding temperature" | X1 to X3 | Seeded vehicle availability |
| A13 | POD = photo + receiver name + device time; signature optional | R3, S3 | n/a |
| A14 | Store orders captured in units; kg and m³ estimated per unit from the outlet's history | S1 | Seeded per-outlet unit factors |
| A15 | D9 weekly percentages and "2 workshop slots" | D9 | Replace with a baseline computed from deliveries_train.csv (section 12) |
| A16 | Conflict resolution is a record decision, not a new plan version | D5, D7 | n/a |
| A17 | VEH036's driver is not a persona and departs 03:30 as planned | X6 | Scenario event (section 13) |

### A18 to A30

| # | Assumption | Used in |
|---|---|---|
| A18 | Received times: ORD1001 13:41, ORD1005 13:48, ORD1002 14:02, ORD1007 14:27, ORD1020 15:12, ORD1025 14:39, ORD1026 15:03, ORD2003 14:48 | D1 |
| A19 | ORD1025 (OUT017: Fresh, Gampaha, 04:30 to 08:00, 24 units, 150 kg, 1.0 m³) and ORD1026 (OUT023: Style, Colombo, mall dock, 18 units, 260 kg, 3.1 m³) | D1.2 |
| A20 | Kandy queue rows ORD2004 to ORD2007, received 14:55, 15:05, 15:18, 15:31 | D1.3 |
| A21 | D3 deferral cards: ORD1020 van access; ORD1009 window; ORD1017 window; ORD1006 window | D3 |
| A22 | Non-persona drivers: R. Silva (VEH036), P. Kumara (VEH035), S. Jayasena (VEH011) | D5, D6 |
| A23 | Delivered counts on D6.1 to D6.6: 22, 23, 24, 31, 33; Issues 1 then 0 | D6 (Hackathon: computed) |
| A24 | Hero run distances 8.3 / 3.1 / 8.0 km, 19.4 km, 3.9 L. No odometer readings | R7, R9 |
| A25 | Store edit flow: ORD2001 12 → 10 units at 15:42 (about 58 kg, 0.6 m³); updated 15:44; cancelled 15:45 | S1.3 B to D (branch, not the hero line) |
| A26 | Calendar frames keep calendar.csv dates: monsoon Sat 27 Jun (Kandy speed index 63 vs 77), Sunday Sun 28 Jun, public holiday Tue 14 Apr | R10 |
| A27 | Lateness risk rule (4a) | D6 |
| A28 | Store receipt shortfall: ORD2001 received 10 of 12, reported 07:04 (S3.1 B frame 07:29) | S3.1 B, D7.3 |
| A29 | Sync failure reference "WP-SYNC-409" | R8.3 |
| A30 | Release notes line on D5 version history | D5 |

### A31 to A43

| # | Assumption | Used in |
|---|---|---|
| A31 | D5.3 A clock 23:41: 0 of 4 acknowledged; "Departs in" 5 h 29 min (VEH039) and 3 h 49 min (VEH036). D5.3 B clock 04:10: Priya ✓ 03:05, R. Silva ✓ 03:10 (departed 03:30), Ruwan and Nimal pending "in 60 min" | D5.3 A, D5.3 B |
| A32 | D7.4 B: Kumari resolves as Partial at 07:05; notices to Nimal, Anusha and the Kandy dock at 07:05; follow-up for 2 units | D7.3, D7.4 B |
| A33 | Live-board rows at 07:31 (4c) | D6.6 |
| A34 | Driver history rows: Mon 28 Sep 05:09 to 06:31, 19.5 km, 1 h 22 min, 2 of 2; Sat 26 Sep 05:12 to 06:30, 19.6 km, 1 h 18 min, 2 of 2; Fri 25 Sep 05:05 to 06:52, 22.3 km, 3 of 3, 1 h 47 min; Thu 24 Sep 05:08 to 06:28, 19.2 km, 1 h 20 min, 2 of 2; Sun 27 Sep no run. Today Tue 29 Sep 05:10 to 06:45, 19.4 km, 1 h 35 min | R7.1 |
| A35 | Store history (Mon to Sat): Mon 28 Sep delivered 05:40; Sat 26 delivered 05:51; **Fri 25 deferred (policy), served next day**; **Thu 24 delivered 05:38**; Wed 23 05:44; Tue 22 05:36; Mon 21 partial (1 unit short). S2.10 swaps Thu and Fri; A35 wins (V25) | S2.10, S1.6, S4.2 |
| A36 | **New.** Demo loader PINs: Priya `1234`, Ruwan `5678` (requested by the loader build prompt). "Other…" in "Who's acknowledging?" takes a typed name | L1 to L4 |
| A37 | **New.** S4 feed rows and times (section 3, S4 table); "2 unread" at 06:45 = the 06:40 review row and the 06:44 kept row | S4.1 |
| A38 | **New.** Scenario checkpoint Mon 28 Sep 2026 15:30; the clock only moves forward except on Reset (section 13) | All |
| A39 | **New.** Background vehicles (everything except VEH039, VEH003 and VEH036's swap) progress by scripted scenario events, labelled as simulation in the README (section 13) | D6 |
| A40 | **New.** Demo passwords for the four accounts are set in `.env.example` and listed in the README | Sign-in |
| A41 | **New.** Generated orders for the seeded day, sampled per outlet from deliveries_train.csv with a fixed random seed by a local script (section 14) | D1 to D5 |
| A42 | **New (30 Sep, store build).** Until the backend supplies per-outlet unit factors (A14), the store mock spreads the hero orders evenly over their units: chilled 70 kg and 0.7 m³ per 12 units, dry 45 kg and 0.6 m³ per 8. Store estimates scale linearly with the unit count, kg rounded to a whole number, m³ to one decimal. This is what S1.3 B shows (10 chilled units, about 58 kg, 0.6 m³) | S1 |
| A43 | **New (30 Sep, store build).** Copy and behaviour S1 needs but Figma does not draw: "Orders closed at 16:00" with "This order can no longer be edited or cancelled." when an edit is refused at the cutoff; "Place 1 order" for a single line and a disabled "Place orders" for none; a line lowered to 0 is cancelled on Save changes; Cancel order has no confirm step (as drawn). The S1.4 after-cutoff order shows the hero quantities (12 and 8) read-only, as drawn | S1 |
| A44 | **New (30 Sep, store build).** The delivery day the store's Deliveries tab looks at is today until 08:00 and otherwise the next operating day; the S2 empty state's "No deliveries scheduled for Tue 29 Sep" uses it | S2.S A |
| A45 | **New (30 Sep, store build).** The S2 journey shows only the steps reached behind "Show all steps" while two or fewer are reached (S2.1); from Planned every step is listed. Ordered and Confirmed are green, the amber marker starts at Planned, and once Delivered the amber step is Receipt confirmed (it waits on the store) | S2.1 to S2.8, S2.11 |
| A46 | **New (30 Sep, store build).** After Got it on a deferral the button becomes a disabled "Dispatch has seen this"; the caption "Dispatch sees when you tap Got it." shows for store-request deferrals only | S2.6, S2.9 |
| A47 | **New (30 Sep, store build).** "Yes, we received it" on S2.7 settles the delivery for the store at once (Delivered 05:42 + Deferral withdrawn, as S2.8) without waiting for Dispatch at 06:44; the review stays Dispatch's to close | S2.7, S2.8, S3.5 |
| A48 | **New (30 Sep, store build).** S2 wording Figma does not draw: an Ordered day reads "Confirmed at 16:00 when orders close."; the S2.10 summary card's second line reads "arrives from HH:MM", "delivered HH:MM", "next run Wed 30 Sep", "Dispatch is reviewing" or "arrival time follows" by status. The mock holds ORD1002 (chilled, 35 units, window 04:00 to 07:45) for OUT009 so S2.9 can be shown | S2.10, S2.9 |
| A49 | **New (30 Sep, store build).** The S3 report sheet opens with Missing chosen, the first order selected and 2 units (S3.3 draws 2 of 12); a Missing report on part of an order is tagged Short (S3.4) | S3.3, S3.4 |
| A50 | **New (30 Sep, store build).** "Confirm with a shortfall" asks for a reason on a sheet (Missing, Damaged, Wrong item, Other) before it sends; the order becomes Partial and the receipt reads "ORD2001 · 10 of 12 units received · Missing" | S3.1 B |
| A51 | **New (30 Sep, store build).** S3.5 appears only when Dispatch has asked the store ("Review with store first"). Without an ask, the receipt under review is S3.1 with "Why you're seeing this", and Confirm receipt gives S3.6 with the review still open | S3.5, S3.6 |
| A52 | **New (30 Sep, store build).** A receipt confirmed offline is saved on the phone with the phone's time and sent on reconnect (S3.S C); reporting an issue needs a connection. The Issues tab lists reported issues: order IDs, issue tag, "2 units short", "Dispatch will follow up." (S3.7 draws only the empty tab) | S3.S C, S3.7 |
| A53 | **New (30 Sep, store build).** What the store has read of its S4 feed: everything sent by 05:20 on the hero morning (H10), and the deferral once Got it is tapped. So S2.6 at 05:22 has one unread and S4.1 at 06:45 has the two of A37 (the 06:40 review and the 06:44 resolution) when Got it was tapped; without it, three. Mark all read reads everything up to now | S4.1, bell |
| A54 | **New (30 Sep, store build).** For a day other than the hero's, the feed has only Order received, Confirmed and "Arrival from 05:30. Have receivers ready by 05:30." History lists the current day once it is delivered (or Partial) with its order IDs and tags; a day still under review or deferred is not listed yet. S4.S C shows the saved feed under the offline bar, worded "You are offline. Showing updates saved on this phone. Last updated HH:MM." | S4.2, S4.S C |

### Corrections to app.html

app.html (Plan A) is retired for the Hackathon. The React build replaces it; corrections C1 to C18 are absorbed into this spec and need not be applied to app.html.

---

## 5. Handoffs

Every handoff is a change to the shared order record or plan version, so the receiving screen shows it without a phone call [BOOKLET][DECIDED]. In the build each row is an API write followed by the receiver's next read (section 10); check both ends in the walkthrough test.

| # | From → To | Sender does (screen) | What travels | Receiver sees | If delayed or failed |
|---|---|---|---|---|---|
| 1 | Store → Dispatcher | Places, edits or cancels an order before 16:00 (S1) | Outlet, date, chilled or dry, units, estimated kg / m³, received time | D1 row (Ordered, then Confirmed at 16:00); edits and cancellations update the row | After cutoff: tagged After cutoff, moved to the following run, S1 says so. Offline: S1.5 A Pending sync; counts only once Received shows |
| 2 | Dispatcher → Store (schedule) | Cutoff (system) and release (D5) | Status, window-aware arrival | S2 and S4 at 16:00 (Confirmed) and 23:40 (Planned + arrival) | Not yet released: "Plan not released yet, arrival time follows" |
| 3 | Dispatcher → Store (deferral) | Notify (D4), Defer stop (D6), confirm (D8) | Deferred + type, reason, who decided, next run | S2 card at once (S2.6, S2.9), S4 row | Store offline: shown on next open. D4 shows sent / not yet seen |
| 4 | Dispatcher → Loader | Release (D5), confirm (D8) | Plan version, trips, reverse load order, what changed | L1 acknowledge; L4 diff when a vehicle changes | Not acknowledged: D5 "Acknowledgement pending" with Call; L2 gate blocked for that vehicle. Dock offline: L1.S offline |
| 5 | Loader → Dispatcher | Send to Dispatch (L3) | Exception type, vehicle, affected orders, units short | D6 needs-a-decision item → D8 | Until decided: vehicle Held, L3.3 A. Tablet offline: queued (L3.4 A) |
| 6 | Loader → Driver | Confirm loaded at the gate (L2) | Orders + units on board, shortfalls | R1.3 B "Confirmed by Ruwan · 04:50"; R2.3 B shortfall on the stop | Not confirmed: R1.3 A waiting for loading, Start route disabled |
| 7 | Dispatcher → Driver | Release (D5); later changes (D6) | Plan version, stops, windows, docks, changes | R1 on next sync; driver acknowledges | Driver offline: D6.4 change pending, D5.4 B. The phone keeps its last version and never shows a change it didn't receive |
| 8 | Driver → Dispatcher | Arrival (R2), outcome + POD (R3), via the outbox (R4) | Per order: outcome, units, receiver, photo, device time | D6 rows on sync; disagreements go to D7 | Offline: Pending sync on the phone; D6 last-heard age and Unknown · offline |
| 9 | Driver → Store | Delivery record (R3) | Delivered time, receiver, POD, units | S2 delivery record; S3 to confirm; S4 row | Driver offline: S2.5 keeps the last status with a coverage note |
| 10 | Store → Dispatcher | Confirm receipt, confirm with a shortfall, or report an issue (S3); answer "Did you receive this?" (S3.5) | Receipt, issue type, units, photo | D6 order row; D7.3 if raised during a review, resolved on D7.4 B as Partial | Not confirmed: stays Delivered without Receipt confirmed |
| 11 | Dispatcher → Driver (resolution) | Confirm (D7.4 A or B) | Final status, deferral withdrawn | R1.8 notice, R5.3, R8.1 | Driver offline again: shown on next sync |
| 12 | Loader → Store (via Dispatcher) | L3 flag, then D8 decision | Short units or a deferral before arrival | S2.9 before the truck arrives; S4 row | n/a |
| 13 | Driver → Dispatcher (problem) | Record problem (R6) | What happened, affected orders, time, stop | D6 needs-a-decision item; R6.4 "Waiting for Dispatch" | Offline: saved on the phone (R6.3), sent on signal |
| 14 | Order record → Store (updates feed) | Any change above that concerns the store's orders | Tag, time, title, body, link to the S1 or S2 state | S4.1 row, bell turns unread | Store offline: S4.S C shows the updates saved on the phone |

---

## 6. Design system link

Visual rules come from the shared Figma library ("Shared Library Framing" `158:2`: LIB1 Master Order Component `162:429`, LIB2 status, tags, buttons and icons `161:3`, LIB3 global chrome `166:1761`, LIB6 field components `171:2123`, LIB8 states `173:2112`) and the style guide (F16 `187:3073`). Where a library component and a real frame differ, the frame wins. In code they live in `frontend/src/styles/tokens.css` (custom properties from the Figma variable collection "Waypoint colour", three modes: `light` Light · office, `dark` Dark · pre-dawn, `field` Field · sunlight, set by `data-theme` **on each role's root element**, not on `<html>`, because four roles share one app; Field mode has no shadows) and in shared components under `frontend/src/shared/` (cross-role) and `frontend/src/field/` (loader and driver). The full token table is in `claude/field-build/00-field-conventions.md` §6. Nobody builds a one-off component inside a screen.

### App names and themes

| Role | App name | Theme |
|---|---|---|
| Dispatcher | Waypoint Dispatch | Light (office) |
| Loader | Waypoint Load | Dark · pre-dawn (night dock) |
| Driver | (no product name shown on screens) | Dark · pre-dawn by default; Field · sunlight when the R1.9 switch is on; Light · office when the phone prefers light (V31) |
| Store manager | Waypoint Store | Light (daylight counter) |

Theme follows the working environment, not the role. The build prints "Waypoint Load" and "Waypoint Store" in their chrome and shows a neutral "Waypoint" sign-in (section 18, departure DP-02).

### Type and writing rules

- Archivo for sentences and labels; IBM Plex Mono only for IDs, times and figures (self-hosted via fontsource so they work offline). Sinhala and Tamil (R1.9 language labels and the driver translations) use Noto Sans Sinhala and Noto Sans Tamil, also self-hosted.
- Scale: h1 28/34 700 · h2 22/28 600 · h3 17/24 600 · body 15/22 · body-sm 13/18 · caption 12/16 · label 12/16 600 uppercase · pill 13/16 600 · button 17/24 (large) and 15/20 (medium) 600 · data 14/20 Plex Mono 500. Nothing under 12 px; contrast at least 4.5:1.
- Spacing on a 4 px grid; radius 4 tags, 8 inputs and medium buttons, 12 cards, sheets and large buttons, 999 pills; buttons 56 / 44 px; every tap target at least 44 px.
- Icons: Lucide, 2 px stroke; fixed meanings (clock Ordered, lock Confirmed, route Planned, check Loaded / Delivered, truck Departed, alert-triangle Partial / Under review, alert-circle Issue, cloud Pending sync, wifi-off Offline, snowflake Chilled / Arrived warm, calendar-clock Deferred, bell Updates).
- No em dashes in visible text; no "Mock" text; no bracketed placeholders; no invented phone numbers ("Peliyagoda dispatch desk").
- Times are 24-hour HH:MM Asia/Colombo; dates "Tue 29 Sep"; units after a space ("0.7 m³"); buttons are verb + object.
- Motion: 120 ms colour transitions, spinning sync icon while sending; respect `prefers-reduced-motion`.

### Master Order Component: one component, four densities

| Density | Used on | Adds |
|---|---|---|
| Dispatcher row | D1, D3, D4, D6, D8 | Temp / access / dock tags, kg + m³, window, reason line, "Move to…", history drawer |
| Loader check | L2, L4 | Load number (reverse order), large check target, units expected vs loaded, chilled-zone accent, dock type |
| Driver stop | R1, R2, R3 | Outlet, window, dock type, orders on the stop, units; large tap target |
| Store delivery | S2, S3, S4 | Brand + chilled / dry, window-aware arrival, deferral notice, POD summary |

### Components the build needs

| Group | Components |
|---|---|
| Status and tags | StatusPill (11 states, role-aware label via `statusLabel(status, role)`) · Tag · BindingTag · LatenessPill · AtRiskChip |
| Global | AppBar (clock, depot, plan version) · TopBar · TabBar · SyncChip · ConnectivityBar · LastHeard · PlanningStepper · UpdatesBell |
| Planning | CapacityCard · ForcedVsChosenHeadline · TripCard · ConsequencePreview · RefusalPopover (every broken rule) · WhyThisVehicle · DeferralBlock · VersionHistory · AcknowledgementTable |
| Decisions | RecommendationPanel · RecordComparison · EventTimeline · VehicleSwapCard |
| Field | PlanDiffRow · PinSheet · Sheet · PinnedActionBar · OutcomeGrid (5) · UnitStepper · PhotoTile · SignaturePad · OutboxRow · OfflineBanner |
| Store | CutoffCountdown · AcknowledgementCard · WhatHappensNext · ArrivalRangeCard · DeferralNotice · WhySeeingThisCard · PODSummary · IssueSheet · UpdatesFeedRow · HistoryRow |
| States | Alert (info, success, warning, danger, offline, conflict) · StateScreen (empty, loading, offline, error with retry) · ForecastWeekRow |

Dialogs, sheets, popovers and toasts use Radix primitives styled with CSS Modules.

---

## 7. Known gaps between this spec and the Day 5 prototype (re-checked Wed 30 Sep)

These stay in the frozen Figma file. The build implements the spec's behaviour; the right-hand column says what the build does. Any visible difference goes in section 18.

| # | Gap in Figma (30 Sep) | Status | Build does |
|---|---|---|---|
| G-1 | Loader handoffs: L1.1 "Acknowledge plan v3" goes straight to L1.3 without a PIN sheet; L1.3 "Load VEH003" opens L3.1; L2.5 "Go to VEH035" opens L1.4; L2.2 "Flag shortage" opens L3.2 B; L2.6 A title and L2.6 B "Back to load lists" return to the 00:10 dock L1.3 | Still open | Every acknowledgement and gate confirm asks for a PIN; "Load" opens L2; back goes to the current dock state (DP-03) |
| G-2 | "Waypoint Load" and "Waypoint Store" not printed; all five sign-in frames read "Waypoint Dispatch"; no retry on wrong-password and offline sign-in | Still open | App names printed; neutral sign-in; retry shown (DP-02) |
| G-3 | 13 state frames have no inbound link (S1.5 B, S1.5 D, S2.S A, S2.S C, S3.S A, S3.S C, R1.S, R2.S 2, R2.S 3, R3.6, R5.S 1, R5.S 3, R8.4) | Still open | States appear when data or connectivity causes them; all reachable in the `/_states` galleries |
| G-4 | Counts disagree: Deferrals badge 2 on D1.1 and D1.2, 19 on D4.1 and D5.1, 20 on D6.1 and D6.6, 0 on D7.4 B (Kandy); D5 "36 trips · 11 drivers" (Priya 8, Ruwan 3) vs D6 "38 trips today" | Still open | Every count computed (Q14). Badge = deferred orders in the latest plan version for the selected depot, hidden before the first draft (DP-04) |
| G-5 | D6.8 is clocked 06:15 but its rows show the ~05:12 picture (VEH039 "arrive about 05:26", last heard "05:12 · now"; VEH036 at OUT012) | Confirmed | Rows computed from the clock |
| G-6 | Small mismatches: D3.6 "Kandy" opens D3.2; "History" on D6 rows opens the ORD1002 drawer; D2.3 "Open live view" opens D6.7; R1.8 and D7.4 quote the driver notice differently (D7.4 B says "OUT084: resolved: kept as partial"); S3.5 shows 07:28 while D7.2 asks at 06:45; D1.1 omits ORD1025 and ORD1026; R7.1's Sun 27 Sep row opens R10.2 (Sun 28 Jun) | Still open | One notice text per event from the API; the history drawer opens for the row's own order; R7 Sunday row opens a Sunday state for that date |
| G-7 | Page layout: header "Kumari · Dispatcher screens" only above the dispatcher column; empty 100 × 100 frame "Title with lock" at (0, 0); G frames far left; R10.1 "Start route" opens R1.5 | Still open | n/a (Figma only) |
| G-8 | Stop-number marker for OUT012 on L2.2 and L2.6 B unchecked | Unchecked | Load numbers computed from stop order |
| G-9 | Contrast not measured file-wide. Text under 12 px now only on X frames (X1, X5, X9, X11, X13) | Narrowed | Token contrast checked in CI (section 17) |
| G-10 | **New.** S2.10 swaps Thu 24 and Fri 25 (see V25) | New | Follows A35 (DP-05) |
| G-11 | **New.** Flow start "Flow 1" (G1.1) is unnamed; "Store · 7 · Deliveries: load error and retry 1" duplicates Store · 7 and opens S4.S D | New | n/a (Figma only) |
| G-12 | **New.** The Updates bell is on S1.1, S1.1 B, S1.3, S2.1 to S2.8 and S2.10 only; not on S1.2, S1.4, S1.5, S1.6, S2.9, S2.11, S3 or S4 frames. Desktop frames have no bell | New | Bell on every store screen, phone and desktop (DP-06) |
| G-13 | **New.** Hidden "Mock data" tag layers remain inside X2 to X13 (not visible) | Harmless | n/a |

---

# Part B · Build (Hackathon)

## 8. What the Hackathon requires [BOOKLET]

- A **responsive web application** where a judge completes the delivery workflow across all four roles, planning → loading → delivery → receipt. Driver and loader are judged on **phone-sized screens**.
- The system **respects the operating constraints** (capacity, temperature, access, windows, fuel) and **handles a day when demand exceeds capacity**, producing an allocation that respects the constraints and identifies deferred orders.
- **Seeded** with the shared datasets and at least one realistic delivery day, so the walkthrough works on a **fresh installation**.
- **Deliverables:** public URL + four seeded accounts; GitHub **monorepo named `TeamName_SolutionName`** with README (setup, config, accounts, numbered judge walkthrough, departures from the Designathon), `docker-compose.yml` and `.env.example` at the root (`docker compose up` starts everything including the database and seed data), `docs/` with an architecture diagram, a data model and an AI tool disclosure; a **5 to 8 minute** unlisted YouTube video showing all four roles then the code and architecture.
- **Judging:** functional completeness across four roles 20% · planning and allocation engine 20% · degradation, offline and recovery 10% · fidelity to the Day 5 design 10% · **engineering quality and architecture 25%** · creativity 5% · demo video 10%.
- **Deadline Sun 4 Oct 2026, 23:59** Sri Lanka time. Code pushed after it is not considered. Keep the deployment live through review (and semifinal and final if we advance).
- **Data confidentiality:** the datasets must not be shared, published or uploaded to third parties (section 19, open decision O-1).

Repository name [BUILD]: **`Nexora_Waypoint`**.

## 9. Architecture [TEAM ANSWER Q12 + BUILD]

```
 Browser (one SPA, four role areas)                         Server
 ┌───────────────────────────────────────────┐   HTTPS   ┌──────────────────────────────┐
 │ React + TS (Vite) · React Router          │ ────────▶ │ web: nginx (static SPA,      │
 │ TanStack Query (server state, polling)    │           │      /api proxy, TLS on host)│
 │ Dexie / IndexedDB: route cache, outbox,   │           ├──────────────────────────────┤
 │   photos, store feed cache                │           │ api: FastAPI (uvicorn)       │
 │ Service worker (vite-plugin-pwa/Workbox): │           │  routers per role            │
 │   app shell, fonts, route package         │           │  services (orders, planning, │
 │ Role API clients (typed from OpenAPI) +   │           │   loading, runs, sync,       │
 │   mock implementations for dev            │           │   reconciliation, feed)      │
 └───────────────────────────────────────────┘           │  waypoint_rules (pure Python)│
                                                         │  scenario clock + jobs       │
                                                         ├──────────────────────────────┤
                                                         │ db: PostgreSQL 16            │
                                                         │ uploads volume (POD photos)  │
                                                         └──────────────────────────────┘
 Datathon notebook ── imports waypoint_rules (Task 2B feasibility + trip minutes)
```

**Repository layout** [BUILD]

```
Nexora_Waypoint/
├── frontend/                 existing Vite app
│   ├── src/api/              schema.ts (generated from OpenAPI); real clients per role
│   ├── src/shared/           cross-role UI, domain types (11 statuses, tags), statusLabel()
│   ├── src/field/            loader + driver infrastructure: offline/ (Dexie db
│   │                         `waypoint-field`, connectivity, transport, outbox, sync,
│   │                         blobs), clock, gallery, chrome components, gps/
│   ├── src/screens/{dispatcher,store,loader,driver}/   screens, fixtures.ts, mock API
│   ├── src/styles/           tokens.css (light, dark, field), base.css
│   ├── .figma/ .compare/     local Figma and app screenshots (gitignored)
│   └── scripts/compare-frames.ts
├── backend/
│   ├── app/                  FastAPI: main.py, routers/, services/, models/ (SQLAlchemy),
│   │                         schemas/ (Pydantic), clock.py, jobs.py, auth.py
│   ├── alembic/              migrations
│   ├── waypoint_rules/       pure package: no FastAPI, no SQLAlchemy imports
│   ├── seed/                 load_reference.py, generate_day.py, fixtures/ (pinned rows),
│   │                         scenario_events.yaml, checks.py
│   └── tests/                rules, planner golden, sync, API
├── data/                     competition CSVs (see O-1; not committed if the repo is public)
├── e2e/                      Playwright judge walkthrough
├── docs/                     architecture.md (+ diagram), data-model.md (+ ERD),
│                             ai-disclosure.md, api.md (link to /api/docs)
├── docker-compose.yml, .env.example, README.md
```

**Principles** [BUILD]

1. **One source of rules.** `waypoint_rules` holds every constraint, calculation and refusal message. The API calls it; the frontend never re-implements a rule, it asks the API (`/validate`) or displays what the API computed.
2. **The server owns time.** `clock.now()` everywhere; nothing calls `datetime.now()` in business code (Q13, section 13).
3. **Events plus state.** Every business action writes the state change and an `audit_events` row in the same transaction. Order history (D1.5), R7, S4 and the D7 timeline read from events.
4. **Idempotent writes from devices.** Every device record has a client UUID; replays are harmless.
5. **Typed contract, mock first.** Each role has a typed API interface (`DispatcherApi`, `StoreApi`, `LoaderApi`, `DriverApi`) with a mock implementation over a small transport, seeded from that role's `fixtures.ts`. Screens call only the interface, never `fetch` or fixtures directly. FastAPI generates OpenAPI; `openapi-typescript` generates `frontend/src/api/schema.ts`; the real client implements the same interface, so wiring the backend is a swap per role (section 19). The backend seed mirrors the role fixtures.
6. **Role-scoped access.** Every endpoint checks role and scope (depot, outlet, vehicle, dock) from the token.

**Live updates** [BUILD]: TanStack Query polling (dispatcher live board and inbox 5 s; store deliveries and feed 10 s; loader dock 10 s; driver on sync). No websockets needed for the walkthrough; SSE is optional later.

**Auth** [BUILD]: email + password → JWT (bearer, 12 h). Sessions are stored **per role** in `localStorage` (`wp.session.dispatcher`, `wp.session.loader`, …) so one browser can hold all four roles in four tabs, which the walkthrough needs. The driver token survives offline so the outbox can sync later. Loader actions additionally need a **PIN person** chosen in the PIN sheet ("Who's acknowledging?" Priya, Ruwan, Other…): the dock tablet caches salted PIN hashes for its dock's people so PIN actions can queue offline; the server re-verifies on sync. The tablet's dock is a device setting (`?dock=kandy|peliyagoda` in the gallery).

## 10. Data model (PostgreSQL) [BUILD]

Times are `timestamptz` stored in UTC and shown in Asia/Colombo. `service_date` is the delivery day (`date`). IDs from the datasets are kept as text primary keys (`OUT084`, `VEH039`, `ORD2001`).

### Reference data (from the CSVs)

| Table | Key columns |
|---|---|
| `depots` | id (`peliyagoda`, `kandy`), name |
| `districts` | name PK, depot, road_class, free_flow_kmh, depot_to_district_km, depot_to_district_freeflow_min, inter_stop_km, inter_stop_freeflow_min |
| `service_allowances` | (brand, dock_type) PK, minutes |
| `outlets` | id PK, brand, district, depot, dock_type, parking_constraint, mall_window_open, mall_window_close, window_open, window_close, units_to_kg, units_to_m3 (A14, derived from history) |
| `vehicles` | id PK, type, temp, weight_cap_kg, volume_cap_m3, fuel_type, km_per_l, weekly_fuel_quota_l, depot |
| `calendar_days` | date PK, dow, dow_name, is_weekend, iso_year, iso_week, is_payday, festival, festival_ramp, is_holiday, monsoon, is_operating |
| `traffic_speed` | as supplied (used for the R10 monsoon speed index) |

### People and access

| Table | Key columns |
|---|---|
| `users` | id, email unique, password_hash, role (`dispatcher`, `loader`, `driver`, `store`), display_name, depot, outlet_id, vehicle_id |
| `pin_people` | id, loader_user_id, name (Priya, Ruwan), dock (depot), pin_hash |
| `drivers` | vehicle_id PK, name (Nimal, R. Silva, P. Kumara, S. Jayasena, generated names for the rest), user_id nullable |

### Orders and deferrals

| Table | Key columns |
|---|---|
| `orders` | id PK, outlet_id, service_date, temp (`chilled`, `ambient`), units, weight_kg, volume_m3, status (enum, 10 server statuses), tags text[], received_at, placed_by, after_cutoff bool, cancelled_at, deferred_from_order_id (re-run lineage), row_version int |
| `outlet_service_history` | outlet_id, service_date, outcome (`served`, `deferred`, `partial`, `no_run`), time; drives deferred_yesterday and days_since_served, S4.2 and S2.10 |
| `deferrals` | id, order_id, plan_version_id, type (`capacity`, `policy`, `store_request`), binding (`reefer_minutes`, `weight`, `volume`, `van_access`, `window`, `fuel`, null), reason_text, impact jsonb (deferred_yesterday, days_since_served, consequence), frees jsonb (kg, m3, minutes), next_run_date, decided_by, decided_at, notice_sent_at, notice_seen_at, withdrawn_at, withdrawn_reason |

### Plans, trips, loading

| Table | Key columns |
|---|---|
| `plan_versions` | id, service_date, number (1..n), state (`draft`, `released`), note, created_by, created_at, released_at. One plan per service date covering both depots |
| `trips` | id, plan_version_id, vehicle_id, trip_no (1, 2), brand, district, depart_at, minutes, kg, m3, planned_km, planned_fuel_l |
| `trip_orders` | trip_id, order_id, seq (stop order), load_no (reverse), planned_arrival, handling_start, handling_end |
| `vehicle_day_status` | (vehicle_id, service_date) PK, availability (`available`, `in_workshop`), available_from, held_at, held_reason, replaced_by |
| `fuel_ledger` | (vehicle_id, iso_year, iso_week) PK, used_before_l |
| `acknowledgements` | id, plan_version_id, actor_kind (`pin_person`, `driver`), actor_id, dock or vehicle_id, acknowledged_at |
| `load_checks` | trip_id, order_id, units_expected, units_loaded, checked_by_pin, checked_at, client_id |
| `load_gates` | trip_id PK, confirmed_at, confirmed_by_pin |

### Field execution and reconciliation

| Table | Key columns |
|---|---|
| `runs` | id, vehicle_id, trip_id, driver_id, plan_version_seen, departed_at, finished_at, gps_km, gps_gap_filled_km, fuel_l_est, last_heard_at |
| `device_records` | client_id uuid PK (the idempotency key), device_id, user_id, actor (driver or PIN person), type (`driver.ack`, `driver.startRoute`, `driver.arrival`, `driver.outcome`, `driver.problem`, `driver.finishRun`, `loader.ack`, `loader.check`, `loader.confirmLoaded`, `loader.exception`), order_ids text[], outlet_id, vehicle_id, trip_no, payload jsonb, device_time, plan_version_on_device, received_at, result (`accepted`, `duplicate`, `conflict`, `error`), result_reason, conflict_id |
| `attachments` | id uuid, device_record_id, kind (`photo`, `signature`), path, mime, bytes |
| `exceptions` | id, kind (`loader_flag`, `driver_problem`, `store_issue`), type, vehicle_id, trip_id, order_ids, units_short jsonb, detail, raised_by, raised_at, device_time, status (`open`, `decided`), decision jsonb, decided_by, decided_at |
| `conflicts` | id, order_ids, device_record_ids, server_snapshot jsonb, device_snapshot jsonb, recommendation (`keep_delivery`, `keep_partial`, `keep_deferral`), reasons text[], status (`open`, `awaiting_store`, `resolved`), resolution, resolved_by, resolved_at |
| `receipts` | order_id PK, units_received, shortfall_reason, confirmed_at, confirmed_by |

### Communication and audit

| Table | Key columns |
|---|---|
| `notices` | id, audience (`store:OUT084`, `driver:VEH039`, `dock:kandy`, `dispatch`), tag (Order, Plan, Delivery, Deferral, Review, Change), title, body, link (screen state), entity refs, created_at, read_at. Feeds S4, R8, L1.5 and the D4 sent / seen column |
| `audit_events` | id bigserial, at (scenario time), actor, entity_type, entity_id, type (ORDER_PLACED, ORDER_EDITED, ORDER_CANCELLED, CUTOFF_CLOSED, PLAN_DRAFTED, MOVE_ACCEPTED, MOVE_REFUSED, PLAN_RELEASED, PLAN_ACKNOWLEDGED, LOAD_CHECKED, LOAD_CONFIRMED, FLAG_RAISED, VEHICLE_SWAPPED, ORDER_DEFERRED, RUN_STARTED, ARRIVED, OUTCOME_RECORDED, SYNCED, CONFLICT_OPENED, CONFLICT_RESOLVED, RECEIPT_CONFIRMED, ISSUE_REPORTED, NOTICE_SEEN, CLOCK_ADVANCED), payload jsonb. Append-only |
| `clock` | single row: scenario_now, checkpoint, updated_at |
| `scenario_events` | id, at, kind, payload, applied_at (section 13) |

### Order state machine (server)

```
ordered ──cutoff──▶ confirmed ──draft──▶ planned ──gate──▶ loaded ──start──▶ departed ──outcome──▶ delivered
   │                   │                    │  ▲                                  │          │
 cancel (≤16:00)       └──▶ deferred ◀──────┘  └── serve instead / swap           │          ├──▶ partial (store shortfall, D7.4 B)
                            (capacity|policy|store_request)                        │          └──(receipt tag)
                                                                                   ├──▶ issue (refused, store closed, damaged, R6, store issue)
                                                                                   └──▶ conflict ──resolve──▶ delivered | partial | deferred
```

- A deferred order gets a **next-run copy** (new order row, `deferred_from_order_id` set, Confirmed for the next operating day) created when the deferral is decided; withdrawing the deferral deletes the copy ("Wed re-run removed").
- `pending_sync` exists only on devices. `conflict` is set only by the sync service.
- Transitions live in one function `transition(order, event)`; an illegal transition is a 409 with a message.

## 11. Shared rules module `waypoint_rules` [BUILD]

Pure Python 3.12, standard library plus `dataclasses`; no framework imports. Used by the API, the seed checks and the Datathon notebook.

| Function | Returns | Used by |
|---|---|---|
| `service_day_for(placed_at, calendar)` | Next operating day, After cutoff flag, editable_until | S1, R-CUTOFF, R-OPDAY, R-EDIT |
| `trip_minutes(trip)` | Minutes by the booklet formula | D2, D3, planner, Task 2B |
| `planned_clock(trip, depart_at)` | Per stop: arrival, wait, handling start and end; last end; return-leg time | D3, R1, S2, L2 load numbers |
| `planned_fuel(trip, vehicle)` | km, litres | D3, R-FUEL, R9 |
| `check_trip(trip, vehicle, day_state)` | List of `Violation(rule_id, message, figures)`, empty if legal | planner, validate |
| `validate_move(plan, move)` | `ok`, **every** violation, consequence preview (before / after for the source and target trips, deferral changes) | D3.2 to D3.6 |
| `why_this_vehicle(plan, order)` | Checklist of rules passed with figures | D3.7 |
| `legal_vehicles(order, fleet_day)` | Vehicles that could carry the whole order alone | capacity vs policy typing |
| `classify_deferral(order, fleet_day)` | `capacity` if no legal vehicle, else `policy` | planner, D8 |
| `impact_on_store(order, history)` / `frees(order, binding)` | Impact block and Frees block | D4, D8 |
| `binding_resource(depot_day)` | Resource, demand, supply, % and over-by | D2 |
| `recommend_swap(trip, replacement, protected)` | Deferral set that closes the gap, with reasons | D8 |
| `lateness_risk(run, clock)` | On time · At risk · Unknown · offline | D6 |
| `store_arrival(trip, order)` | "from 05:30 (truck may arrive 05:26 and wait)" | S2, S4 |
| `reconcile(order_state, device_record)` | `accepted` or conflict with recommendation and reasons | sync |

**Refusal messages** are written once here, in the screen voice, e.g. R-WINDOW: "Arrives 08:06, after OUT014 closes at 08:00". R-TEMP: "Needs a reefer: VEH011 is ambient". R-BRAND: "Two brands on one trip: Fresh and Style". R-CONT: "OUT012 was deferred yesterday; the continuity guard protects it". A refused move lists all of them (D3.4 shows two).

## 12. Planner: Guided Adaptive Allocation [BUILD]

Runs at 16:05 on the scenario clock (H3) and on "Redraft" in D2. Deterministic: same input, same plan (stable sorts by order ID).

1. **Pool.** Confirmed orders for the service date per depot; vehicles with `availability = available` for the whole morning (VEH036 is `in_workshop` until 02:45, so the 16:05 draft does not use it).
2. **Hard constraints first.** For each order, `legal_vehicles`. None → **Deferred · capacity** with the reason line (ORD1020).
3. **Group** by (depot, brand, district). Fresh groups use Fresh budgets and the 03:30 start; Style and Tech use the 480-minute budget and mall windows.
4. **Operational priority** inside a group: continuity-protected orders first (deferred yesterday), then earliest window close, then more days since served, then order ID. Refrigeration and van_only only restrict which vehicles fit; they never raise priority.
5. **Build trips** greedily: for each group, open a trip on the best-fit legal vehicle (smallest capacity that fits, reefers reserved for chilled groups while chilled orders remain), add orders in priority order while `check_trip` stays clean (kg, m³, windows by the planned clock, budget, fuel). A vehicle's second trip is placed after its first trip's return.
6. **Shortfall.** Orders left over in a group become **Deferred · policy**. When the group overflows by an amount, the planner picks which orders to leave out by lowest impact on the store per unit of the binding resource freed, ties to the least surplus freed; the continuity guard forbids choosing a protected order.
7. **Explain.** Each deferral stores type, binding tag, reason, Impact, Frees and Next run. D2's headline counts capacity vs policy.
8. **Dispatcher edits** (D3) go through `validate_move`; accepted moves write a new draft version on save (v2 = Kumari's adjustments).

**Seed calibration.** The generated orders (section 14) are tuned until this planner reproduces the section 4c targets for the pinned orders: ORD1020 capacity; ORD1009, ORD1017 and ORD1006 policy by window; the six v3 trips; 19 deferrals at Peliyagoda (1 + 18). If the generated remainder cannot hit 19 exactly, the computed count is shown and recorded as DP-01.

**D8 recommendation** (`recommend_swap`). For VEH003 trip 1 on VEH036: need ≥ 120 kg and ≥ 0.7 m³. Candidates (excluding protected OUT012): OUT011 240 / 1.6, OUT006 230 / 1.5, OUT005 260 / 1.7, OUT009 210 / 1.4. All close the gap alone with equal impact; least surplus is OUT009 (90 kg, 0.7 m³) → defer ORD1002 by policy. "Adjust manually" (D8.3) lets Kumari pick another set, validated the same way.

**D9 baseline** (A15): reefer demand minutes per ISO week for the next 4 weeks = mean of the same weekday mix over the last 8 weeks of deliveries_train.csv, scaled by festival_ramp; usable capacity = available reefers × 270 × operating days. Labelled "Baseline forecast: Datathon Task 2A model not wired in".

## 13. Scenario clock, jobs and the demo controls [BUILD]

- **Clock.** One row in `clock`. `GET /api/v1/clock` returns scenario time; every app bar shows it. The seed sets it to **Mon 28 Sep 2026 15:30** (A38).
- **Frontend clock.** Every screen reads "now" from one client clock (`useNow()`, Asia/Colombo, never the browser time zone). In **mock mode** and the state galleries it is set by `?at=HH:MM` and `?date=YYYY-MM-DD` (default 2026-09-29) and otherwise runs in real time from the role's first frame, as the store and field prompts built it. In **API mode** the client clock follows `GET /clock` (polled, and after every write), and `?at=` is ignored.
- **How it moves.** (a) A user action stamped "now" does not move the clock. (b) The **presenter control** (the G3 idea, shown as a small floating panel when `?presenter=1` or from the avatar menu) offers "Go to next step" with the next walkthrough time (for example "Go to 16:00: cutoff") and "Reset demo". (c) `POST /api/v1/demo/advance {to}` is what the control calls; it refuses to go backwards.
- **Jobs.** Crossing a time runs its job once: 16:00 cutoff (Ordered → Confirmed, S2.1 and S4 notices), 16:05 draft (plan v1), 21:15 Kumari's evening adjustments saved as draft v2 (a scripted set of accepted moves, so the numbering matches the design even if the judge makes no edits), 02:45 VEH036 available, plus every due row in `scenario_events`.
- **Version numbering.** Every saved draft and every release takes the next number. Releasing the current draft creates the released snapshot (v3 at 23:40). A D8 decision or a D6 deferral after release creates and releases the next version at once (v4 at 03:00, v5 at 05:21).
- **Scenario events** (A39) move background vehicles so D6 looks like a real morning: other vehicles' load confirmations, departures, arrivals and deliveries, R. Silva's 03:10 acknowledgement and 03:30 departure. They are data in `seed/scenario_events.yaml`, applied through the same services as real actions, and the README says they are simulated.
- **Reset.** `POST /api/v1/demo/reset` (presenter only) truncates operational tables and reruns the seed; takes under 5 seconds.
- **Simulate offline** (the R4 "Prototype" switch). Sets the field foundation's `simulatedOffline`: the transport throws `NetworkError` as if the network were down, records stay in the outbox, the chip turns Offline. Real offline (airplane mode, DevTools "Offline") behaves the same. It is stored in the field `settings` table of that browser, so run the driver in a different browser profile or on a phone if the loader tab must stay online at the same time; the dispatcher and store apps do not read it.
- **Coverage profile** (driver dev setting "Kandy corridor coverage gap", on for the walkthrough): between 05:17 and 06:40 on the scenario clock the driver app treats itself as offline. Real connectivity and Simulate offline still apply on top. This is what makes H9 and H15 happen at the designed times without anyone touching a switch.

## 14. Seed and demo data [BUILD]

Order of the seed (idempotent; runs on `api` start when the database is empty, `SEED_ON_START=true`):

1. **Reference tables** from `data/*.csv`: outlets, vehicles, calendar, district_travel, service_allowance, traffic_speed.
2. **Checks** (`seed/checks.py`, fail loudly): every 4c vehicle, district and allowance value equals the CSV; Tue 29 Sep and Mon 28 Sep are operating days; Sun 27 Sep is not; the R10 dates exist with the stated flags; fleet counts per depot match 4c.
3. **Accounts** (A36, A40): four users, two PIN people (Priya 1234, Ruwan 5678), driver names.
4. **History** (A34, A35, A4): outlet service history for Mon 21 to Mon 28 Sep (Sun 27 no run); VEH039 runs Thu 24 to Mon 28; OUT084 delivery days exactly as A35; deferred_yesterday = true for OUT012 and OUT029; fuel ledger (A7).
5. **Vehicle day status** for Tue 29 Sep: 4 Peliyagoda vehicles in workshop including VEH036 until 02:45 (A12).
6. **Orders for Tue 29 Sep:** pinned rows from 4c and A18 to A20, all Confirmed except the hero pair (not yet placed; Anusha places them in the walkthrough) and orders still arriving before 16:00. **Generated rows** (A41) fill Peliyagoda to 212 and Kandy to 64 (counting the hero pair): outlets drawn from the depot's operating outlets for that weekday, sizes sampled from each outlet's history in deliveries_train.csv with a fixed seed, IDs `ORD3001` upward, received times spread 09:00 to 15:55.
7. **Scenario events** loaded; clock set to Mon 15:30.

**Where ORD2001 and ORD2002 come from.** They are not pre-seeded. The judge places them as Anusha at scenario 15:40 (walkthrough step 1). The seed reserves those IDs for OUT084's next two orders so the IDs match the design.

**Accounts table in the README** (values from `.env.example`): dispatcher@, loader@, driver@, store@waypoint.demo; loader PINs for Priya and Ruwan.

## 15. Frontend: routes, states and offline [BUILD]

One SPA. `/` sends a signed-in user to their role home; `/sign-in` is G1 (desktop and phone), `/start` shows the four role cards (G2) for judges. Each role root is a `RoleRoot` that sets that role's `data-theme`. Route names follow the store and field build prompts.

| Role · theme | Route | Screen · frames |
|---|---|---|
| Dispatcher · Light | `/dispatcher/queue?depot=` | D1 (D1.1 to D1.5, D1.S) |
| | `/dispatcher/capacity` | D2 |
| | `/dispatcher/trips` | D3 (Move to… dialog, refusal popover, Why this vehicle) |
| | `/dispatcher/deferrals` (`/:orderId` drawer) | D4 |
| | `/dispatcher/release` | D5 |
| | `/dispatcher/live` | D6 (Defer stop dialog) |
| | `/dispatcher/conflicts/:id` | D7 |
| | `/dispatcher/exceptions/:id` | D8 |
| | `/dispatcher/forecast` | D9 |
| Loader · Dark | `/loader/dock` | L1 (PIN sheet; tablet master and detail at ≥ 1024 px = L1.7) |
| | `/loader/vehicles/:vehicleId/trips/:trip` | L2 (flag sheet L3 as overlay) |
| | `/loader/changes` | L4 |
| Driver · Dark / Field / Light | `/driver/run` | R1 (outbox sheet R4 from the chip; R5 shown over the run after a sync; R10 states by calendar) |
| | `/driver/stops/:stopId` | R2 |
| | `/driver/stops/:stopId/outcome` | R3 |
| | `/driver/issues` | R6 sheet and R6.4 Issues tab |
| | `/driver/history` (and run and stop detail below it) | R7 |
| | `/driver/notifications` | R8 |
| | `/driver/finish` | R9 |
| | `/driver/me` | R1.9 |
| Store · Light | `/store/orders` | S1 |
| | `/store/deliveries`, `/store/deliveries/:date` | S2 |
| | `/store/deliveries/:date/receipt` | S3 |
| | `/store/issues` | S3.7 |
| | `/store/updates`, `/store/history` | **S4** |
| Dev only | `/<role>/_states` (`?frame=<id>` full-screen), `/field/_components` | State galleries and the field component gallery |

**Rules for screens**

- A frame is a **state**: the same route renders D6.1 or D6.5 depending on data. Each role keeps a dev-only gallery at `/<role>/_states` that renders every frame state from the mock API at its Figma size, labelled with the frame name. Judges never see it.
- Every screen has its loading, empty (where the design has one), offline and error state from the design. Empty and error screens say what is safe ("Your orders and deliveries are safe. Nothing was changed.").
- Phone first for load and run (390 px; nothing breaks at 320 px). Dispatch is desktop (1440 px; usable at 1280). Store works at 390 and 1280.
- Each screen may carry the G4 "Why this screen" panel (from the avatar menu), showing its rationale card text. Optional, creativity points.

**Offline (field roles)** (built by `claude/field-build/01` and `04`; the backend must match)

| Concern | Implementation |
|---|---|
| Storage | Dexie database `waypoint-field`: `outbox`, `cache` (dock plan, load plans, route, history), `blobs` (photos, signatures, compressed to JPEG, longest edge 1600 px), `settings` (theme, text size, language, simulated offline, dock). `navigator.storage.persist()` on first run |
| App shell | `vite-plugin-pwa` precaches JS, CSS, HTML, fonts and icons; GET data is network-first with cache fallback; the app opens with no network after one visit |
| Route package | Acknowledging the plan (R1.3 A → R1.2 A/B) downloads the run into `cache`; R1 reads the cache first |
| Outbox record | `clientId` (UUID, idempotency key), `type`, `payload`, `deviceTime`, `planVersionOnDevice`, `actor`, `status` (`waiting`, `sending`, `accepted`, `conflict`, `error`), `attempts`, `blobIds`. Accepted records are kept so screens can show history |
| Record types | Driver: `driver.ack`, `driver.startRoute`, `driver.arrival`, `driver.outcome` (one per order), `driver.problem`, `driver.finishRun`. Loader: `loader.ack`, `loader.check`, `loader.confirmLoaded`, `loader.exception` |
| Sync engine | Runs on the `online` event, every 30 s while records wait, and on Send now / Retry now; sends in order through per-type handlers; each record returns `accepted`, `duplicate` (counts as accepted), `conflict` (not retried) or `error` (retried). No Background Sync API (iOS lacks it). Blobs upload after their records, one at a time; a failed upload leaves the record Synced and raises R8.2 / R8.3 (WP-SYNC-409) |
| Conflict display | Grouped by stop: "1 conflict (2 orders)". The phone learns about a newer plan only through sync (handoff 7) and polls notices every 30 s while a conflict is open |
| Connectivity | `online`, `offline`, `syncing`, `failed` from `navigator.onLine`, Simulate offline, the coverage profile and the last request's result; "Last sync HH:MM" is the last successful sync |
| Loader | Checks, flags and the gate confirmation queue in the outbox (L2.S 3, L3.4 A); an acknowledgement of a version older than the server's current one returns `conflict`, and the dock shows L1.5 "Plan changed, review change" |
| Store | S1 orders queue (S1.5 A) and count only when the server returns Received; a queued order that lands after 16:00 comes back After cutoff and the screen says so. S4 keeps the last feed for S4.S C |
| GPS (R9) | `watchPosition` (high accuracy) from Start route to Finish run, fixes stored in IndexedDB; drop fixes worse than 50 m or implying over 120 km/h; legs split by the run's own arrivals; any stretch over 2 minutes with no fix is filled with the planned leg distance in proportion to the missing time; permission refused → planned distances. Positions never leave the phone. In the scenario the hero fixture legs (A24) are used, and the README says so |

## 16. Judge walkthrough (README draft) [BUILD]

Open four tabs (or phone + laptop): `/start` lets you sign in as each role. Turn on the presenter control from the dispatcher avatar menu. The clock in every app bar is the scenario clock; each "Go to" step moves it forward.

| # | Clock | Role | Do this | You should see |
|---|---|---|---|---|
| 1 | Mon 15:30 → 15:40 | Store (phone width) | Orders tab: set Chilled 12, Dry 8, review, Place orders | "Received 15:40 · counts for Tue 29 Sep", "You can edit until 16:00" (S1.3); bell shows an update |
| 2 | 15:40 | Dispatcher | Queue, Kandy: ORD2001 and ORD2002 under OUT084, Ordered; Capacity locked "Opens at cutoff, 16:00" | D1.1, D1.3 |
| 3 | Go to 16:05 | System | Cutoff closes; plan v1 drafted | D1.2 Confirmed; S2.1 "Confirmed for Tue 29 Sep" |
| 4 | 16:05 | Dispatcher | Capacity (Peliyagoda): binding reefer minutes, forced-vs-chosen headline. Trips: drag ORD1009 to VEH003 trip 2, then ORD1002 to VEH011, then ORD1001 to the pool | Refusals naming every rule (window 08:06; reefer + two brands; continuity guard) |
| 5 | 16:05 | Dispatcher | Deferrals: open ORD1020 (capacity) and a policy row | Type, binding tag, Impact on store, Frees, Next run |
| 6 | Go to 23:40 | Dispatcher | Release plan v3 | D5.3 A: 0 of 4 acknowledged; S2.2 arrival "from 05:30 (truck may arrive 05:26 and wait)" |
| 7 | Go to 00:10, then 02:55 | Loader (Peliyagoda, Priya PIN) | At 00:10 acknowledge v3 with PIN. At 02:55 open VEH003 trip 1, Flag issue → Vehicle check failed | L1.3 acknowledged; then VEH003 Held and D6.7 needs a decision |
| 8 | 03:00 | Dispatcher | Open the exception, accept "Defer ORD1002, load VEH036" | Plan v4; D4 20 deferrals; OUT009's store sees S2.9 |
| 9 | 03:04 | Loader (Priya) | Review changes, acknowledge v4 with PIN, load VEH036, confirm gate | L4.1 diff with "Don't load ORD1002"; L2.6 B loaded |
| 10 | Go to 04:15 | Loader (Kandy, Ruwan PIN) | Acknowledge v4 ("No change to your vehicle"), load VEH039 in reverse order, confirm gate at 04:50 | L1.6 B, L2.4; R1.3 B "Confirmed by Ruwan · 04:50" |
| 11 | 04:55 → 05:10 | Driver (phone width) | Acknowledge v4, download route, Start route | R1.5 departed; S2.4 on the way |
| 12 | Go to 05:17 | Driver | Nothing: the coverage profile drops the phone offline at 05:17. (Or turn on Simulate offline in the outbox sheet, or airplane mode on a real phone) | R1.6 "Offline · last sync 05:17"; D6.2 Unknown · offline |
| 13 | 05:21 | Dispatcher | Live board: Defer stop OUT084, reason store request | Dialog warns the driver is offline; v5; S2.6 deferred at your request; driver still on v4 |
| 14 | 05:26 → 05:58 | Driver (still offline) | Arrive at OUT084, wait for 05:30, record Delivered with photo and receiver S. Fernando; do OUT087 | Outbox counts 1, 3, 5 waiting |
| 15 | Go to 06:40 | Driver | Coverage returns (turn Simulate offline off if you used it); open the Run screen | R4.2 syncing, then R5.1 "3 synced · 1 conflict (2 orders) sent to Dispatch"; R1.7 under review; S2.7 Under review |
| 16 | 06:44 | Dispatcher | Inbox → Reconciliation → Confirm, keep delivery | D7.4 A; R1.8 notice; S2.8 Delivered + Deferral withdrawn; Wed re-run removed |
| 17 | Go to 07:30 | Store | Bell → Updates feed; open the delivery, check POD, Confirm receipt | S4.1 rows 15:40 to 06:44; S3.2; D6.6 receipt confirmed |
| 18 | 07:31 | Driver | Finish run | R9: 19.4 km GPS, 3.9 L; R7 history row |
| 19 | any | Anyone | Presenter → Reset demo | Back to Mon 15:30 |

Branches to show in the video if time allows: D7 "Review with store first" (S3.5), shortfall 10 / 12 (D7.4 B), store edit and cancel before 16:00 (S1.3 B to D), order after cutoff (S1.4), R6 road problem.

## 17. Tests and quality gates [BUILD]

| Layer | What | Pass condition |
|---|---|---|
| Rules unit tests | Every rule ID with a passing and a failing case; trip minutes 132 (VEH003 t1), 109, 125, 101, 83, 73; D3.3 arrival 08:06; D3.4 two violations; D3.5 continuity; VEH036 950 / 1,040 and 109 min | pytest green |
| Planner golden tests | On the seeded day: ORD1020 capacity; ORD1009, ORD1017, ORD1006 policy with window binding; the six v3 trips exactly; ORD2001 + ORD2002 on VEH039 trip 1; no plan breaks any rule (`check_trip` on every trip) | pytest green; Peliyagoda deferral count reported (target 19) |
| D8 test | `recommend_swap` picks ORD1002 with surplus 90 kg / 0.7 m³ and skips OUT012 | pytest |
| Sync and reconciliation | Replay H11 to H16: v5 deferral, offline arrival and outcomes with device times 05:26 to 05:58, sync at 06:40 → 3 accepted + 1 conflict (2 orders), recommendation keep_delivery, resolve → delivered + Deferral withdrawn + re-run removed; replaying the same batch changes nothing | pytest |
| Contract | Frontend mocks type-check against the generated `schema.ts` | `tsc --noEmit` |
| Frontend | `tsc --noEmit`, oxlint (React, hooks, jsx-a11y rules on), `vite build` on every commit | CI green |
| End to end | Playwright plays section 16 steps 1 to 17 against `docker compose up` on a clean checkout, at 390 px for store, loader and driver and 1440 px for dispatch | CI green on `main` |
| Accessibility | Token pairs meet 4.5:1 (script over `tokens.css`); axe on each role home; keyboard-only path for D3 Move to… | No violations |

## 18. Departures register (goes into the README) [BUILD]

Start with these. Add a row the day a visible difference from the Day 5 frames is introduced.

| # | Day 5 design | Build | Why |
|---|---|---|---|
| DP-01 | Fixed aggregates (212 / 64 orders, 19 deferrals, 2,590 vs 2,160 minutes, delivered counts) | Computed from the seeded day; may differ slightly | A working planner must show what it computes (Q14) |
| DP-02 | Sign-in reads "Waypoint Dispatch" for every role; Load and Store names not printed | Neutral "Waypoint" sign-in; each role shows its app name | Spec V10 (G-2) |
| DP-03 | L1.1 acknowledges without a PIN; some loader buttons lead to the wrong frame | PIN on every acknowledgement and gate; buttons go where their label says | Spec L1 to L4 (G-1) |
| DP-04 | Deferrals badge and trip counts disagree across frames | One computed badge and one computed trip count | G-4 |
| DP-05 | S2.10 shows Thu 24 deferred and Fri 25 delivered | Fri 25 deferred, Thu 24 delivered | A35 (G-10) |
| DP-06 | Updates bell on some store frames only | Bell on every store screen, phone and desktop | G-12 |
| DP-07 | Prototype auto-advance timers and Present-mode keys | Real data changes and the scenario clock; `/_states` galleries replace keys | A working system |
| DP-08 | Presenter mode G3 is a prototype aid | A presenter control that moves the scenario clock and resets the demo | Needed so judges can replay the hero day on any date |
| DP-09 | "Other…" in the PIN sheet's "Who's acknowledging?" has no design | Tapping it shows a name field above the keypad | Loader prompt 02 |
| DP-10 | VEH036 stop marker for OUT012 may read 5 on L2.2 / L2.6 B | Stop 4 | G-8 |
| DP-11 | Driver outcome "Other" has no frame | Uses the Refused pattern (outcome plus reason) | Driver prompt 03 |
| DP-12 | Partial resolution (D7.4 B) has no driver frame | R1.8 and R5.3 layouts with "Dispatch kept your delivery at OUT084 as Partial · 07:05" | Driver prompt 04 |
| DP-13 | R7.1 "Sun 27 Sep" opens R10.2 dated Sun 28 Jun | A no-run detail dated Sun 27 Sep in the R10.2 layout | G-6, driver prompt 05 |
| DP-14 | GPS permission prompt and the permission-refused case have no frame | A short plain explanation at Start route; refused → R9.2 layout with planned distances | Driver prompt 05 |
| DP-15 | Driver shows Dark in every frame | Light · office when the phone prefers light, as the R1.9 copy says | V31 |
| DP-16 | S1.3 B (15:42) and S1.3 D (15:45) both read "20 min left" on the cutoff alert | The countdown is computed from the scenario clock: 18 min at 15:42 and 15 min at 15:45 | Q14: every number is computed; a live countdown cannot match two static frames |

## 19. Build order, deliverables and open decisions

### Build order (from the 30 Sep plan) [BUILD]

| Stage | What lands | Depends on |
|---|---|---|
| 1 | Dispatcher and Store screens continue against typed mock APIs | none |
| 2 | Loader and Driver screens start on the same mock pattern | none |
| 3 | Backend foundation: schema + Alembic, seed + checks, auth, clock, OpenAPI contract published early, Compose skeleton | none |
| 4 | `waypoint_rules` + planner + validate + golden tests | 3 |
| 5 | Wire roles to the real API, Store first, then Dispatcher, Loader, Driver | 3, 4 |
| 6 | Offline outbox, `/sync`, reconciliation, D7 and D8 end to end | 5 |
| 7 | Full walkthrough on a clean `docker compose up`; Playwright green | 6 |
| 8 | README, docs, video, deploy, tag a release before Sun 4 Oct 23:59 | 7 |

### API surface (v1) [BUILD]

All under `/api/v1`, JSON, bearer auth, role-checked. Full schema at `/api/docs` (FastAPI) and in `docs/api.md`. Endpoints are grouped by the **typed frontend interface** they back, so each role's mock can be swapped for the real client one operation at a time. Operation names for Store, Loader and Driver are the ones already fixed in the build prompts.

| Interface · operation | Endpoint |
|---|---|
| **Shared** | `POST /auth/login` · `GET /me` · `GET /clock` · `POST /demo/advance` · `POST /demo/reset` |
| **StoreApi** `getOrderDraft` · `placeOrders` · `editOrder` · `cancelOrder` | `GET /store/order-form?date=` · `POST /store/orders` · `PATCH /store/orders/{id}` · `POST /store/orders/{id}/cancel` |
| `listDeliveries` · `listRecent` · `listIssues` | `GET /store/deliveries?from=&to=` (and `/{date}`) · `GET /store/history` · `GET /store/issues` |
| `acknowledgeDeferral` · `answerReceivedQuestion` | `POST /store/deferrals/{id}/seen` · `POST /store/reviews/{conflictId}/answer` |
| `confirmReceipt` · `reportIssue` | `POST /store/receipts` · `POST /store/issues` |
| S4 feed (new) | `GET /store/updates` · `POST /store/updates/read-all` |
| **DispatcherApi** (to be fixed by the dispatcher owner; proposed) | `GET /dispatcher/queue?depot=&date=` · `GET /dispatcher/orders/{id}/history` · `GET /dispatcher/capacity?depot=` · `GET /dispatcher/plan?version=` · `POST /dispatcher/plan/redraft` · `POST /dispatcher/plan/validate-move` · `POST /dispatcher/plan/moves` · `GET /dispatcher/deferrals?depot=` · `POST /dispatcher/deferrals/notify` · `POST /dispatcher/plan/release` · `GET /dispatcher/acknowledgements?version=` · `GET /dispatcher/live?depot=` · `POST /dispatcher/stops/defer` · `GET /dispatcher/inbox` · `GET /dispatcher/conflicts/{id}` · `POST /dispatcher/conflicts/{id}/ask-store` · `POST /dispatcher/conflicts/{id}/resolve` · `GET /dispatcher/exceptions/{id}` · `POST /dispatcher/exceptions/{id}/decide` · `GET /dispatcher/forecast` |
| **LoaderApi** `getDock(dockId)` | `GET /loader/docks/{dock}` |
| `verifyPin(personId, pin)` | `POST /loader/pins/verify` (the tablet also caches hashes for offline) |
| `getLoadPlan(vehicleId, trip)` | `GET /loader/vehicles/{vehicleId}/trips/{trip}` |
| `getException(id)` · `getPlanDiff({dockId, from, to})` | `GET /loader/exceptions/{id}` · `GET /loader/docks/{dock}/diff?from=&to=` |
| `acknowledgePlan` · `recordCheck` · `confirmLoaded` · `flagException` | Outbox records `loader.ack` · `loader.check` · `loader.confirmLoaded` · `loader.exception` via `POST /sync` |
| **DriverApi** `getRun(date)` · `downloadRun(date)` | `GET /driver/runs/{date}` (the route package, with current plan version and per-order server state after sync) |
| `getNotices(since)` | `GET /driver/notices?since=` |
| History (R7) | `GET /driver/history` |
| `acknowledgePlan` · `startRoute` · `recordArrival` · `recordOutcome` · problem · finish | Outbox records `driver.ack` · `driver.startRoute` · `driver.arrival` · `driver.outcome` · `driver.problem` · `driver.finishRun` via `POST /sync` |
| Photos and signatures | `POST /attachments` (multipart, `clientId` of the blob; idempotent) |
| **Sync** | `POST /sync` body `{deviceId, records:[{clientId, type, payload, deviceTime, planVersionOnDevice, actor, blobIds}]}` (one or many) → `{results:[{clientId, result: accepted | duplicate | conflict | error, reason, conflictId, serverPayload}]}`. Idempotent by `clientId`: a replay returns `duplicate` |

**Reconciliation rule** (in `waypoint_rules.reconcile`, used by `/sync`; the driver mock in prompt 04 implements the same rule):

1. `driver.arrival`, `loader.check` and `driver.problem` are facts: always accepted, never conflict.
2. A `driver.outcome` (Delivered or Damaged) for an order whose server state was changed by a plan version **newer than** `planVersionOnDevice` in a way that contradicts it (the order is Deferred on the server) returns **conflict**: order status `conflict`, both records kept, recommendation computed, one conflict per stop (ORD2001 + ORD2002 = "1 conflict (2 orders)"). Delivered with photo and receiver → `keep_delivery` ("the goods are at the store; reversing needs a return trip; the deferral never reached the driver").
3. Otherwise the outcome applies: Delivered → `delivered`; Damaged, Refused, Store closed, Other → `issue` with the matching tag.
4. A `loader.ack` for a version older than the current one returns **conflict** (the dock then shows L1.5).
5. Resolving (D7) writes the decision, withdraws or keeps the deferral, deletes or keeps the next-run copy, posts notices to driver, store and dock, and writes CONFLICT_RESOLVED.

### Hackathon deliverables checklist

- [ ] Public HTTPS URL (service worker, camera and GPS need HTTPS on phones)
- [ ] Four seeded accounts in the README
- [ ] Monorepo `Nexora_Waypoint`: README (setup, configuration, accounts, numbered walkthrough, departures register), `docker-compose.yml`, `.env.example`
- [ ] `docker compose up` on a clean machine starts db, api (migrate + seed) and web
- [ ] `docs/architecture.md` with diagram, `docs/data-model.md` with ERD, `docs/ai-disclosure.md`
- [ ] 5 to 8 minute unlisted YouTube video: four roles, then code and architecture
- [ ] Submission form: repo link, URL, credentials, video link, before Sun 4 Oct 23:59

### Open decisions (need an owner and an answer)

| # | Question | Default if nobody decides by Thu 1 Oct |
|---|---|---|
| O-1 | **Datasets in the repo.** The booklet forbids distributing the CSVs, yet `docker compose up` must seed from them on a fresh install | Keep the GitHub repo **private** and give the judges access; email tech-triathlon@rootcode.io to confirm this is acceptable before submission |
| O-2 | Hosting for the public HTTPS URL | One small VM running the same Compose file behind Caddy for automatic TLS |
| O-3 | Photo storage | Files on a Docker volume, paths in `attachments` |
| O-4 | Demo passwords | Set in `.env.example`; listed in the README. PINs are fixed by A36 |
| O-5 | Presenter control visible by default for judges | On for the dispatcher avatar menu; hidden elsewhere |
| O-6 | DispatcherApi operation names | The proposal in the API table unless the dispatcher owner has already fixed them |
| O-7 | Spec owner name (header) | HH |
