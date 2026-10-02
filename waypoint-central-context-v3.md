# Waypoint: central context for the team (v3, Hackathon)

Status as of Wed 30 Sep 2026, 16:00 · Team Nexora · maintained by HH

**Read this first.** One page for any teammate (or their Claude): what we are building, what is settled, where everything lives, the rules we follow, and what is open. For detail, the source of truth is **`claude/waypoint-prd-v3.md`** (supersedes `waypoint-prd-v2.1.md`). Loader and driver work also follows **`claude/field-build/00-field-conventions.md`**.

---

## 1. The competition

- **rootcode Tech-Triathlon 2026**: one business case (Waypoint Group, a fictional Sri Lankan retail group), three phases, each a third of the score.
- **Designathon:** submitted Tue 29 Sep. The "Nexora (main)" Figma page as submitted is the **Day 5 design**. It is frozen: no more edits.
- **Hackathon (current phase): due Sun 4 Oct 2026, 23:59** Sri Lanka time. Code pushed after it is not considered.
  - A responsive web app where a judge completes the workflow across all four roles, planning → loading → delivery → receipt. **Driver and loader are judged on phone-sized screens.**
  - Plans respect capacity, temperature, access, windows and fuel, and handle a day when demand exceeds capacity, identifying deferred orders.
  - Seeded with the shared datasets and at least one realistic delivery day, so the walkthrough works on a **fresh install**.
  - Deliverables: public URL + four seeded accounts; GitHub monorepo `TeamName_SolutionName` (we propose `Nexora_Waypoint`) with README (setup, config, accounts, numbered judge walkthrough, **departures from the Designathon**), `docker-compose.yml` and `.env.example` at the root (`docker compose up` starts everything including database and seed), `docs/` with architecture diagram, data model and AI disclosure; a 5 to 8 minute unlisted YouTube video (four roles, then code and architecture).
  - **Judging:** functional completeness 20% · planning and allocation engine 20% · degradation, offline and recovery 10% · fidelity to the Day 5 design 10% · **engineering quality and architecture 25%** · creativity 5% · demo video 10%.
- **Datathon:** due Fri 9 Oct, 23:59. Separate notebook; not wired into the app. Task 2B imports our shared rules module.
- **Data confidentiality** (booklet): the competition CSVs must not be shared, published, or pasted into external sites or AI tools. See open decision O-1 about the repo.

## 2. The product in one paragraph

Waypoint's shared fleet can't serve all three brands (Fresh, Style, Tech) on most days, so the product makes every deferral **deliberate, explained and visible to every role**. One order record moves from the store's order to the store's receipt across four roles. After the 16:00 cutoff the system drafts tomorrow's plan; the dispatcher edits it with every rule checked live. **Capacity forces how many orders wait; policy chooses which**, and each deferral carries typed reasons, never a score. Plans are versioned and acknowledged by loaders and drivers. Field work records offline and reconciles on reconnect: **the system recommends, a person confirms.**

## 3. Decisions that are settled (don't reopen)

