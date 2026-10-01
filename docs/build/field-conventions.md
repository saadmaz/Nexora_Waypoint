# Field apps conventions: Waypoint Load and Waypoint Driver

**Saved in the repo as `docs/build/field-conventions.md`.** Every field-app prompt (01 to 05) tells the builder to read it first. It is binding for all Loader and Driver work. Team Nexora · Tech-Triathlon 2026 Hackathon · written Wed 30 Sep 2026.

> **Repo adaptations (agreed 30 Sep, HH).** The team's `Contributing.md` overrides the git sections below where they differ:
> branches are `feature/field-foundation`, `feature/loader`, `feature/driver` (and `feature/driver-<topic>` for the later driver prompts), cut from `develop`;
> `develop` is merged into the branch (no rebase); pull requests target `develop`; `main` is never touched.
> Commits carry **no** AI attribution lines of any kind.

---

## 1. What we are building

Waypoint is one delivery system for Waypoint Group: one order record moves from the store's order to the store's receipt across four roles. These prompts cover the two **field roles**, which judges assess on phone-sized screens:

| Role | Persona | Device and conditions | Theme | Screens |
|---|---|---|---|---|
| Loader | Priya (Peliyagoda dock), Ruwan (Kandy dock) | Shared dock tablet, night shift, one PIN per person per action, phone width first, tablet master-detail at 1024 px | Dark · pre-dawn | L1 Dock · L2 Load plan · L3 Flag exception · L4 Plan changed |
| Driver | Nimal, VEH039, Kandy | Own phone, used only when safely stopped, loses coverage on the Kandy corridor | Dark · pre-dawn, Field · sunlight on demand | R1 Route · R2 Stop detail · R3 Record outcome · R4 Outbox · R5 Sync result · R6 Problem · R7 Trip history · R8 Notifications · R9 Finish run · R10 Calendar days |

The Dispatcher and Store frontends are being built in parallel by teammates in the same repo. Reuse what they have already merged; do not restyle their work.

## 2. Sources, in order of authority

