# 04 · Store Manager (Anusha, OUT084 Waypoint Fresh, Kandy) · design fixes

**Figma page:** Store Manager (`17:4`) in *NEXORA – TRIATHLON* (`0qCle1zCrSImSou4lVlvmL`). The frames are 390×844 phone, plus 1280×800 desktop (S1.6, S2.11). Theme: **Light · office**.
**Review score:** 7 / 10 (10 screens rated). **Target:** 8.5+.
**Do the cross-role file first** (`00-cross-role.md`):
- X1: 14 mock chips, in S1.1, S1.2, S1.5·A/B/C, S1.6 and S2.10.
- X3: the "Waypoint Dispatch" header on **S1.6 and S2.11**.
- X5: Conflict pill.

---

## What the booklet asks of the store manager

These come from spec §3; tags show where each requirement comes from:
- Outlet counter, **desktop or phone**. Today store managers order by phone with **no confirmation, no arrival time and no deferral notice**. **[BOOKLET]**
- **S1 Place order:** the order is confirmed before the cutoff. Delivery date, cutoff countdown, chilled and dry as **two orders**, and an acknowledgement "Received 15:40 · counts for Tue 29 Sep". **[BOOKLET]**
- **S2 Deliveries:** know what is coming, and when or why not. Status chip, window-aware arrival, deferral notice with type, reason and next run, and the delivery record.
  - States: Confirmed · Planned · Loaded · Departed · Deferred · **Conflict (under review)** · Delivered + Deferral withdrawn. **[BOOKLET]**
- **S3 Receipt:** confirm what arrived, or raise an issue tied to the POD.
  - Issue types: missing, damaged, wrong item, late, other.
  - "Dispatch asks: did you receive this?" **[BOOKLET]**

The spec's own wording, **"Conflict (under review)"**, settles the reviewer's jargon complaint: store screens should say **Under review**.

---

## Priority list

| # | Fix | Frames | Effort | Review score now |
|---|---|---|---|---|
| S-0 | Cross-role items X1, X3, X5 | S1.1, S1.2, S1.5, S1.6, S2.10, S2.11, S2.7, S3.6 | S | n/a |
| S-1 | Conflict in plain words: "Under review" + what "Yes" does | S2.7, S3.5, S3.6 | S | **5.5** |
| S-2 | Desktop: store app name, CTA in a summary panel, review step, clickable rows | S1.6, S2.11 | M | **6** |
| S-3 | Review sheet: remove the confusing duplicate-order warning | S1.2 | S | 6.5 |
| S-4 | Deliveries: page title, Rear dock as a tag, "receivers ready by 05:30" | S2.1–S2.11 | S | 8.5 |
| S-5 | Received: stronger "Ordered" chips, edit-until and ETA timing | S1.3 | S | 7.5 |
| S-6 | After cutoff: say it's placed for Wed | S1.4 | S | 7 |
| S-7 | Place order: window and dock on the form, urgent countdown | S1.1 | S | 8 |
| S-8 | Offline: standard Pending sync chip + queued time | S1.5·A | S | 8 |
| S-9 | Confirm receipt: inline counts, neutral "Report issue" | S3.1 | S | 7.5 |
| S-10 | Report issue: "Arrived warm" for chilled, both orders selectable | S3.3 | S | 7 |

---

## S-1 · Conflict in plain words (5.5 → 8.5), the biggest gain on this page

**Frames:** S2.7 "Deliveries: Conflict, Dispatch reviewing" (06:41), S3.5 "Dispatch asks: did you receive this?", S3.6 "Receipt confirmed while conflict still open".
**What's there now:**
- A "Conflict" pill on ORD2001 and ORD2002.
- "Delivery recorded 05:42, received by S. Fernando. Dispatch is reviewing."
- The question "Did you receive this delivery?" with the buttons "Yes, we received it" and "Report issue".

**Changes:**
1. **Pill:** replace "Conflict" with **"Under review"**, using the outlined-amber style from X5. Store users never see the word Conflict; that matches spec S2 "Conflict (under review)".
2. **Explanation**, in a `route-soft` info card above the question:
   > **Why you're seeing this**
   > You asked Dispatch at 05:20 to hold today's delivery. The driver had no signal and delivered at 05:42, and S. Fernando signed for it. Dispatch is checking which record to keep.
3. **Say what the buttons do:**
   - **"Yes, we received it"**, with the helper "Dispatch keeps the delivery. No second trip on Wed."
   - **"Report issue"**, with the helper "Tell Dispatch what's wrong with what arrived."