1. System drafts the allocation; the dispatcher edits with live validation. A refused edit names every rule it breaks.
2. Guided Adaptive Allocation, in order: hard constraints, operational priority, continuity guard, dispatcher-adjustable soft priorities, explainable consequences. Refrigeration and van_only are resources, not priority.
3. Three deferral types: **capacity** (no legal vehicle exists), **policy** (a legal vehicle exists, policy chose it), **store request**.
4. 11 order statuses; everything else is a tag. Stores see **"Under review"**, never "Conflict". Pending sync exists only on devices.
5. One brand and one district per trip, whole orders only, max 2 trips per vehicle, Fresh ≤ 270 min, Style + Tech ≤ 480 min.
6. No live map or live tracking. GPS on the driver's phone measures **run distance only**; if GPS drops out, the planned distance fills the gap. No odometer.
7. Screen set: 21 v1 IDs + driver R6 to R10 + **store S4 Updates and history** (new, see section 8). Extra frames are states.
8. Store can edit or cancel **until 16:00**; nothing after.
9. No "Mock" text anywhere; invented data is disclosed once (PRD §4d, AI disclosure, videos, README).
10. Theme follows the working environment, not the role. Driver: Dark by default, Field in sunlight, Light when the phone prefers light (R1.9 copy).
11. Driver outcomes are five: Delivered, Damaged, Refused, Store closed, Other. Partial comes from the store's shortfall (S3) or the dispatcher's D7 decision.
12. Waypoint operates Monday to Saturday. Hero day Tue 29 Sep everywhere except R10 (June and April dates).
13. **Stack:** React + TypeScript (strict), Vite, plain CSS with `tokens.css` and CSS Modules, Radix primitives, fontsource fonts (Archivo, IBM Plex Mono, Noto Sans Sinhala, Noto Sans Tamil), oxlint, PWA with Dexie. Backend FastAPI + PostgreSQL + a framework-free Python rules module (`waypoint_rules`). One `docker compose up`.
14. **Figma wins on UI and copy; the PRD wins on behaviour and data; the booklet wins over both.** Anything the build shows differently from a Day 5 frame goes in the README departures table (PRD §18).
15. **Mock first.** Every role codes against a typed API interface (`DispatcherApi`, `StoreApi`, `LoaderApi`, `DriverApi`) with a mock over a small transport, seeded from its `fixtures.ts`. The real backend replaces the mock operation by operation (PRD §19).
16. **One scenario clock.** Nothing reads the wall clock. Mock mode: `?at=HH:MM` and `?date=`. API mode: the server's scenario clock, starting Mon 28 Sep 2026 15:30, moved forward by a presenter control.
17. **Computed numbers.** In the build, counts, minutes, kg, fuel and deferral totals come from data and the rules module. PRD §4c figures are seed targets; if the seeded day computes differently, the screen shows the computed value and the README says so.
18. **Mock to real is per role**, switched with `VITE_<ROLE>_API=mock|api`. The field transport has a mock and a `fetch` implementation behind one function, with the same connectivity behaviour (PRD §9, principle 7).

## 4. People, story and scenarios

| Persona | Role | Device and conditions | App |
|---|---|---|---|
| Kumari | Dispatcher | Large screen, Peliyagoda office, plans both depots | Waypoint Dispatch (Light) |
| Priya (Peliyagoda), Ruwan (Kandy) | Loader | Shared dock tablet, night shift, PIN per action (Priya `1234`, Ruwan `5678`), phone width first, master-detail at 1024 px | Waypoint Load (Dark) |
| Nimal | Driver | Own phone, VEH039, Kandy corridor with coverage gaps, used when stopped | Driver app (Dark, Field in sunlight) |
| Anusha | Store manager | OUT084 Waypoint Fresh, Kandy; phone and counter PC | Waypoint Store (Light) |

**Hero failure, "Driver offline, plan changed"** (H1 to H17, F13, D7): ORD2001 (chilled, 12) + ORD2002 (dry, 8) for OUT084 on VEH039. Ordered Mon 15:40 → cutoff 16:00 → v3 released 23:40 → v4 03:00 (no change for VEH039) → Ruwan acknowledges 04:15, loads by 04:50 → Nimal acknowledges 04:55, departs 05:10 → offline 05:17 → Anusha phones 05:20 → Kumari defers (store request, v5) 05:21, never reaches the phone → arrival 05:26, delivered 05:42 (S. Fernando) → OUT087 05:48 / 05:58 → sync 06:40: "3 synced · 1 conflict (2 orders)" → Kumari confirms Keep delivery 06:44 → Anusha confirms receipt 07:30. Branch: store reports 10 of 12 at 07:04 → kept as Partial 07:05.

**Secondary failure, reefer swap** (X1 to X6, F14, D8): VEH003 fails its check 02:55 → VEH036 (out of the workshop 02:45) replaces it, 120 kg / 0.7 m³ short → system recommends deferring ORD1002 (OUT009) by policy, OUT012 protected → v4 at 03:00 → Priya reviews 03:04, acknowledges 03:05, loads VEH036 by 03:25 → departs 03:30.

**Key numbers (seed targets):** Peliyagoda 212 orders, Kandy 64; reefer Fresh minutes 2,590 demand vs 2,160 supply (120%, over by 430); v3 = 19 deferrals (1 capacity: ORD1020, 18 policy); v4 = 20. All IDs, times and figures: PRD §4c.

## 5. Screen map and routes

