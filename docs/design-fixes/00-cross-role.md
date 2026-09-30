# 00 · Cross-role fixes (do these first)

**Applies to:** every role page in the Figma file *NEXORA – TRIATHLON* (`0qCle1zCrSImSou4lVlvmL`): Dispatcher (`13:2`), Loader (`17:2`), Driver (`17:3`), Store Manager (`17:4`), plus the framing pages.
**Review scores:** Dispatcher 7 · Loader 7 · Driver 7.5 · Store Manager 7 (review of 27 Sep).
**Why this file comes first:** consistency across roles is worth **15%** of the score, and these items show up on every page a judge opens. Most are small, quick edits.

> **Deadline reminders (from the team plan):** design freeze **Tue 29 Sep 15:00**, submission target **20:00**, hard deadline **23:59** Sri Lanka time. The morning of Mon 28 Sep is the library checkpoint and the evening is the consistency check. Aim to finish this file before the evening check.

---

## How to make changes properly (all roles)

1. **Edit the library, not the copy.** If an element is an instance of a library component (Status pill, Tag, Button, Master order, ConnectivityBar), change the **main component** on *Shared Library Framing* (`158:2`). Every frame then updates at once. Never detach an instance to fix one frame, because that creates the inconsistency the judges mark down.
2. **Numbers, IDs and times come only from spec §4c.** If a fix needs a new number or name, first add it to spec §4d (assumptions) and tell the other three designers. Otherwise two roles will show different values.
3. **Check both ends of every handoff** (spec §5): the sender's screen shows the item was sent, and the receiver's screen shows it arrived, or clearly that it hasn't yet.
4. **Keep the prototype working.** After you move or rename a button, click through it in Present mode. The Dispatcher prototype has 983 links and four start points; don't delete a node that carries a link, edit it instead.
5. **Update the rationale paragraph** under the screen. The team plan requires one under every one of the 21 screens.
6. **No em dashes** (the long dash character) anywhere. The file was cleaned on 27 Sep; keep it that way (use a colon, a comma or a full stop).
7. **Tag every claim** on persona and rationale pages: [A] booklet · [B] inference · [C] our choice.

---

## Priority list

| # | Fix | Pages | Effort | Score impact |
|---|---|---|---|---|
| X1 | Resolve the "Mock data" chip question (decision needed) | all | S | High: the review names it first |
| X2 | Fill every placeholder | Driver, Dispatcher | S | High: judges spot these instantly |
| X3 | Give each role app its own name | Loader L1.7, Store S1.6, S2.11 | S | Medium |
| X4 | Explain the dark vs light theme choice | framing + role pages | S | Medium |
| X5 | Conflict pill: keep it distinct, make it read as a warning (decision needed) | library + all | S | Medium |
| X6 | Cut monospace from body text | all | M | Medium |
| X7 | Make the Forecast tab visibly land on screens | Dispatcher | S | **Very high**: the review scored it 2/10 |
| X8 | Hero consistency sweep (ORD2001 / ORD2002 identical everywhere) | all | M | High: part of the 15% |

---

## X1 · "Mock data" and "Mock time" chips: decision needed

**Review says:** remove them from every frame.
**Found in the file:**
- Dispatcher: 49 chips in 27 frames.
- Loader: 4.
- Driver: 14, including "(mock)" in frame names and text.
- Store: 14.

**Spec check:** the review's advice conflicts with your own spec. Spec §4d says *"screens that use it keep the Mock data tag until it is retired [APP]"*, and the team-plan checklist says *"Mock data tag where 4d says so."* The booklet itself says nothing about this; it is your team's rule.

**Recommendation:** retire the per-frame chips and disclose mock data **once**, in three places:
- Spec §4d: add *"Mock data is disclosed on the AI disclosure page (F17) and in the video; per-screen tags retired 28 Sep."*
- AI disclosure page (F17): add the row *"Order sizes, departures, driver names and aggregates are mock (spec §4d)."*
- Video script: one sentence in the assumptions section.

That keeps you honest and removes the noise the reviewer marked down.

