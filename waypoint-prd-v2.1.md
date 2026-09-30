# Waypoint: Product Requirements Spec (v2.1)

Version 2.1 · Tue 29 Sep 2026, 19:00 · Team Nexora · owner: HH (spec owner: ________)

This is the single source of truth for the Waypoint Designathon prototype and, after the freeze, the build specification for the Hackathon. One order record moves through four roles, the system drafts tomorrow's plan, and every deferral is typed and explained.

**v2.1 supersedes v2** (28 Sep). It keeps every v2 decision unless the change log says otherwise, and brings the spec in line with the "Nexora (main)" Figma page as it stands after the 29 Sep audit fixes. **The Figma prototype is the file being judged; where this spec and the prototype differ, section 7 lists the gap.** v2 superseded v1 (the 27 Sep "Waypoint: Product Requirements Spec" Claude Doc and its Word export `Untitled.docx` in this project).

Design freeze: Tue 29 Sep 2026, 15:00 (passed; only fixes since). Submission target 20:00, hard deadline 23:59 Sri Lanka time.

**How to use this spec:** find your screens in section 3, copy every ID, time and number from section 4c, and check every handoff in section 5. If a number you need is missing, ask the spec owner. If you must invent one, add it to the 4d register the same day.

---

## Change log

### v2 to v2.1 (29 Sep)

| # | Change | Why | Sections |
|---|---|---|---|
| V15 | **Odometer fallback removed.** Run distance comes from the phone's GPS, recorded offline. If GPS drops out for a stretch, the planned distance fills that gap. The driver never types an odometer reading. Frames R9.2 C and R9.2 D do not exist. Supersedes the odometer clause of V1 and Q7 | Driver-page design decision, confirmed 29 Sep | 1, 3 (R1, R7, R9), 4a, 4c, 4d (A24), C15 |
| V16 | **Driver outcomes are five:** Delivered, Damaged, Refused, Store closed, Other. Partial is not a driver outcome. Units delivered is a per-order stepper on R3.1 and R3.4 ("Damaged goods with units"). Partial is set by the store's shortfall (S3) or by the dispatcher's decision on D7 (D7.4 B). Supersedes the six-outcome grid of V12 (Damaged stays) | Team decision 29 Sep | 3 (R3), 4b, 6 |
| V17 | New states: **D5.3 A** (plan v3 released 23:40, acknowledgements pending) and **D5.3 B** (plan v4 released 03:00); **D7.4 A** (resolved, kept as Delivered) and **D7.4 B** (resolved as Partial, 07:05); R7.1 gains a Mon 28 Sep run row. Extra frames are states, so Q8 still holds | Audit fixes F-04, F-15, F-01 | 2, 3 (D5, D7, R7) |
| V18 | **Calendar rule for screens:** the hero day is Tue 29 Sep everywhere except the R10 calendar frames, which stay on June and April dates from calendar.csv. Waypoint operates Monday to Saturday, so no screen shows a delivery on a Sunday; Sundays read "No run" | Booklet; audit F-01, F-02 | 3 (R7, S2), 4d (A26, A34, A35) |
| V19 | D1.1 (before cutoff): the Capacity button and the "2 Capacity" step are locked and do not navigate | Audit F-07 | 3 (D1) |
| V20 | Role-landing cards (G2.1 to G2.4) describe the screen they open, with the same time and version. G2.4 opens S1.1 (Place order), not S2.1. G1.2 (phone, Light) signs in to the Store landing | Audit F-03, F-14 | 3 |
| V21 | Hero chain on the driver phone runs R1.7 (under review) to R5.3 (resolved), with no photo-failure alert. The sync-failure alert R8.2 and R8.3 (WP-SYNC-409) is a separate branch, entered from a flow start or the notification list | Audit F-17 | 2, 3 (R1, R8) |
| V22 | Prototype conventions are part of the spec: flow starts are named "Role · n · title"; Present-mode keys E, O, L, N open state frames and R steps through the refused moves on D3; store hero frames S2.1 to S2.5 auto-advance after 5 s | Audit F-08, F-22, F-25 | 3b |

### v1 (27 Sep) to v2 (28 Sep)

| # | Change | Why | Sections |
|---|---|---|---|
| V1 | GPS is in scope **for run distance only**: the driver's phone measures distance by GPS. No live map, no live tracking for Dispatch. (v2 also had an odometer entry as fallback; **removed by V15**) | Team answer 28 Sep. Distance is needed for fuel against the weekly quota; live tracking is still excluded for the v1 reasons | 1, 3 (R1, R7, R9), 4a |
| V2 | Screen inventory matches Figma as built: the 21 v1 screen IDs stay, **R6 to R10 are added** as driver screens, and new frames on existing screens are recorded as states. Replaces v1's Q5 ("21 screens, no additions") | Team answer 28 Sep | 1, 3 |
| V3 | Per-frame "Mock data" chips are retired. Invented data is disclosed once: register 4d, the AI disclosure page (F17) and the video. The booklet sets no rule on this; it is the team's own rule. The out-of-scope X frames carry no Mock text either | Review fix X1, 28 Sep; audit F-20 | 4b, 4d |
| V4 | Stores never see the word "Conflict". The store-facing label for the Conflict status is **Under review**, with a "Why you're seeing this" card | Store fix S-1 | 4b, S2, S3 |
| V5 | The deferral "harm line" is labelled **Impact on store** on screens. The concept is unchanged | Dispatcher fix D-5 | 1, 4b, D4 |
| V6 | D9 is named **Forecast** (was "Outlook" / "Capacity outlook") | Review fix X7 | 1, 3 |
| V7 | Store can **edit quantities or cancel an order until the 16:00 cutoff** (S1). Changes after cutoff remain out of scope | Team answer 28 Sep | 1, 3 (S1), 5 |
| V8 | Store receipt: reducing a delivered count turns the main button into **Confirm with a shortfall**, which asks for a reason (S3) | Team answer 28 Sep | 3 (S3) |
| V9 | D6 has a **Lateness risk** column (On time · At risk · Unknown · offline) | Dispatcher fix D-2 | 3 (D6), 4b |
| V10 | Each role app has its own name: Waypoint Dispatch, Waypoint Load, Waypoint Store | Review fix X3 | 6 |
| V11 | **Theme follows the working environment, not the role**: Light for dispatcher and store, Dark (pre-dawn) for loader and driver, Field theme for the driver in sunlight | Review fix X4 | 6 |
| V12 | Driver record outcomes include **Damaged** in both the stop-level and per-order grids. (The six-outcome grid with Partial is **superseded by V16**) | Driver fix R-5, team answer 28 Sep | 3 (R3) |
| V13 | New handoff: Driver problem report to Dispatcher (R6) | Follows V2 | 5 |
| V14 | New assumptions A18 to A30 and a data conflict (ORD1021 / ORD1022) recorded | 28 Sep fixes | 4d |

---

## Decisions applied

v1's six team answers (27 Sep) still stand, except Q5 (superseded by Q8) and Q7 (updated).

| # | Topic | Decision |
|---|---|---|
| Q1 | Data, hero, people, date | app.html fixture (real outlets, vehicles, windows, district travel, allowances). Hero = ORD2001 (chilled) + ORD2002 (dry) at OUT084, VEH039, Kandy. People = Kumari (dispatcher), Priya (loader), Nimal (driver), Anusha (store manager). Logins dispatcher@ / loader@ / driver@ / store@waypoint.demo. Operating day Tue 29 Sep 2026, planned Mon 28 Sep [ASSUMPTION A1] |
| Q2 | Hero timeline | Store's call 05:20, deferral 05:21 (plan v5), after coverage drops at 05:17 and before the 05:26 arrival. Delivery 05:42 |
| Q3 | Hero loader | Loader account = dock tablet, one PIN per person. Priya works Peliyagoda. VEH039 is loaded at the Kandy dock by a second PIN user, Ruwan [ASSUMPTION A9] |
| Q4 | Secondary scenario | VEH003 (reefer truck) fails its pre-departure check; VEH036 (smaller reefer van) replaces it; one order is deferred by policy |
| Q5 | Screen count | **Superseded by Q8** |
| Q6 | One brand + one district per trip | Hard rule in the app, same as Datathon Task 2B |
| Q7 | GPS | Distance only. GPS during the run, works offline; if GPS drops out, the planned distance fills the gap; no odometer entry; no live tracking (V1, V15) [TEAM ANSWER 28 Sep, updated 29 Sep] |
| Q8 | Screen set | Spec matches Figma: 21 v1 IDs + R6 to R10; extra frames are states (V2, V17) [TEAM ANSWER 28 Sep] |
| Q9 | Store edit | Edit quantities or cancel until 16:00 (V7) [TEAM ANSWER 28 Sep] |
| Q10 | Mock data | Disclose once, no per-screen chips (V3) [TEAM ANSWER 28 Sep] |
| Q11 | Driver outcomes | Five outcomes; Partial comes from the store shortfall (S3) or the dispatcher's D7 decision (V16) [TEAM ANSWER 29 Sep] |

**Origin tags on every requirement:** [BOOKLET] challenge booklet · [DECIDED] confirmed direction (Part 5 of the Operations Deconstruction, `Untitled.md` in this project) · [APP] app.html prototype (Plan A) · [PLAN B] the Word plan · [TEAM ANSWER] the answers above · [BUILT] exists in the Figma file as of 29 Sep · [ASSUMPTION] invented and listed in 4d.

Rationale paragraphs in Figma use a shorter set: [A] booklet (only what the booklet actually says) · [B] inference · [C] our choice. Invented figures such as the D2 aggregates are [C], not [A].

---

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
| Live operations, exception-first, no map | D6 | Dispatchers need progress and problems after departure [BOOKLET]; exception-first [APP][PLAN B] |
| Offline driver flow and reconciliation | R1 to R5, D7 | "Record work offline and reconcile" [BOOKLET]; hero degradation [DECIDED] |
| Driver run support: problems on the road, history, notifications, finishing the run, calendar days | R6 to R10 | Built on 28 Sep [BUILT][TEAM ANSWER Q8]. R6 lets a driver report a stop that can't be reached while offline; R9 closes the run with a GPS distance for the fuel quota; R10 shows non-standard days from the calendar |
| Pre-departure gate, plan versions, loading exception | L1 to L4, D5, D8 | "Flag a loading shortfall before departure"; stale printed lists [BOOKLET] |
| Store order (with edit until cutoff), arrival, deferral notice, receipt | S1 to S3 | Confirmation, arrival time, deferral notice, receipt and issues [BOOKLET] |
| One forecast screen | D9 | "Plan future capacity" is a workflow stage [BOOKLET][DECIDED] |

