<!-- Build log moved out of README.md so the README reads as the deliverable. -->

# 🚚 Driver (Waypoint Driver)

Nimal's app: today's stops, offline-first, one decision at a time. Built in `frontend/`. Branch: `feature/driver`, cut from `develop` after `feature/field-foundation` merged. Driver prompt 3 (`claude/field-build/03-driver-core.md`) covers the shell and the hero delivery path (R1 Route, R2 Stop detail, R3 Record outcome, the Me tab); the outbox sheet, sync, conflicts and notifications (R4, R5, R8) are prompt 4, and problems, history, the GPS tracker, finish run and calendar days (R6, R7, R9, R10) are prompt 5.

**Status:** R1 to R3, the Me tab and driver prompt 4 (R4 Outbox, R5 Sync result, R8 Notifications, the conflict and its resolution) are built, checked and pushed. D0 to D5 and O1 to O6 (below) are done, except the physical-phone check, which needs a person with a phone (see "Real devices").

## How to run

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
npm run dev:https        # self-signed HTTPS on the LAN: the real camera needs a secure context on a phone
npm run compare -- driver R1.1 R3.1   # frame screenshots beside Figma (needs the dev server and .figma/<id>.png)
npm run test:hero        # the hero path end to end against a running dev server (see "Checks run")
npm run test:hero -- --partial   # the same, ending with the presenter's "Keep as Partial (10 of 12)"
npm test                 # vitest, 55 tests
VITE_API_BASE=http://localhost:8000 npm run build && npm run preview   # then, in another terminal (the API on :8000, :4173 in CORS_ORIGINS):
npm run test:offline -- --base http://localhost:4173   # the production build works with no network, then syncs
```

Add `?presenter=1` to any driver URL to get the presenter controls in the Outbox sheet (see "The Outbox").

| Route | Screen |
|---|---|
| `/driver`, `/driver/run` | R1 Route |
| `/driver/stops/:stopId` | R2 Stop detail |
| `/driver/stops/:stopId/outcome` | R3 Record outcome |
| `/driver/me` | R1.9 Me tab |
| `/driver/issues` | R6 Issues (placeholder; driver prompt 5) |
| `/driver/history` | R7 History (placeholder; driver prompt 5) |
| `/driver/notifications` | R8.1 Notifications, R8.4 when empty |
| `/driver/notifications/photo/:blobId` | R8.3 Photo failure detail |
| `/driver/sync-result?view=conflict`, `synced`, `resolved` | R5 Sync result |
| `/driver/finish` | R9 Finish run (placeholder; driver prompt 5) |
| `/driver/_states` | The state gallery (dev only; `?frame=ID` renders one frame full screen) |

**The scenario clock.** `?at=HH:MM` starts the clock there and lets it tick in real time; `?date=YYYY-MM-DD` picks the day (default Tue 29 Sep 2026). Without `?at=` the driver starts at 04:45, the first frame's own time. There is no presenter control on this role (that is the Store's): to move through the hero timeline quickly, re-open a route with a later `?at=` rather than waiting in real time; the phone's local state (acknowledged, departed, each stop's arrival and outcome) is in IndexedDB and survives the navigation, so this is how the hero walkthrough script moves between H5 and H14.

**The hero path** (PRD H5 to H14, driver prompt 3 section 2): 04:45 route known, not yet downloaded (R1.3 A) → tap Acknowledge v4, downloads (R1.2 A), ready offline (R1.2 B) → tap again, acknowledged, Ruwan's gate confirmation shows once past 04:50 (R1.3 B / R1.4) → 05:10 Start route (R1.5) → 05:17 the Kandy corridor drops coverage for real (R1.6) → 05:26 arrive OUT084 before its window, wait for 05:30 (R2.2 A) → window open, record Delivered for ORD2001 and ORD2002 with a photo and a receiver name (R3.1 → R3.7, which turned out to be the Run screen itself, see "Departures") → 05:48 arrive OUT087, already inside its window → 05:58 record Delivered for ORD2003 → 05:59 all stops recorded, five records waiting on the phone (R3.9 / R3.10).

## The theme rule and text size

The sunlight switch (R1.9) wins when it is on, forcing Field; otherwise the phone's own `prefers-color-scheme` decides Dark or Light, per the R1.9 copy ("Dark mode follows your phone's setting"). Verified in a real browser: toggling the switch flips the role root's `data-theme` at once and the choice survives a reload (`DriverProvider`, backed by the field database's `settings` table).

Text size (Standard / Large) scales the body content, not the chrome: `DriverShell` applies CSS `zoom: 1.15` to the scrollable `<main>` when Large is chosen, so the top bar and tab bar stay their fixed size while everything else — type and the spacing around it together — grows. `zoom` is Chromium and WebKit only (not Firefox); the project's own tooling (Playwright, the compare script) and real phones (Chrome, Safari) are both covered, so this was the pragmatic choice over rewriting every driver stylesheet's fixed-px type scale into a parallel rem-based one.

## Language

The `t(key, params)` dictionary (`i18n.ts`) is complete in English and routes every driver string, as the brief asks. Sinhala and Tamil are still empty and fall back to English, exactly as driver prompt 3 scoped it ("filled in prompt 5"); when they are filled they will be a machine draft needing a native-speaker review (open decision O-8), not reviewed as of this PR. Language labels in the Me tab picker are always shown in their own script regardless of the chosen language.

## Offline and the Kandy corridor

`DriverProvider` runs a real connectivity gate (`field/offline`'s `connectivity.setGate`) that closes at Tue 29 Sep 05:17 and reopens at 06:40, the **coverage profile**: the Kandy gap. The presenter's "Kandy corridor coverage gap" switch (under `?presenter=1`) turns the profile on and off, and **Simulate offline** in the Outbox holds the phone offline whatever the clock says. This is independent of a real network drop: the Playwright hero walkthrough exercises both, dropping the browser's own connection with `context.setOffline(true)` as well as letting the scripted gate do its job, and both agree once the clock passes 05:17.

`getRun` reads the phone's own cache and never throws offline, since the route has to be usable with no signal by design; writes (`acknowledgePlan`, `startRoute`, `recordArrival`, `recordOutcome`) update that same cache at once, so the screen reflects them immediately, and queue an outbox record (`driver.ack`, `driver.startRoute`, `driver.arrival`, `driver.outcome`) that the shared sync engine sends once it can. The mock server applies the v5 conflict rule from driver prompt 4 (see "Sync result and the conflict").

**Known gap, a team call:** records already waiting when the app opens online are sent by the 30 s timer or the next `online` event, not at once. Nothing is lost, but a reload leaves them for up to 30 s. Syncing at start would be friendlier on a phone, but it would also change the hero walkthrough's offline reloads, which load a page online for a moment, so it is left as is until the team decides.

## The Outbox (driver prompt 4, O2)

The connectivity chip on every driver screen opens the R4 Outbox sheet (`screens/driver/outbox/`). It is a read of the phone's own outbox (`useOutbox()`) and connectivity (`useConnectivity()`), so it never touches the network. One bar says what the device is doing, in this order: sending ("Sending 5 records…", with "3 / 5" also on the chip), offline ("Offline · 5 saved on phone", "Last sync 05:17"), failed and retrying, sent for review ("1 stop (2 orders) sent for review. Nothing for you to do."), or all synced (the empty state). The rows are the driver's own events in save order: Departed, Arrival, and one outcome per order. The plan acknowledgement is not listed. A conflict row reads Synced again once Dispatch has resolved its stop.

- **Simulate offline** (the "Prototype" row) is the foundation's real `connectivity.setSimulatedOffline`: it persists, and every screen reacts.
- **Send now** and **Retry now** call `connectivity.sendNow()`, which forces a run past the 30 s wait. Pressing it repeatedly joins the run in flight, so nothing is sent twice. Offline it sends nothing and loses nothing.
- **Presenter controls** appear in the sheet only under `?presenter=1`: the Kandy corridor coverage gap switch, "Fail next photo upload", and "Dispatch resolves now: Keep delivery" or "Keep as Partial (10 of 12)" while a conflict is open.
- The chip gains two drawn variants: "3 / 5" while syncing, and "Retrying 1" while a failed record waits for its automatic retry.

## Sync result and the conflict (driver prompt 4, O3)

R5 (`screens/driver/sync/SyncResultScreen.tsx`, route `/driver/sync-result?view=conflict|synced|resolved`) says plainly how the run stands after a sync. It is one screen with seven frames: what went out and what went to Dispatch (R5.1), all synced (R5.2), Dispatch's decision (R5.3), and offline again, sync failed, nothing to sync and loading (R5.S). Every count is read from the same rows the Outbox shows (`outboxRows`), so the two cannot disagree. R5.1's two conflicting orders are one row, "Delivered ORD2001 + ORD2002", and the 05:21 and "store's request" wording comes from the conflict the mock server returned (`ConflictDetail.changedAt` and `changedBy`, added for this).

**When it shows** (`sync/syncView.ts`). Only a catch-up run counts: the phone had been offline with records waiting, the run was not cut short, something went out, and nothing failed. A single record sent from the road a moment after it is saved is not a "sync result". The result is queued once and shown the next time the driver is on the Run screen, or over an open Outbox. The outcome screens never enable it, so it can never interrupt R3 while recording. It survives a reload while unseen, and so does "the phone was offline", so an app killed offline still tells the driver once it syncs. A resolution from Dispatch queues R5.3 once per stop.

**While a conflict is open** and the phone is online, `useSyncWatcher` (mounted by the shell, so on every driver screen) asks `getNotices` every 30 s of scenario time and after every sync. When Dispatch's decision lands on a stop the run switches from R1.7 to R1.8 by itself and R5.3 shows once.

**R1.7 and R1.8 are real.** The run screen's all-recorded layout reads the stops: a stop with an open conflict is "Sent for review" with the amber bar and View (which opens the Outbox on the conflict); a resolved stop reads Delivered, or Partial, with the green bar. While records still wait it is R3.9 and R3.10, the same layout with "5 on phone" and Saved on phone pills. `RunScreen`'s gallery-only `reviewNotice` prop is gone. Frames R1.7, R1.8 and R5.1 to R5.S 4 are in `/driver/_states` and were compared against Figma with `npm run compare`.

## Photos after records, and the failure branch (driver prompt 4, O4)

A stop's photo and signature belong to its first record and upload only after that record has reached the server, one at a time in the order they were taken. `recordOutcome` ties them to the record before it is queued: queueing starts a sync at once, and until now nothing called `attachBlob`, so a photo had no owner and the engine would have sent it ahead of the delivery it proves.

A failed upload never fails its record. The record reads Synced, the photo stays on the phone, and the phone retries it every 30 s (or at once on Retry or Try again).

- **R8.2, the alert on the run.** "Couldn't send photo of stop 1. Kept on phone." with Retry. The alert text opens R8.3; Retry sends now. The progress pill reads "1 on phone", and the stop reads "Delivered 05:42 · photo still on phone" with a "Photo on phone" pill. The alert takes the bar's slot ahead of the under-review notice, since it is the one the driver can act on; the stop's own pill still shows a stop under review.
- **R8.3, the detail** (`sync/PhotoFailureScreen.tsx`, route `/driver/notifications/photo/:blobId`): what failed, what is safe, when it was taken, the last try, when the delivery record synced, and the reference WP-SYNC-409. Try again sends now; View outbox opens the sheet, whose bar reads "1 photo didn't send. Retrying automatically every 30 s." When the photo gets through the driver is taken back to the run and the alert is gone. The notifications list links its "Sync failed" entry to the same route.
- **One notice per photo.** The phone retries every 30 s, so the "Sync failed" notice is kept once per photo with the time of the latest try, and names the real stop from the photo's record (it used to say stop 1 for every photo).
- **A failed photo is not a failed sync.** The R5.S 2 "Sync failed" screen is for records that did not send; a photo that will not send is the run's alert, and R5.1 still shows the records that got through.

## Notifications and the bell (driver prompt 4, O5)

R8.1 (`notices/NotificationsScreen.tsx`, route `/driver/notifications`) lists only the changes that affect the driver's own run, newest first, and R8.4 is its empty state. The notices live in the phone's own cache, so they are there offline and survive a reload. The bell on every driver screen counts the unread ones; it is a number, never a bare dot.

- **What it holds:** Dispatch resolved a stop; sync failed (a photo); delivery sent for review; N records synced (what went out, listed); plan v5 received (the first time a sync reaches the server); you went offline (once per spell of no coverage); orders on board (the load confirmed); plan released. Filters: All, Sync, Dispatch, Run.
- **Opening one** marks it read and leads where the navigation map says: resolved to R5.3, sent for review to R5.1, sync failed to R8.3, records synced to the Outbox. Plan and load entries are information only. "Mark all read" clears the count and the bell badge.
- **Born read:** the plan release and the load confirmation are things the server told the phone before the day began, so they arrive read; the bell counts what needs a look. The same goes for "You went offline".
- **A batch, not every record:** "N records synced" appears when two or more arrivals or deliveries go out together. One record sent from the road a moment after it is saved raises nothing.

## Real devices, the service worker and the iOS note (driver prompt 4, O6)

- **Offline after one visit.** The production build registers a service worker (`vite-plugin-pwa`). `npm run test:offline` checks it against the real API (a production build runs nothing else): after one visit it sets the browser offline, reloads, and checks that the cached run is on screen, that a departure recorded offline survives a reload and has not reached the server, that the Me tab shows storage used, and that once the network returns the departure reaches the server. It resets the demo first. This passes on desktop Chromium.
- **Storage.** `startFieldRuntime` asks `navigator.storage.persist()` at first run; the browser decides, and desktop Chromium usually says no for a new origin. The Me tab shows "N MB used" from `navigator.storage.estimate()`.
- **iOS has no Background Sync API.** Safari on iPhone will not wake the app to send records. Syncing happens only while the app is open: on the `online` event, on the 30 s timer, and on "Send now". A driver who records a stop in a dead zone and closes the app sends nothing until the app is opened again with coverage. The app does not register a background sync on Android either, so it behaves the same way there.
- **The physical-phone check has not been done.** It needs a person with a phone. Checklist, on a production build served over HTTPS (`npm run build`, then any HTTPS host):
  1. Android (Chrome) and iPhone (Safari): open the app once with coverage, then Add to Home Screen and open it from the icon.
  2. Acknowledge plan v4 and start the route, with coverage.
  3. Turn airplane mode on at "05:17" (or turn on Simulate offline in the Outbox).
  4. Record the whole of stop 1 with a real photo from the real camera, a receiver name and Delivered for both orders, then stop 2.
  5. Kill the app from the app switcher. Reopen it with airplane mode still on: the run, the five waiting records and the Outbox must all be there.
  6. Turn airplane mode off. Open the app and press "Send now" if nothing moves within 30 s. Watch R4.2, then R5.1.
  7. Note anything that differs: the camera permission prompt, the keyboard covering the receiver name, the bars sitting under the browser chrome, the storage reading on the Me tab.

## Camera, signature and receiver name

`CameraCapture` opens a real `getUserMedia({ video: { facingMode: "environment" } })` viewfinder with a shutter; if the camera is unavailable or permission is refused it falls back to `<input type="file" accept="image/*" capture="environment">`, per field conventions and PRD A58. Headless Chromium has no camera, so every photo in the gallery, the hero walkthrough and this PR's own testing went through the file-input fallback; the live viewfinder path has not been tried on a physical phone in this PR (do that over `npm run dev:https` before the judge walkthrough). Captured photos are compressed with the shared `compressImage` (JPEG, longest edge 1600 px, quality 0.7, PRD A57) and stored with `saveBlob`. `SignaturePad` is a pointer-events canvas saved as a PNG blob. `ReceiverNameForm` offers per-outlet recent-name chips from the fixtures.

## Phases

- [x] D0 types, fixtures, `DriverApi` and mock, sync handlers
- [x] D1 shell: top bar, banner, tab bar, theme rule, text size, the `t()` dictionary, Me tab
- [x] D2 R1 Route, every state (R1.1 to R1.6, R1.10, R1.S)
- [x] D3 R2 Stop detail, every state (R2.1 to R2.3, R2.S 1 to 4)
- [x] D4 R3 Record outcome: all five outcomes, the per-order grid, camera, receiver name, signature, validation (R3.1 to R3.11)
- [x] D5 state gallery, a compare pass against Figma, the hero-path Playwright walkthrough, this section

Driver prompt 4 (`claude/field-build/04-driver-offline.md`):

- [x] O1 mock server: plan v5, the conflict rule, grouping by stop, notices, the 06:44 resolution, dev controls, the coverage profile
- [x] O2 R4 Outbox sheet, Simulate offline, Send now and Retry now (frames R4.1, R4.2, R4.3 1 to 3)
- [x] O3 R5 Sync result (R5.1 to R5.3, R5.S 1 to 4), R1.7 and R1.8 on real data, the 30 s conflict poll
- [x] O4 photo upload after records (attached before queueing, in capture order), R8.2 and R8.3 failure branch with retry
- [x] O5 R8 Notifications list (R8.1), empty (R8.4), the bell count, mark read
- [x] O6 gallery, compare, remaining tests, the offline production-build check, README. The physical-phone check is written down above and still needs a person with a phone

## Departures from the Designathon design

Figma wins on UI and copy (field conventions section 2); where it was silent or where building exactly what it drew was impractical, this is what was built instead, and why. Numbered departure rows now collide across parallel branches, so these are prose, not register rows; HH numbers them centrally.

- **R1.3 B and R1.4 are one state, not two.** Both show the plan acknowledged and the loader confirmed, not yet departed; the only difference Figma draws (R1.4 additionally shows the Will-wait and Chilled tags and the Navigate button on the first stop card) reads as the same moment captured a little further along, so the build shows those consistently in both rather than toggling them off for a few minutes after acknowledging.
- **The connectivity chip's wording is inferred, not drawn as a rule.** Every pre-departure frame's chip time equals that frame's own clock time exactly ("Synced 04:54" at 04:54, "Synced 05:08" at 05:08 and so on), so the build reads it as "Synced `now`" while not yet departed, and "Online" once departed (R1.5, R1.10) or on an error/empty screen (R2.S 3, R2.S 4) — never a stored last-sync timestamp pre-departure.
- **R3.7, R3.9, R3.10 and R3.5 C are the Run screen, not separate screens.** Reading their frames side by side, all four are the same "Run 1 · VEH039" layout with a done stop shown as a compact row instead of its full card (`CompletedStopRow`), worded for the moment: "{outcome} HH:MM · saved on phone, syncs later" or "{outcome} · issue sent to Dispatch when you reconnect" mid-run (R3.5 C, R3.7), "{outcome} HH:MM · signed {name}" plus a "Saved on phone" tag once every stop is done (R3.9, R3.10). Saving an outcome in `OutcomeScreen` always just navigates to `/driver/run`, which renders the right one from the data.
- **R2's "Arrived" and "Window opened" facts are two stat tiles,** not Figma's two-row list with an inline tag on each row. Same information, a different shared-component shape; not worth a new row-list component for two call sites.
- **"All synced" and "Nothing to send" are a plain line,** not the pill Figma draws next to "N of 2 stops done". A stops-done progress bar was still added under that line once it was clear from a pixel comparison that Figma draws one.
- **Call store has no action.** The dataset has no outlet phone numbers, and field conventions section 8 bars inventing one ("use Peliyagoda dispatch desk" is the pattern for a dispatch contact, not a store's). The button is drawn but does nothing yet.
- **One shared Proof of delivery section, even in the per-order grid (R3.4).** Figma draws a single photo, receiver name and optional signature for the whole stop in every outcome layout, including when orders have different outcomes, so a Damaged order's "take a photo of the damage" instruction points at that same single capture rather than a second one.
- **Other reuses the Refused pattern exactly** (reason chips, a name field, "Dispatch will decide"), as driver prompt 3 section 6 directs, since no frame draws it.
- **(Superseded by O3) R1.7 and R1.8 were gallery-only layouts.** Both are registered in `/driver/_states` with fixture data shaped the way driver prompt 4's sync result will supply it (`RunScreen`'s `reviewNotice` prop), but nothing in this prompt produces a real review or resolution notice, since that needs the conflict rule and a plan v5 the phone does not yet know about (by design: "the phone never learns about plan v5 in this prompt").
- **ORD2003's weight and volume are not drawn anywhere** (only its 9-unit count is, on R1.2 and R2.3). Estimated from ORD2002's per-unit rate (45 kg / 0.6 m³ for 8 ambient units) as 51 kg / 0.68 m³ for 9 units.
- **R3.9 and R3.10 were realigned in O3.** Prompt 3 built them as a plain list with a green "Saved on phone" tag. The Figma frames are the same card layout as R1.7: progress row with a "5 on phone" pill, two segments, an uppercase "In trip history" label, and cards with a cloud icon, the outcome and a Saved on phone pill. The helper line sits above Finish run, and the "Delivery saved on this phone" toast is the dark card with an amber cloud after the list. It now shows only when the last outcome was just saved, not on every reopen.
- **R5.1's rows are in save order,** not Figma's (Arrival OUT084, Delivered ORD2003, Arrival OUT087, then the conflict). The order in the frame follows no rule the data has.
- **R5.3 for a Partial resolution** has no frame. It reuses the layout with the title "Kept as Partial at OUT084", the body "Dispatch kept your delivery at OUT084 as Partial · 07:05." (the prompt's copy), a Partial pill on each order, and R1.8's bar reads "OUT084 - resolved: delivered as Partial. Kumari kept your delivery at 07:05."
- **"Call Dispatch" on R5.S 2 has no action,** like "Call store": the dataset has no dispatch desk number and none is invented. The failed screen reuses the reference WP-SYNC-409 that R8.3 uses for a photo.
- **R8.3 has no bell, chip or tab bar, as drawn.** It opens from the alert on the run and from the list.
- **"You went offline" is timed when the phone notices,** not at the scripted 05:17: with a real disconnect in the walkthrough it reads 05:20. The Kandy gate frame draws 05:17; with the coverage gap switch on the two agree.
- **The bell badge is the danger colour at 18 px,** as R1.7, R1.8 and R8.2 draw it, not the amber count the foundation had.
- **R5.1 opened from an old "sent for review" entry after Dispatch has decided shows the decision (R5.3),** since the conflict it describes is gone.
- **Camera and Receiver name drop the tab bar; Signature keeps it**, matching what each frame actually draws (R3.2, R3.3 omit it; R3.11 does not).
- **The Prototype row stays on the live Outbox in every state.** R4.2 and R4.3 draw the sheet without it, but it is the only way to turn Simulate offline on while online, so the app always shows it. Their gallery frames pass `showSimulate: false` so they still match Figma.
- **"Send now" is pressable offline.** Figma draws it enabled on R4.1 (offline), and the prompt says it is only possible online; it stays enabled and does nothing until coverage returns, rather than greying out a button the frame shows live.
- **No prototype timers.** Figma's "Times out to" links (R4.2 to R5.1 after 2.5 s, R1.7 to R5.3 after 5 s, R8.2 to R5.3 after 5 s, R5.S 4 to R5.2, R1.3 B to R1.4, R1.5 to R1.6) are not built as timers. Each screen follows the data instead: R5.1 opens when a catch-up sync finishes, R5.3 when Dispatch's decision reaches the phone, and R8.2 stays until the photo sends.
- **R1.3 A, R1.3 B and R1.4 were compared in O6 and are not pixel-matched.** Their copy and order match, but Figma draws the plan card with a bold title and a smaller button, the loader line as a green card with a check (R1.3 B, R1.4) or as a clock line above an amber Start route (R1.3 A), amber "Will wait" tags and, on R1.4, Navigate after the tags. The build keeps the shared Card, Button and Tag components from the foundation as they are. Left as a departure rather than reworked at the end of the build.
- **The run's progress bar is teal and plain,** where Figma draws amber segments and, on R1.5, an "All synced" pill (see also the "All synced" line above).
- **Icons fixed in O6:** Arrive has the map-pin, Problem the alert triangle, and the Issues tab the alert circle, as drawn. The Issues tab's red count badge (R3.5 C) is not built, since Issues is prompt 5.
- **Behind the R4 sheet** Figma draws the run's subtitle as "2 of 2 stops done · Kandy" and a collapsed stop card; the build's dimmed run reads "All recorded · Plan v4" with the real cards. Both are behind the scrim.
- **Mono text is regular weight where Figma draws Medium** (IBM Plex Mono is loaded in regular only).
- **The live app now fills the screen** (`DriverShell`: `height: 100dvh` outside the gallery), so a long screen such as R5.1 scrolls inside the main area and the pinned bar and tab bar stay at the bottom. Gallery frames keep a minimum height so a tall frame grows, as the compare script expects.
- **The chip says "Synced HH:MM" after a catch-up with news, and "Online" otherwise.** R1.7, R1.8, R4.3 1, R4.3 3, R5.1 and R5.3 draw "Synced" with a time; R5.2 and R5.S 3 draw "Online". The build shows "Synced" with the last sync time on the run, R5.1 and R5.3 while a stop is under review or resolved, and "Online" everywhere else once departed. The Figma frames do not state a rule, so this is inferred.
- **Syncing and Failed are the plain muted outline on the phone chip,** as R5.S 2 and R5.S 4 draw them, not amber or red. The loader's tablet chip is unchanged.

## Shared files this role has changed

- `frontend/src/domain/field.ts`: `Stop` gains optional `parkingNote` and `unloadMinutes` (additive; R1 and R2's "Rear dock, normal parking. Allow about 15 min to unload.").
- `frontend/package.json`: two new scripts, `test:hero` and `test:offline`. No dependency or version change.
- `frontend/src/field/components/BottomSheet`: a `flush` variant (full-bleed body, 40 px grabber) and a `headerAside` slot, a z-index so the sheet and scrim sit above the shell's bars, a plain scrim in the non-modal gallery case (Radix draws none), and the flush sheet opens focused on itself. Existing sheets are unchanged.
- `frontend/src/field/components/ConnectivityChip`: `progress` ("3 / 5") and a `retrying` status ("Retrying 1"). Additive.
- `frontend/src/field/offline/blobs.ts` and `db.ts`: `useBlobs()` (null until the first read) and `lastAttemptAt` on a blob, for "Last try". Additive.
- `frontend/src/field/offline/sync.ts`: photos upload in the order they were taken (the table is keyed by a random id, so they went in a random order), and a failed upload records the time of the try.
- `frontend/src/field/components/NotificationBell`: the badge is the danger colour, 18 px, top left of the icon (R1.7, R1.8, R8.2). Additive to the count it already took.
- `frontend/src/field/components/PinnedActionBar`: `helperPosition` ("above" for R1.7, R1.8, R3.9, R3.10). Additive.
- `frontend/src/field/components/ConnectivityChip.module.css`: the phone chip's Syncing and Failed are the muted outline (R5.S 2, R5.S 4).
- `frontend/src/field/offline/sync.ts`: a call that joins a run already in flight now makes the run go round once more when it finishes. A record saved while a run was sending was never in that run's list and waited for the 30 s timer, which left "Departed" unsent in the hero walkthrough about one run in three. One new unit test.
- `frontend/src/field/offline/sync.ts`: `requeueInterrupted()`, called when the engine starts. A record left `sending` by a reload or a killed app was never retried; it now goes back to `waiting` and is sent (the server answers `duplicate` if the first send landed). One new unit test.

## Checks run (D5 and O6)

- `npm run typecheck`, `npm run lint` and `npm run build` are clean on every commit. `npm test`: 55 tests in 6 files (the conflict rule, grouping by stop, duplicates, the counts on R5 equal the outbox, a photo failure keeps its record Synced, resolution and partial resolution, notices, the outbox mode precedence, the requeue and rerun engine fixes).
- `npm run test:hero` plays 04:45 to 06:46 at 390 x 844 and passes with 64 checks (10 of 10 runs earlier in O6, plus the runs after the final changes): the offline spell, the five waiting records, the 06:40 reconnect, R5.1, the WP-SYNC-409 photo failure and its recovery, R1.7, the 06:44 resolution, R5.3, R1.8 and R8.1. `-- --partial` ends with the presenter's partial resolution instead and passes with 63. The photo failure is one section of the hero script, not a second script: it needs the same 05:42 record and the same 06:40 sync, so splitting it would only repeat them.
- `npm run test:offline` passes against the production build (service worker, cached run, a record saved offline survives a reload, storage on the Me tab).
- Pixel-compared with `npm run compare` against Figma screenshots: R1.1, R1.3 A, R1.3 B, R1.4, R1.5, R1.6, R1.7, R1.8, R2.1, R2.2 B, R2.S 1, R3.1, R3.5 B, R3.5 C, R3.7, R3.9, R3.10, R4.1, R4.2, R4.3 1 to 3, R5.1 to R5.3, R5.S 1 to 4 and R8.1 to R8.4. R4, R5 and R8 match apart from the accepted items above; R1.3 A, R1.3 B, R1.4, R1.5, R1.6, R3.5 C and R3.7 differ as listed under the departures. The other R2 and R3 frames were text-verified in D5, not pixel-compared again.
- Earlier, in D5: every registered R1 to R3 frame was read against the Figma file's own text; the sunlight switch, text size and language settings were checked for persistence across a reload.
- **Not done:** the physical-phone check (see "Real devices"); the live camera viewfinder has only run through the file-input fallback; no vitest covers `useSyncWatcher` itself (there is no React testing library in the project), and the hero script is what shows R5.3 queued once.

---
