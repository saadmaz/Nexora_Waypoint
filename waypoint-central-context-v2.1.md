# Waypoint prototype: central context for the team

Status as of Tue 29 Sep 2026, 19:00 · Team Nexora · maintained by HH

**Read this first.** This file gives any teammate (or their Claude) the whole picture in one place: what we are building, what is decided, where everything lives, the rules we follow, and what is still open. For requirements detail, the source of truth is **`waypoint-prd-v2.1.md`** in this project (it supersedes `claude/waypoint-prd-v2.md`).

---

## 1. The competition

- **rootcode Tech-Triathlon 2026**: one business case (Waypoint Group, a fictional Sri Lankan retail group), three phases, each worth a third of the score.
- **Designathon** (current phase): due **Tue 29 Sep 2026, 23:59** Sri Lanka time. Design freeze was Tue 15:00; submission target 20:00. Only fixes since the freeze.
- **Hackathon**: due Sun 4 Oct, 23:59. Must build what the Designathon designed; judges check continuity, and departures must be documented in the README.
- **Datathon**: due Fri 9 Oct, 23:59. Separate notebook; not wired into the app.
- **Designathon deliverables** (booklet): one persona per role; screen flows with a one-paragraph rationale per screen; at least one fully designed degradation screen with name and rationale; a high-fidelity prototype; a 3 to 5 minute unlisted YouTube video covering the workflow and assumptions; AI tool disclosure; optional core tradeoff page and style guide. Export as `Nexora_Designathon`, zipped as `Nexora_Designathon.zip`.
- **Designathon judging**: problem framing 25%, user context 20%, degradation screen 15%, scope and prioritization 15%, visual and interaction design incl. cross-role consistency 15%, domain accuracy 10%.
- **Data confidentiality** (booklet): never upload the competition CSVs to external websites, public repos or third-party tools.

## 2. The product in one paragraph

Waypoint's shared fleet can't serve all three brands (Fresh, Style, Tech) on most days, so the product makes every deferral **deliberate, explained and visible to every role**. One order record moves from the store's order to the store's receipt across four roles. After the 16:00 cutoff the system drafts tomorrow's plan; the dispatcher edits it with every rule checked live. **Capacity forces how many orders wait; policy chooses which**, and each deferral carries typed reasons, never a score. Plans are versioned and acknowledged by loaders and drivers. Field work records offline and reconciles on reconnect: **the system recommends, a person confirms**.

## 3. Decisions that are settled (don't reopen)

1. System drafts the allocation; the dispatcher edits with live validation. A refused edit names every rule it breaks.
2. Guided Adaptive Allocation, in order: hard constraints, operational priority, continuity guard, dispatcher-adjustable soft priorities, explainable consequences. Refrigeration and van_only are resources, not priority.
3. Three deferral types: **capacity** (no legal vehicle exists), **policy** (a legal vehicle exists, policy chose it), **store request**.
4. 11 order statuses; everything else is a tag. Stores see **"Under review"**, never "Conflict".
5. One brand and one district per trip, whole orders only, max 2 trips per vehicle, Fresh ≤ 270 min, Style + Tech ≤ 480 min.
6. No live map or live tracking. GPS on the driver's phone measures **run distance only**. **Updated 29 Sep:** if GPS drops out, the planned distance fills the gap; there is no odometer entry and no R9.2 C or D frame.
7. Screen set = the 21 v1 IDs + driver R6 to R10. Extra frames are states of those screens (D5.3 A and B, D7.4 A and B are states). **Not yet reconciled: Store screen S4 "Updates and history" exists in Figma but was never added to this count — see PRD G-10.**
8. Store can edit quantities or cancel **until 16:00**; nothing after the cutoff.
9. No per-screen "Mock data" chips; invented data is disclosed once (PRD 4d, F17 page, video). The out-of-scope X frames carry no Mock text either.
10. Theme follows the working environment, not the role.
11. **New 29 Sep:** the driver records five outcomes: Delivered, Damaged, Refused, Store closed, Other. Partial is not a driver outcome; it comes from the store's shortfall (S3) or the dispatcher's decision on D7 (D7.4 B).
12. **New 29 Sep:** Waypoint operates Monday to Saturday. No screen shows a delivery on a Sunday. The hero day is Tue 29 Sep on every frame except R10 (June and April calendar dates).

