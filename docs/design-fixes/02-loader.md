# 02 · Loader (Priya at Peliyagoda, Ruwan at Kandy) · design fixes

**Figma page:** Loader (`17:2`) in *NEXORA – TRIATHLON* (`0qCle1zCrSImSou4lVlvmL`). The frames are 390×844 phone, plus one 1024×768 tablet (L1.7). Theme: **Dark · pre-dawn**.
**Review score:** 7 / 10 (11 screens rated). **Target:** 8.5+.
**Do the cross-role file first** (`00-cross-role.md`). X1 (4 mock chips), X3 (L1.7 header name) and X4 (dark theme rationale) touch this page.

---

## What the booklet asks of the loader

These come from spec §3; tags show where each requirement comes from:
- Shared dock tablet, **designed at phone width first. The booklet judges on phone-sized screens.** **[BOOKLET]**
- Know which plan is current before touching a vehicle (L1). **[APP]**
- Load in **reverse stop order** and pass the gate (L2). One check per order, units expected vs loaded, chilled-zone marker, dock type per stop. The gate stays disabled until every order is checked or an exception is flagged. **[BOOKLET]**
- **Flag a loading shortfall before departure** (L3). Types: missing item, damaged item, wrong item, warehouse shortage, vehicle check failed, other. **[BOOKLET]**
- Show what changed since the last acknowledged version (L4). **[APP]**

**What this means for priorities:** judges look at the **phone** frames. The review's biggest single ask, redesigning the tablet L1.7 as master–detail, is worth doing *last*. Its cheap part, the header name, is worth doing first.

---

## Priority list

| # | Fix | Frames | Effort | Review score now |
|---|---|---|---|---|
| L-0 | Cross-role items X1, X3, X4 | L1.3, L1.S·3, L2.5, L3.4·A, L1.7 | S | n/a |
| L-1 | Dock list: same CTA on every card, clear progress label, departure countdown | L1.3, L1.4, L1.6 | S | 6.5 |
| L-2 | Held vehicle: name the failed check, give a next step, less red | L1.4, L2.5 | S | 6.5 |
| L-3 | Load plan: stop number on every row, one flag button, count-confirm per order, clear gate button | L2.1–L2.6, L2.S | M | 7 |
| L-4 | Offline chip overflow bug | L2.S·3 | S | 6.5 |
| L-5 | Short units: remove the duplicate wording, fix the contrast | L2.2 | S | 7.5 |
| L-6 | Loaded summary: units total + volume + chilled-zone check | L2.3–L2.4, L2.6·B | S | 8 |
| L-7 | Plan not acknowledged: contrast, plan summary, info tone | L1.1, L1.S | S | 7 |
| L-8 | PIN sheet: pick a name first (shared tablet) | L1.2·A/B/C, L2.3·B | S | 8.5 |
| L-9 | Flag sheet: lighter backdrop, wider "Other" chip | L3.1–L3.4 | S | 7.5 |
| L-10 | Plan changed diff: "Removed" is the loudest row | L4.1 | S | 8.5 |
| L-11 | Tablet layout (only after everything above) | L1.7 | L | 5.5 |

---

## L-1 · Dock: vehicles to load (6.5 → 8)

**Frames:** L1.3 "Dock: acknowledged, vehicles to load", L1.4 Held, L1.6·A/B (Kandy).
**What's there now:**
- VEH003 has a big yellow "Begin loading VEH003" button.
- VEH035 shows "Loading 3 / 5" with a small "Load" link.
- VEH011 shows "Not started".
- The check icon in the header has no label.
- There is a "Mock time" chip.

**Changes:**
1. **One CTA pattern for every vehicle card.**
   - The **next vehicle to depart** gets a primary full-width button: "Load VEH003 · departs 03:30".
   - Every other card gets a secondary full-width button: "Load VEH035".
   - Remove the "Load >" text links.
2. **Progress label.** Change "Loading 3 / 5" to **"3 of 5 orders checked"**, in Archivo 13 with the numbers in Mono.
3. **Departure countdown** on each card, at the right of the meta line: **"Departs 03:30 · in 3 h 20 min"**. The countdown uses the frame's own time, for example 00:10 on L1.3, so 3 h 20 min to 03:30.
4. **Label the header check icon.** Next to the plan chip, write "v3 · acknowledged by Priya 23:52". The info is already there ("v3 · Priya 23:52"); add the word "acknowledged".
5. Remove the "Mock time" chip (X1).

**Done when:** every vehicle card has the same kind of button, and a loader can tell in one glance which vehicle leaves first.

---

## L-2 · Held vehicle (6.5 → 8)

