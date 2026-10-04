<!-- Build log moved out of README.md so the README reads as the deliverable. -->

# 🏭 Waypoint Load (Loader)

L1 Dock, L2 Load plan, L3 Flag exception and L4 Plan changed, built in `frontend/`, branch `feature/loader` from `feature/field-foundation`. Binding rules: [`field-conventions.md`](field-conventions.md) and the loader prompt. The tablet layout (L1.7) is built and a Playwright run plays both stories (L6).

**Status:** L0 (types, fixtures, `LoaderApi`, mock server), L1 (Dock: every state, PIN acknowledgement, countdowns, held vehicle, plan-changed banner, offline cache, empty, loading, error) and L2 (Load plan: checks, count confirm, short units, the gate, loaded, held, the VEH003 → VEH036 swap reload), L3 (flag exception sheet, the outbox-driven sent, saved and failed states) and L4 (what changed between plan versions, acknowledge, begin loading) built, checked and compared against Figma. L1.7 (tablet master-detail at 1024 px and wider) is built as L5. The state gallery holds every frame the loader prompt lists (42), all compared against Figma, and `npm run test:loader-stories` plays both stories in a browser.

## How to run

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173/loader/dock?dock=peliyagoda        Priya's dock
# http://localhost:5173/loader/dock?dock=kandy&at=04:14     Ruwan's dock, v4 no change
# http://localhost:5173/loader/vehicles/VEH003/trips/1/flag?dock=peliyagoda&date=2026-09-29&at=02:55&dev=1   Priya's flag
npm run compare -- loader L1.1 L1.3 L2.1-A L2.3-A L2.4 L2.5 L2.6-A L2.6-B --base http://localhost:5173
```

`?dock=peliyagoda|kandy` sets which dock this tablet is at and saves it (`settings` table); without it, or on a first run with nothing saved, a plain dock picker asks once. This picker is not a designed screen (loader prompt section 3 allows it) and is kept out of the main UI.

## The two stories

- **Priya, Peliyagoda.** Open `/loader/dock?dock=peliyagoda`. Acknowledge plan v3 (PIN `1234`), open VEH003 or VEH035's load plan, check each order (the count stepper is prefilled, lower it for a shortfall), confirm the gate with a PIN. To play the swap, open `/loader/dock?dock=peliyagoda&date=2026-09-29&at=02:55&dev=1`, acknowledge v3, open VEH003, **Flag issue**, **Vehicle check failed**, **Send to Dispatch** (PIN `1234`), then tap **Dispatch decides now** (the tab on the top edge) instead of waiting for 03:00. **Review change** opens L4: what changed (ORD1002 removed, VEH003 → VEH036), **Acknowledge and load VEH036** (PIN), then **Begin loading VEH036** opens VEH036's load plan.
- **Ruwan, Kandy.** Open `/loader/dock?dock=kandy`. Acknowledge plan v3 (PIN `5678`) first (so there is a version to compare against), then once Peliyagoda's plan reaches v4 the Kandy dock shows "Plan v4: no change to your vehicles" and asks for a fresh acknowledgement (L1.6 A/B), then load VEH039 (L2.1 to L2.4) and confirm the gate.

## Demo PINs

Priya `1234`, Ruwan `5678` (PRD v3 assumption A36). Both are offered at both docks (their `dock` in `fixtures.ts` is their home dock, informational only). "Other…" takes a typed name plus the guest PIN `0000` and is recorded as the actor under that name.

## `LoaderApi` and the mock server (`src/screens/loader/`)

- `fixtures.ts`: docks, people, PINs and the guest PIN, plan v3 and v4 trips for VEH003, VEH035, VEH036, VEH011 (Peliyagoda) and VEH039 (Kandy), copied from PRD v3 §4c's "Plan v3 trips" and "Pinned orders" tables.
- `LoaderApi.ts` / `mockLoaderApi.ts`: one in-memory server per app session. `getDock`, `getLoadPlan`, `getPlanDiff`, `getException`, `getCurrentVersion` read it; `acknowledgePlan`, `recordCheck`, `confirmLoaded`, `flagException` write it. Every write applies to the mock server at once (so the screen never waits on the network to show a check as saved) and is also enqueued under `loader.ack`, `loader.check`, `loader.confirmLoaded` or `loader.exception`, so the outbox, the sync engine and the connectivity chip all see it the same way a real write would behave. The VEH003 "Vehicle check failed" exception resolves into plan v4 at the scenario's 03:00, or at once via `devResolveExceptionNow`, which the **Dispatch decides now** tab (`?dev=1`) calls.
- `LoaderProvider.tsx` / `LoaderContext.ts`: creates the one `LoaderApi` for the session, resolves the dock, and remembers the last person to enter a PIN this session (`currentPerson`) as the actor for a write the frames never re-prompt for, such as a per-order count confirm.
- Reads go through `useFieldQuery` (`field/offline/query.ts`): cache-then-network, falling back to the last cached value on a `NetworkError` and marking it stale (L1.S-3, L2.S-3).

## L1 Dock (`src/screens/loader/dock/`)

`Dock.tsx` is presentational (a `view`, an `alert`, a list of vehicle cards, a pinned acknowledge button); `DockContainer.tsx` wires it to `LoaderApi`, the scenario clock and connectivity for the live route, and the state gallery builds the same `Dock` and `VehicleCard` straight from literal fixture props, per frame. `VehicleCard.tsx` is the vehicle row (L1.1 to L1.6), including the held variant with its "Go to VEH0xx" shortcut.

## L2 Load plan (`src/screens/loader/loadplan/`)

`LoadPlan.tsx` is presentational and covers every L2 phase: the in-progress checklist with each order's inline count-confirm (no sheet: the row itself expands, matching L2.1 B's taller frame), the gate, two different "loaded" layouts (L2.4's plain summary with "Who already knows" for a normal vehicle, L2.6 B's capacity bars and full order list for the swap), the held/frozen read-only list (L2.5), and the empty, loading, offline and error states. `LoadPlanContainer.tsx` wires it to `LoaderApi`. The reverse-stop-order check row reuses `LoaderCheckCard` (field conventions LIB1), extended this phase with a `planned` state (the held list's read-only pill) and a `protectedOrder` flag (OUT012's lock tag in place of its brand tag).

## L3 Flag exception (`src/screens/loader/flag/`)

`FlagSheet.tsx` is the bottom sheet over the load plan: **What's wrong?** (L3.1, the six types), the details for the chosen type (L3.2 A for a failed vehicle check, L3.2 B for an order), then it follows the flag: **sending** (L3.4 C), **sent, Kumari reviewing** (L3.3 A) and **decision made, plan v4** (L3.3 B). `FlagStatus.tsx` draws the two full screens that replace the sheet: **saved on this tablet** (L3.4 A, offline) and **couldn't send** (L3.4 B). `FlagContainer.tsx` wires them to `LoaderApi` and the outbox.

The flow runs at `/loader/vehicles/:vehicleId/trips/:trip/flag` (the load plan stays behind the sheet). "Flag issue" opens the type chooser; "Flag shortage" on L2.2 opens Missing item with that order and the units short already filled in. **Send to Dispatch** asks for a PIN (`PinSheet`), then saves the flag in the outbox. What the sheet shows comes from that outbox record, not a timer: waiting while online is "sending", waiting while offline is "saved on this tablet", an error is "couldn't send" (Retry runs `runSync({ force: true })`), accepted is "sent". A failed vehicle check holds the vehicle at once (L1.4, L2.5) and Dispatch decides it into plan v4 at 03:00 on the scenario clock; **Review change** then opens L4.

**Every other flag only reaches Dispatch** (PRD v3.1 G-14, no designed resolution): the sheet stays at "sent", the status line becomes "Kumari has seen this" once Dispatch opens it, and no plan version follows. Add `?dev=1` (or `?presenter=1`) to show a **Dispatch decides now** button, which decides the VEH003 check or marks any other flag seen, so the flow can be played without waiting for 03:00. In API mode the real dispatcher does this at D8 (PRD v3.1 section 13).

An optional photo (Vehicle check failed, Damaged item, Wrong item, Other) uses the device camera where there is one and the file picker where there is not (A58), compressed to JPEG at 1600 px and quality 0.7 (A57), and uploads after its record.

## L4 Plan changed (`src/screens/loader/changes/`)

`PlanChanged.tsx` is presentational: the diff in the order the prompt asks for (Removed, loudest; Changed; Unchanged; the new trip 1 capacity; the vehicles with no change, collapsed), the pinned **Acknowledge and load** with its "You'll enter your PIN" helper, and the states around it: **acknowledged** (L4.2), **no change for this dock** (L4.3, still needs acknowledging), **up to date** (L4.S 1), **loading** (L4.S 2), **offline, may be missing a newer version** (L4.S 3) and **couldn't load, Retry** (L4.S 4). `ChangesContainer.tsx` wires it to `getDock` and `getPlanDiff` at `/loader/changes`. The diff runs from the version the dock last acknowledged to the current one; once this screen acknowledges, it keeps showing that same diff (L4.2) instead of reading the new version as the old one. **Begin loading** goes to the first changed vehicle's load plan.

## L5 Tablet master-detail (`src/screens/loader/tablet/`)

At 1024 px and wider the dock and load plan share one screen (frame L1.7, 1024 x 768). `TabletShell.tsx` draws the app bar (Waypoint Load, tabs, date line, sync chip), a 360 px master pane and the detail pane. `TabletDock.tsx` owns the dock query and passes it to `DockContainer` (`embedded`, so a card selects its vehicle and has no action button); the detail pane is `LoadPlanContainer` in `embedded` mode. The selected vehicle comes from the URL (`/loader/vehicles/:id/trips/:n[/flag]`); on `/loader/dock` it is the next vehicle to load once the dock is acknowledged, and a placeholder while the dock is locked. `LoaderApp.tsx` uses a layout route (`DockRoutes`) that renders `TabletDock` on wide screens and an `Outlet` on phones, so the phone screens are unchanged. `WideColumn.tsx` centres L4 at 720 px.

## Playwright run of both stories

`npm run test:loader-stories` (`scripts/loader-stories.ts`, needs the dev server; `-- --base http://localhost:5199` for another port, `-- --headed` to watch) plays both stories at 390 x 844 in Chromium. Mock state lives in memory, so each story stays in one page session after its first load and every later step is a tap.

