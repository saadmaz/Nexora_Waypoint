<!-- Build log moved out of README.md so the README reads as the deliverable. -->

# 🚛 Field apps foundation (Loader and Driver)

What the Loader (`/loader`) and Driver (`/driver`) apps share, built in `frontend/`. Branch: `feature/field-foundation`, cut from `feature/store-manager-frontend` (the only Vite scaffold on the remote when this started) and meant to merge to `develop` before `feature/loader` and `feature/driver` start. The binding rules for this work are in [`field-conventions.md`](field-conventions.md).

**Status:** F1 to F6 built, checked and pushed (`tsc -b`, `oxlint`, `vitest run`, `vite build` all clean). F7 is this section. Not done yet: a pixel comparison of every field component against Figma (the Figma connection dropped mid-session; see "Still to check").

## How to run

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
npm run dev:https      # self-signed HTTPS on the LAN, for camera and GPS on a phone
npm test               # vitest: offline core and clock
npm run compare -- loader L2.1-A L2.1-B   # frame screenshots beside Figma (needs the dev server)
```

On a phone, open the `Network` address `npm run dev:https` prints, accept the certificate warning once, then use the app. `npx playwright install chromium` is needed once for `npm run compare`.

| Route | What |
|---|---|
| `/loader`, `/loader/dock` | Loader root, always Dark · pre-dawn. L1 Dock is built (loader prompt); see "Waypoint Load" below |
| `/loader/vehicles/:vehicleId/trips/:trip`, `/loader/changes` | Placeholders for L2 and L4 |
| `/driver`, `/driver/run`, `/driver/stops/:stopId`, `/driver/stops/:stopId/outcome`, `/driver/issues`, `/driver/history`, `/driver/notifications`, `/driver/finish`, `/driver/me` | Driver root, Dark for now (the theme rule lands with driver prompt 3). Placeholders for R1 to R9 |
| `/loader/_states`, `/driver/_states` | State galleries, dev only, empty until the role prompts register their frames. `?frame=ID` renders one frame at its Figma size |
| `/field/_components` | Every field component in Dark, Field and Light side by side (dev only) |
| anything else | Waypoint Store, unchanged |

## Scenario clock

`?at=HH:MM` starts the clock at that time and lets it tick; `?date=YYYY-MM-DD` picks the day (default `2026-09-29`, so Monday evening needs `?date=2026-09-28`). Without `?at=` the Loader starts at 23:45 on Monday and the Driver at 04:45 on Tuesday, then run in real time. Everything is read and shown in Asia/Colombo whatever the browser's zone (`src/field/clock/`). Use `useNow()` from `field/clock/useClock`; never call `new Date()` in a component. The Store keeps its own clock, which reads the browser's zone, so the two are separate until someone merges them.

## Offline core (`src/field/offline/`)

Import from `field/offline`. One IndexedDB, `waypoint-field`: `outbox`, `cache`, `blobs`, `settings`.

- **Save a write:** `await enqueue({ type: "driver.arrival", payload, actor, planVersionOnDevice })`. The screen shows "Saved to phone" at once. The record has a `clientId` (idempotency key), the scenario `deviceTime` and `status`. Accepted records stay, so a screen can show "Synced".
- **Plug in a record type:** `registerSyncHandler("driver.arrival", async (record) => ({ result: "accepted" | "duplicate" | "conflict" | "error", groupKey, serverPayload }))`. Throw a `NetworkError` when the device cannot reach the server; the engine puts the record back and stops. `groupKey` (for example the stop) is how R5 says "1 conflict (2 orders)".
- **Photos and signatures:** `compressImage` (JPEG, longest edge 1600 px, quality 0.7), `saveBlob({ kind, blob, recordClientId })`, then `registerBlobUploader(...)`. A photo uploads after its record; a failed upload never fails the record.
- **Read state:** `useConnectivity()` gives `status` (`online | offline | syncing | failed`), `lastSyncAt`, `waitingCount`, `simulatedOffline`; `useOutbox()` gives the records; `connectivity.setSimulatedOffline(true)` is the R4 "Simulate offline" switch; `connectivity.sendNow()` is "Send now" and "Retry now"; `connectivity.setGate(name, open)` adds a condition such as the Kandy coverage gap.
- **Engine:** runs on the `online` event, every 30 s while anything waits (errors retry 30 s after they fail) and on Send now; sends in order; one run at a time, so pressing Send now repeatedly sends nothing twice; emits a grouped `SyncResult` through `onSyncResult`. A conflict is recorded and never retried. There is no Background Sync API: iOS Safari lacks it, so sync only runs while the app is open.
- **Mock API:** go through `request(op, payload)` (`transport.ts`): 300 to 600 ms latency, `NetworkError` when offline, answers from `registerMockHandler`. Swap `setTransport` for a `fetch` transport when a role is wired to the real API. No screen calls `fetch` or reads a fixture directly.

## Components (`src/field/components/`)

`FieldTopBar`, `ConnectivityChip` (Online, Synced 04:54, Offline · 5, Syncing, Failed 06:42), `NotificationBell`, `OfflineBanner` (five tones), `FieldTabBar`, `BottomSheet`, `PinSheet`, `PinnedActionBar`, `UnitsStepper`, `LoaderCheckCard` and `DriverStopCard` (the two densities of the Master Order Component), `FieldSwitch`, `ChoiceChips` (Text size and Language on R1.9). `PinSheet` takes an async `verify(personId, pin)` and an `onConfirmed` callback and knows nothing about plans. Pills, tags, alerts, state screens and toasts are the shared ones, extended where a field frame needed it. Sheets read their role's theme from `RoleRoot`'s context, because Radix portals render outside the role root.

## Departures from the Designathon design (foundation)

| Frame | Day 5 | Build | Why |
|---|---|---|---|
| L1.2 A to C, L2.3 B | "Other…" has no design | Selecting it shows a "Your name" field above the keypad | A person who is not Priya or Ruwan needs a name for the record (loader prompt, README departures) |
| L1.2 A | The sheet shows no vehicle card inside it | `PinSheet` takes an optional `context` card, off by default | Matches the frame; L2.3 B's prompt text names a context card, so it is there when a screen wants it |
| L1.2 C | Dots fill red, message shown, nothing clears | Dots fill in the danger colour, shake for 120 ms (none under reduced motion), then clear after 450 ms; the message stays until the next digit | Prompt 1 asks for the shake and the clear |
| LIB6 | The library draws the PIN sheet as "Store PIN for OUT084" | The frame L1.2 wins | Where the library and a frame differ, the frame wins |
| Top bars | L1 draws a 24 px title line, R1 a 22 px one | 22 px for both | Within the 2 px tolerance |
| Notification bell | No count badge drawn on R1.6 and R3.1 | A small signal count badge when the count is above 0 | The prompts and R8 call for an unread count on the bell |
| Sheets | 390 px wide | Centred, at most 430 px wide on wider screens | Field conventions section 12 |

## Shared files this role has changed

- `styles/tokens.css`: `--font-sans` falls back to Noto Sans Sinhala and Tamil; `--shadow-1` and `--shadow-2` are `none` under `data-theme="field"`. The Dark and Field colour blocks already matched conventions section 6, so no value changed. Light is untouched.
- `shared/ui/Icon.tsx`: new names (`flag`, `history`, `map-pin`, `navigation`, `delete`, `phone`, `package`, `pen`, `sun`, `type`, `globe`, `database`, `wifi`) and sizes 22 and 28. `shared/ui/Alert.tsx` and `.module.css`: `issue` and `conflict` tones. Nothing existing changed.
- New `shared/RoleRoot.tsx` and `shared/theme.ts` (the theme context).
- `app/App.tsx`: the router. `/loader/*` and `/driver/*` go to their roots; the Store tree moved into a `StoreApp` component inside the same providers, behaviour unchanged. The Dispatcher root joins here when its branch merges.
- `main.tsx`: Sinhala and Tamil font imports (400, 600, 700).
- `vite.config.ts`: PWA plugin, vitest, `dev:https`. `package.json` and the lockfile: dexie, vite-plugin-pwa, vitest, fake-indexeddb, @playwright/test, @vitejs/plugin-basic-ssl, @radix-ui/react-switch, the two Noto fonts. `tsconfig.node.json` includes `scripts/`.
- New `domain/field.ts` (Depot, Vehicle, PlannedOrder, Stop, Trip, PlanVersion, Person). It reuses the Store's `OrderStatus` and `DeferralType`; the Store's `Order` is a store order line, so the field type is named `PlannedOrder`.

## Phases

- [x] F1 fonts, tokens, `RoleRoot`
- [x] F2 field components and `/field/_components`
- [x] F3 offline core and tests (21 tests across the offline core and the clock)
- [x] F4 clock, state gallery harness, compare script
- [x] F5 service worker, manifest, HTTPS dev
- [x] F6 domain types, role roots, placeholder routes
- [x] F7 this section

## Still to check

- Compare each component with its Figma frame once the role screens register frames in the galleries (`npm run compare`). `.figma/` and `.compare/` are git-ignored.
- `Mono` renders at the surrounding weight; the frames use Plex Mono Medium (500) for IDs. Compare when the first screens land and set it if it differs.
- Sign-in: no sign-in exists on this branch, so `loader@waypoint.demo` and `driver@waypoint.demo` do not land anywhere yet.