**Frames:** L1.4 "Dock: VEH003 Held", L2.5 "Load plan: held (VEH003)".
**What's there now:** "Held: waiting for Dispatch · Check failed 02:55". It doesn't say *which* check, gives no next step, and has heavy red on dark.

**Spec check:** the reefer swap is X2, *"VEH003 fails check (L3)"*: the reefer planned for two Colombo Fresh trips fails its check.

**Changes:**
1. **Name the failed check:** "Held: **reefer unit failed pre-departure check** at 02:55".
2. **Next step:**
   - Add a line under it: **"While Dispatch decides: load VEH035 next"**, with a secondary button **"Go to VEH035"** linked to VEH035's load list.
   - Keep "Dispatch is deciding" as the status.
3. **Less red.**
   - Card background goes from red fill to `surface-1`.
   - Keep a 3 px `danger` left border and a `danger` alert icon.
   - The status pill stays `danger-soft`.

**Done when:** the loader knows what failed and what to do next, without a phone call.

---

## L-3 · Load plan (7 → 8.5)

**Frames:** L2.1 in progress (VEH039, Kandy hero), L2.2 short units, L2.3·A all checked, L2.5 held, L2.6·A/B VEH036 reload, L2.S.
**What's there now:**
- "Load order · last stop in first" is correct [BOOKLET].
- The stop number "1" shows only on the active row.
- There are two flag buttons: one per row and one in the footer.
- One tap marks an order Loaded.
- There is no zone line.
- The gate button is disabled with low contrast.

**Changes:**
1. **Load position on every row.** Each order row starts with a badge "**Load 1st** · Stop 2" (and "Load 2nd", "Load 3rd"...). The load position comes from reverse stop order. For VEH039:
   - ORD2003 (OUT087, stop 2) = Load 1st;
   - ORD2002 (OUT084) = Load 2nd;
   - ORD2001 (OUT084) = Load 3rd.

   This removes the ambiguous "1".
2. **One flag button.** Remove the per-row flag icon. Keep the footer **"Flag issue"**, which opens L3 with the current order preselected.
3. **Count-confirm per order.** The row action becomes **"Load 12 units"**. Tapping it shows a stepper with the count prefilled to expected (12). Confirm sets "12 / 12 units · Loaded". Lowering the count leads to the L2.2 short-units flow. This matches the spec: "units expected vs loaded".
4. **Zone line** under each order: "**Chilled zone**" (spec: chilled-zone marker) plus the dock type of the stop, e.g. "Rear dock". Don't add bay numbers unless you add them to spec §4d first; they aren't in the booklet data.
5. **Gate button readable when disabled.**
   - Fill `surface-2`, label `ink-muted` (not 40% opacity), 1 px `line-strong` border.
   - Keep the reason under it: "Check ORD2001 or flag an issue first".

**Done when:** every row shows its load position, and each load needs a count.

---

## L-4 · Offline chip overflow (visible bug)

**Frame:** L2.S·3 "Offline: checks saved on tablet".
**Problem:** the "Saved on tablet" chip overflows the edge of the OUT087 card.
**Fix:**
1. Put the chip on its own line under "ORD2003 · 9 / 9 units", left-aligned.
2. Or shorten it to "Saved" with a `cloud` icon.
3. Set the card's auto-layout to *Hug* height so it grows instead of clipping.

**Also answer the reviewer's question in the banner:** *"Offline: checks are saved on this tablet. You can still clear the vehicle to depart; it syncs when back online."* That is a design decision [C]; add it to spec §4d and the L2 rationale.

**Done when:** nothing crosses a card edge at 390 px.

---

## L-5 · Short units (7.5 → 8.5)

**Frame:** L2.2 "Load plan: short units entry (VEH036)".
**Problems:**
- "Short · 4 short" says the same thing twice.
- There is yellow text on amber.