## 4. People, story and scenarios

| Persona | Role | Device and conditions | App |
|---|---|---|---|
| Kumari | Dispatcher | Large screen, Peliyagoda office, plans both depots | Waypoint Dispatch (Light) |
| Priya (Peliyagoda), Ruwan (Kandy) | Loader | Shared dock tablet, night shift, PIN per action, phone width first | Waypoint Load (Dark) |
| Nimal | Driver | Own phone, VEH039, Kandy corridor with coverage gaps, used when stopped | Driver app (Dark, Field in sunlight) |
| Anusha | Store manager | OUT084 Waypoint Fresh, Kandy; phone and counter PC | Waypoint Store (Light) |

**Hero failure, "Driver offline, plan changed"** (H1 to H17, degradation page F13, screen D7): ORD2001 (chilled, 12 units) + ORD2002 (dry, 8 units) for OUT084 on VEH039. Ordered Mon 15:40 → cutoff 16:00 → plan v3 released 23:40 (D5.3 A) → v4 released 03:00 (D5.3 B) → Ruwan acknowledges v4 04:15, loads by 04:50 → Nimal departs 05:10 → offline 05:17 → Anusha phones 05:20 → Kumari defers (store request, v5) 05:21, which never reaches the phone → arrival 05:26, delivered 05:42 (receiver S. Fernando) → sync 06:40 shows a conflict → Kumari confirms "Keep delivery" 06:44 (Delivered + Deferral withdrawn, D7.4 A) → Anusha confirms receipt 07:30.

**Branch on D7:** the store reports 10 of 12 units at 07:04 → Kumari confirms "keep as Partial" at 07:05 (D7.4 B: Partial, follow-up for 2 units).

**Secondary failure, reefer swap at the dock** (X1 to X6, page F14, screen D8): VEH003 fails its check at 02:55 → VEH036 (smaller reefer van, out of the workshop at 02:45) replaces it, 120 kg / 0.7 m³ short → system recommends deferring ORD1002 (OUT009) by policy, OUT012 protected → plan v4 at 03:00 → Priya reviews the diff 03:04, acknowledges 03:05, loads VEH036 by 03:25 → departs 03:30.

**Key numbers:** Peliyagoda 212 orders, Kandy 64; reefer Fresh minutes 2,590 demand vs 2,160 supply (120%, over by 430); v3 = 19 deferrals (1 capacity: ORD1020, 18 policy); v4 = 20. All IDs, times and figures: PRD section 4c.

## 5. Screen map

| Role | Screens (Figma sections) |
|---|---|
| Dispatcher | D1 Order queue · D2 Capacity · D3 Trip board · D4 Deferrals · D5 Release · D6 Live operations · D7 Reconciliation · D8 Loading exception · D9 Forecast |
| Loader | L1 Dock · L2 Load plan · L3 Flag exception · L4 Plan changed |
| Driver | R1 Route · R2 Stop detail · R3 Record outcome · R4 Outbox · R5 Sync result · R6 Problem · R7 Trip history · R8 Notifications · R9 Finish run · R10 Calendar days |
| Store | S1 Place order (incl. edit until 16:00) · S2 Deliveries · S3 Receipt (incl. Issues tab) · **S4 Updates and history (built in Figma, not yet reconciled into the PRD body — see G-10; entered from a bell icon, not the tab bar)** |

Frames are named `<ID>.<n>` with letters for variants (`S1.3 · B`) and `.S` for empty / loading / offline / error states. Every screen has one rationale card beside its frames (26 cards in the 29 Sep count; S4 makes 27, uncounted as of the freeze).

## 6. Where everything lives

### Figma: NEXORA · TRIATHLON

https://www.figma.com/design/0qCle1zCrSImSou4lVlvmL/NEXORA---TRIATHLON (file key `0qCle1zCrSImSou4lVlvmL`)

