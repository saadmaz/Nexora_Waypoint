# 01 · Dispatcher (Kumari) · design fixes

**Figma page:** Dispatcher (`13:2`) in *NEXORA – TRIATHLON* (`0qCle1zCrSImSou4lVlvmL`). 1440×900 desktop frames, grouped in sections D1 to D9. The main flow runs along the top row; Empty, Loading, Offline and Error states sit in the row below.
**Review score:** 7 / 10 (9 screens rated). **Target:** 8.5+.
**Do the cross-role file first** (`00-cross-role.md`). X1 (mock chips), X2 (VEH036 driver name), X6 (monospace) and X7 (Forecast) all touch this page. X7 alone lifts the lowest-rated item from 2/10.

---

## What the booklet asks of the dispatcher

These come from spec §3; tags show where each requirement comes from:
- Large screen, Peliyagoda planning office, stable connectivity. **[BOOKLET]**
- One confirmed queue at cutoff, with carry-overs first. **[BOOKLET]**
- Explain deferrals: this is the booklet's objective. Two measures (impact on the outlet, capacity freed on the binding resource), **never a score**. **[BOOKLET][DECIDED]**
- See progress and problems after departure: exception-first live board, **no map**. **[BOOKLET][DECIDED]**
- Resolve a pre-departure failure before the vehicle leaves (D8). **[BOOKLET]**
- "Plan future capacity" is a workflow stage (D9 Forecast). **[BOOKLET][DECIDED]**

Any fix below that would break one of these has been dropped or modified; see "Not taking" at the end.

---

## Priority list

| # | Fix | Frames | Effort | Review score now |
|---|---|---|---|---|
| D-0 | Cross-role items X1, X2, X6, X7 | many | S–M | Forecast 2 |
| D-1 | Queue: flag ORD1020 at risk, readable disabled button, fuller table, useful Received column | D1.1–D1.4, D1.S | M | 6.5 |
| D-2 | Live board: counts that add up, lateness risk, one pill per stop, no Defer on delivered | D6.1–D6.8, D6.S | M | 6.5 / 7 |
| D-3 | Trip board: "Move to…" only on the selected row, one legend, richer deferred panel | D3.1–D3.8, D3.S | M | 7 |
| D-4 | Refused move: anchor the popover beside the row | D3.3–D3.5 | S | 8 |
| D-5 | Deferrals: "Impact on store", one card pattern, "Serve instead…", clear button order | D4.1–D4.5, D4.S, D8.2–D8.S | S | 8.5 |
| D-6 | Release: countdown and Call on every pending acknowledgement | D5.3, D5.4A/B | M | 8 |
| D-7 | Capacity: fleet vs vehicle labels, fill dead space, less red | D2.1–D2.4, D2.S | S | 8 |

---

## D-1 · Order queue (6.5 → 8)

**Frames:**
- "Dispatcher queue before cutoff" (D1.1)
- "Dispatcher queue after cutoff" (D1.2)
- "Kandy depot queue" (D1.3)
- "Queue filters open" (D1.4)
- D1.S Empty, Loading, Offline and Error

**Problems from the review:**
- Only 5 of 212 rows are shown.
- The Received column is empty on D1.1.
- The "Kandy 64" count repeats the depot toggle.
- The disabled "Go to capacity board" button has low contrast.
- ORD1020 is not flagged, though it has no legal vehicle.

**Booklet check:**
- ORD1020 is the spec's **capacity-group deferral** (spec §3 D4: "Capacity group: ORD1020"), because it is van-only at 8.6 m³ and no van can carry it. Flagging it at the queue stage shows the system catching the problem early, which directly supports "explain deferrals" [BOOKLET].
- Search and filters already exist (D1.4). The reviewer looked at D1.1, where the toolbar is present but not obviously interactive.

**Changes:**
1. **At-risk flag on ORD1020.** In the Status cell of the ORD1020 row:
   - Add a `warning`-tone Tag reading **"No legal vehicle"**.
   - Under it, add the reason line (Archivo 12, `ink-muted`): *"Van only · 8.6 m³ · no van free on Tue 29 Sep"*.
   - Give the row a `signal-soft` left border, 3 px.
2. **Replace the "Kandy 64" chip meaning.** Keep the depot counts: they switch depot, and D1.3 is linked from them. Add one KPI chip to the left of the depot switch in the table toolbar:
   - **"At risk: 1"**, Tag `warn`, with an `alert` icon.
   - Clicking it filters to ORD1020 (link it to D1.4 in the prototype).