| Role | Screens | Routes |
|---|---|---|
| Dispatcher | D1 Order queue · D2 Capacity · D3 Trip board · D4 Deferrals · D5 Release · D6 Live operations · D7 Reconciliation · D8 Loading exception · D9 Forecast | `/dispatcher/queue`, `/capacity`, `/trips`, `/deferrals`, `/release`, `/live`, `/conflicts/:id`, `/exceptions/:id`, `/forecast` |
| Loader | L1 Dock · L2 Load plan · L3 Flag exception (sheet) · L4 Plan changed | `/loader/dock`, `/loader/vehicles/:vehicleId/trips/:trip`, `/loader/changes` |
| Driver | R1 Route · R2 Stop · R3 Record outcome · R4 Outbox (sheet) · R5 Sync result · R6 Problem · R7 History · R8 Notifications · R9 Finish run · R10 Calendar days | `/driver/run`, `/driver/stops/:stopId`, `/driver/stops/:stopId/outcome`, `/driver/issues`, `/driver/history`, `/driver/notifications`, `/driver/finish`, `/driver/me` |
| Store | S1 Place order · S2 Deliveries · S3 Receipt (+ Issues tab) · **S4 Updates and history** | `/store/orders`, `/store/deliveries`, `/store/deliveries/:date/receipt`, `/store/issues`, `/store/updates`, `/store/history` |

A frame is a **state** of its screen, produced by data, connectivity and the clock, never a separate page. Every role keeps a dev-only state gallery at `/<role>/_states` (`?frame=<id>` renders one frame for the compare script).

## 6. Where everything lives

### Figma: NEXORA · TRIATHLON (read-only now)

https://www.figma.com/design/0qCle1zCrSImSou4lVlvmL/NEXORA---TRIATHLON · file key `0qCle1zCrSImSou4lVlvmL`. The file now has **two pages**:

| Page | Contents |
|---|---|
| **Nexora (main)** `0:1` | The Day 5 design. **27 sections** (D1 to D9, S1 to S4, L1 to L4, R1 to R10), 27 rationale cards; G1.1 to G1.5 sign-in, G2.1 to G2.4 role landing, G3 presenter mode, G4 "Why this screen"; X1 to X14 out of scope (not built). **53 flow starts, 1,851 prototype reactions** (30 Sep). Node IDs are `442:*`, plus `527:32` D5.3 B, `527:324` D7.4 B and `585:*` for S4 |
| **Shared Library Framing** `158:2` | LIB1 to LIB8 components, F1 to F17 framing pages (personas F4 to F7, flows F9 to F12, degradation F13 and F14, tradeoff F15, style guide F16 `187:3073`, AI disclosure F17) |

Node IDs quoted in `claude/store-manager-build-prompt.md` point at the deleted Store Manager page and are stale; use the S1 to S4 sections on Nexora (main). The field-build prompts carry correct node IDs for every loader and driver frame (138 IDs, checked against the live file on 30 Sep).

### This Claude project

| File | What it is |
|---|---|
| `claude/waypoint-prd-v3.md` | **Source of truth (v3.1, 1 Oct).** Part A: product, hero timeline, screen inventory with S4, rules, vocabulary, data, assumptions A1 to A58, handoffs 1 to 14, known gaps G-1 to G-15. Part B: architecture, data model, rules module, planner, scenario clock, seed, routes and offline, judge walkthrough, tests, departures register DP-01 to DP-25, API, build order, open decisions O-1 to O-11. In the repo it is `waypoint-prd-v3.md` at the root |
| `claude/waypoint-central-context-v3.md` | This file |
| `claude/field-build/00-field-conventions.md` | Binding conventions for loader and driver: sources, how to copy a frame exactly, tokens for all three themes, offline model, git rules. In the repo it is saved as `docs/build/field-conventions.md`, which is the path every prompt reads |
| `claude/field-build/01` to `05` | Build prompts: field foundation, loader L1 to L4, driver core, driver offline and recovery, driver run support |
| `claude/store-manager-build-prompt.md` | Store build prompt (S1 to S3). Written against PRD v2; use PRD v3 for S4 and the stale node IDs note above |
| `waypoint-prd-v2.1.md`, `waypoint-central-context-v2.1.md` | 29 Sep. **Superseded** by v3 |
| `claude/waypoint-prd-v2.md`, `claude/waypoint-central-context.md`, `Untitled.docx`, `claude/one-app-rebuild-prompt.md`, `index.html` (app.html) | Older. Do not use |
| `Challenge Booklet.pdf` | The brief. Ranks above everything |
| `Untitled.md` | Operations Deconstruction (25 Sep); Part 5 is the source of [DECIDED] tags |
| `Nexora - FINALIZED TECH-TRIATHLON 2026 PLAN.docx` | Whole-competition plan. Its Next.js / Tailwind stack is superseded by decision 13 |
| `Untitled (1).md` | Competition intelligence brief |
| `Untitled (1).docx`, `Untitled (2).docx`, `00-cross-role.md` to `04-store-manager.md`, `README.md`, `spec-4d-additions.md`, `claude/designathon-spec-index.md`, `claude/plan-reconciliation-step1.md`, `claude/prd-synthesis-prompt.md` | Designathon history |
| `UI direction` | Link to the chosen UI direction artifact |