| Page | Contents | Status |
|---|---|---|
| **Nexora (main)** `0:1` | **The prototype being judged.** Role sections D1 to D9, S1 to S3 (+ S4, section node `589:32`, ungrouped in the count above), L1 to L4, R1 to R10 with rationale cards; shared aids G1.1 to G1.5 (sign-in), G2.1 to G2.4 (role landing), G3 (presenter mode over D6.4), G4 ("Why this screen" over D7.1); out-of-scope frames X1 to X14. 1,775 prototype reactions, 51 flow starts | **Edit this page only** |
| Dispatcher `13:2`, Store Manager `17:4`, Loader `17:2`, Driver `17:3` | Earlier per-role pages | Reference only. The Driver page still carries the June dates (Tue 30 Jun, Mon 29 Jun); main has the corrected Sep dates |
| Out of Scope `144:2` | Earlier X1 to X14 | Reference only |
| Shared Library Framing `158:2` | LIB1 to LIB8 components; F1 to F17 framing pages (cover, problem, context, personas F4 to F7, system overview F8, role flows F9 to F12, degradation F13 and F14, core tradeoff F15, style guide F16, AI disclosure F17) | Reference only |
| AI Disclosure `429:2` | AI tool disclosure | Reference only |

Figma working rules: never delete a node that carries a prototype link (edit it); check links in Present mode after moving or renaming a button; don't build components locally.

**Present-mode keys (dispatcher main frames):** E Error, O Offline, L Loading, N Empty state frames; R steps D3.1 → D3.3 → D3.4 → D3.5 (refused moves). Arrow keys walk the X1 to X14 tour. The hint is in the subtitle at the top of the dispatcher column.

### This Claude project

| File | What it is |
|---|---|
| `waypoint-prd-v2.1.md` | **Source of truth (29 Sep, with a 30 Sep addendum for gap G-10)**: requirements, hero timeline, screen inventory with frame IDs, rules, vocabulary, data, assumptions A1 to A35, handoffs, known gaps (section 7) |
| `waypoint-central-context-v2.1.md` | This file |
| `claude/waypoint-prd-v2.md`, `claude/waypoint-central-context.md` | v2 (28 Sep). **Superseded** by the two files above |
| `nexora_main_audit.md` | 29 Sep audit of Nexora (main) against the PRD, this file and the booklet, with the fix status table (section 0b) |
| `Challenge Booklet.pdf` | The brief. Ranks above everything else |
| `Untitled.docx` | Export of the v1 spec (27 Sep). **Superseded** |
| `Untitled.md` | Waypoint Operations Deconstruction (25 Sep): problem analysis, dispatcher decision chain, and **Part 5 "Confirmed product direction"**, the source of every [DECIDED] tag. Its example times in Part 5 are superseded by PRD §2 |
| `Untitled (1).docx` | Persona briefs export (27 Sep). Partly out of date: it lists D9 as "Outlook" and R1 to R5 only, and its state copy uses em dashes. The PRD wins where they differ |
| `Untitled (2).docx` | Designathon team plan export (27 Sep): ownership, checkpoints, assembly steps |
| `00-cross-role.md` to `04-store-manager.md`, `README.md` | 27 Sep review fix lists. Applied; kept for history |
| `spec-4d-additions.md` | Earlier list of invented data; merged into PRD §4d |
| `Nexora - FINALIZED TECH-TRIATHLON 2026 PLAN.docx` | Whole-competition plan (all three phases) |
| `Untitled (1).md` | Competition intelligence brief (judging criteria analysis, risks) |
| `claude/designathon-spec-index.md`, `claude/plan-reconciliation-step1.md`, `claude/prd-synthesis-prompt.md` | How v1 was built |
| `index.html` | app.html prototype (Plan A); corrections C1 to C18 in PRD §4d |
| `UI direction` | Link to the chosen UI direction artifact |

The 27 Sep Claude Docs (spec, persona briefs, team plan) are private to their owner. Their owner should mark the spec doc as superseded by PRD v2.1.

## 7. House rules for anyone editing (and for Claude)