### Out of scope

| Excluded | Reason |
|---|---|
| Live map or live vehicle tracking for Dispatch | No GPS in the data, unreliable coverage, personal phones. Dispatch sees progress from stop events plus a last-heard age [DECIDED]. The driver's phone uses GPS only to measure run distance, and the planned distance fills a gap if GPS drops out [TEAM ANSWER Q7] |
| Chatbot or generative assistant | Unverifiable and not asked for; explanations come from the rule trace [DECIDED][PLAN B] |
| Driver rostering | "Driver availability is not a separate constraint" [BOOKLET] |
| Route-optimisation solver | One district per trip; stop order only has to meet windows [DECIDED] |
| Product catalogue or item picking | The booklet has no product data. Orders are units, kg, m³ and temperature [BOOKLET] |
| Dispatcher notification centre, KPI dashboard, reports, analytics, what-if, plan comparison | No decision they support at this scope. Kept as concept frames X1 to X14, drawn to the right of the role sections on the "Nexora (main)" page and titled "Out of scope: build only if the team reopens Q8". The driver's R8 list is not a notification centre: it lists only changes to the driver's own run |
| Order changes **after** the cutoff (change-request workflow) | Late changes are dispatcher actions on D6. Edits **before** 16:00 are in scope (S1) [TEAM ANSWER Q9] |
| Issue-management engine (owners, severities, lifecycles) | Issues are a status plus tags, followed up by the dispatcher |
| Datathon models wired into the app | Not required [BOOKLET]; D9 uses a baseline forecast |
| Driver-entered odometer readings | Removed 29 Sep (V15); GPS distance with a planned-distance gap fill is enough for the fuel estimate |
| Native apps, blockchain, 3D maps, gamification, voice | Responsive web is required and native is optional [BOOKLET]; the rest solve nothing here [PLAN B] |

---

## 2. The hero order's journey

The hero story follows ORD2001 (chilled, 12 units, 70 kg) and ORD2002 (dry, 8 units, 45 kg), both for OUT084 (Waypoint Fresh, Kandy, rear_dock, window 05:30 to 08:00). They travel on VEH039 trip 1 with ORD2003 for OUT087 [APP][TEAM ANSWER]. At 05:21 Dispatch defers the stop at the store's request while the driver, already offline, goes on to deliver it. On reconnect the system recommends Keep delivery and Kumari confirms [DECIDED].

**Every screen that shows the hero must use these exact times, IDs and statuses.**

| # | Time | Role | Action | Screen | Status after (ORD2001 + ORD2002) | What the other roles now see |
|---|---|---|---|---|---|---|
| H1 | Mon 28 Sep 15:40 | Store · Anusha | Places two orders for Tue: ORD2001 chilled 12 units, ORD2002 dry 8 units | S1.3 | Ordered | S1: "Received 15:40 · counts for Tue 29 Sep". D1: both rows under OUT084 |
| H2 | 16:00 | System | Cutoff closes; orders enter tomorrow's queue | D1 | Confirmed | S2.1: "Confirmed for Tue 29 Sep" |
| H3 | 16:05 | System | Drafts plan v1: both orders on VEH039 trip 1, first stop | D3 (Kandy) | Planned | D2 Kandy pool: 64 orders, 0 deferred |
| H4 | 23:40 | Dispatcher · Kumari | Releases plan v3 (Peliyagoda + Kandy) | D5.2, D5.3 A | Planned | D5.3 A (23:41): 0 of 4 acknowledged. L1 (Kandy dock): plan v3 to acknowledge. R1: route ready to download. S2.2: arrival "from 05:30 (truck may arrive 05:26 and wait)" |
| n/a | Tue 29 Sep 03:00 | Dispatcher | Plan v4 released for the Peliyagoda reefer swap (see 2b). VEH039 unchanged | D8, D5.3 B | Planned | D5.3 B: Ruwan and Nimal acknowledgement pending. Kandy devices show v4 with "No change to your vehicle" (L1.6, L4.3) |
| H5 | 04:15 | Loader · Ruwan (Kandy dock, PIN) | Acknowledges v4 on the Kandy dock tablet | L1.6 B | Planned | D5 acknowledgement list: Ruwan · Kandy dock · v4 ✓ 04:15 |
| H6 | 04:20 to 04:50 | Loader · Ruwan | Loads in reverse stop order (ORD2003, then ORD2002, then ORD2001 in the chilled zone) and confirms at the gate | L2.1 to L2.4 | Loaded | D6: VEH039 loaded 04:50. R1.3 B: "Confirmed by Ruwan · 04:50". S2.3: Loaded |
| H7 | 04:55 | Driver · Nimal | Acknowledges v4 (route unchanged since v3); route cached for offline | R1.3 B | Loaded | D5.4 A: Nimal · VEH039 · v4 ✓ 04:55 |
| H8 | 05:10 | Driver · Nimal | Taps Start route; VEH039 departs Kandy | R1.4 to R1.5 | Departed | D6: VEH039 departed 05:10. S2.4: on the way, arrives about 05:26, unloading from 05:30 |
| H9 | 05:17 | System | Nimal's phone loses coverage; last sync 05:17 | R1.6 | Departed | R1.6: "Offline · last sync 05:17 · 0 waiting". D6.2: last heard 05:17, known coverage gap. S2.5: driver out of coverage |
| H10 | 05:20 | Store · Anusha | Phones Dispatch from home: receiving staff unavailable, please defer [ASSUMPTION A10] | n/a | Departed | n/a |
| H11 | 05:21 | Dispatcher · Kumari | Defers ORD2001 + ORD2002 (store request, next run Wed 30 Sep), creating plan v5. The dialog warns the change cannot reach the offline driver | D6.3 | Deferred · store request | S2.6: deferred at your request, next run Wed 30 Sep. D6.4: change pending, driver offline. D5.4 B: v5 released, driver offline 05:22. R1 unchanged, still v4 |
| H12 | 05:26 | Driver · Nimal (offline) | Records arrival at OUT084; window opens 05:30, so tag Waiting | R2.2 | On phone: Pending sync. On server: Deferred | R4: 1 waiting. D6 still last heard 05:17 |
| H13 | 05:42 | Driver · Nimal (offline) | Records Delivered for both orders: POD photo, receiver S. Fernando, 12 + 8 units | R3 | On phone: Pending sync | R4: 3 waiting |
| H14 | 05:48 / 05:58 | Driver · Nimal (offline) | Arrives at OUT087 and records ORD2003 Delivered [ASSUMPTION A11] | R2.3, R3.8, R3.9 | ORD2003: Pending sync | R4: 5 waiting |
| H15 | 06:40 | System | Coverage returns and the outbox syncs. Arrivals and ORD2003 are accepted; ORD2001 + ORD2002 disagree with v5 | R5.1 | Conflict (stores see: Under review) | R5.1: "3 synced · 1 conflict (2 orders) sent to Dispatch". D6.5 inbox: conflict needs a decision. S2.7: Under review, with "Why you're seeing this" |
| H16 | 06:44 | Dispatcher · Kumari | Opens D7. Recommended: Keep delivery (physically done with proof; the deferral never reached the driver). Kumari confirms | D7.1 to D7.4 A | Delivered | R1.7 then R5.3 (resolved) and R1.8: "Dispatch kept your delivery at OUT084 · 06:44". S2.8: Delivered 05:42 + tag Deferral withdrawn. Wed re-run removed; the audit keeps both records |
| H17 | 07:30 | Store · Anusha | Checks the POD and confirms receipt | S3.1 to S3.2 | Delivered + tag Receipt confirmed | D6.6: receipt confirmed 07:30 |

**Arithmetic checks**

- **Arrival.** 05:26 = 05:10 departure + 16 min Kandy outbound [APP data].
- **Deferral timing.** 05:21 falls after coverage is lost (05:17) and before delivery (05:42) [TEAM ANSWER Q2].
- **Plan (system view).** Arrive 05:26, wait to 05:30, leave 06:00; OUT087 06:06 to 06:21; 73 of 270 Fresh minutes.
- **Actual delivery.** 05:42 is faster than the 30-minute allowance (15 + 15). The allowance is a planning figure, not an observed time [BOOKLET]; this gap is what Datathon Task 1 predicts.

**Branch states** [APP][BUILT]

- **D7 "Review with store first"** (D7.2 awaiting store). S3.5 asks Anusha "Did you receive this?". "Yes, we received it" resolves to S2.8; "Report issue" escalates to S3.3 and back to D7.3.
- **Store confirms receipt before the review is resolved** (S3.6). S3 records the receipt; the review stays open for Kumari, and the store is told no action is needed. S3.6 has its own flow start.
- **Store reports a shortage during review** (D7.3, 07:04 to 07:05). The recommendation becomes Keep delivery as Partial (10 / 12). "Confirm: keep as Partial" opens **D7.4 B**: status Partial, follow-up created for 2 units, Wed re-run removed, resolved by Kumari 07:05 [ASSUMPTION A28, A32].
- **Sync failure on the driver phone** (R8.2, R8.3, WP-SYNC-409): not part of the H15 to H16 chain. Entered from the notification list or the R8.2 flow start.

---

## 2b. Secondary scenario: reefer swap at the dock

The reefer planned for two Colombo Fresh trips fails its check, and the only spare is a smaller reefer van, so one order must be deferred [DECIDED][TEAM ANSWER Q4]. The system recommends which one, protects the outlet skipped yesterday, and Kumari confirms.