**Changes:**
1. Change the chip to **"4 short"** (Tag `warn`).
2. On the amber card, set the text to `ink` (not `warning` yellow), keep the icon in `warning`, and check 4.5:1 contrast. In Dark mode `signal-soft` (#3A2E10) with `ink` (#ECEEEC) passes.
3. Keep "Loaded 36 of 40", the stepper, and "Flag this to Dispatch?".

---

## L-6 · Loaded and cleared (8 → 9)

**Frames:** L2.3·A all checked, L2.4 loaded / cleared, L2.6·B VEH036 loaded.
**What's there now:** "Units 12 + 8 + 9 · Weight 170 kg".
**Changes:**
1. Show units as **"29 units (3 orders)"**, weight **"170 kg"** and volume. Take the m³ from spec §4c order sizes; add them to §4d if missing.
2. Add a checked row: **"Chilled zone checked · Ruwan 04:49"**.
3. Keep "Who already knows". The reviewer called it excellent.

---

## L-7 · Plan not acknowledged (7 → 8.5)

**Frames:** L1.1 "Dock: plan not acknowledged", L1.S states.
**Problems from the review:**
- Locked cards are grey on dark, which likely fails 4.5:1 contrast.
- There is no plan summary.
- A warning icon is used for a "ready" state.

**Changes:**
1. **Contrast:** locked card text uses `ink-muted` (#A2AAB0 on #161A1D passes AA), not a lighter grey at reduced opacity. Remove any opacity below 100% on text.
2. **Plan summary** above the Acknowledge button: **"Plan v3 · 4 vehicles · 17 orders · first departure 03:30"**. Check the counts against spec §4c; add them to §4d if they're mock.
3. **Tone:** "Plan v3 is ready" uses the **info** alert (route-soft, info icon), not warning.

---

## L-8 · PIN sheet: pick a name first (8.5 → 9)

**Frames:** L1.2·A entry, L1.2·B success, L1.2·C wrong PIN, L2.3·B "PIN sheet: Confirm VEH039 loaded".
**Why:** the tablet is shared [BOOKLET]. The PIN per person is a team choice [C], but the sheet never says *who* is acknowledging.
**Change:**
1. Add a row above the keypad titled **"Who's acknowledging?"** with 2–3 name chips: *Priya · Ruwan · Other…*. The selected chip uses route-soft with a route border.
2. Keep the keypad as it is; the reviewer rated it 8.5.
3. The success state says "Acknowledged by Priya · 23:52".

---

## L-9 · Flag exception sheet (7.5 → 8.5)

**Frames:** L3.1 choose type, L3.2·A/B details, L3.3·A/B sent, L3.4·A/B/C queued / error / sending.
**Problems:**
- The solid black backdrop hides the context behind the sheet.
- The "Other" chip is cramped.

**Changes:**
1. Backdrop: `chrome` at **60%** opacity, so the load list shows through.
2. Reason chips: give each chip a minimum width of 100 px and let "Other" span the full row if it's alone. Keep the spec's six types: missing item, damaged item, wrong item, warehouse shortage, vehicle check failed, other.

---

## L-10 · Plan changed diff (8.5 → 9)

**Frame:** L4.1 "Plan changed: diff v3 → v4".
**What's there now:** Changed (VEH003 → VEH036), Removed ("OUT009 · ORD1002: deferred (policy). Don't load."), Unchanged, and the new trip weight.
**Changes:**
1. **Order the rows by risk: Removed first, then Changed, then Unchanged.**
2. Give the Removed row the strongest style:
   - `danger-soft` background, 3 px `danger` left border;
   - "**Don't load ORD1002**" as the first line in bold;
   - the reason below it.
3. Strike-through text and the weight line (`950 / 1,040 kg · 6.3 / 7.0 m³`) use `ink`, not a faded grey.

---

## L-11 · Tablet layout L1.7 (5.5 → 8), last priority

**Frame:** L1.7 "Dock: tablet layout (1024×768)".
**Problems:**
- The header says "Waypoint Dispatch" (fix with X3, 1 minute).
- About two thirds of the screen is empty.

**Change (only if time remains after L-1 to L-10):** make it master–detail.
- **Left column, 360 px:** the vehicle list, reusing the L1.3 cards.
- **Right side:** the load list of the selected vehicle, reusing the L2.1 rows, with the gate button pinned at the bottom.

**Why last:** the booklet judges on phone-sized screens. This frame shows the design scales up, but it won't carry the score.

---

## Not taking these review suggestions

| Suggestion | Decision | Reason |
|---|---|---|
| Add bay numbers ("Bay 3") | **Only if added to spec §4d** | Bays aren't in the booklet data. The spec asks only for a chilled-zone marker and dock type. |
| Tablet master–detail first | **Last** (L-11) | The booklet judges phone screens; the header fix (X3) is the quick win. |

---

## Final checklist for this page

- ☐ X1, X3 and X4 are done on this page.
- ☐ L-1 to L-10 are done (L-11 only if there's time).
- ☐ Reverse-order load positions are right for VEH039 (ORD2003 → ORD2002 → ORD2001) and VEH036.
- ☐ The reefer swap reads end to end: L2.5 held 02:56 → L3 flag 02:55 → L3.3·B decision 03:02 → L4.1 diff 03:04 → L4.2 acknowledged 03:05 → L2.6·B loaded 03:25.
- ☐ Nothing crosses a card edge at 390 px width.
- ☐ Every text passes 4.5:1 contrast on the dark theme (check with a contrast plugin).
- ☐ Rationale paragraphs are updated under L1, L2, L3 and L4.