## 7. House rules (for people and for Claude)

- **Source ranking:** booklet → Figma for UI and copy → PRD v3 for behaviour and data → everything else. Record every visible difference from a Day 5 frame in the README departures table.
- **Figma is read-only.** Never create, move, rename or edit anything in the file.
- **Copy frames exactly:** screenshot, design context, text dump, compare side by side (field conventions §3). Spacing within 2 px, identical strings, same Lucide icons, same tokens.
- **Prototype links are a map, not the behaviour.** Timers and shortcuts in the prototype become real data changes.
- **Never invent a number silently.** Copy from the frame and PRD §4c; if you must invent, add it to PRD §4d the same day.
- **Vocabulary is fixed:** 11 statuses, 3 deferral types, tag groups (PRD §4b), one `statusLabel(status, role)`.
- **Writing:** no em dashes, no "Mock", no bracketed placeholders, no invented phone numbers ("Peliyagoda dispatch desk"); times 24-hour HH:MM Asia/Colombo in Plex Mono; dates "Tue 29 Sep".
- **Type:** Archivo for sentences, IBM Plex Mono only for IDs, times and figures; nothing under 12 px; contrast ≥ 4.5:1 in all three themes; every tap target ≥ 44 px.
- **Hero consistency:** ORD2001 / ORD2002 look the same and use the same times on every role's screens; no screen shows a plan version that doesn't exist yet at its clock.
- **Code:** screens call only their role's API interface; no rule logic in the frontend (it lives in `waypoint_rules`); every commit passes `tsc --noEmit`, `oxlint` and `vite build`; CSS Modules only; shared files (tokens, shared UI, domain types, router) change in their own commit.
- **Git:** branches from `develop` as `feature/<area>` and PRs back to `develop`; never commit to `main` or `develop` directly, never force push. Conventional Commits, commit as the repo owner. Our team prompts ask for **no AI attribution lines** in commits and PRs; AI use is disclosed in `docs/ai-disclosure.md` instead. Each role writes its own README section and departures list; HH merges them into the PRD §18 register on Sat 3 Oct.
- **Data:** never paste or commit the competition CSVs anywhere public or into AI tools.
- **Scope restraint:** X1 to X14 stay unbuilt. Anything not in PRD §3 needs the PRD updated first.

## 8. What changed since v2.1 (29 Sep, 19:00)