| # | Time | Role | Action | Screen | Status after | What the other roles now see |
|---|---|---|---|---|---|---|
| X1 | Tue 02:45 | System | VEH036 (reefer van) is released from the workshop [ASSUMPTION A12] | D2.3, D6.7 | n/a | D6.7: "VEH036 available since 02:45" (info only) |
| X2 | 02:55 | Loader · Priya (PIN) | While loading VEH003 trip 1, flags "Vehicle check failed: reefer not holding temperature" [ASSUMPTION A12] | L2.5, L3.1 to L3.3 A | Trip-1 orders stay Planned; VEH003 tagged Held | D6.7: VEH003 held, 34 min to departure, Review. L1.4: VEH003 Held |
| X3 | 03:00 | Dispatcher · Kumari | Opens D8. VEH036 carries 1,040 kg / 7.0 m³; trip 1 holds 1,160 kg / 7.7 m³, so it is **120 kg and 0.7 m³ short**. System recommends deferring ORD1002 (OUT009): frees 210 kg / 1.4 m³, the least surplus of four equal-impact orders. OUT012 protected (deferred yesterday). Kumari confirms: plan v4 | D8.1 to D8.4 | ORD1002: Deferred · policy. Other VEH003 orders: Planned on VEH036 | L3.3 B (03:02): decision made, plan v4. L1.5: plan changed, review. S2.9 (OUT009): moved to Wed, decided by Kumari 03:00. D4: 19 to 20 deferrals |
| X4 | 03:04 to 03:05 | Loader · Priya (PIN) | Reviews the diff (VEH003 to VEH036; ORD1002 removed; stop order otherwise unchanged) and acknowledges | L4.1, L4.2 | n/a | D5: Priya · Peliyagoda dock · v4 ✓ 03:05 |
| X5 | 03:05 to 03:25 | Loader · Priya | Loads VEH036 trip 1 in reverse order (OUT012 first, then OUT005, OUT006, OUT011 last) and confirms at the gate | L2.6 A, L2.6 B | Loaded | D6: VEH036 loaded 03:25 |
| X6 | 03:30 | VEH036's driver, R. Silva (not a persona) | Departs on time [ASSUMPTION A17, A22] | n/a | Departed | D5: R. Silva · VEH036 · departed 03:30 |

**Arithmetic checks**

- **VEH036 trip 1 after the swap:** 4 stops (OUT011 stop 1, OUT006 stop 2, OUT005 stop 3, OUT012 stop 4), 950 / 1,040 kg, 6.3 / 7.0 m³, 109 min. Last stop OUT012 reached 05:04, waits for the 05:30 window. Screens number the stops 1 to 4.
- **Trip 2:** departs 06:09 after the return leg; last arrival OUT004 at 07:42, before its 08:00 close.
- **Vehicle total:** 218 of 270 Fresh minutes.
- **The deferral type is policy, not capacity:** other Peliyagoda reefers could legally carry OUT009, but they are full [DECIDED: capacity only when no legal vehicle exists].

---

## 3. Screen inventory

Screen IDs are stable; Figma frames are named `<ID>.<n>` for states. "States (frames)" lists what exists in the Figma file on 29 Sep [BUILT]. Each screen has one rationale card beside its frames (booklet: one-paragraph rationale per screen [BOOKLET]).

Everything is on the **"Nexora (main)"** page: role sections D1 to D9, S1 to S3, L1 to L4, R1 to R10 (26 sections, 26 rationale cards), the sign-in page (G1.1 to G1.5), role landing (G2.1 to G2.4), presenter mode (G3, over D6.4) and "Why this screen" panel (G4, over D7.1), and the out-of-scope frames X1 to X14. G1 to G4 are prototype aids, not counted as product screens. The F-frames (framing pages) and LIB frames live on "Shared Library Framing".

**Not yet in this table (see section 7, gap G-10):** a Store screen, section node `589:32` on "Nexora (main)", named **"S4 · Updates and history"**, exists in Figma with its own rationale card but was never folded into this spec's screen inventory or the handoffs in section 5. See G-10 for its frames and purpose; it is now in scope for the store-manager build (see the store README).

### Dispatcher · Waypoint Dispatch · large screen, Peliyagoda planning office, stable connectivity, Light theme [BOOKLET]

Top navigation: Plan (D1 to D5) · Live (D6 to D8) · Deferrals (D4, with count) · Forecast (D9). Depot switch Peliyagoda / Kandy. All frames are 1440 × 900.

| ID | Screen | Purpose | Key information | Primary action | States (frames) | Steps |
|---|---|---|---|---|---|---|
| D1 | Order queue | One confirmed queue at cutoff, carry-overs first [BOOKLET] | Rows with order, outlet, brand, district, temp, access/dock, window, units, kg, m³, status, **Received time**. Carry-overs ORD1001 (OUT012) and ORD1005 (OUT029) grouped first. 212 Peliyagoda / 64 Kandy. **ORD1020 flagged "No legal vehicle"** with reason line and amber bar; **At risk chip** in the toolbar (Peliyagoda 1, Kandy 0) opens the filtered view. Sort chevrons. **Capacity button locked before cutoff with "Opens at cutoff, 16:00" and no navigation** (V19) | Go to capacity board | D1.1 before cutoff · D1.2 after cutoff · D1.3 Kandy · D1.4 filters open · D1.5 order history drawer · D1.S empty / loading / offline (cached queue, ORD1020 still flagged) / error | H1, H2 |
| D2 | Capacity | Supply vs demand per scarce resource; names the binding constraint and the forced-vs-chosen headline [DECIDED] | Binding: reefer Fresh minutes, 2,590 demand vs 2,160 supply (8 available reefers × 270), 120%, over by 430 min. Headline "Capacity forces 19 deferrals at Peliyagoda. 1 has no legal vehicle; policy chose the other 18." Sample cards "busiest vehicle: VEH011" (Style + Tech minutes) and "closest to limit: VEH003" (fuel). Kandy separate pool | Go to trip board | D2.1 Peliyagoda draft · D2.2 Kandy · D2.3 spare reefer appears (released, read-only) · D2.4 released read-only · D2.S | H3, X1 |
| D3 | Trip board | System draft plus live-validated edits [DECIDED] | Trip card per vehicle × trip: order rows, kg and m³ vs caps, trip minutes, vehicle Fresh total vs 270, fuel. One legend line for "one brand · one district per trip" (not a tag per card). Deferred pool cards show order, outlet, brand and temperature tags, and the binding tag. One "Move to…" button per frame | Move an order / defer | D3.1 draft · D3.2 accepted move with consequence preview · D3.3 refused: window rule (ORD1009 to VEH003 trip 2, arrival 08:06 after 08:00 close; popover under the returned card) · D3.4 refused: two rules broken (ORD1002 to VEH011: needs a reefer; two brands) · D3.5 refused: continuity guard (ORD1001) · D3.6 Move to… dialog (keyboard path) · D3.7 Why this vehicle checklist · D3.8 released read-only · D3.S. D3.1 to D3.5 are chained with key R (3b) | H3 |
| D4 | Deferrals | Forced vs chosen, with reasons and store notices [DECIDED] | Headline. Capacity group: ORD1020. Policy group: ORD1009, ORD1017, ORD1006 + 15 more (v4 adds ORD1002). Expanded card shows **Impact on store**, **Frees**, **Next run**, binding tag, and "Serve instead…" (opens D3.6). Protected: OUT012, OUT029. Store-request group after H11. Notice sent / seen. "Notices also go out automatically on release" | Confirm and release · Notify stores | D4.1 v3 (forced vs chosen) · D4.2 detail drawer (ORD1002) · D4.3 v4 adds ORD1002 (only ORD1002 expanded) · D4.4 store-request group (Kandy, after H11) · D4.5 all stores notified · D4.S | H3, H11, X3 |
| D5 | Release | Lock a version and see who has it [APP] | Checklist gate (no unplaced order without a reason; every vehicle has a driver and dock). Totals (v3: 257 served, 19 deferred of 276). **Acknowledgement table**: person, role, vehicle / dock, plan they have, **Departs in**, **Call** button on every row. Version history below it, showing only versions that exist at the frame's clock | Release plan v3 | D5.1 draft ready to lock (Mon 23:35) · D5.2 confirmation dialog · **D5.3 A plan v3 released 23:40, 0 of 4 acknowledged (clock 23:41)** · **D5.3 B plan v4 released 03:00, Ruwan and Nimal pending** · D5.4 A all acknowledged 04:56 · D5.4 B v5 released, driver offline 05:22 · D5.S (loading = releasing) | H4, H5, H7, X4 |
| D6 | Live operations | Exception-first live board, no map [DECIDED] | "Needs a decision" panel. Stat cards: Departed, Loading, Delivered, Issues. Caption "4 of N shown · needing attention first · Show all". Vehicle rows: trip, driver, plan on device, next stop, **Lateness risk**, stops done, last heard, one status pill per stop. "Defer stop" dialog. Refresh only on offline and error states. Vehicle rows match the frame clock (D6.6, 07:31: VEH036 and VEH035 on trip 2, VEH011 parked) | Review → · Resolve → · Defer stop | D6.1 normal · D6.2 driver offline (known coverage gap) · D6.3 Defer stop dialog with offline warning · D6.4 change pending · D6.5 conflict in inbox · D6.6 resolved + receipt confirmed · D6.7 VEH003 held (lateness pill At risk) · D6.8 nothing needs attention · D6.S loading / offline / error (no empty state) | H8 to H17, X2 |
| D7 | Reconciliation | The named hero degradation screen: settle two true records [DECIDED] | Timeline 05:17 / 05:20 / 05:21 / 05:42 / 06:40. Driver record (Delivered 05:42, S. Fernando, POD) beside Dispatch record (Deferred · store request 05:21, v5, never reached the driver). Recommendation Keep delivery with reasons. Result line: Delivered + Deferral withdrawn, Wed re-run removed, both records kept | Confirm, keep delivery · Review with store first | D7.1 needs decision · D7.2 awaiting store · D7.3 store reported an issue (Partial 10 / 12) · **D7.4 A resolved, Delivered (06:44)** · **D7.4 B resolved as Partial (07:05)** · D7.S | H15, H16 |
| D8 | Loading exception | Resolve a pre-departure failure before the vehicle leaves [BOOKLET] | Failed VEH003 (truck, reefer, 5,510 kg, 26.4 m³) vs VEH036 (van, reefer, 1,040 kg, 7.0 m³); gap 120 kg / 0.7 m³; recommendation defer ORD1002 (policy); OUT012 protected; trip after the change; notices sent / not yet seen | Confirm, defer ORD1002, load VEH036 · Adjust manually | D8.1 held, working out options · D8.2 recommendation · D8.3 adjust manually · D8.4 confirmed, plan v4 · D8.S empty / offline / error | X2, X3 |
| D9 | Forecast | Which coming weeks will be short [DECIDED] | 4 ISO weeks labelled by their Monday: reefer demand vs usable capacity (%), over 100% flagged. Levers as notes only (move workshop slots, pre-warn stores). Label: "Baseline forecast: Datathon Task 2A model not wired in" | View only | D9.1 4 weeks · D9.2 short week flagged (expanded) · D9.S | Framing only |