**How to do it in Figma:**
1. Find every instance: select the page, press ⌘F / Ctrl+F, and search `Mock data`, then `Mock time`, then `(Mock)`.
2. Delete the chip. If it sits inside an auto-layout row, check the row doesn't collapse or shift (for example, D1's cutoff alert keeps its right padding).
3. For driver names written like "R. Silva (Mock)", delete the " (Mock)" suffix.
4. Frame *names* such as "R2.3 · B · 05:48 loader shortfall (mock)" can stay; judges don't read layer names.

**Done when:** a search for "Mock" on each role page returns only layer names, and F17 carries the disclosure.

---

## X2 · Fill every placeholder

| Placeholder | Where (found on 28 Sep) | Replace with |
|---|---|---|
| `[DISPATCH NUMBER]` | Driver **R1.S** (download failed), **R5.S·2** (sync failed), **R6.1** (problem chooser) | A **"Call Dispatch"** button with the subtitle "Peliyagoda dispatch desk". **Don't invent a real-looking phone number:** a number in a local format could belong to a real person. If you must show digits, use one that is obviously fictional and add it to spec §4d. |
| `VEH036 driver` | Dispatcher **D5.3**, **D5.4**, **D8.4** | **R. Silva**, the name already shown for VEH036 on the D6 live board, so the two roles agree. Add "R. Silva drives VEH036" to spec §4d. |

**Done when:** a search for `[`, `DISPATCH NUMBER` and `VEH036 driver` returns nothing.

---

## X3 · Give each role app its own name

**Problem:** the Loader tablet (L1.7) and Store desktop (S1.6, S2.11) headers say "Waypoint Dispatch", which is the dispatcher's product. A judge reads that as "the store manager is using the dispatch tool".

**Change:** use the names the shared library already defines (LIB3 App bar variants):

| Role | Header text |
|---|---|
| Dispatcher | Waypoint **Dispatch** |
| Loader | Waypoint **Load** |
| Driver | Waypoint **Driver** (phone top bar shows the tab title, so this only appears on sign-in or landing) |
| Store Manager | Waypoint **Store** |

**How:**
1. On the Loader and Store pages, find the text layer containing "Waypoint Dispatch".
2. Change only the second word, keeping the bold "Waypoint" and the signal diamond.
3. If the header is an App bar instance, swap it to the right variant instead: `Role=Loader tablet` or `Role=Store desktop`.

**Done when:** each role's desktop or tablet header names its own app.

---

## X4 · Dark vs light theme: explain it, don't unify it

**Review says:** "either unify them or explain the choice".
**Recommendation: explain it.** Changing Loader and Driver to light would cost hours and throw away a decision that comes straight from the booklet's working conditions:
- Loaders work a night shift at the dock [A].
- Drivers use a personal phone before dawn and then in sunlight [A].

The style guide already defines three modes: Light · office, Dark · pre-dawn, and Field · sunlight.

**Where to write it (one sentence each):**
- **Style guide page (F16):** add a line under the colour tokens: *"Theme follows the working environment, not the role: Light · office for desk work (Dispatcher, Store), Dark · pre-dawn for the dock and the road before sunrise (Loader, Driver), Field · sunlight for outdoor glare (Driver toggle, R1.9). Every theme uses the same tokens and components."* [C]
- **Loader and Driver persona pages (F5, F6):** one line in "Who and where", tagged [B].
- **Rationale paragraph** under L1.1 and R1.4.

**Done when:** a judge can find the reason on F16 without asking.

---

## X5 · The black "Conflict" pill: decision needed

**Review says:** replace it with amber so it matches the warning colour.
**Why that's risky:** amber is already taken twice in the 11-status set:
- **Departed** uses a solid amber fill.
- **Partial** uses the soft amber warning style.

An amber Conflict pill would look like one of them, and judges who check consistency would catch that instead.

**Recommended fix:** keep Conflict distinct but make it *read* as a warning:
1. On *Shared Library Framing*, open the **Status pill** component set and edit `State=Conflict`:
   - Fill: `signal-soft`.
   - Stroke: 1.5 px `signal`.
   - Icon: `alert` in `warning`.
   - Label: `ink`, SemiBold.

   This is amber-*toned* but outlined, so it isn't confused with Departed (solid) or Partial (no outline).
