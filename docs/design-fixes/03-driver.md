# 03 · Driver (Nimal, VEH039, Kandy) · design fixes

**Figma page:** Driver (`17:3`) in *NEXORA – TRIATHLON* (`0qCle1zCrSImSou4lVlvmL`). The frames are 390×844 phone; some are taller full-scroll frames. Theme: **Dark · pre-dawn**, plus the **Field · sunlight** variant (R1.9 toggle, R1.10).
**Review score:** 7.5 / 10 (8 screens rated). This is the strongest role. **Target:** 8.5+.
**Do the cross-role file first** (`00-cross-role.md`):
- X1: 14 mock mentions.
- X2: `[DISPATCH NUMBER]` in **R1.S, R5.S·2 and R6.1**, not just R6.1.
- X4: dark theme rationale.
- X5: Conflict pill.

---

## What the booklet asks of the driver

These come from spec §3; tags show where each requirement comes from:
- Personal phone, **used when safely stopped**. **[BOOKLET]**
- Today's stops, available offline, with window and dock type per stop and "3 orders on board" (R1). **[APP]**
- One stop, one decision at a time (R2). **[APP]**
- **Proof that survives disputes** (R3): one row per order, defaulting to "same for the stop".
  - Outcomes: **Delivered, Partial (units delivered), Refused, Store closed, Damaged, Other**.
  - POD photo and receiver name are required; **signature is optional**. **[BOOKLET]**
- Record work offline and reconcile (R4 Outbox, R5 Sync result). Wording from spec §2 H15: *"3 synced · 1 conflict (2 orders) sent to Dispatch; nothing for you to do."* **[BOOKLET][DECIDED]**
- No GPS in the data; progress comes from stop events and last-heard age. **[DECIDED]**

Two of the review's suggestions contradict this spec: removing "Damaged" and removing "signature optional". See "Not taking".

---

## Priority list

| # | Fix | Frames | Effort | Review score now |
|---|---|---|---|---|
| R-0 | Cross-role items X1, X2, X4, X5 | many | S | n/a |
| R-1 | Outbox and sync counts agree with each other and with the spec | R4.1–R4.3, R5.1–R5.3 | S | 6.5 / 7 |
| R-2 | Departed and offline: Arrive is primary, one-line offline banner | R1.5, R1.6 | S | 7 |
| R-3 | Stop cards: outlet name on every stop, sync pill label, tags on one line | R1.4–R1.10 | S | 7.5 |
| R-4 | Stop detail: Call store, Directions, unloading note | R2.1–R2.3 | S | 7 |
| R-5 | Record outcome: sticky Save, clearer Damaged vs Partial, signature pad | R3.1, R3.4, R3.6, R3.8 | M | 7 |
| R-6 | Sunlight variant: solid tags | R1.10 | S | 8 |
| R-7 | Scope check for R6–R9 | R6–R9 | S | n/a |

---

## R-1 · Outbox and sync result: numbers that agree (6.5 / 7 → 8.5)

**Frames:** R4.1 "Outbox sheet: records waiting", R4.2 syncing, R4.3·1 Conflict, R4.3·2 retrying, R4.3·3 empty, R5.1 "Sync result: conflict sent to Dispatch", R5.2, R5.3.
**What's there now:**
- R4.1: "5 records waiting". This is correct: departed, arrival OUT084, delivered ORD2001, delivered ORD2002, arrival OUT087, delivered ORD2003.
- R4.3·1: "**1 record** sent to Dispatch for review", but **two** rows show Conflict (ORD2001 and ORD2002).
- R5.1 headline: "3 synced · 1 conflict sent to Dispatch", while the stats say "Sent for review · 2 orders".

**Changes (use the spec wording from H15):**
1. **R4.3·1 banner:** **"1 stop (2 orders) sent to Dispatch for review."**
2. **R5.1 headline:** **"3 synced · 1 conflict (2 orders) sent to Dispatch"**, with body **"Nothing for you to do."** (the spec text, with the em dash replaced by a full stop). Keep the stats cards (3 synced / 2 orders for review); they now agree.
3. **Conflict pill:** apply X5 (outlined amber). On driver screens, the row text "Dispatch is reviewing" stays.
4. **Retry action:** in R4.3·2 (error, retrying), add a secondary button **"Retry now"** and the line "Retrying automatically every 30 s" [C; add to spec §4d].

**Done when:** every count on R4 and R5 can be added up from the rows under it.

---

## R-2 · Departed and offline (7 → 8.5)

**Frames:** R1.5 "Route: departed, online", R1.6 "Route: offline, last synced 05:17".
**Problems:**
- "Problem" and "Arrive" sit side by side with equal weight, which invites mis-taps.
- The offline banner is about 100 px tall.
- The yellow "0" badge is unclear.

**Why it matters:** the driver uses the phone when safely stopped, often with one thumb [BOOKLET].

**Changes:**
1. On the next-stop card:
   - **"Arrive at OUT084"** is a **full-width primary** button, 56 px tall.
   - **"Report a problem"** is a ghost text link under it, centred.
2. The offline banner collapses to one line, 40 px: `wifi-off` icon + **"Offline · last sync 05:17 · 3 waiting"**. Tapping it opens the Outbox (R4).
3. The "0" badge becomes a label: **"0 waiting"** when online, **"3 waiting"** when offline. Or remove it when the count is 0.

---

## R-3 · Stop cards on the route (7.5 → 8.5)

**Frames:** R1.4 "Route: ready, start route", R1.5, R1.6, R1.7 under review, R1.8 resolved, R1.10 sunlight.
**Problems:**
- The OUT087 card shows only the code; OUT084 shows "OUT084 · Waypoint Fresh".
- The "05:08" sync pill is ambiguous.
- The tags wrap onto two lines.