### Loader · Waypoint Load · shared dock tablet, phone width first, Dark (pre-dawn) theme [BOOKLET: judged on phone-sized screens]

Frames are 390 × 844 (L2 scroll variants up to 390 × 1,360; L1.7 is the tablet frame at 1024 × 768).

| ID | Screen | Purpose | Key information | Primary action | States (frames) | Steps |
|---|---|---|---|---|---|---|
| L1 | Dock | Know which plan is current before touching a vehicle [APP] | Dock (Peliyagoda or Kandy), plan version + PIN acknowledgement, vehicles to load sorted by departure with countdown. Call Dispatch shows "Peliyagoda dispatch desk" (no phone number) | Acknowledge plan (PIN) · Load | L1.1 plan not acknowledged 23:45 · L1.2 A/B/C PIN entry, success, wrong PIN (Kandy, plan v4) · L1.3 acknowledged · L1.4 VEH003 Held · L1.5 plan changed, review · L1.6 A/B Kandy v4 no change, before / after · L1.7 tablet master and detail (1024 × 768) · L1.S empty / loading / offline / error | H5, X2, X4 |
| L2 | Load plan | Load in reverse stop order and pass the gate [BOOKLET] | Reverse order with load numbers; chilled-zone marker; dock type; one check per order with units expected vs loaded (count confirm stepper). Gate "Confirm loaded: clear to depart" disabled until every order is checked or an issue is flagged. After the swap VEH036 shows four stops numbered 1 to 4 | Confirm loaded (PIN) · Flag issue | L2.1 A in progress (VEH039 hero) · L2.1 B count confirm · L2.2 short units entry (VEH036) · L2.3 A all checked, gate enabled · L2.3 B PIN confirm · L2.4 loaded / cleared 04:50 · L2.5 held (VEH003) · L2.6 A VEH036 reload after swap · L2.6 B VEH036 loaded 03:25 · L2.S empty / loading / offline (checks saved on tablet) / error | H6, X2, X5 |
| L3 | Flag exception (sheet) | Report a problem before departure [BOOKLET] | Six types: missing item, damaged item, wrong item, warehouse shortage, vehicle check failed, other; affected orders; units short; PIN. After sending: what is safe, who knows, what Dispatch is doing | Send to Dispatch | L3.1 choose type · L3.2 A details (vehicle check failed) · L3.2 B details (missing item) · L3.3 A sent, Kumari reviewing · L3.3 B decision made, plan v4 (03:02) · L3.4 A queued offline (call Dispatch if departure is under 30 min away) · L3.4 B error · L3.4 C sending | X2 |
| L4 | Plan changed | Show only what changed since the last acknowledged version [APP] | Diff v3 to v4, removed rows first and loudest ("Don't load ORD1002"), then changed (VEH003 to VEH036), then unchanged; new totals 950 / 1,040 kg · 6.3 / 7.0 m³ | Acknowledge (PIN) | L4.1 diff 03:04 · L4.2 acknowledged 03:05 · L4.3 no change for this vehicle (Kandy, 04:14) · L4.S empty / loading / offline (may be missing a newer version) / error | X4 |

### Driver · personal phone, used when safely stopped, Dark (pre-dawn) theme with Field (sunlight) variant [BOOKLET]

Tab bar: Run · Issues · History · Me. The top bar always shows the connectivity chip (Online / Offline · N / Synced HH:MM). Frames are 390 × 844. Hero-day frames (R1 to R9) are dated Tue 29 Sep (V18).

| ID | Screen | Purpose | Key information | Primary action | States (frames) | Steps |
|---|---|---|---|---|---|---|
| R1 | Route | Today's stops, available offline [APP] | Plan version, stops with outlet, window, ETA, dock and parking note, expected wait, orders on each stop; connectivity line with last sync and records waiting; under-review or resolved notice. **Me tab (R1.9):** sunlight screen, text size, language (English, Sinhala, Tamil, in native script), **Distance tracking** ("GPS, always on during a run. Works offline."), offline storage | Acknowledge · Start route · Arrive · Navigate | R1.1 no route yet · R1.2 A downloading · R1.2 B ready offline · R1.3 A waiting for loading · R1.3 B loaded and acknowledged · R1.4 ready, start route · R1.5 departed online · R1.6 offline, last sync 05:17 · R1.7 under review (after sync) · R1.8 resolved notice · R1.9 Me tab · R1.10 Field sunlight variant · R1.S download failed | H7 to H9, H15, H16 |
| R2 | Stop detail | One stop, one decision at a time [APP] | Window, dock, parking, time to allow for unloading, orders on this stop; full-width Arrive; Call store; loader shortfall shown on the stop | Arrive → Record outcome | R2.1 before arrival (OUT084) · R2.2 A 05:27 waiting for the window · R2.2 B 05:30 window open · R2.3 A OUT087 05:48 · R2.3 B loader shortfall · R2.S offline arrival saved / error / not on your route / loading | H12, H14 |
| R3 | Record outcome | Proof that survives disputes [BOOKLET] | Outcome for the whole stop by default, per-order switch one tap away. **Five outcomes: Delivered, Damaged, Refused, Store closed, Other**, with helper lines. **Units delivered is a per-order stepper** ("12 of 12"); R3.4 records damaged units ("10 of 12") with a photo of the damage. Proof: photo + receiver name required, signature optional | Save delivery record | R3.1 same for the stop · R3.2 A/B camera, after capture · R3.3 receiver name · R3.4 damaged goods with units (per-order grid: Delivered, Damaged, Refused, Other) · R3.5 A store closed · R3.5 B refused with reason · R3.5 C failed stop card on the run · R3.6 validation, missing photo or name · R3.7 saved to phone · R3.8 OUT087 · R3.9 all stops recorded (offline) · R3.10 05:59 waiting for signal · R3.11 signature pad (optional) | H13, H14 |
| R4 | Outbox (sheet from the chip) | Show that nothing is lost [APP] | Each record with state (waiting, synced, sent to Dispatch for review); "Simulate offline" switch (prototype control for judges) | Retry now · Close | R4.1 records waiting · R4.2 syncing · R4.3 1 "1 stop (2 orders) sent to Dispatch for review" · R4.3 2 error, "Retrying automatically every 30 s" + Retry now · R4.3 3 all synced | H12 to H15 |
| R5 | Sync result | Close the offline loop [APP] | "3 synced · 1 conflict (2 orders) sent to Dispatch"; nothing for the driver to do; the delivery record is safe | Back to route | R5.1 conflict sent to Dispatch · R5.2 all synced · R5.3 resolved (kept 06:44) · R5.S offline again / sync failed / nothing to sync / loading | H15, H16 |
| R6 | Problem: record what happened | Report a stop that can't be done, offline, and carry on [BUILT][TEAM ANSWER Q8] | What happened: road blocked, flooded or closed; breakdown, flat tyre, accident; goods damaged on the truck; others. Affected orders. Saved on the phone; Dispatch decides | Save problem | R6.1 choose what happened · R6.2 record problem · R6.3 saved, back on the run ("You can go on to OUT087") · R6.4 Issues tab (waiting for Dispatch) | Not in the hero line |
| R7 | Trip history | Check what was recorded on this and earlier runs, read-only [BUILT] | Runs with times and sync state; non-operating days shown as depot closed; run detail with arrival and delivery per stop and distance; stop detail with proof. Works offline. Rows: Today Tue 29 Sep, Mon 28 Sep run, Sun 27 Sep No run, Sat 26 Sep, Fri 25 Sep, Thu 24 Sep (A34) | View | R7.1 trip history · R7.2 run detail with mileage · R7.3 stop in history (OUT084) · R7.4 history while offline mid-run | After H16 |
| R8 | Notifications | Changes that affect the driver's own run [BUILT] | Kept delivery, delivery sent for review, photo retrying, stop changed while offline. Sync issue also shown as an alert on the run (R8.2, a separate branch, V21). Detail shows what failed, what is safe, reference (e.g. WP-SYNC-409) | Open | R8.1 notifications · R8.2 sync issue alert on the run · R8.3 detail, sync failed · R8.4 empty | H15, H16 |
| R9 | Finish run | Close the run with a distance for fuel, and leave nothing behind [BUILT][TEAM ANSWER Q7] | **Distance by GPS** (19.4 km; legs 8.3 / 3.1 / 8.0 km), fuel used est. 3.9 L, planned 19 km at 5.0 km/l. If GPS drops out for a stretch, the planned distance fills that gap; the driver types nothing. Run complete says whether all records have synced | Finish run | R9.2 GPS tracked (online) · R9.2 B GPS tracked (offline) · R9.3 run complete · R9.4 run complete, records still on phone · R9.5 no more runs today (next plan 23:40). No R9.1, R9.2 C or R9.2 D frame exists | After H16 |
| R10 | Calendar days | Explain non-standard days so the driver never faces an unexplained empty screen [BUILT] | Monsoon day: slower roads stated, ETAs later (speed index 63 vs 77). Sunday: Kandy depot closed. Public holiday: depot closed, next plan when it reopens. These frames keep their calendar.csv dates | View | R10.1 monsoon day (Sat 27 Jun) · R10.2 Sunday no run (Sun 28 Jun) · R10.3 public holiday (Tue 14 Apr) [ASSUMPTION A26] | Framing only |

### Store manager · Waypoint Store · outlet counter, phone and desktop, Light theme [BOOKLET]

Tab bar: Orders · Deliveries · Issues. Title bar: "OUT084 · Waypoint Fresh · Kandy". Phone frames 390 × 844; desktop frames (S1.6, S1.6 B, S2.11) 1280 × 800. **S4 (Updates and history) is entered from a bell icon, not a tab bar item; see G-10.**