3. **Fuller table.** Add 7 more Confirmed rows to D1.2 and D1.3 so the table reaches the bottom of the viewport. Use the same row component and copy existing IDs from spec §4c where available. Where you need new IDs, use ORD1021–ORD1027 and add them to §4d. Update the footer to "Showing 12 of 212 confirmed Peliyagoda orders".
4. **Received column.** On D1.1 (before cutoff), fill Received with each order's time, for example ORD1002 "14:02" and ORD1020 "15:12", in Mono 12 `ink-muted`. On D1.2 it already shows "2 days since served" for carry-overs and "16:07" for the after-cutoff order, so keep that. Don't delete the column: D1.2 needs it.
5. **Disabled button contrast.** On D1.1, "Go to capacity board" is disabled before cutoff:
   - Change the fill to `surface-2` and the label to `ink-muted`, with a 1 px `line-strong` border, instead of 40% opacity.
   - Add a hint under the button: *"Opens at cutoff, 16:00"*.
6. **Sortable headers.** Add a 12 px `chevron-down` icon (`ink-muted`) next to Order ID, Window, Units, Kg and M³ on all D1 frames. This is visual only; no new frames are needed.

**Done when:**
- ORD1020 stands out in two seconds.
- The table fills the frame.
- No column is empty on the main D1.2.

**Also update:**
- The D1.2 rationale: "ORD1020 is flagged before planning because no legal vehicle exists [B]".
- The React screen `frontend/src/screens/d1/`.

---

## D-2 · Live operations (6.5 / 7 → 8.5)

**Frames:**
- D6.1 Normal morning
- D6.2 Driver offline
- D6.3 Defer stop dialog
- D6.4 Change pending
- D6.5 Conflict in inbox
- D6.6 Resolved + receipt
- D6.7 VEH003 held
- D6.8 Nothing needs attention
- D6.S

**Problems from the review:**
- The table shows 4 vehicles but the KPI says "14 of 38".
- There is no lateness-risk column.
- Order status pills are duplicated.
- "Both depots" text conflicts with the depot toggle.
- "Refresh" and "Live sync" do the same job.
- The Issues KPI stays 0 during the conflict.
- Delivered stays 22 from 05:12 to 06:40.
- "Defer stop" is offered on a delivered stop.

**Booklet check:**
- The spec says **no map** [DECIDED] and **counts replace the dashboard** (+B). Don't add a map.
- A lateness-risk column fits the booklet's Datathon Task 1 (predicting delivery time) and needs no new data, since the spec already has planned ETAs and windows.
- **Careful with Delivered:** VEH039 is offline 05:17–06:40, so dispatch *cannot* know about ORD2001 and ORD2002 before 06:40. Holding their count is correct. What's wrong is that *other* vehicles' deliveries don't grow the number either.

**Changes:**
1. **Counts that add up.** Above the vehicle table, add a caption (Archivo 12, `ink-muted`): *"4 of 14 departed shown · needing attention first · Show all"*. "Show all" is a ghost link; it needs no frame.
2. **Delivered KPI by time.** Use this progression, adding the numbers to spec §4d:

   | Frame | Time | Delivered |
   |---|---|---|
   | D6.1 | 05:12 | 22 |
   | D6.2 | 05:19 | 23 |
   | D6.4 | 05:22 | 24 |
   | D6.5 | 06:40 | 31 |
   | D6.6 | 06:44 | 33 (incl. ORD2001 + ORD2002) |

   From 05:22 on, add a foot note: "VEH039 records pending sync".
3. **Issues KPI.** On D6.5, set the value to **1** and the foot to "1 conflict needs a decision" in `danger`. On D6.6, reset it to **0** with "Resolved 06:44".
4. **Lateness risk column.** Insert it between Next stop and Stops, 110 px wide:
   - Values: **On time** (Tag `success`), **At risk** (Tag `warn`), **Late** (Tag `danger`).
   - VEH039: *On time* until 05:17, then *Unknown · offline* (Tag outline, `wifi-off` icon).
   - All other vehicles: On time.
   - On D6.7, VEH003: "Held".
5. **One status pill per stop.** Keep the pill in the stop row. Remove the second pill from the order sub-row, leaving only the order ID and the brand and temperature tags.
6. **No Defer on delivered stops.** Where a stop's status is Delivered (D6.6, and D6.5 once ORD2001 syncs as delivered):
   - Replace "Defer stop" with a disabled ghost button "Delivered" with a `check` icon, or remove it.
   - Keep "History".