2. Store-facing copy says **"Under review"** instead of "Conflict". This is the spec's own wording: S2 state *"Conflict (under review)"*. See the Store file, fix S8.
3. Add one line to F16: *"Conflict is outlined so it stays distinct from Departed and Partial."*

**Alternative:** keep the black pill and just add the F16 line. That's the cheapest option, but the reviewer will probably still flag it.

---

## X6 · Monospace only for IDs, times and figures

**Rule:** IBM Plex Mono is for data only:
- order, outlet and vehicle IDs (ORD2001, OUT084, VEH039);
- times (05:42), durations (109 min), weights and volumes (950 / 1,040 kg);
- counts inside metrics.

Everything else is Archivo: sentences, labels, button text, reasons, names.

**How:**
1. On each page, select all text (Edit → Select all with the same font → IBM Plex Mono).
2. Go through the selection and switch any text that is a sentence or label to Archivo Regular 13 or 14.
3. Worst offenders flagged by the review: Dispatcher D2 capacity cards and D6 office context line. Also check Driver R1 stop meta lines.

**Done when:** no full sentence is set in mono.

---

## X7 · The Forecast tab (Dispatcher): the 2/10 score

**The review is wrong on the facts:** the screens exist. D9.1 *"Capacity outlook, 4 weeks"* and D9.2 *"Short week flagged"* are on the Dispatcher page, and the **Forecast** tab links to them in the prototype. The reviewer didn't connect "Forecast" in the nav with "Outlook" in the title.

**Fix (about 5 minutes):**
1. In D9.1, D9.2 and D9.S, change the overline to **"FORECAST · NEXT 4 WEEKS"** and the title to **"Forecast: which weeks will be short"**.
2. Rename the Figma section from "D9 · Capacity outlook" to **"D9 · Forecast"**.
3. Add to the D9.1 rationale: *"Answers the booklet's 'Plan future capacity' stage [A]. Baseline forecast from the competition data; festival_ramp and payday flags from calendar.csv [B]."*

**Done when:** clicking Forecast lands on a screen whose title says Forecast.

---

## X8 · Hero consistency sweep

Run the team plan's consistency checklist (Monday evening) after the fixes above:
- ☐ ORD2001 (chilled, 12 units) and ORD2002 (ambient, 8 units) for OUT084 look identical in every role: same Master order component, same chips, same IDs and times.
- ☐ Hero times match spec §4c everywhere:
  - H1 15:40 order · H2 16:00 cutoff · H4 23:40 release v3 · v4 03:00;
  - H5 04:15 · H6 04:50 loaded · H7 04:55 driver ack · H8 05:10 departed;
  - H9 05:17 offline · H10 05:20 store call · H11 05:21 defer v5;
  - H12 05:26 arrive/wait · H13 05:42 delivered · H14 05:58 OUT087;
  - H15 06:40 conflict · H16 06:44 resolved · H17 07:30 receipt.
- ☐ The reefer swap X1–X6 reads end to end: L2 → L3 → D6 → D8 → L4 → L2 (02:45, 02:55, 03:00, 03:05, 03:25, 03:30).
- ☐ The deferral at 05:21 is typed **store request** in every role (D4.4, D6.3, D7, S2.6, R5, L-none).
- ☐ Driver and vehicle names agree: Nimal / VEH039, R. Silva / VEH036, Ruwan at Kandy dock, Priya at Peliyagoda dock.

---

## Review suggestions we are not taking (and why)

| Suggestion | Decision | Reason |
|---|---|---|
| Unify all roles to one theme | **No**, explain instead (X4) | The theme follows booklet working conditions; changing it costs hours and weakens the rationale. |
| Make Conflict amber | **Modified** (X5) | Amber collides with Departed and Partial in the 11-status set. |
| Remove Mock data without disclosure | **Modified** (X1) | Your spec requires mock data to be disclosed; move the disclosure to F17. |
| Use the review's prompts as written | **No** | They point to a different Figma file key (`fmn11aJe8kUYbJdsgZuUNi`). Your file is `0qCle1zCrSImSou4lVlvmL`. |