**Changes:**
1. **Outlet name on every stop:** "OUT087 · Waypoint Fresh · Kandy". Use brand + district from the competition data; no street address, because addresses aren't in the booklet data. If you add addresses, list them in spec §4d first.
2. **Sync pill label:** **"Synced 05:08"** online; **"3 waiting"** offline.
3. **Tags on one line:** keep brand, temperature and dock type (e.g. Fresh · Chilled · Rear dock). Reduce tag padding to 2 × 6 px and the font to 12 px. If they still wrap, drop the brand tag; the outlet line already names the brand.

---

## R-4 · Stop detail (7 → 8.5)

**Frames:** R2.1 before arrival (OUT084), R2.2·A waiting for the window (05:27), R2.2·B window open (05:30), R2.3·A OUT087, R2.3·B loader shortfall, R2.S.
**Problems:** there is no way to call the store or get directions, and no unloading note.
**Changes:**
1. Add an action row under the stop header with two secondary icon buttons:
   - **"Call store"** (`phone` icon);
   - **"Directions"** (`pin` icon).

   Directions opens the phone's maps app by outlet name. This is a hand-off, not an in-app map: the spec says there is no GPS in the data. Note both as [C] in the rationale.
2. **Unloading note** card, from the dock type (spec: "dock type per stop"):
   - OUT084: "**Rear dock** · Receivers from 05:30 · Night staff sign".
   - Mall outlets (e.g. OUT015): "**Mall bay** · Mall dock hours 09:00–11:00". This is already on the dispatcher queue (ORD1007), so the data is consistent.
3. Keep the arrival log; the reviewer called it good.

---

## R-5 · Record outcome (7 → 8.5)

**Frames:** R3.1 "Record outcome: same for the stop" (390×1180), R3.4 partial with units, R3.6 validation, R3.8 OUT087.
**Problems:**
- The screen is 1180 px tall with Save at the very bottom.
- "Damaged" overlaps with "Partial".
- The screen says "signature optional" but has no signature field.

**Changes:**
1. **Sticky footer:**
   - The **"Save delivery record"** button is pinned to the bottom (56 px, surface-1 background, 1 px top line).
   - Above it, a status line: "Photo ✓ · Receiver ✓".
   - In Figma, set the footer frame to *Fixed position when scrolling* so the prototype scroll shows it.
2. **Keep "Damaged"** (the spec lists it as an outcome) but make the difference obvious with one helper line per tile:
   - **Partial:** "Some units delivered. Enter the count."
   - **Damaged:** "Goods damaged. Store did not accept them."
   - **Refused:** "Store refused for another reason."
3. **Signature: add it, don't delete it.**
   - Add a collapsed row **"Add signature (optional)"** below the receiver name.
   - Tapping it expands a 120 px signature box with a "Clear" link.
   - This matches the spec: signature optional.

**Done when:** Save is always visible, and no two outcomes can be confused.

---

## R-6 · Sunlight variant (8 → 9)

**Frame:** R1.10 "Route: Field · sunlight variant".
**Problem:** the pastel tags lose contrast in sunlight.
**Change:**
- In Field mode, tags use **solid fills with white text**: brand-fresh, chilled, ink for outline tags.
- Do this in the library **Tag** component with a Field-mode variable override, not by detaching.

---

## R-7 · Scope check: R6 to R9

The Driver page has extra screens beyond the spec's five (R1–R5):
- R6 Problem;
- R7 Trip history and mileage;
- R8 Notifications;
- R9 Odometer and run complete.

**Keep them, but make them earn their place:**
- **R6 (problem chooser)** answers "flag a problem" and pairs with the loader's L3. Keep it and fix `[DISPATCH NUMBER]` (X2).
- **R9 (odometer)** supports the booklet's **weekly fuel quota** hard rule. Say that in its rationale: "Odometer readings feed the fuel quota (hard rule, spec §4a) [B]."
- **R7 and R8:** make sure they use the same hero data (VEH039, 05:10 departed, 05:42 delivered) and carry no Mock chips (X1). If time is short, leave them as they are; don't expand them.

---

## Not taking these review suggestions

| Suggestion | Decision | Reason |
|---|---|---|
| Remove "Damaged" and fold it into Partial | **No**, clarify instead (R-5.2) | The spec's R3 outcome list includes Damaged [BOOKLET-derived]. Removing it breaks the loader ↔ driver ↔ store vocabulary (L3 "damaged item", S3 "Damaged"). |
| Remove "signature optional" | **No**, add the optional pad (R-5.3) | The spec says signature optional. |
| Show a real phone number, e.g. "011 234 5678" | **No** | A realistic number may belong to someone real. Use a "Call Dispatch" button label. |
| In-app navigation map | **No** | No GPS in the data [DECIDED]; hand off to the phone's maps app instead. |

---

## Final checklist for this page

- ☐ X1, X2 (all three frames), X4 and X5 are done on this page.
- ☐ R-1 to R-6 are done; R-7 rationale lines are added.
- ☐ Hero times: 04:55 acknowledge, 05:10 departed, 05:17 offline, 05:26 arrive (waits to 05:30), 05:42 delivered (S. Fernando), 05:58 OUT087, 06:40 sync → conflict, 06:44 resolved.
- ☐ Counts on R4 and R5 add up and match spec H15.
- ☐ Save is visible on every Record outcome frame without scrolling.
- ☐ The Field · sunlight frame passes contrast with solid tags.
- ☐ Rationale paragraphs are updated under R1–R5.