4. **S3.6** (receipt confirmed while the conflict is open): use the same card, with the line "Your receipt is saved. Dispatch will close this by 07:00." Keep the time consistent: the hero resolves at 06:44, so on frames after 06:44 show "Resolved" instead.

**Done when:** a store manager who has never heard "conflict" understands the situation and the effect of each button.

---

## S-2 · Desktop (6 → 8.5)

**Frames:** S1.6 "Place order: desktop" (15:38), S2.11 "Deliveries: desktop" (07:28).
**Problems:**
- The header says "Waypoint Dispatch".
- The CTA is orphaned.
- There is no review step.
- The recent-order rows aren't clickable.

**Changes:**
1. **Header:** "Waypoint **Store**" (X3). Swap the App bar instance to `Role=Store desktop` if it's a library instance.
2. **Summary panel** in the right column, under the cutoff card:
   - "2 orders for Tue 29 Sep";
   - Chilled 12 units (≈ 70 kg · 0.7 m³);
   - Dry 8 units (≈ 45 kg · 0.6 m³);
   - Window 05:30–08:00 · Rear dock;
   - the primary **"Review 2 orders"** button.

   The CTA now belongs to something.
3. **Review step:** duplicate the S1.2 review sheet as a centred 560 px modal over S1.6 (new frame "S1.6 · B · review"), and link "Review 2 orders" → modal → "Place orders" → S1.3.
4. **Clickable rows:** in the recent-orders table, each row gets a `chevron-right` and a prototype link to S2.x for that order.

---

## S-3 · Review sheet (6.5 → 8.5)

**Frame:** S1.2 "Place order: review before submit" (15:39).
**Problem:** the message "You already have a dry order for Tue, add to it instead?" appears while Anusha is placing her dry order (8 units) for the first time. In the hero story there is no earlier order, so the warning is wrong for this frame.
**Change (recommended):** **remove the duplicate warning from S1.2.** The booklet doesn't ask for duplicate detection, and it contradicts the hero data. The review sheet then shows:
- "Check your orders";
- 12 units chilled, 8 units dry;
- "Tue 29 Sep · window 05:30–08:00 · Rear dock";
- the buttons **Place orders** (primary) and **Edit** (secondary).

**Alternative (only if the team wants duplicate detection):**
1. Keep S1.2 clean.
2. Add a separate state frame "S1.2 · B · existing order".
3. Use explicit copy: "You already placed a dry order today: 6 units at 14:10."
4. Offer two equal buttons: **"Add 8 to that order"** and **"Place separately"**.
5. The earlier order's ID must be added to spec §4d (no "xx" placeholders).

---

## S-4 · Deliveries timeline (8.5 → 9)

**Frames:** S2.1 Confirmed (16:01) through S2.10 recent orders, S2.S.
**Changes:**
1. Add a **page title "Deliveries"** at the top of each S2 frame (Archivo 22 Bold), above the day card.
2. **"Rear dock"** becomes a non-interactive **Tag**: square corners, `line-strong` outline, no shadow, no hover style. It currently looks like a button.
3. Add a **staff cue** line on S2.2 (Planned, 23:41) through S2.5, with a `user` icon:
   - **"Have receivers ready by 05:30"**;
   - under it, "Truck may arrive 05:26 and wait".

   This is taken from the arrival range, window 05:30–08:00, H12.

---

## S-5 · Received acknowledgement (7.5 → 8.5)

**Frame:** S1.3 "Received acknowledgement" (15:40).
**Problems:**
- The "Ordered" chips look disabled.
- There's no "edit until" and no ETA timing.
- There's a lot of empty space.

**Booklet and consistency check:** "Ordered" is one of the 11 statuses. Its library style is **neutral** (grey), shared by all roles. Making it teal, as the review suggests, would make it look like **Planned**, which is a different status.

**Changes:**
1. Keep the neutral style, but **strengthen it:** ink text (not muted), a `clock` icon, 100% opacity. It now reads as a status, not as disabled.
2. Under the order list, add:
   - **"You can edit until 16:00"** (22 min left at 15:38);
   - **"Arrival time is shown after the plan is released at 23:40"**.
3. Fill the empty space with a "What happens next" mini-timeline:
   - 16:00 confirmed → 23:40 arrival time → 05:30–08:00 delivery.
   - Reuse the JourneyTimeline component from the library (LIB5).