| ID | Screen | Purpose | Key information | Primary action | States (frames) | Steps |
|---|---|---|---|---|---|---|
| S1 | Place order | Order confirmed before the cutoff, editable until then [BOOKLET][TEAM ANSWER Q9] | Delivery date, window and dock, cutoff countdown, chilled and dry as two orders with unit steppers (kg and m³ estimated). Acknowledgement "Received 15:40 · counts for Tue 29 Sep", "You can edit until 16:00", arrival note, "What happens next" timeline. **Edit order** (quantities, **Cancel order**) until 16:00. Recent-orders lists on the desktop frames skip Sundays (V18) | Place orders · Edit order | S1.1 before cutoff (22 min left) · S1.1 B 12 min left · S1.2 review before submit · S1.3 received · **S1.3 B edit order 15:42 · S1.3 C order updated 15:44 · S1.3 D order cancelled 15:45** · S1.4 after cutoff (For Wed 30 Sep · After cutoff) · S1.4 B placed for Wed · S1.5 A offline, not sent (Pending sync, queued, reconnect warning) · S1.5 B error · S1.5 C sending · S1.5 D no orders yet · S1.6 desktop · S1.6 B desktop review modal | H1 |
| S2 | Deliveries | Know what is coming, and when or why not [BOOKLET] | One card per delivery day for OUT084; status; window-aware arrival range; "Have receivers ready by 05:30" cue; deferral notice with type, reason, who decided, next run; journey (Show all steps); recent orders (Mon to Sat only). The Deliveries tab opens S2.10, whose Tue 29 Sep card opens S2.2 | Confirm receipt → | S2.1 confirmed · S2.2 planned with arrival range · S2.3 loaded · S2.4 on the way · S2.5 driver out of coverage · S2.6 deferred at your request · S2.7 **Under review** (+ "Why you're seeing this"; Yes, we received it / Report issue) · S2.8 delivered + deferral withdrawn · S2.9 deferred by policy (OUT009's manager view) · S2.10 recent orders · S2.11 desktop · S2.S empty / loading / offline / error | H2 to H17 |
| S3 | Receipt | Confirm what arrived, or raise an issue tied to the POD [BOOKLET] | POD photo, receiver, time, driver + vehicle; units delivered vs expected with steppers. Reducing a count switches the button to **Confirm with a shortfall**. Neutral "Report issue". Issue sheet: missing, damaged, wrong item, late, **arrived warm**, other; multi-select orders; units; photo. **Issues tab** lists reported issues | Confirm receipt · Report issue | S3.1 to confirm · **S3.1 B confirm with a shortfall** · S3.2 confirmed · S3.3 report issue sheet · S3.4 issue reported · S3.5 Dispatch asks: did you receive this? · S3.6 receipt confirmed while review still open · **S3.7 Issues tab** · S3.S empty / loading / offline / error | H17 |
| S4 | Updates and history | One feed for every notice the order record sends the store, plus a read-only look back at past delivery days [BUILT, not yet reconciled into this spec before 30 Sep — see G-10] | Two tabs: **Updates** (unread-first feed grouped by day, each row tagged Order / Plan / Delivery / Deferral / Review, opens the matching S1/S2 frame; "Mark all read") and **History** (past delivery days Mon to Sat only, filter chips All / Deferred / Partial, only the hero day opens a delivery; older rows are display-only). Entered from a bell icon (with an unread-count dot), not the tab bar | View update · Mark all read · Filter history | S4.1 updates, unread · S4.1 B all read · S4.2 history · S4.S empty / loading / offline / error | Not in the H-table; aggregates H1 to H17 |

### 3b. Prototype conventions (judges' view)

- **Sign-in and landing.** G1.1 to G1.5 lead to G2.1 (Kumari, opens D1.1), G2.2 (loader, opens L1.1), G2.3 (Nimal, opens R1.1) and G2.4 (Anusha, opens S1.1). Each landing card states the same time and plan version as the screen it opens (V20).
- **Flow starts.** 51 in total, named "Role · n · title" with no trailing number: 4 dispatcher, 13 store plus S3.6, 20 loader, 4 driver plus R8.2, the X1 tour, five sign-in starts, G3 and G4.
- **Keys in Present mode.** On the dispatcher main frames E opens the Error state, O Offline, L Loading, N Empty. On D3.1, D3.3 and D3.4, R steps to the next refused-move frame (D3.3, D3.4, D3.5). Left and right arrows walk the X1 to X14 tour. The hint is printed in the page subtitle at the top of the dispatcher column.
- **Auto-advance.** Loading states leave after 1.2 to 1.5 s. Hero chains advance on a timer: S2.1 to S2.5 after 5 s (S2.7 after 5 s), D5.3 A and D5.3 B, D6.4 to D6.5 and D6.6 to D6.8 after 5 s, R1.5 to R1.6 after 4 s, R3.10 and R9.3 or R9.4 after 6 s.
- **Cross-role links.** The only clickable cross-role link inside the story is G3 "Next step" (D6.4 to R2.2 A, the deferral that cannot reach the offline driver). All other handoffs (section 5) are shown by matching times and copy on the receiving screen.
- **External links.** "Navigate" on driver stops opens a Google Maps search for the outlet in a new tab. This is not tracking.
- **Out-of-scope tour.** X1 to X14 are reachable from the "K" avatar on D1.1 and D6.1 (opens X14) and from the X1 tour start.

---

## 4a. Rules and calculations

These rules live in one shared rules module. Every screen that shows a number or a refusal uses these definitions [BOOKLET][DECIDED].

### Hard constraints: a plan never breaks these

| Rule | Source |
|---|---|
| Weight and volume per trip: sum of order kg ≤ weight_cap_kg **and** sum of m³ ≤ volume_cap_m3 | [BOOKLET] |
| Chilled orders only on reefers. Reefers may carry ambient; ambient vehicles never carry chilled | [BOOKLET] |
| van_only outlets only by vans | [BOOKLET] |
| A vehicle serves only its home depot's outlets (Peliyagoda and Kandy are separate pools) | [BOOKLET] |
| Whole orders: one order = one vehicle, one trip, never split | [BOOKLET Task 2B][DECIDED] |
| One brand and one district per trip | [BOOKLET Task 2B][TEAM ANSWER Q6] |
| At most 2 trips per vehicle per day, one driver per vehicle. Fresh trips ≤ 270 min total per vehicle; Style + Tech ≤ 480 min total | [BOOKLET][DECIDED] |
| Only available vehicles; in_workshop or Held vehicles cannot be allocated | [BOOKLET Task 2B][APP] |
| Weekly fuel: fuel used this week + tonight's planned fuel ≤ weekly_fuel_quota_l | [BOOKLET] |
| Planned arrival ≤ the outlet's window close, and ≤ the mall window close for mall_dock outlets | [BOOKLET][DECIDED] |
| Orders after the 16:00 cutoff go to the following run | [BOOKLET] |
| Waypoint operates Monday to Saturday; no delivery is shown on a Sunday | [BOOKLET] |
| Store edits and cancellations are accepted only before 16:00 | [TEAM ANSWER Q9] |

**In execution**, a late arrival is still delivered and tagged Late; it is never refused [BOOKLET][DECIDED]. The **continuity guard** blocks deferring an outlet deferred on the previous run, unless no legal vehicle exists [DECIDED][APP].

### Trip minutes (budget check)

trip min = depot_to_district_freeflow_min + inter_stop_freeflow_min × (orders − 1) + Σ service_allowance_min(brand, dock_type)

Count stops per **order**, not per outlet (OUT084's two orders are two allowances). The return leg is not included [BOOKLET Task 2B]. Worked example, VEH003 trip 1: 24 + 8 × 4 + (15 + 16 + 15 + 15 + 15) = 132 min.

### Planned clock (window check and arrival times)

- Arrival = departure + outbound + inter-stop hops + handling at earlier stops + waiting. Two orders at one outlet share one arrival [APP][TEAM ANSWER].
- An early arrival waits until the window opens; handling starts at the later of arrival and window open [BOOKLET].
- A second trip departs no earlier than the first trip's last handling end + the outbound time back to the depot [APP].
- The 08:00 wall clock often binds before the 270-minute budget: VEH003's two trips use 241 of 270 min, yet a 5th stop on trip 2 would arrive at 08:06.

### Fuel and distance

- **Planned:** km = 2 × depot_to_district_km + inter_stop_km × (orders − 1); litres = km ÷ km_per_l. The return leg counts for fuel only [APP][ASSUMPTION A7].
- **Actual (R9):** distance comes from the phone's GPS during the run, recorded offline. **If GPS drops out for a stretch, the planned distance fills that gap** (V15). The driver enters nothing. Litres = distance ÷ km_per_l (estimate). The planned distance is always shown beside it as a check [TEAM ANSWER Q7]. GPS positions are not sent to Dispatch as live tracking.

### What the store sees as arrival time

Shown arrival = the later of predicted arrival and window open, as a range, for example "from 05:30 (truck may arrive 05:26 and wait)" [PLAN B][APP].

### Lateness risk (D6)

| Value | Meaning |
|---|---|
| On time | Predicted arrival at every remaining stop is before its window closes |
| At risk | A remaining stop is predicted after its window close, or the vehicle is Held |
| Unknown · offline | No event since the vehicle went out of coverage |

The risk rule is a planning estimate from the planned clock, not a Datathon model [ASSUMPTION A27].

---

## 4b. Deferral language, statuses and tags

One vocabulary for all four roles: 11 order statuses, three deferral types, and everything else is a tag [DECIDED].

### Deferral language

| Type | When it applies | Reason line (example) |
|---|---|---|
| Deferred · capacity | No legal vehicle exists for the whole order today | ORD1020 · OUT001: "van_only and 1,250 kg; the largest Peliyagoda reefer van carries 1,040 kg; whole orders can't split." |
| Deferred · policy | A legal vehicle exists, but policy chose this order to absorb the shortfall | ORD1002 · OUT009: "VEH003 failed its check; replacement VEH036 is 120 kg / 0.7 m³ short on Trip 1." Frees 210 kg / 1.4 m³, the least surplus. Next run Wed 30 Sep |
| Deferred · store request | The store asked not to receive | ORD2001 + ORD2002 · OUT084: "Store request: receiving staff unavailable. Next run Wed 30 Sep." |

**Headline sentence** (D2 and D4): "Capacity forces N deferrals at {depot}. {k} have no legal vehicle; policy chose the other {N − k}."

- v3 Peliyagoda: "Capacity forces 19 deferrals at Peliyagoda. 1 has no legal vehicle; policy chose the other 18."
- v4 adds ORD1002: 20 deferrals, 1 capacity and 19 policy.

**Every deferral shows:**

- its type;
- a binding-resource tag;
- **Impact on store** (screen label; was "harm line" in v1): deferred yesterday, days since last served, missed Fresh morning sales or the next mall slot;
- **Frees**: capacity freed on the binding resource (kg, m³ or minutes);
- **Next run** date;
- whether the store notice was sent and seen.

Show reasons, never a score. Ties go to the order that frees the least surplus [DECIDED].

### The 11 order statuses

| Status | Meaning | Set by | Shown on |
|---|---|---|---|
| Ordered | Submitted by the store, before cutoff (still editable until 16:00) | Store (S1) | S1, S2, D1 |
| Confirmed | In the closed queue after 16:00 | System at cutoff | D1, S2 |
| Planned | On a vehicle and trip in the current plan version | System draft; dispatcher (D3, D8) | D3, D5, L1, L2, R1, S2 |
| Deferred | Not in this run. Always shows its type, reason and next run | System draft; dispatcher (D3, D4, D6, D8) | D3, D4, D6, D8, L4, S2 |
| Loaded | The loader confirmed it at the L2 gate | Loader (L2) | L1, L2, D6, R1, S2 |
| Departed | The driver started the route | Driver (R1) | R1, D6, S2 |
| Delivered | Full delivery recorded with POD and synced, or kept by the dispatcher in reconciliation | Driver (R3); dispatcher (D7.4 A) | R1, D6, D7, S2, S3 |
| Partial | Delivered with fewer units than ordered, as reported by the store or confirmed by the dispatcher. **The driver has no Partial outcome** (V16) | Store shortfall (S3); dispatcher (D7.4 B) | D6, D7, S2, S3 |
| Issue | A failed stop (refused, store closed), damage recorded by the driver (R3.4), a road problem (R6), or a store-reported problem | Driver (R3, R6); store (S3) | D6, S2, S3 |
| Pending sync | Recorded on a device, not yet on the server. Only the device shows it | Device | R1 to R9, S1.5 A |
| Conflict | A synced device record disagrees with the current plan. Own colour: outlined amber (soft fill, `signal` stroke, warning icon, `ink` label). **Store-facing label: Under review** | System on sync | R4, R5, D6, D7; S2, S3 as Under review |

Loader flags do not change order status: the **vehicle** gets the tag Held, and its orders stay Planned until the dispatcher decides [APP].

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

v1's "Prototype only: Mock data" tag is retired (V3).

---

## 4c. Shared data reference

All designers copy identifiers and numbers from these tables and nowhere else. Vehicles, outlets, windows, district travel and allowances come from the competition datasets via app.html [APP]. Order sizes, departures and aggregates are mock and listed in 4d.

### People and accounts

| Person | Role | Login | Where / what |
|---|---|---|---|
| Kumari | Dispatcher | dispatcher@waypoint.demo | Peliyagoda planning office; plans both depots; evening plan plus an early shift from 02:30 [ASSUMPTION A8] |
| Priya | Loader | loader@waypoint.demo (dock tablet) | Peliyagoda dock, night shift, PIN per action |
| Ruwan | Loader (second PIN user) | same dock-tablet account, Kandy dock | Loads VEH039 [ASSUMPTION A9] |
| Nimal | Driver | driver@waypoint.demo | VEH039, Kandy, personal phone |
| Anusha | Store manager | store@waypoint.demo | OUT084, Waypoint Fresh, Kandy |
| S. Fernando | OUT084 night receiving staff | n/a | Named on the POD only |
| R. Silva | Driver of VEH036 (not a persona) | n/a | D5 acknowledgement table [ASSUMPTION A22] |
| P. Kumara, S. Jayasena | Drivers of VEH035, VEH011 (not personas) | n/a | D6 rows [ASSUMPTION A22] |

### Fleet by depot [APP from vehicles.csv]

| Depot | Reefer trucks | Dry-box trucks | Reefer vans | Ambient vans | Total |
|---|---|---|---|---|---|
| Peliyagoda | 7 | 27 | 2 | 2 | 38 |
| Kandy | 5 | 13 | 2 | 2 | 22 |

Network: 60 vehicles, 16 reefer-capable, 8 vans [BOOKLET].

### Vehicles used on screens [APP]

| Vehicle | Depot | Type · temp | Weight cap | Volume cap | km/L | Weekly quota | Used before tonight | Role in the story |
|---|---|---|---|---|---|---|---|---|
| VEH003 | Peliyagoda | truck · reefer | 5,510 kg | 26.4 m³ | 4.7 | 480 L | 58 L | Colombo Fresh, 2 trips. Fails its check at 02:55 |
| VEH011 | Peliyagoda | truck · ambient | 7,200 kg | 38.0 m³ | 4.9 | 600 L | 64 L | Style trip to the OUT015 mall |
| VEH035 | Peliyagoda | van · reefer | 1,040 kg | 7.0 m³ | 10.3 | 480 L | 40 L | Gampaha Fresh, 2 trips |
| VEH036 | Peliyagoda | van · reefer | 1,040 kg | 7.0 m³ | 10.3 | 480 L | 22 L | In workshop until 02:45; replaces VEH003 |
| VEH037 | Peliyagoda | van · ambient | 1,100 kg | 8.0 m³ | 11.5 | 340 L | 30 L | Not used in the story |
| VEH039 | Kandy | truck · reefer | 6,180 kg | 29.9 m³ | 5.0 | 370 L | 71 L | Hero vehicle |

### District travel and handling allowances [APP from district_travel.csv and service_allowance.csv]

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

### Orders [APP; sizes and history ASSUMPTION A3, A4]

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

ORD1025 (OUT017) and ORD1026 (OUT023) are the two extra rows on D1.2; see A18 and A19. Received times and the extra queue rows (ORD2004 to ORD2007) are in 4d, A18 to A20.

### Plan v3 trips (released Mon 23:40) [APP, corrected]

| Vehicle · trip | Departs | Stops in order (planned arrival) | Load | Trip min | Vehicle total |
|---|---|---|---|---|---|
| VEH003 · 1 | 03:30 | OUT011 03:54 → OUT006 04:17 → OUT005 04:41 → OUT009 05:04 → OUT012 05:27 (waits to 05:30) | 1,160 / 5,510 kg · 7.7 / 26.4 m³ | 132 | Fresh 241 / 270 · fuel 74.2 / 480 L |
| VEH003 · 2 | 06:09 | OUT008 06:33 → OUT013 06:56 → OUT010 07:19 → OUT004 07:42 | 340 kg · 3.3 m³ | 109 | (above) |
| VEH035 · 1 | 03:30 | OUT026 04:07 → OUT028 04:31 → OUT032 04:56 → OUT034 05:20 | 330 / 1,040 kg · 3.0 / 7.0 m³ | 125 | Fresh 226 / 270 · fuel 54.3 / 480 L |
| VEH035 · 2 | 06:12 | OUT027 06:49 → OUT025 07:14 → OUT029 07:38 | 290 kg · 2.5 m³ | 101 | (above) |
| VEH011 · 1 | 08:36 | OUT015 09:00 (mall window opens 09:00) | 450 / 7,200 kg · 6.5 / 38.0 m³ | 83 | Style+Tech 83 / 480 · fuel 68.9 / 600 L |
| VEH039 · 1 | 05:10 | OUT084 05:26 (waits to 05:30; ORD2001 + ORD2002) → OUT087 06:06 | 170 / 6,180 kg · 1.9 / 29.9 m³ | 73 | Fresh 73 / 270 · fuel 75.4 / 370 L |

**Deferred in v3:** ORD1020 (OUT001), capacity: no legal vehicle. ORD1009 (OUT014) and ORD1017 (OUT007), policy: a 5th stop on VEH003 trip 2 would arrive at 08:06, after the 08:00 close (D3.3). ORD1006 (OUT033), policy: a 4th stop on VEH035 trip 2 would arrive at 08:02. Plus 15 policy deferrals not modelled one by one.

**Plan v4 (Tue 03:00):** VEH003's orders move to VEH036 (same stops); ORD1002 (OUT009) deferred by policy. VEH036: trip 1 950 kg / 6.3 m³ / 109 min; trip 2 departs 06:09; Fresh 218 / 270; fuel 29.0 / 480 L.

### Hero run actuals (VEH039) [BUILT; ASSUMPTION A11, A23]

| Figure | Value |
|---|---|
| Legs (GPS) | Depot to OUT084 8.3 km · OUT084 to OUT087 3.1 km · OUT087 to depot 8.0 km · total 19.4 km |
| Fuel used (estimate) | 3.9 L at 5.0 km/l (planned 19 km) |
| Run times | Departed 05:10 · synced 06:40 to 06:45 · run 05:10 to 06:45, 1 h 35 min |

### Live-board rows at 07:31 (D6.6) [ASSUMPTION A33]

| Vehicle | Trip | Driver | Plan | Next stop | Stops | Last heard | Status |
|---|---|---|---|---|---|---|---|
| VEH039 | 1 | Nimal | v5 | Returning to Kandy | 2 / 2 | 07:29 | Delivered |
| VEH036 | 2 | R. Silva | v4 | OUT004 · ETA 07:42 | 3 / 4 | 07:29 · 2 min | Departed |
| VEH035 | 2 | P. Kumara | v4 | OUT029 · ETA 07:38 | 2 / 3 | 07:30 · 1 min | Departed |
| VEH011 | 1 | S. Jayasena | v4 | OUT015 · departs 08:36 | 0 / 1 | 07:27 | Planned |

### Aggregates and plan versions [APP; ASSUMPTION A6]

| Figure | Value |
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

The 06:44 resolution is a decision on the order record, not a new plan version [ASSUMPTION A16]. Frames never list a version that does not yet exist at their clock (D5.3 A at 23:41 lists v1 to v3 only).

---

## 4d. Assumption register

Everything below was invented or inferred. **Disclosure rule (V3):** no per-screen "Mock data" chips; invented data is disclosed once, on the AI disclosure page (F17), in the video's assumptions segment, and here. The booklet does not regulate this; it is the team's rule.

Proposed F17 line: *"Illustrative data: some times, order IDs, outlet tags and quantities were invented to complete the flows. They are listed in spec §4d."* The out-of-scope subtitle already says "Every figure here is illustrative (spec §4d)".

### A1 to A17 (v1, unchanged)

| # | Assumption | Used in | How to retire it |
|---|---|---|---|
| A1 | Operating day Tue 29 Sep 2026, planned Mon 28 Sep | Everywhere | Confirm is_operating = 1 in calendar.csv |
| A2 | Order IDs ORD1001 to ORD2007 (tomorrow's orders aren't in the dataset) | All screens | Keep; note in the README |
| A3 | Units, kg and m³ per order; trip-1 weights raised so VEH036 is 120 kg short | D3, D8, L2, S3 | Sample from deliveries_train.csv for the same outlets |
| A4 | deferred_yesterday and days since last served | D1, D4, D8 | Same as A3 |
| A5 | Departures: Fresh 03:30, VEH039 05:10, VEH011 08:36; second trips derived | D3, R1, S2 | Keep |
| A6 | Aggregates: 212 / 64 orders, 2,590 demand minutes, 19 deferrals. These are our figures, so rationale cards tag them [C], not [A] | D1, D2, D4, D5 | Recount from the seeded day in the Hackathon |
| A7 | Week-to-date fuel used; fuel includes the return leg | D2, D3, R9 | Keep, state it in the rationale |
| A8 | One Peliyagoda office plans both depots; Kumari covers evening + early shift from 02:30 | D6 to D8 | Say so in the video |
| A9 | Loader account = dock tablet with a PIN per person; Ruwan loads at Kandy | L1 to L4 | n/a |
| A10 | Anusha phones Dispatch at 05:20 from home; S. Fernando receives at 05:42 | H10 to H13 | n/a |
| A11 | Hero delivered 05:42; OUT087 arrival 05:48, delivered 05:58 | R3, D7, S2, S3 | n/a |
| A12 | VEH036 leaves the workshop at 02:45; VEH003 failure is "reefer not holding temperature" | X1 to X3 | n/a |
| A13 | POD = photo + receiver name + device time; signature optional | R3, S3 | n/a |
| A14 | Store orders captured in units; kg and m³ estimated | S1 | n/a |
| A15 | D9 weekly percentages and "2 workshop slots" | D9 | Replace with the Task 2A baseline |
| A16 | Conflict resolution is a record decision, not a new plan version | D5, D7 | n/a |
| A17 | VEH036's driver is not a persona and departs 03:30 as planned | X6 | n/a |

### A18 to A30 (added 28 Sep)

| # | Assumption | Used in |
|---|---|---|
| A18 | Received times on D1.1 / D1.2: ORD1001 13:41, ORD1005 13:48, ORD1002 14:02, ORD1007 14:27, ORD1020 15:12. D1.2 also lists two extra rows, ORD1025 (OUT017) and ORD1026 (OUT023), received 14:39 and 15:03. ORD2003 14:48 | D1 |
| A19 | **Resolved 29 Sep.** The two extra D1.2 rows collided with ORD1021 (OUT034) and ORD1022 (OUT032) in 4c; they are now ORD1025 (OUT017: Fresh, Gampaha, 04:30 to 08:00, 24 units, 150 kg, 1.0 m³) and ORD1026 (OUT023: Style, Colombo, mall dock, 18 units, 260 kg, 3.1 m³). ORD1021 and ORD1022 belong to OUT034 and OUT032 only. D1.1 shows five sample rows and does not list ORD1025 or ORD1026 | D1.2 |
| A20 | Kandy queue rows ORD2004 to ORD2007, received 14:55, 15:05, 15:18, 15:31 | D1.3 |
| A21 | D3 deferral cards: ORD1020 OUT001 van access; ORD1009 OUT014 window; ORD1017 OUT007 window; ORD1006 OUT033 window (last two inferred from their D4 reasons) | D3 |
| A22 | Non-persona drivers: R. Silva (VEH036), P. Kumara (VEH035), S. Jayasena (VEH011) | D5, D6 |
| A23 | Delivered counts on D6.1 to D6.6 run 22, 23, 24, 31, 33; Issues 1 then 0; VEH039 "Unknown · offline" during D6.2 to D6.4; "VEH039 records pending sync" on D6.4 and D6.5 | D6 |
| A24 | Hero run distances (4c "Hero run actuals"): legs 8.3 / 3.1 / 8.0 km, total 19.4 km, 3.9 L. **No odometer readings exist** (V15) | R7, R9 |
| A25 | Store edit flow: ORD2001 changed 12 to 10 units at 15:42 (estimate about 58 kg, 0.6 m³); updated 15:44; cancelled 15:45 | S1.3 B to D |
| A26 | Calendar frames keep calendar.csv dates: monsoon Sat 27 Jun (Kandy speed index 63 vs 77), Sunday Sun 28 Jun, public holiday Tue 14 Apr. They are the only frames not on the hero day. Check against calendar.csv | R10 |
| A27 | Lateness risk values and rule (4a) | D6 |
| A28 | Store receipt shortfall: ORD2001 received 10 of 12 at 07:29, reported 07:04 | S3.1 B, D7.3 |
| A29 | Sync failure reference "WP-SYNC-409" | R8.3 |
| A30 | Release notes line on D5 version history ("VEH003 → VEH036; ORD1002 deferred (policy)" etc.) | D5 |

### A31 to A35 (added 29 Sep, please confirm)

| # | Assumption | Used in |
|---|---|---|
| A31 | D5.3 A clock 23:41: acknowledgements 0 of 4; "Departs in" 5 h 29 min for VEH039 (05:10) and 3 h 49 min for VEH036 (03:30); Deferrals badge 19. D5.3 B is the 03:00 v4 frame (Ruwan and Nimal pending, clock 04:10) | D5.3 A, D5.3 B |
| A32 | D7.4 B: Kumari resolves as Partial at 07:05, one minute after the store's 07:04 report; notices to Nimal, Anusha and the Kandy dock at 07:05; follow-up for 2 units | D7.3, D7.4 B |
| A33 | Live-board rows at 07:31 (table above): VEH036 and VEH035 on trip 2, VEH011 parked | D6.6 |
| A34 | Driver history rows: Mon 28 Sep run 05:09 to 06:31, 19.5 km, 1 h 22 min, 2 of 2; Sat 26 Sep 05:12 to 06:30, 19.6 km, 1 h 18 min; Fri 25 Sep 05:05 to 06:52, 22.3 km, 3 of 3, 1 h 47 min; Thu 24 Sep 05:08 to 06:28, 19.2 km, 1 h 20 min; Sun 27 Sep no run. Today Tue 29 Sep 05:10 to 06:45, 19.4 km | R7.1 |
| A35 | Store recent-orders lists (Mon to Sat): Mon 28 Sep delivered 05:40, Sat 26 05:51, Fri 25 deferred (policy) served next day, Thu 24 05:38, Wed 23 05:44, Tue 22 05:36, Mon 21 partial (1 unit short). Times moved with their rows when Sunday was removed | S2.10, S1.6 |

### A36 to A37 (added 30 Sep by the store-manager frontend build, please confirm)

| # | Assumption | Used in |
|---|---|---|
| A36 | Store order estimates scale linearly with units: chilled 70 kg and 0.7 m³ per 12 units, dry 45 kg and 0.6 m³ per 8 units (the ORD2001 and ORD2002 figures), kg rounded to a whole number, m³ to one decimal. This is what S1.3 B shows (10 chilled units, about 58 kg, 0.6 m³). Extends A14 (orders are captured in units, kg and m³ estimated) | S1 |
| A37 | Copy and behaviour S1 needs but Figma does not draw: "Orders closed at 16:00" with "This order can no longer be edited or cancelled." when an edit is refused at the cutoff; "Place 1 order" for a single line and a disabled "Place orders" for none; a line lowered to 0 is cancelled on Save changes; Cancel order has no confirm step (as drawn). Also: the S1.4 after-cutoff order shows the hero quantities (12 and 8) read-only, as drawn | S1 |

**A35 correction (30 Sep):** the S1.6 frame shows Recent orders as Sat 26 Sep 2 Delivered, Fri 25 Sep 2 Delivered, Thu 24 Sep 1 Deferred · policy, Wed 23 Sep 2 Delivered, Tue 22 Sep 2 Delivered (date, order count and status only, no times). A35 above puts the policy deferral on Fri 25 and lists delivery times and a Mon 21 partial. The frame is what is judged, so the store build follows it; A35 should be reconciled with the frame or the frame redrawn.

### Corrections to app.html (v1, status not re-checked)

C1 to C11 from v1 still apply to whoever maintains app.html: re-sequenced trips so every window holds; second trips after the return leg; three modelled policy deferrals; the VEH003 → VEH036 swap with ORD1002 deferred; VEH036 released at 02:45; store deferral at 05:20 / 05:21; R3 outcomes map to Delivered / Issue + tag; loader at phone width with the Kandy load by Ruwan; continuity-guard wording; D9 ISO weeks labelled by Monday; units, S2 Departed state and ORD2003 delivered 05:58. v2 added: C12 R6 to R10 screens; C13 store edit before cutoff; C14 Under review label for stores; C15 GPS distance (**v2.1: no odometer fallback, planned distance fills a GPS gap**). v2.1 adds: C16 no delivery on Sundays; C17 five driver outcomes with a units stepper; C18 D5.3 A and D7.4 B states.

---

## 5. Handoffs

Every handoff is a change to the shared order record or plan version, so the receiving screen shows it without a phone call [BOOKLET][DECIDED]. Check both ends of each row. In the prototype the receiving screen is shown by matching times and copy; the only clickable cross-role link is G3 (3b).

| # | From → To | Sender does (screen) | What travels | Receiver sees | If delayed or failed |
|---|---|---|---|---|---|
| 1 | Store → Dispatcher | Places, edits or cancels an order before 16:00 (S1) | Outlet, date, chilled or dry, units, estimated kg / m³, received time | D1 row immediately (Ordered, then Confirmed at 16:00); edits and cancellations update the row | After cutoff: tagged After cutoff, moved to the following run, and S1 says so. Offline: S1.5 A "Pending sync", counts only once Received shows |
| 2 | Dispatcher → Store (schedule) | Cutoff (system) and release (D5) | Status, window-aware arrival | S2 at 16:00 (Confirmed) and 23:40 (Planned + arrival) | Not yet released: "Plan not released yet, arrival time follows" |
| 3 | Dispatcher → Store (deferral) | Notify (D4), Defer stop (D6), confirm (D8) | Deferred + type, reason, who decided, next run | S2 card at once (S2.6, S2.9) | Store offline: shown on next open. D4 shows sent / not yet seen |
| 4 | Dispatcher → Loader | Release (D5), confirm (D8) | Plan version, trips, reverse load order, what changed | L1 acknowledge; L4 diff when a vehicle changes | Not acknowledged: D5 "Acknowledgement pending" with Call (D5.3 A, D5.3 B); L2 gate blocked for that vehicle. Dock offline: L1.S offline |
| 5 | Loader → Dispatcher | Send to Dispatch (L3) | Exception type, vehicle, affected orders, units short | D6 needs-a-decision item → D8 | Until decided: vehicle Held, L3.3 A. Tablet offline: queued (L3.4 A) with "call Dispatch if departure is under 30 min away" |
| 6 | Loader → Driver | Confirm loaded at the gate (L2) | Orders + units on board, shortfalls | R1.3 B "Confirmed by Ruwan · 04:50"; R2.3 B shortfall on the stop | Not confirmed: R1.3 A waiting for loading, Start route disabled |
| 7 | Dispatcher → Driver | Release (D5); later changes (D6) | Plan version, stops, windows, docks, changes | R1 on next sync; driver acknowledges | Driver offline: D6.4 change pending, D5.4 B v5 released. The phone keeps its last version and never shows a change it didn't receive |
| 8 | Driver → Dispatcher | Arrival (R2), outcome + POD (R3), via the outbox (R4) | Per order: outcome, units, receiver, photo, device time | D6 rows on sync; disagreements go to D7 | Offline: Pending sync on the phone; D6 last-heard age and Unknown · offline risk; conflicts surface on sync |
| 9 | Driver → Store | Delivery record (R3) | Delivered time, receiver, POD, units | S2 delivery record; S3 to confirm | Driver offline: S2.5 keeps the last status with a coverage note |
| 10 | Store → Dispatcher | Confirm receipt, confirm with a shortfall, or report an issue (S3); answer "Did you receive this?" (S3.5) | Receipt, issue type, units, photo | D6 order row; D7.3 if raised during a review, resolved on D7.4 B as Partial | Not confirmed: stays Delivered without Receipt confirmed |
| 11 | Dispatcher → Driver (resolution) | Confirm (D7.4 A or B) | Final status, deferral withdrawn | R1.8 notice, R5.3, R8.1 | Driver offline again: shown on next sync |
| 12 | Loader → Store (via Dispatcher) | L3 flag, then D8 decision | Short units or a deferral before arrival | S2 before the truck arrives (S2.9) | n/a |
| 13 | Driver → Dispatcher (problem) | Record problem (R6) | What happened, affected orders, time, stop | D6 needs-a-decision item; R6.4 shows "Waiting for Dispatch" | Offline: saved on the phone (R6.3), sent on signal |

**Not yet numbered (see G-10):** Dispatcher/System → Store, via S4. Every handoff above that lands on an S1 or S2 frame (1, 2, 3) also produces a row in the S4 Updates feed, since S4 aggregates the same notices rather than sourcing new ones. No new information crosses roles; S4 is a store-side view, not a new sender or receiver.

The driver's R8 list and the store's deferral notices are the only notification surfaces; there is no separate notification centre. **This should be revised once S4 is reconciled into the spec** — S4 is the store's equivalent of R8, and the sentence above should say so.

---

## 6. Design system link

Visual rules come from the shared Figma library on the "Shared Library Framing" page (LIB1 to LIB8) and the style guide (F16). This spec defines content and behaviour only. Nobody builds components locally.

### App names and themes (V10, V11)

| Role | App name | Theme |
|---|---|---|
| Dispatcher | Waypoint Dispatch | Light (office) |
| Loader | Waypoint Load | Dark · pre-dawn (night dock) |
| Driver | (no product name shown on screens) | Dark · pre-dawn, Field theme in sunlight |
| Store manager | Waypoint Store | Light (daylight counter) |

Theme follows the working environment, not the role. (Current prototype: "Waypoint Dispatch" is shown on every dispatcher frame; the loader and store names are not yet printed on their screens and the sign-in frames read "Waypoint Dispatch" for every role. See section 7.)

### Type and writing rules

- Archivo for sentences and labels; IBM Plex Mono only for IDs, times and figures. Sinhala and Tamil language labels on R1.9 use their own script fonts.
- No text under 12 px; contrast at least 4.5:1 (contrast not yet measured across the file).
- No em dashes in visible text (use a colon, comma, full stop or middot).
- No "Mock" text, no bracketed placeholders, no invented phone numbers ("Peliyagoda dispatch desk" instead).
- Rationale cards: title "Rationale · <ID> <name> (<frame range>)", one paragraph starting "Purpose:", claims tagged [A] / [B] / [C], legend line underneath. [A] only for what the booklet says.

### Master Order Component: one component, four densities [APP]

| Density | Used on | Adds |
|---|---|---|
| Dispatcher row | D1, D3, D4, D6, D8 | Temp / access / dock tags, kg + m³, window, reason line, "Move to…", history drawer |
| Loader check | L2, L4 | Load number (reverse order), large check target, units expected vs loaded, chilled-zone accent, dock type |
| Driver stop | R1, R2, R3 | Outlet, window, dock type, orders on the stop, units; large tap target |
| Store delivery | S2, S3 | Brand + chilled / dry, window-aware arrival, deferral notice, POD summary |

### Components this spec needs from the library

| Group | Components |
|---|---|
| Status and tags | Status chip (11 states; Deferred with a type suffix; Conflict outlined amber; Under review for stores) · tag · binding tag · lateness pill (pill shape, same as status pills) · At risk chip |
| Global | App bar (clock, depot, plan version) · connectivity chip · last-heard indicator · device tab bar · planning stepper (D1 to D5) |
| Planning | Capacity card with bar · forced-vs-chosen headline · trip card · consequence preview · refusal popover listing every broken rule · "Why this vehicle" checklist · deferral block (Impact on store, Frees, Next run) · version history · acknowledgement table with Call |
| Decisions | Recommendation panel · side-by-side record comparison · event timeline · vehicle swap card |
| Field | Plan diff row · PIN sheet · bottom sheet · pinned action bar · outcome grid (5 outcomes) · units stepper · photo tile · signature pad · outbox row · offline banner |
| Store | Cutoff countdown · acknowledgement card · "What happens next" timeline · arrival range card · deferral notice · "Why you're seeing this" card · POD summary · unit stepper with shortfall · issue sheet · **update feed row and unread bell (S4, G-10)** |
| States | Alert banners (info, warning, issue, offline, conflict) · empty · loading skeleton · error with retry · forecast week row (D9) |

---

## 7. Known gaps between this spec and the prototype (29 Sep, 19:00)

Not fixed because they need new frames or are low demo impact. Say them in the video or fix them before the 23:59 deadline if time allows.

| # | Gap | Where |
|---|---|---|
| G-1 | Loader handoffs: L1.1 acknowledges v3 without a PIN sheet; L1.3 "Load VEH003" opens the flag sheet L3.1; L2.5 "Go to VEH035" opens the dock list; L2.2 "Flag shortage" opens L3.2 B (VEH003, v3, 02:55); L2.6 A and B return to the 00:10 dock L1.3 | L1, L2, L3 |
| G-2 | App names: "Waypoint Load" and "Waypoint Store" are not printed on screens; sign-in frames read "Waypoint Dispatch" for every role; no retry link on the wrong-password and offline sign-in frames | G1, L, S |
| G-3 | 13 state frames have no inbound link (S1.5 B, S1.5 D, S2.S A, S2.S C, S3.S A, S3.S C, R1.S, R2.S 2, R2.S 3, R3.6, R5.S 1, R5.S 3, R8.4); the D-role state frames open only by key | S, R, D |
| G-4 | Nav counts and trip counts disagree: Deferrals badge reads 2 on D1.1, 19 on D5.1, 20 on D6.6; D5.1 says "36 trips · 11 drivers", D6 says "38 trips". By the booklet one driver runs at most 2 trips, so 11 drivers cannot cover 36 | D1, D5, D6 |
| G-5 | D6.8 (06:15) vehicle rows not re-checked against its clock | D6.8 |
| G-6 | Small label mismatches: D3.6 "Kandy" hotspot opens D3.2; "History" on D6 rows opens the ORD1002 drawer D1.5; D2.3 "Open live view" opens D6.7; R1.8 and D7.4 quote the driver notice differently; S3.5 shows 07:28 while D7.2 asks at 06:45; D1.1 omits ORD1025 and ORD1026; R7.1's "Sun 27 Sep" row opens R10.2 (dated Sun 28 Jun) | various |
| G-7 | Layout: the page header reads "Kumari · Dispatcher screens" above the dispatcher column only; an empty 100 × 100 frame "Title with lock" sits at (0, 0); the G frames sit about 20,000 px left of D1; R10.1 "Start route" opens the hero frame R1.5 | page |
| G-8 | Stop-number marker on L2.2 and L2.6 B (the row marker for OUT012) was not changed to 4 because no "5" text node was found; check by eye | L2 |
| G-9 | Contrast (4.5:1) and text clipping were not measured file-wide | all |
| G-10 | **Store screen S4 "Updates and history" is built in Figma (section node `589:32`, frames S4.1, S4.1 B, S4.2, S4.S) with its own rationale card, but was never added to section 3's screen table, section 5's handoffs, or the tab bar description before the 29 Sep freeze. Added to this copy of the spec (30 Sep, store-manager frontend build) from the Figma frames directly: two tabs, Updates (unread feed, newest first, grouped by day, tagged Order / Plan / Delivery / Deferral / Review, each row opens its source S1/S2 frame) and History (past delivery days Mon-Sat, filter chips All / Deferred / Partial, only the hero day's row opens a delivery). Entered from a bell icon, not the tab bar. Needs a spec-owner sign-off; flag in the video alongside the other gaps** | S4 (Store) |

---

## Addendum: gap G-10, added 30 Sep by the store-manager frontend build

This section is not part of the 29 Sep freeze; it documents a spec correction made while building the store-manager frontend (`frontend/`, branch `feature/store-manager-frontend`), after finding S4 built in Figma but absent from this document. Full detail (frame IDs, exact copy, states) lives in the store README's phase list and departures section, not duplicated here. This addendum exists so the gap and its resolution are traceable from the spec itself, per the house rule "never invent a number silently."