7. **One live signal.** Remove the "Refresh" button from D6.1–D6.8 and keep "Live sync" in the app bar. In D6.S Offline and Error, the Refresh button stays: it's the recovery action there.
8. **Depot text.** In the app bar context, replace "Tue 29 Sep · both depots" with "Tue 29 Sep" and let the depot toggle carry the depot. If D6 genuinely shows both depots, make the toggle a third option "Both" (selected) instead.

**Done when:**
- Every number on the board agrees with every other number in the same frame and with the frame's time.
- No delivered stop can be deferred.

**Also update:** the rationale on D6.5: "Issues counts open conflicts; Delivered updates as vehicles sync [C]."

---

## D-3 · Trip board (7 → 8)

**Frames:** D3.1 draft, D3.2 accepted move, D3.6 Move-to dialog, D3.7 Why this vehicle, D3.8 released, D3.S.

**Problems from the review:**
- 151 "Move to…" buttons (about 20 per frame).
- "One brand · one district" repeats 50 times.
- There is no time view.
- The deferred panel shows only IDs.

**Booklet check:** spec D3 says "Drag or 'Move to…'; consequence preview while hovering". Showing the button on hover or selection matches that exactly.

**Changes:**
1. **"Move to…" only where it matters.** In each frame, keep the button on **one row**: the selected or hovered row. In D3.1 that's the ORD1009 row, the refused-move example. Delete it from every other row.
   - **Prototype:** before deleting, check which "Move to…" buttons carry links. Keep the linked one; it opens D3.6. Every row still accepts drag.
   - Add a one-line hint under the board header (Archivo 12, `ink-muted`): *"Drag an order, or select it and press Move to…"*.
2. **One legend instead of 50 repeats.**
   - Remove "One brand · one district" from every trip card.
   - Add one legend line at the top of the board: *"Every trip carries one brand and one district [booklet rule]"*, using a `route` icon and Tag outline.
   - Where a trip breaks the rule (the refused moves), keep the rule text in the refusal.
3. **Richer deferred panel.** Each deferred item gets three lines:
   - `ORD1009 · OUT014` (Mono)
   - a brand tag and a temperature tag
   - the binding tag (e.g. "Reefer minutes")

   Keep the existing Deferred pill.
4. **Time strip (optional, only if time allows).** Under each trip card header, add a 6 px bar spanning the trip's departure to its last arrival, with a tick per stop ETA and a light band for each stop's window. This is lower value per hour than items 1–3.

**Done when:** a judge's eye goes to trip loads and the deferred pool, not to button noise.

---

## D-4 · Refused move popover (8 → 9)

**Frames:** D3.3 window rule, D3.4 two rules broken, D3.5 continuity guard.
**Problem:** the refusal popover covers the trip it refers to.
**Change:**
- Move the popover so it sits **to the right of the dragged row**, with a 12 px gap and an arrow pointing at the row.
- If the target trip is in the rightmost lane, place it to the left instead.
- Keep every broken rule listed, with the spec wording:
  - ORD1009 → VEH003 trip 2: *"planned arrival 08:06 is after OUT014's window closes at 08:00"*.
  - ORD1002 → VEH011 trip 1: *"chilled order needs a reefer · trip would carry two brands (Style, Fresh)"*.

**Done when:** the popover and the target trip are both fully visible.

---

## D-5 · Deferrals (8.5 → 9+)

**Frames:** D4.1 plan v3, D4.2 detail drawer, D4.3 v4 adds ORD1002, D4.4 store-request group (Kandy), D4.5 all notified, D4.S; also D8.2–D8.S, which use the same card.
**Problems from the review:**
- "Harm" is unclear.
- Cards expand differently.
- There is no manual override.
- The order of "Notify stores" and "Confirm and release" is unclear.

**Booklet check:** spec rule, *"Show reasons, never a score."* Renaming "Harm" keeps the two separate measures; it does **not** introduce a score.

**Changes:**
1. **Rename "Harm" to "Impact on store"** in all 22 places (D4 and D8). Search `Harm` on the page. Keep the values ("Low · ambient", "Equal · chilled" and so on).
2. **One card pattern.**
   - **Collapsed:** header row (ID · outlet · brand · deferred pill) plus a one-line reason.
   - **Expanded:** the three-cell grid (Impact on store · Frees · Next run) plus actions.

   Every card expands the same way. Show ORD1002 expanded on D4.3 and all others collapsed.