1. **Challenge Booklet** (`Challenge Booklet.pdf` in the team's Claude project). It decides operating rules: capacity, refrigeration, van_only, windows, cutoff, two trips, Monday to Saturday.
2. **Figma, page "Nexora (main)"** (file key `0qCle1zCrSImSou4lVlvmL`, page `0:1`). It decides **everything a user sees**: layout, spacing, colour, type, icons, every word of copy, every state, and which control leads where. **Copy it exactly.**
3. **PRD v3** (`claude/waypoint-prd-v3.md`, dated 30 Sep). Use it for behaviour and data the frames do not show: rules, status meanings, handoffs, the hero timeline, record types, the backend contract. Its Part A follows the Day 5 frames; Part B is the Hackathon build spec.
4. **Central context v3** (`claude/waypoint-central-context-v3.md`): settled decisions and house rules.

**Decision (HH, 1 Oct).** This overrides the "follow the PRD" line in `CLAUDE.md` for the field apps: **Figma wins** on anything a user sees. Where Figma is silent or unclear (a state, a string, a number, a behaviour), pick the sensible default, then add it to `waypoint-prd-v3.md` the same day (section 4d assumptions, or section 18 departures if it differs from a frame) and mention it in the README departures table.

**Conflicts.** Where Figma and the PRD disagree on UI or copy, Figma wins. Where Figma breaks a booklet rule, the booklet wins. Record every such case in the README "Departures from the Designathon design" table with the reason. Do not use PRD v2 or v2.1 (`claude/waypoint-prd-v2.md`, `waypoint-prd-v2.1.md`), the persona-brief .docx, `app.html` or the old one-app rebuild prompt; they are superseded.

**The Figma file now has only two pages:** "Nexora (main)" `0:1` and "Shared Library Framing" `158:2`. The old per-role pages (Dispatcher, Loader, Driver, Store Manager) have been deleted. Each role's screens are **sections** on "Nexora (main)". Node IDs for every section and frame are in the role prompts.

Useful nodes on "Shared Library Framing" `158:2`:

| Node | What |
|---|---|
| `162:429` | LIB1 Master Order Component (four densities: loader check, driver stop) |
| `161:3` | LIB2 Status, tags, buttons and icons |
| `166:1761` | LIB3 Global chrome (top bar, connectivity chip, tab bar) |
| `171:2123` | LIB6 Field components (plan diff row, PIN sheet, bottom sheet, pinned action bar, outcome grid, units stepper, photo tile, signature pad, outbox row, offline banner) |
| `173:2112` | LIB8 States components (alerts, empty, loading skeleton, error with retry) |
| `175:2174` | G1.3 Sign-in, phone, Dark · pre-dawn |
| `175:2456` · `175:2472` | G2.2 Role landing, Loader · G2.3 Role landing, Driver |
| `180:2729` · `182:2132` | F5 Persona Priya · F6 Persona Nimal |
| `185:2285` · `185:2746` | F10 Loader flow · F11 Driver flow |
| `185:3310` · `186:2946` | F13 Degradation: Driver offline, plan changed · F14 Degradation: Reefer swap |
| `187:3073` | F16 Style guide |

**Figma is read-only for you.** Never create, move, rename or edit anything in the Figma file.

## 3. How to copy a frame exactly

A Figma frame is a **state** of a screen, not a page. Build one screen component per screen ID (L1, R3 …) whose props and data produce every frame of that screen. Never build one component per frame, and never hard-code a frame's markup.

For every frame you implement:

1. **Screenshot.** `get_screenshot(fileKey, nodeId, maxDimension: 1688)` and save it to `frontend/.figma/<frame-id>.png` (for example `L2.1-A.png`). Add `frontend/.figma/` and `frontend/.compare/` to `.gitignore`.
2. **Structure and measurements.** `get_design_context(fileKey, nodeId)` for layout, spacing, font sizes, weights, radii, borders and icon names. `get_variable_defs(fileKey, nodeId)` to map colours to token names. The returned code is **reference only** (it is usually React + Tailwind): translate it into our components, CSS Modules and tokens. Never paste Tailwind classes, never hard-code a hex value, never use absolute positioning copied from Figma coordinates for normal flow content.
3. **Copy, verbatim.** Dump the frame's text in reading order with the read-only script below (use the Figma MCP `use_figma` tool; if it asks you to load its usage guidance first, do so). Put every string into the screen's strings module. Match every character: capitals, middots (`·`), arrows (`→`), hyphens, units ("0.7 m³"), times ("05:42"). If the screenshot shows text the dump missed (or the reverse, because a hidden parent hides it), the screenshot wins.

   ```js
   // READ-ONLY. Replace NODE_ID. Returns the frame's visible text top-to-bottom, left-to-right.
   const fr = await figma.getNodeByIdAsync('NODE_ID');
   const t = fr.findAll(n => n.type === 'TEXT' && n.visible)
     .map(n => ({ y: Math.round(n.absoluteTransform[1][2]), x: Math.round(n.absoluteTransform[0][2]), s: n.characters }));
   t.sort((a, b) => a.y - b.y || a.x - b.x);
   return t.map(x => x.s).join('\n');
   ```

4. **Rationale card.** Each section has a "Rationale card" frame. Read it once per screen; it states the screen's purpose and priorities.
5. **Compare.** Render the same state in the app through the state gallery (section 10) at the frame's size (390 × 844 unless the frame says otherwise), take a Playwright screenshot at device scale factor 2 into `frontend/.compare/<frame-id>.app.png`, and build a side-by-side image with the Figma screenshot. Fix until: every string is identical, elements appear in the same order, icons are the same Lucide icons, colours are the same tokens, and spacing is within 2 px. Tall frames (for example 390 × 1360) are scroll captures: compare full-page.
6. **Numbers and IDs come from the frame.** Cross-check against PRD §4c. If the frame and the PRD disagree on a number, use the frame and list it in the README departures table only if the frame is clearly wrong (for example a date on a Sunday).

## 4. Prototype links are a map, not the behaviour

The Figma prototype fakes progress with timers ("after 4 s go to offline") and shortcuts (any PIN digit succeeds). Use its links to know **which control opens which screen or sheet**, and build the real behaviour behind them:

- State changes come from data, connectivity and the scenario clock, never from a timer that pretends something happened.
- Timers are fine only where they are real UX: dismissing a success confirmation, a sending spinner that lasts as long as the request.
- Each role prompt lists the known shortcut links and what the real behaviour is. Follow those lists.
- "Navigate" opens a Google Maps search for the outlet in a new tab. It is not tracking.

## 5. Stack and code conventions

- **React + TypeScript** (strict), **Vite**. Check `frontend/package.json`, `vite.config.*`, `tsconfig*.json`, `frontend/.oxlintrc.json`, the router, and what already exists in `frontend/src/` before writing code. Follow existing patterns.
- **Plain CSS with CSS Modules** for every component and screen (`LoadPlan.module.css`). Only `tokens.css`, font imports and a small `base.css` are global. No CSS framework.
- **Radix primitives**, unstyled and styled with CSS Modules, for anything that manages focus: `@radix-ui/react-dialog` (bottom sheets, PIN sheet, outbox sheet, modals), `@radix-ui/react-switch` for switches, `@radix-ui/react-toast` if the repo has no toast yet. Native elements where they suffice.
- **Icons:** `lucide-react`, 2 px stroke, shown at 14, 16, 20 or 24 px as the frame shows. Use the icon named in `get_design_context` (layer names such as `snowflake`, `triangle-alert`, `wifi-off`).
- **Fonts** (self-hosted with fontsource so they work offline): `@fontsource-variable/archivo` (sentences and labels), `@fontsource/ibm-plex-mono` 400/500/600 (IDs, times, figures only), `@fontsource/noto-sans-sinhala` and `@fontsource/noto-sans-tamil` (driver language labels and translations). Never Google Fonts.
- **Offline:** `vite-plugin-pwa` (Workbox) and `dexie` (IndexedDB).
- **Tests and checks:** `tsc --noEmit`, `oxlint` (no new warnings; fix code, do not disable rules), `vite build`. Dev dependencies allowed: `vitest`, `fake-indexeddb`, `@playwright/test`, `@vitejs/plugin-basic-ssl` (HTTPS on a phone in dev: camera and GPS need a secure context).
- **Ask before adding any other dependency.**
- **Folders** (adapt to the repo if it already has a pattern): `src/shared/` for cross-role UI and domain types, `src/field/` for field-app infrastructure (offline, connectivity, clock, chrome), `src/screens/loader/`, `src/screens/driver/`.

## 6. Design tokens (Figma collection "Waypoint colour")

Three modes, switched with a `data-theme` attribute **on the role's root element**, not on `<html>`, because Dispatcher and Store run Light in the same app. Values below were read from Figma on 30 Sep; confirm with `get_variable_defs` if something looks off.

| Token | Dark · pre-dawn `dark` | Field · sunlight `field` | Light · office `light` |
|---|---|---|---|
| surface-0 | #0e1113 | #ffffff | #f5f4f0 |
| surface-1 | #161a1d | #ffffff | #ffffff |
| surface-2 | #1e2327 | #eeeeee | #eceae4 |
| line | #2c3338 | #1a1a1a | #d8d5cd |
| line-strong | #6b737a | #000000 | #858178 |
| ink | #eceeec | #000000 | #15191c |
| ink-muted | #a2aab0 | #2e3338 | #50565c |
| chrome | #07090a | #000000 | #15191c |
| on-chrome | #eceeec | #ffffff | #f5f4f0 |
| on-chrome-muted | #8e979d | #d0d4d7 | #a9b0b5 |
| route | #5cc6c0 | #00474d | #0b5c63 |
| route-hover | #7ad4cf | #00363b | #084a50 |
| on-route | #062224 | #ffffff | #ffffff |
| route-soft | #133335 | #d6ecec | #ddefef |
| signal | #ffc53d | #ffc400 | #f2a900 |
| on-signal | #15191c | #000000 | #15191c |
| signal-soft | #3a2e10 | #fff0b8 | #fdf1d3 |
| warning | #ffc53d | #5a3700 | #855000 |
| success | #57c99a | #0a4d33 | #13684a |
| success-soft | #12302a | #d9f0e5 | #dff1e8 |
| danger | #ff8a70 | #8f1a0e | #b42318 |
| on-danger | #1a0a07 | #ffffff | #ffffff |
| danger-soft | #3d1c17 | #fbe1dd | #fbe4e1 |
| offline | #a9b1b7 | #2e3338 | #4a5056 |
| offline-soft | #262c31 | #e3e5e7 | #e4e6e8 |
| chilled | #6cc7ee | #00506e | #0a6a90 |
| chilled-soft | #11303d | #d8eef7 | #ddf0f8 |
| brand-fresh | #86c77b | #1f4f1b | #2f6a2a |
| brand-fresh-soft | #1c2e1a | #e3f0e0 | #e3f0e0 |
| brand-style | #ee8cbf | #6e1f48 | #982c64 |
| brand-style-soft | #3a1c2c | #f7e2ec | #f7e2ec |
| brand-tech | #a7abf5 | #2c3080 | #4146a8 |
| brand-tech-soft | #23254a | #e6e7f7 | #e6e7f7 |
| focus | #ffc53d | #000000 | #0b5c63 |

If `tokens.css` already defines the Light values (the Store and Dispatcher work uses them), add the `dark` and `field` blocks next to them with the same custom-property names. Field · sunlight also means "High contrast, no shadows" (R1.9 copy): shadows are `none` in that mode.

**Type** (confirm against F16 `187:3073` and each frame): Archivo for sentences and labels, IBM Plex Mono only for IDs, times and figures. h1 28/34 700 · h2 22/28 600 · h3 17/24 600 · body 15/22 · body-sm 13/18 · caption 12/16 · label 12/16 600 uppercase · pill and tag 13/16 600 · large button 17/24 600 · medium button 15/20 600 · data 14/20 Plex Mono 500. Nothing under 12 px.

**Space and size:** 4 px grid; 16 px phone gutter. Radius 4 tags, 8 inputs and medium buttons, 12 cards, sheets, alerts and large buttons, 999 pills. Buttons 56 px (large) and 44 px (medium). Every tap target at least 44 × 44 px; primary field actions are full-width 56 px. Take bar heights from the frames.

**Motion:** 120 ms colour transitions; the PIN shake is 120 ms; sheets slide in. Everything respects `prefers-reduced-motion`.

## 7. Vocabulary (the same in all four roles)

- **11 order statuses** (typed string union, shared with Dispatcher and Store): Ordered · Confirmed · Planned · Deferred · Loaded · Departed · Delivered · Partial · Issue · Pending sync · Conflict. Everything else is a tag.
- **Deferral types:** capacity · policy · store request. Shown as "Deferred · policy → Wed" style.
- **Loader flags never change order status.** The vehicle gets the tag Held; its orders stay Planned until Dispatch decides.
- **Driver outcomes are five:** Delivered, Damaged, Refused, Store closed, Other. Partial is **not** a driver outcome. Mapping to status: Delivered → Delivered; Damaged, Refused, Store closed, Other → Issue plus the matching issue tag.
- **Pending sync** exists only on the device. **Conflict** has its own style (soft `signal-soft` fill, `signal` stroke, warning icon, `ink` label).
- Use a single `statusLabel(status, role)` helper; if the Store work already created one, extend it.

## 8. Writing rules

- Copy is whatever the Figma frame says. Do not "improve" it.
- Where you must write new text (an error the frames don't cover, an aria-label): no em dashes, no "Mock", no bracketed placeholders, no invented phone numbers (use "Peliyagoda dispatch desk"), verb + object on buttons.
- Times are 24-hour HH:MM in Asia/Colombo, in Plex Mono. Dates look like "Tue 29 Sep".
- One operating-date model in Asia/Colombo everywhere. Never use the browser's local time zone for scenario times.

## 9. Data

- Operating day **Tue 29 Sep 2026**, planned Mon 28 Sep. Hero: ORD2001 (chilled, 12 units, 70 kg, 0.7 m³) and ORD2002 (dry/ambient, 8 units, 45 kg, 0.6 m³) for OUT084 (Waypoint Fresh, Kandy, rear dock, window 05:30 to 08:00) on VEH039 trip 1, with ORD2003 (OUT087, 9 units). Plan versions v3 23:40, v4 03:00, v5 05:21.
- Secondary: VEH003 fails its check at 02:55, VEH036 replaces it, ORD1002 (OUT009) deferred by policy in plan v4 at 03:00.
- Take every other value from the frames, cross-checked with PRD §2, §2b and §4c. The same ID must look the same on every screen.
- Seed data lives in one fixture module per role (`src/screens/<role>/fixtures.ts` or the repo's equivalent), typed, so the backend team can mirror it in the database seed.
- **Data confidentiality:** never paste, upload or commit the competition CSVs anywhere, including into AI tools. Use the values already in the frames and PRD.

## 10. Scenario clock, state gallery and mock API

- **Scenario clock.** All "now" values come from one clock. `?at=HH:MM` sets it (for example `?at=05:26`), `?date=YYYY-MM-DD` sets the date (default 2026-09-29; times before 12:00 on the Monday evening use `?date=2026-09-28`). Without parameters the clock starts at the role's first frame time and runs in real time. If the Store work already built a scenario clock, reuse it.
- **State gallery** at `/loader/_states` and `/driver/_states` (dev only, excluded from the production navigation): renders every Figma frame of the role, labelled with its frame name and Figma node ID, at the frame's size, driven by fixture data plus a fixed clock and connectivity. `?frame=L2.1-A` renders one frame full-screen for the compare script.
- **Mock API.** Each role has a typed interface (`LoaderApi`, `DriverApi`) and a mock implementation over a small **transport** that: adds 300 to 600 ms latency, throws a `NetworkError` when the device is offline (real or simulated), and reads and writes a **mock server store** seeded from the fixtures. The real backend will replace the mock with the same interface, so no screen may call `fetch` directly or read fixtures directly.
- Every write carries: `clientId` (`crypto.randomUUID()`, the idempotency key), `deviceTime`, `planVersionOnDevice`, and the actor (PIN person for the loader, driver ID for the driver).

## 11. Offline model (shared by Loader and Driver)

- **IndexedDB via Dexie**, database `waypoint-field`, tables: `outbox` (pending writes), `cache` (dock plan, load plans, route, history), `blobs` (photos, signatures), `settings` (theme, text size, language, simulated offline, dock).
- **Connectivity** = `navigator.onLine` AND not simulated-offline AND the last request did not fail with a network error. Expose it as a store with: `online | offline | syncing | failed`, `lastSyncAt`, `waitingCount`.
- **Sync engine:** runs on the `online` event, every 30 s while records wait, and on "Send now" / "Retry now". Sends in order. Each record returns `accepted | duplicate | conflict | error`. `duplicate` counts as accepted (idempotent by `clientId`). Do not rely on the Background Sync API (iOS Safari lacks it).
- **Service worker:** precache the app shell and fonts; network-first with cache fallback for GET data; the app must open with no network after one visit.
- A device never shows a plan change it has not received. "Last sync HH:MM" always means the last successful sync.

## 12. Layout

- Frames are 390 × 844. On phones, render full-width. On wider screens the driver app is a centred column (max 430 px) on `surface-0`. The loader app switches to the L1.7 master-detail layout at 1024 px and above. No fake device bezel.
- Safe areas: respect `env(safe-area-inset-*)` for the top bar and tab bar.
- No horizontal scroll at 320 px.

## 13. Accessibility and quality bar

- Real `<button>`, `<input>` and Radix controls; visible focus ring (3 px `focus` colour, 2 px offset); every sheet traps focus, closes on Esc and returns focus.
- Status never shown by colour alone (icon plus label).
- Contrast at least 4.5:1 in all three themes.
- `aria-live="polite"` for connectivity and sync-count changes; `assertive` only for errors that block the user.
- Every commit passes `tsc --noEmit`, `oxlint` and `vite build`.

## 14. Git, commits and README

- **Identity:** commit as the repo owner's GitHub account. Before the first commit run `git config user.name` and `git config user.email`; if either is empty or not the owner's, stop and ask. Never set it yourself, never use `--author`. (30 Sep: HH confirmed the configured identity, `ft-potatoe`, is the one to use.)
- **No AI attribution** anywhere: no `Co-Authored-By: Claude`, no "Generated with Claude Code", in commits, PR descriptions or code comments.
- **Branches** from the latest `develop`: `feature/field-foundation`, `feature/loader`, `feature/driver`. Never commit to `main`. Merge `develop` into the branch before each phase; resolve conflicts without discarding teammates' changes. Push after every phase; open a draft PR to `develop` after the first phase.
- **Shared files** (tokens, shared UI, domain types, router, rules module): change them in their own commit and say so in the message, so the Dispatcher and Store owners can review.
- **Commit messages:** Conventional Commits, imperative subject of 72 characters or fewer, no trailing full stop, no em dashes. Body: what changed, why, and the frames or PRD section implemented (for example "Figma L2.1 A, L2.1 B, L2.3 A").
- **README:** keep the existing README; edit only your role's section (add it if missing). Cover: routes, state gallery and `?at=`, demo PINs, phase checklist, **departures from the Designathon design** (each with its reason), and shared files you changed.

## 15. When to stop and ask

Stop and ask HH (the repo owner) when: a frame cannot be read; Figma and the booklet conflict on a rule; a needed value exists in neither Figma nor the PRD; a dependency outside section 5 is needed; or a teammate's shared component would have to change in a way that breaks their screens.