- **Source ranking:** Challenge Booklet → PRD v2.1 → everything else. Where a review or older file disagrees with the PRD, the PRD wins. Where the PRD and the Nexora (main) prototype disagree, PRD section 7 lists the gap; fix the prototype or the PRD, and record which.
- **Edit Nexora (main) only.** Other pages are reference.
- **Never invent a number silently.** Copy from PRD §4c. If you must invent, add it to §4d with where it's used.
- **Vocabulary is fixed:** the 11 statuses, 3 deferral types and tag groups in PRD §4b. Screens say "Impact on store", "Frees", "Next run", "Under review" (stores), "Forecast" (D9).
- **Writing:** no em dashes; no "Mock" text anywhere on the page (including X frames); no bracketed placeholders; no invented phone numbers.
- **Calendar:** hero day Tue 29 Sep; no Sunday deliveries; June and April dates only on R10.
- **Type:** Archivo for sentences, IBM Plex Mono only for IDs, times and figures; nothing under 12 px; contrast ≥ 4.5:1.
- **Rationale and persona claims** are tagged [A] booklet, [B] inference, [C] our choice. Only tag [A] what the booklet actually says. Invented aggregates are [C].
- **Hero consistency:** ORD2001 / ORD2002 look the same and use the same times on every role's screens. A frame never shows a plan version that does not yet exist at its clock.
- **Scope restraint:** anything not in PRD §3 is out of scope unless the team agrees and the PRD is updated first. **S4 is the one documented exception (G-10): built in Figma, now folded into the PRD's screen table and this file, but still needs spec-owner sign-off before it can be called fully reconciled.**

## 8. What was done

### 28 Sep

- All four role pages: review fixes applied (mock chips removed, placeholders filled, app names, monospace cut, em dashes cleaned, Forecast naming, hero times checked).
- Dispatcher: ORD1020 flagged on D1.1, D1.2 and D1.S Offline; At risk chip; Received column; Lateness risk column; one status pill per stop; acknowledgement table with Call; "Impact on store"; lateness pills restyled (held vehicle reads At risk); D5 columns aligned.
- Driver: GPS distance, wording updated on R1.9, R7.2 and R9.2; Damaged outcome in both grids; counts and retry wording in R4 and R5.
- Store: edit and cancel flow (S1.3 B to D); Confirm with a shortfall (S3.1 B); Issues tab (S3.7); every tab and dead button wired; Under review wording; new S1 variants.
- Loader: rationale cards L1 to L4; app name; dispatch desk label; contrast checked.
- Rationale cards added for every Dispatcher, Driver and Store screen, beside the frames.
- F5, F6 and F16: "Theme follows the working environment, not the role" added.

### 29 Sep (audit and fixes on Nexora (main))

- Whole page audited: 1,758 reactions, 0 broken links, all PRD frames present except the odometer frames. See `nexora_main_audit.md`.
- **Dates:** driver hero screens (R1, R7, R8, R9) moved from June to Tue 29 Sep and Mon 28 Sep; R7.1 gained a Mon 28 Sep run row; store recent-orders lists skip Sunday.
- **Landing cards:** G2.1 to G2.4 now match the screens they open; G2.4 opens S1.1; G1.2 signs in to the Store landing.
- **Flow 1:** new D5.3 A (v3 released 23:40); the old v4 frame is D5.3 B. **Degradation:** new D7.4 B (resolved as Partial 07:05); R1.7 goes to R5.3, not the photo-failure alert; R8.2 has its own flow start.
- **Dispatcher:** D1.1 capacity button locked; D6.6 vehicle rows match 07:31; keyboard hint added; D1.1 to D1.5 frames renamed.
- **Loader:** L1.3 VEH035 count fixed; VEH036 stop numbering 1 to 4 on L2.6 A, L2.2, L2.6 B (marker on L2.2 and L2.6 B to be checked by eye).
- **Store:** Deliveries list card opens S2.2; S2.1 to S2.5 auto-advance 5 s; flow start for S3.6.
- **Cleanup:** Mock text removed from X frames; seven [A] tags corrected; 49 flow starts renamed (role prefix, no " 1"); text under 12 px raised to 12 on product frames.
- **Decisions:** no odometer fallback (decision 6); five driver outcomes (decision 11).

### 30 Sep (store-manager frontend build)