---

## S-6 · After cutoff (7 → 8.5)

**Frame:** S1.4 "After cutoff" (16:07).
**Problem:** it's unclear whether the card is a draft or already queued.
**Spec check:** after cutoff, the order moves to the following run with an After cutoff tag. That means it **is** placed, for Wed.
**Change:**
- Give the card the badge **"For Wed 30 Sep · After cutoff"**.
- Keep the button "Place order for Wed 30 Sep".
- After tapping it, the state reads "**Placed for Wed 30 Sep** · Received 16:07".

The review's "Not placed yet" label only applies *before* the tap. Use it on this frame as the card's top-left status, then show the placed state after the tap.

---

## S-7 · Place order (8 → 9)

**Frame:** S1.1 "Place order: before cutoff" (15:38).
**Changes:**
1. Remove the Mock data chips (X1).
2. Under the date, add **"Window 05:30–08:00 · Rear dock"**.
3. **Countdown urgency** in three stages:
   - more than 30 min: info (route-soft);
   - 30 min or less: warning (signal-soft), which is S1.2's "22 min left" state;
   - **15 min or less: danger (danger-soft)**, reading "Orders close at 16:00 · **12 min left**".

   Add the ≤15 min variant as a new state frame only if time allows; otherwise document it in the rationale.

---

## S-8 · Offline, error, loading (8 → 8.5)

**Frame:** S1.5·A "Offline: not sent".
**Change:**
- Use the standard **Pending sync** status pill (offline grey, `cloud` icon) from the 11-status set.
- Add the line **"Queued 15:38 · sends automatically when you're back online"**.
- If the cutoff is under 30 min away, add a warning alert: "Reconnect before 16:00 or this order moves to Wed".

This keeps the status vocabulary consistent (X8) while making the urgency clear.

---

## S-9 · Confirm receipt (7.5 → 8.5)

**Frame:** S3.1 "Receipt: to confirm (POD)" (07:28).
**Changes:**
1. **Inline counts:** each order row's "12 / 12" becomes a compact stepper (− 12 +). Lowering it switches the primary button to "Confirm with a shortfall" and opens S3.3 prefilled with "Missing".
2. **"Report issue"** becomes a **neutral secondary** button (`line-strong` border, `ink` text), not a red outline. Red reads as destructive.
3. The POD photo placeholder gets a realistic grey photo tile with a camera icon and "Photo · 05:42 · S. Fernando". Don't use a stock photo of real people or real brand packaging.

---

## S-10 · Report issue (7 → 8.5)

**Frame:** S3.3 "Report issue sheet" (07:31).
**What's there now:** Missing · Damaged · Wrong item · Late · Other. These match the spec. There is one affected order at a time.
**Changes:**
1. Add **"Arrived warm"** (`snowflake` icon) as a reason, shown only when a **chilled** order (ORD2001) is selected. It matters for chilled Fresh goods [B]. Add it to spec §3 S3 issue types as [C].
2. **Affected orders:** make the chips multi-select, so both ORD2001 and ORD2002 can be ticked. Units affected appear per selected order.

---

## Not taking these review suggestions

| Suggestion | Decision | Reason |
|---|---|---|
| "Ordered" chips in teal | **No**, strengthen the neutral style (S-5) | Teal is **Planned** in the shared 11-status set; changing it breaks cross-role consistency (15% of the score). |
| "Being checked" pill | **Modified:** "Under review" | "Under review" is the spec's own wording for this state. |
| Duplicate-order warning with "ORD19xx" | **No placeholder IDs** (S-3) | Remove the warning, or use a real mock ID recorded in spec §4d. |

---

## Final checklist for this page

- ☐ X1, X3 and X5 are done on this page.
- ☐ S-1 to S-10 are done (the S-7 ≤15 min frame only if there's time).
- ☐ No "Conflict" word is visible anywhere on store screens; they say "Under review".
- ☐ Hero times on store screens:
  - 15:40 received · 16:00 confirmed;
  - 23:41 planned (arrives from 05:30) · 04:51 loaded · 05:11 on the way;
  - 05:19 out of coverage · 05:22 deferred at your request;
  - 06:41 under review · 06:45 delivered + deferral withdrawn · 07:30 receipt.
- ☐ Both desktop frames say "Waypoint Store".
- ☐ Every CTA has a prototype link.
- ☐ Rationale paragraphs are updated under S1, S2 and S3.