- **Priya, Peliyagoda, from 02:55:** acknowledge v3 (PIN 1234), open VEH003, flag Vehicle check failed, send with PIN, Kumari reviewing; the tablet goes offline (the chip says Offline) and back online; Dispatch decides, the sheet reads plan changed to v4; review the change (ORD1002, VEH036), acknowledge v4 with PIN, begin loading VEH036.
- **Ruwan, Kandy, from 04:14:** acknowledge with PIN 5678, open VEH039, check ORD2003, ORD2002 and ORD2001 (the progress reads 1, 2, 3 of 3), confirm loaded with PIN, and see it cleared.

It checks there is no horizontal overflow on the offline step and the change screen, fails on any uncaught page error, and saves `.compare/loader-stories-fail.png` when a step fails.

## State gallery

`/loader/_states` registers all 14 of L1's frames (L1.1 to L1.7, the four L1.S states) and all 13 of L2's frames (L2.1 A to L2.6 B, the four L2.S states). It also registers all 8 of L3's frames (L3.1, L3.2 A and B, L3.3 A and B, L3.4 A to C) and all 7 of L4's (L4.1 to L4.3, L4.S 1 to 4): 42 frames in all. `npm run compare -- loader --all` renders every one beside its Figma screenshot. `npm run compare -- loader <id>` matches each against its Figma screenshot; `PinSheet`'s `demoPhase`/`demoDigits` props and `LoadPlan`'s `demoExpanded` prop freeze a sheet or a row open for the frames that need it (L1.2 B/C, L2.1 B, L2.2, L2.3 B).