- Found Store screen S4 "Updates and history" built in Figma (section `589:32`, frames S4.1, S4.1 B, S4.2, S4.S, own rationale card) but absent from the 29 Sep PRD text, this file, and the frozen screen counts. Not a new design decision — the frame and its rationale predate this discovery; only the spec's bookkeeping was missing it.
- Added S4 to PRD §3's Store screen table, §5's handoff notes, §6's component list, and §7 as gap G-10. Added this file's sections 3, 5, 6 and 7 accordingly.
- This reconciliation is provisional: it reads the Figma frames directly and has not had spec-owner sign-off. Flag it in the video alongside the other section-7 gaps.
- Pulled Figma section `442:22594` (S1 Place order, all 15 frames + rationale card) before starting phase 4, to check the PRD's S1 frame list against the actual designs rather than build from the table alone. Frame list matched; two follow-ons found: (1) the bell icon that opens S4 sits in the topbar on every S1 frame, not just S4, so it belongs in the shared `TopBar`/`AppBar` component (phase 2) with an unread-count dot, not as an S4-only addition; (2) S1.6 (desktop) has a "Recent orders" table (past delivery days, Sunday skipped, order count and status per day) that duplicates data S4's History tab will need, so `StoreApi` needs one shared method for it (e.g. `listRecentOrders`) added in phase 4, not invented twice. Full frame-by-frame copy notes are in the store README under "Notes from pulling the S1 Figma frames."
- **Correction, phase 4 (30 Sep):** the first pull overstated two things. The bell is drawn on only three S1 frames (S1.1, S1.1 B, S1.3), not every frame, and not on the desktop app bar; the store build shows it on every S1 screen and logs the difference in the store README's Departures. The README notes carry only sample copy, not full frame-by-frame copy; the full text for all 15 frames was read from the Figma layers and screenshots when phase 4 was built. Also added PRD 4d A36 (estimate ratios), A37 (unframed S1 copy) and a note that A35's Recent orders rows disagree with the S1.6 frame.

## 9. Open items before the Tue 23:59 deadline

Done since 28 Sep: D1.2 renumber (ORD1025, ORD1026); D5.3 Ruwan timing; F17 wording; F15 "Impact on store"; F6 persona range; dispatcher flow start says Forecast; store duplicate flow start; stale Central flow page gone; PRD and context updated to v2.1.

| # | Item | Where | Owner |
|---|---|---|---|
| 1 | Click through every flow in Present mode, including the two new frames D5.3 A and D7.4 B and the R7.1 Monday row | Nexora (main) | ________ |
| 2 | Decide what to do about PRD §7 gaps G-1 to G-9 (loader handoffs, app names, orphan state frames, nav and trip counts, D6.8, small label mismatches, header, L2 marker, contrast) or say them in the video | Nexora (main) | ________ |
| 3 | Video: say GPS measures distance only with no live tracking and that the planned distance fills a gap (no odometer); say drivers record five outcomes; mention the keyboard keys for state frames; name the handoffs between roles because only G3 is clickable across roles | Video, R9 rationale | ________ |
| 4 | Check F-frames and the F17 line still match decisions 6, 9 and 11 (odometer wording, Mock wording, outcome count) | Shared Library Framing | ________ |
| 5 | Confirm invented data A18 to A35 (PRD §4d), especially R10 dates against calendar.csv and the new A31 to A35 | PRD §4d | ________ |
| 6 | Update the Driver page dates or leave it as reference (main is what is judged) | Driver `17:3` | ________ |
| 7 | Optional: swap the L1.7 plain header for the library App bar instance | Loader L1.7 | ________ |
| 8 | Fill the blank names in the team plan (designers, spec owner) | Team plan | ________ |
| 9 | After the last edit: assemble pages in the team-plan order, export as `Nexora_Designathon` and zip; submit the prototype link, video link and zip | Figma, submission form | ________ |
| 10 | **New 30 Sep:** get spec-owner sign-off on gap G-10 (Store S4 Updates and history), reconciled into the PRD from the Figma frames without a review pass | PRD §7, this file §8 | ________ |

**After the Designathon:** apply app.html corrections C1 to C18; bring the React screens in `frontend/src/screens/` in line with PRD v2.1; start the shared rules module (PRD §4a) that the planner, validation messages and the Datathon Task 2B notebook all use; list departures from this design in the README.