3. **"Serve instead…"** as a ghost button on each expanded card. It opens the trip board with this order selected; link it to D3.6 (Move to dialog) in the prototype. This is the manual override, and it keeps "the system proposes, a person decides" [DECIDED].
4. **Button order.**
   - **Confirm and release** is the primary button, on the right.
   - **Notify stores** is secondary, on its left, with the hint *"Notices also go out automatically on release"*.

   If notices really do go out on release, that hint removes the ordering question entirely. Add it to spec §4d.

**Done when:** every card reads the same, and a judge can tell which button to press first.

---

## D-6 · Release, acknowledgements pending (8 → 9)

**Frames:** D5.3, D5.4A, D5.4B.
**Problems from the review:**
- There is no departure countdown.
- Only Kandy dock has a Call action.
- "VEH036 driver" is unnamed (fixed by X2).
- The lower half of the screen is empty.

**Changes:**
1. **Acknowledgement list as a table.** Columns: Person · Role · Vehicle/dock · Plan they have · Departs in · Action.
   - Rows follow spec §3 D5: Priya (Peliyagoda dock), Ruwan (Kandy dock), Nimal (VEH039), R. Silva (VEH036), plus other drivers as a collapsed "+7 drivers" row.
   - "Departs in" is a mono countdown against the vehicle's departure, for example VEH036 "in 1 h 20 min" at the D5.3 time.
2. **Call on every row.** Use a ghost button with a `phone` icon and the label "Call".
3. **Use the empty space.** Move the version history (v1–v3, later v4 and v5) into the lower half as a compact list; the spec lists version history under D5.

**Done when:** the lower half of the frame carries information and every pending person has an action.

---

## D-7 · Capacity board (8 → 9)

**Frames:** D2.1 draft Peliyagoda, D2.2 Kandy, D2.3 spare reefer appears, D2.4 released, D2.S.
**Problems from the review:**
- The Style+Tech and Fuel cards are tagged with one vehicle.
- The bottom cards are half empty.
- There is too much red and too much monospace.

**Booklet check:** spec §3 D2 says these two cards are *samples*: "Style+Tech sample VEH011 83 / 480 min. Fuel sample VEH003 74.2 / 480 L." The fix is to *label* them as samples, not to change the data.

**Changes:**
1. Change the card titles:
   - **"Style + Tech minutes · busiest vehicle: VEH011"**
   - **"Fuel quota · closest to limit: VEH003"**

   This makes clear they are the worst case, not the fleet total.
2. Fill the bottom cards: add a second line to each, for example *"All other vehicles under 60%"* and *"Weekly quota resets Mon"*. If that still leaves them half empty, reduce their height to fit the content.
3. **Red only for the binding constraint.** Keep red on the reefer Fresh minutes (120%, 430 short). Turn everything else that is not over its limit to `ink` or `route`.
4. Apply X6: remove monospace from the card sentences.

**Done when:** red appears in one place, and the cards have no empty half.

---

## Not taking these review suggestions

| Suggestion | Decision | Reason |
|---|---|---|
| Add a map to D6 | **No** | The spec explicitly says "Exception-first live board, **no map** [DECIDED]", because there is no GPS in the booklet data. Adding a map contradicts your own rationale. |
| Remove the Received column | **No**, fill it (D-1.4) | D1.2 uses it for carry-over age and the after-cutoff arrival time. |
| Replace the "Kandy 64" depot count with a KPI | **Modified** | The count is part of the depot switch, which is a prototype link to D1.3. Add "At risk: 1" beside it instead. |
| Build a new "D7 Forecast" screen | **No** | D9 already is the forecast (see X7). A new "D7" would also clash with the existing D7 Reconciliation. |

---

## Final checklist for this page

- ☐ X1, X2, X6 and X7 from the cross-role file are done on this page.
- ☐ D-1 to D-7 are done; each frame's rationale paragraph is updated.
- ☐ The prototype works: run all four flows in Present mode ("1 · Plan the night", "2 · Reefer swap at the dock", "3 · Driver offline, plan changed", "4 · Capacity outlook", renamed to "Forecast"). Every click lands on the right frame.
- ☐ The presenter keys still work on each section's main screen: L = loading, O = offline, E = error, N = empty, R = the refused moves.
- ☐ No "Mock", "[", "Harm" or "VEH036 driver" left on the page.
- ☐ **Code:** mirror each change in `frontend/src/screens/dN/` on branch `feature/dispatcher-frontend`.