## Departures from the Designathon design (loader)

- **L1.1 / L1.5 locked cards.** A locked card with no diff shows no action at all; a locked card with a diff shows "Acknowledge vN first" and its own disabled button. The build shows the detail line and button only when the card carries a Changed/No change tag, so one rule reproduces both L1.1 (bare) and L1.5 (detailed) exactly.
- **VEH035's checked count.** L1.3 reads "3 of 4 orders checked" at 00:10, L1.4 reads "3 of 5" at 02:56, with no event between them that checks a 5th order. The state gallery keeps both numbers verbatim (literal per-frame fixtures); the live dock computes VEH035's progress for real, starting at 0, since it is not part of either hero story and the two frame numbers are not reconcilable with one running total.
- **L2.4 vs L2.6 B's "loaded" layout.** The frames draw two different confirmations: L2.4 is a plain icon-tile summary with a "Who already knows" reassurance list, L2.6 B is a green banner with capacity bars and the full checked order list. The build keeps both, switching on whether the vehicle is a swap (`swap` prop present).
- **Per-order checks carry no PIN step**, matching L2.1 B exactly (stepper, then "Confirm N units", no keypad); the record's actor is the last person who entered a PIN this session (`currentPerson`), falling back to `"unknown"` if nobody has yet. Only the dock acknowledgement and the L2 gate ask for a PIN, as drawn.
- **L3's four types with no details frame** (Damaged item, Wrong item, Warehouse shortage, Other). Figma draws details only for Vehicle check failed (L3.2 A) and Missing item (L3.2 B). The first three reuse the Missing item layout with their own heading, icon and "Units damaged / wrong / short" label; Damaged item and Wrong item also offer the photo tile as evidence. Other asks "What happened?" with a typed note. Wording the frames do not give: "Tell Dispatch in a sentence.", the PIN sheet title "Send flag for VEH003", "Who's flagging?" and "Flag from Priya", the sent line for a non-vehicle flag ("Dispatch has your flag. You can keep loading the other orders.") and "Kumari has seen this".
- **L3.2 B lists three orders; the live sheet lists every order on the trip.** The frame shows ORD1001, ORD1011 and ORD1014 of VEH003 trip 1's five. The gallery frame keeps those three, with ORD1011 drawn without its Chilled tag; the live sheet draws the tag on every chilled order, as PRD 4c has them.
- **"Flag shortage" opens Missing item.** The Figma link from L2.2 goes to L3.2 B (Missing item), so that is the type prefilled, not Warehouse shortage.
- **Type labels.** Figma draws "Warehouse shortage" and "Vehicle check failed" on one line, running into the tile's padding. That is what 390 px and wider does; on a narrower screen the label wraps instead of leaving its tile.
- **No phone number.** "Call Dispatch" (L3.4 A) has no number to dial and does nothing yet: the app holds no phone numbers (field conventions section 12), only "Peliyagoda dispatch desk" as drawn.
- **L3.4 A and B have no back chevron**, as drawn; "Keep waiting" returns to the dock. Their top bar reads "Peliyagoda", without "dock", as the frames do.
- **Esc or a scrim tap on the details step returns to the type list** rather than closing the sheet, so a wrong type is one step to undo; Cancel on the type list closes it.
- **L4's deferral pill icon.** The Removed card's "Deferred · policy → Wed" pill is drawn with a curved arrow; the shared icon set has no matching glyph, so it uses `calendar-clock`, which says the same thing (moved to a later day).
- **L4 titles are links to the dock.** The screens have no back chevron, as drawn, so the title ("Plan v3 → v4") is the way back.
- **Wording the L4 frames do not give.** The v3-to-v4 case of "no change" for a dock other than Kandy reads "v4 did not change your vehicles."; the acknowledged-but-no-diff case returns to the dock instead of showing an empty diff; the expanded "no change" list reads "VEH035: same trips, same orders as v3".
- **The phone's gate has only the confirm button once every order is checked.** L2.3 A draws no Flag issue button there, only "Confirm loaded: clear to depart" and "You'll enter your PIN". Flag issue returns if an order is unchecked again, and the tablet detail pane keeps it as L1.7 draws.
- **The tablet's Issues tab is drawn but inert.** L1.7 shows it; the loader has no designed Issues screen, so it does nothing.
- **No visible gate helper in the tablet detail pane.** L1.7 draws the pinned gate row without the helper line; it stays in the page for screen readers.
- **Compact checked rows.** On L1.7 a loaded row drops its brand tag and zone line; `LoaderCheckCard` takes `compact` for it.
- **L4 on a wide screen.** There is no tablet frame for L4, so it is centred in a 720 px column.
- **Long order-ID lines wrap** with a trailing dot on a long list, rather than being cut.
- **Sheets stay a centred bottom sheet at tablet width**; no tablet frame draws one.
- **The dev control is a tab on the top edge.** It used to sit in a corner and covered the pinned action on L4 and the dock; no loader screen puts anything on the top edge, centre.