- **Designathon submitted.** The Figma file was reduced to two pages (per-role pages and the old Out of Scope and AI Disclosure pages are gone).
- **New store section S4 · Updates and history** on Nexora (main): a bell in the store top bar opens a feed of every update the order record sends the store (Order, Plan, Delivery, Deferral, Review tags; unread and "Mark all read"), plus a History segment of past delivery days Mon to Sat. States S4.S A to D. The bell is on S1.1, S1.1 B, S1.3, S2.1 to S2.8 and S2.10 only; the build puts it on every store screen.
- Re-check of the page found the 29 Sep gaps G-1 to G-9 still in the frames (they stay; the build fixes behaviour and lists departures), plus: S2.10 swaps Thu 24 and Fri 25 (A35 wins), an unnamed "Flow 1" and a duplicate store flow start, and hidden Mock layers in X frames.
- **Field-build prompts 00 to 05** written for the loader and driver (conventions, foundation, L1 to L4, driver core, offline, run support). PRD v3 adopts their routes, record types, sync results, demo PINs, R6 problem choices and driver theme rule.
- **PRD v3** adds the whole build spec: architecture, database, API, rules module, planner, scenario clock, seed, walkthrough, tests, departures register.
- **1 Oct, PRD v3.1:** v3 checked against the field-build prompts and the merged foundation. Changes V32 to V42: the planned-distance basis (two correct figures, `planned_run_legs` beside `planned_fuel`), the dock as a device setting with `?dock=` and Change dock, the "Other…" guest PIN `0000` and a tablet cache covering every PIN person, R10 in API mode, the app shell as build stage 2b with no owner yet, the `VITE_<ROLE>_API` mock-to-real switch, API-mode answers for the mock-only dev controls, Dispatch handling of non-vehicle flags and driver problems, R6 problem threads, the two kinds of driver notification, assumptions A55 to A58, departures DP-19 to DP-25 and open decisions O-8 to O-11.

## 9. Build plan to Sun 4 Oct 23:59

| Stage | What lands | Notes |
|---|---|---|
| 1 | Dispatcher and Store screens against typed mock APIs | In progress |
| 2 | Loader and Driver: field foundation first, then L1 to L4 and driver prompts 3 to 5 | Prompts ready. Order: foundation (01) merges first, then loader (02) and driver core (03) in parallel, then 04, then 05 |
| 2b | App shell: `/sign-in`, `/start`, per-role session storage, avatar menu, presenter panel (`/demo/advance`, `/demo/reset`; a local clock stepper in mock mode), Change dock, optional G4 "Why this screen" | **No owner yet (O-11).** About half a day, and it blocks stage 7 |
| 3 | Backend foundation: schema + migrations, seed + checks, auth, scenario clock, OpenAPI published early, Compose skeleton | Can start now, parallel to 1 and 2 |
| 4 | `waypoint_rules`, planner, `validate-move`, D8 recommendation, golden tests | Needs 3 |
| 5 | Swap mocks for the real API role by role: Store, Dispatcher, Loader, Driver | Needs 3 and 4 |
| 6 | `/sync`, reconciliation, D7 and D8 end to end across roles | Needs 5 |
| 7 | Judge walkthrough (PRD §16) on a clean `docker compose up`; Playwright green | Sat to Sun midday |
| 8 | README, docs, deploy to a public HTTPS URL, video, tagged release | Sunday, with buffer before 23:59 |

**Biggest risks:** frontends hard-coding data instead of using their API interface (the swap becomes a rewrite); the planner not reproducing the designed numbers on the seeded day (fine, but record DP-01); cross-role handoffs only tested inside each role's mock (stage 7 needs real time).

## 10. Open decisions

| # | Question | Default if nobody decides by Thu 1 Oct | Owner |
|---|---|---|---|
| O-1 | Datasets in the repo: `docker compose up` must seed from the CSVs, but the booklet forbids distributing them | Private GitHub repo with judge access; email tech-triathlon@rootcode.io to confirm | ________ |
| O-2 | Hosting for the public HTTPS URL | One small VM running the same Compose file behind Caddy | ________ |
| O-3 | Photo storage | Files on a Docker volume | ________ |
| O-4 | Demo passwords | In `.env.example` and the README | ________ |
| O-5 | Presenter control (clock + reset) visible to judges | In the dispatcher avatar menu | ________ |
| O-6 | DispatcherApi operation names | PRD §19 proposal unless the dispatcher owner has already fixed them | Dispatcher owner |
| O-7 | Spec owner and team names in the PRD header | HH | ________ |
| O-8 | Who reviews the Sinhala and Tamil driver strings (prompt 05 §6 lists the ten that matter most) | Ship the machine draft and say so in the README and `docs/ai-disclosure.md` | ________ |
| O-9 | Dispatch handling of non-vehicle loader flags and driver problems | The default in PRD §7 G-14: stored, listed in D6, marked seen on open | Dispatcher owner |
| O-10 | The "Other…" guest PIN value (A55) | `0000`, listed in the README | HH |
| O-11 | Owner of the app shell (build stage 2b) | HH until someone takes it | ________ |