## Shared files this role has changed

- `field/components/PinSheet.tsx`: two new optional props, `demoPhase` and `demoDigits`, so the state gallery can freeze the sheet on its success or wrong-PIN frame without a fake timer. No existing prop or behaviour changed.
- `field/components/LoaderCheckCard.tsx`: a `compact` prop (L1.7's loaded row), a `planned` state (L2.5's read-only pill), a `protectedOrder` flag (a lock tag in place of the brand tag), and a `"{n} short"` tag next to the position tag when `state` is `short`. No existing prop or behaviour changed.
- `field/format.ts`: added `formatCountdown(minutes)` ("in 3 h 45 min", "in 56 min").
- `field/offline/query.ts` (new) and `field/offline/index.ts`: `useFieldQuery`, the cache-then-network read hook every field screen's offline state needs. Exported alongside the rest of `field/offline`.
- `vite.config.ts`: `server.fs.allow` now adds the real parent of `node_modules` only when it resolves outside the project directory (a worktree with a symlinked `node_modules`); a normal checkout is unaffected.
- `shared/ui/Icon.tsx`: two new names, `archive` and `wrench`, which L3.1 draws. Additive.
- `field/components/BottomSheet.tsx`: a gallery (non-modal) sheet now draws the 60 percent scrim Radix leaves out and no longer pulls focus into its frame, so the L1.2, L2.3 B and L3 frames dim their screen as Figma does; a tap on anything carrying `data-keeps-sheet-open` (the dev controls, and the presenter control when it lands) no longer dismisses an open sheet. The live modal behaviour is otherwise unchanged.
- `field/offline/query.ts`: `useFieldQuery` also returns `refresh()`, a background re-read that keeps the current screen, alongside `retry()`, which resets to loading. Polling and refreshing after a write used `retry`, which blanked the whole screen and unmounted an open sheet every 15 seconds; they use `refresh` now.
- `scripts/compare-frames.ts`: waits 500 ms before capturing, so a sheet is shown settled rather than sliding in.
- `docs/ai-disclosure.md` (new): the table Contributing.md section 29 asks for, with this branch's row.

## Phases

- [x] L0 types, fixtures, `LoaderApi` and mock server
- [x] L1 Dock: every state, PIN acknowledgement, countdowns, offline cache
- [x] L2 Load plan: checks, count confirm, short units, gate + PIN, loaded, held, swap reload
- [x] L3 Flag exception sheet
- [x] L4 Plan changed
- [x] L5 L1.7 tablet master-detail
- [x] L6 Playwright run of both stories, final README pass

---
