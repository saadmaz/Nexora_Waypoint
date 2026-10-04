<!-- Build log moved out of README.md so the README reads as the deliverable. -->

# 🔌 API mode (`feature/api-wiring`)

Every role runs on its mock by default. Each can be switched to the real backend on its own, so a role goes live the day its backend routes do and not before. Branch: `feature/api-wiring`, cut from `develop`, frontend only apart from three backend lines for the demo password (below).

## Flags

All are read at build time. Set them in the shell that starts Vite, in `frontend/.env.local` (git-ignored), or in the host's build variables.

**One switch: `VITE_DATA_SOURCE`.** `live` puts every role on the database through the API; `mock`, unset or any other value puts every role on the in-browser mocks, so **mock is the fallback**. A per-role flag (`VITE_<ROLE>_API`, `VITE_AUTH_API`) overrides it for that role only. `frontend/.env.production` (committed, no secrets) sets `VITE_DATA_SOURCE=live`, so `npm run build`, the Docker web image and any static host serve the database; a host's build variable or the shell can still set `mock`. A live build leaves the mocks out of the bundle (`npm run check:bundle`). A static host with no `/api` proxy (Cloudflare Pages or Workers assets) must also set `VITE_API_BASE` at build time to the API's origin and add the site's origin to the API's `CORS_ORIGINS`; behind the Docker nginx the default (same origin) is right.

| Variable | Values | What it switches |
|---|---|---|
| `VITE_DATA_SOURCE` | `mock` (default), `live` | Every role at once: `live` reads and writes the database, `mock` uses the in-browser mocks |
| `VITE_AUTH_API` | unset (follows `VITE_DATA_SOURCE`), `mock`, `api` | Sign-in and sessions: `apiAuthApi` instead of the mock |
| `VITE_STORE_API` | unset (follows `VITE_DATA_SOURCE`), `mock`, `api` | `StoreApi`: `createApiStoreApi` instead of the mock. `?state=` and `?preset=` do nothing in `api` |
| `VITE_DRIVER_API` | unset (follows `VITE_DATA_SOURCE`), `mock`, `api` | `DriverApi` and the driver's sync handlers |
| `VITE_LOADER_API` | unset (follows `VITE_DATA_SOURCE`), `mock`, `api` | `LoaderApi` and the loader's sync handlers |
| `VITE_DISPATCHER_API` | unset (follows `VITE_DATA_SOURCE`), `mock`, `api` | `DispatcherApi`: `createHttpDispatcherApi` instead of the mock, plus the server's scenario clock and the presenter control's `/demo` routes. `?state=`, `?preset=`, `?at=` and `?date=` do nothing in `api` |
| `VITE_API_BASE` | an origin, no trailing slash | Where the API is. Unset: `http://localhost:8000` in `npm run dev`, the same origin in a production build (nginx proxies `/api` in Docker) |

The two field roles share one transport. With neither on `api` nothing changes. With either on `api`, `startFieldRuntime()` installs a routing transport that sends each operation to the real `fetch` transport only when that operation's own role is on `api`, and to the mock otherwise, so a loader on the API and a driver on the mock can share a page.

## Run both halves

```bash
# 1. the API on http://localhost:8000 (Docker Desktop must be running)
docker compose up -d --build db api

# 2. the app, every role in api mode, on port 5173 (the API allows :5173 and :8080 by default)
cd frontend
VITE_AUTH_API=api VITE_STORE_API=api VITE_DRIVER_API=api VITE_LOADER_API=api VITE_DISPATCHER_API=api npm run dev
```

**CORS.** The API only allows `http://localhost:5173` and `http://localhost:8080`. On any other port the browser blocks the call and sign-in shows the offline notice, which looks like a bug and is not. Use `:5173`, or start the API with the origin added:

```bash
CORS_ORIGINS='["http://localhost:8080","http://localhost:5173","http://localhost:5191"]' docker compose up -d api
```

**Accounts.** `dispatcher@`, `loader@`, `driver@` and `store@waypoint.demo`, all with the password `waypoint-demo` (the backend's `DEMO_PASSWORD`).

## Checks

| Command | Needs | Proves |
|---|---|---|
| `npm test` | nothing | The HTTP client, the fetch transport, the four role clients and the mappers, all against a stubbed `fetch` (244 tests, 42 of them the dispatcher client) |
| `npm run test:api-auth -- --base http://localhost:5191` | the API, the app with `VITE_AUTH_API=api` | Sign-in against the real backend: four accounts, four real tokens, wrong password, server down, a rejected token, a store route answered from the database |
| `npm run test:api-roles -- --base http://localhost:5192` | the API (with `:5192` in `CORS_ORIGINS`), the app with all four flags | Each role's first screen read goes to the real route with that role's own token; the transport gets a live 200 from `/me`, the server's own 404 from `driver.getRun` while no plan is released, hands a record to `/sync`, and makes no request offline (run it on a freshly seeded database) |
| `npm run test:api-dispatcher -- --base http://localhost:5173` | the API, the app with `VITE_AUTH_API=api VITE_DISPATCHER_API=api` | All 20 dispatcher operations: 401 with no token, 403 with a driver token, the typed 501 with a dispatcher token (or the real answer, compared with the mock's view, for a route that has landed); the same 20 through the app's client; the 501 on each of the nine screens' own error states; offline and recovery on the live board; the presenter control against `/demo/advance` and `/demo/reset`; a rejected token. It resets the demo at the end |
| `npm run test:api-sync` | the API (`docker compose up -d --build db api`); no app | The offline path over HTTP: the gate confirmation, the phone's start, a store-request deferral at 05:21, then a 06:40 sync on the old plan that comes back accepted plus one conflict per deferred stop; the same batch again is all duplicate; the photo uploads once; D7 recommends and keeps the delivery; a dock acknowledgement of the replaced plan is a conflict. ORD2001 + ORD2002 are placed by the store, so until `POST /store/orders` lands it defers the first stop of VEH039 trip 1 instead and skips the board checks. It resets the demo at the start and the end |
| `npm run test:hero` | the app in mock mode (`npm run dev`) | The mock path is unchanged |
| `npm run test:offline -- --base http://localhost:4173` | the API, and a production build with `VITE_API_BASE=http://localhost:8000` in `npm run preview` | The shipped build works offline after one visit and its offline record reaches the server once back online. It resets the demo first |

## What the backend answers today (3 Oct)

| Route | Status | Client that calls it | Proven |
|---|---|---|---|
| `GET /health`, `POST /auth/login`, `GET /me`, `GET /clock`, `POST /demo/advance`, `POST /demo/reset` | built | `apiAuthApi`, the field transport (`driver.getMe`) | live |
| `GET /store/order-form`, `POST /store/orders`, `PATCH /store/orders/{id}`, `POST /store/orders/{id}/cancel` | built | `StoreApi` | backend tests on the hero day; the built app in a browser |
| `GET /store/deliveries`, `/deliveries/{day}`, `/history`, `/issues`, `/updates`; `POST /store/receipts`, `/issues`, `/deferrals/{id}/seen`, `/reviews/{id}/answer`, `/updates/read-all` | built | `StoreApi` | backend tests on the hero day (deferral, review, receipt, issue); the built app in a browser |
| `GET /driver/runs/{day}`, `/driver/notices`, `/driver/history` | built | `DriverApi` (`history` has no caller yet) | backend tests; the built app in a browser |
| `GET /loader/docks/{dock}`, `/docks/{dock}/diff`, `/vehicles/{id}/trips/{trip}`, `/exceptions/{id}`; `POST /loader/pins/verify` | built | `LoaderApi` | backend tests; the built app and a PIN acknowledgement in a browser |
| `POST /sync`, `POST /attachments` | built (`feature/offline-sync`) | the field transport | backend tests; `npm run test:api-sync` |
| All 20 `/dispatcher/*` routes: queue, history, capacity, plan, redraft, validate-move, moves, release, deferrals, acknowledgements, live, inbox, conflicts, exceptions, defer stop, forecast | built (`feature/dispatcher`) | `DispatcherApi` | backend tests on the scenario day; the real screens driven against the API; live 401 and 403 |

Every route in the contract is built, so no client meets a 501. If one ever did, it would reach a client as `NotImplementedApiError`, which names the backend's operation, and nothing falls back to the mock.

**What the screens read from the database.** The store: the order form (its unit factors and starting quantities come from the outlet's own last orders), orders, deliveries, history, issues and the updates feed (`services/store_views.py`, `store_writes.py`; the feed is the store's `notices` rows, written as each thing happens by `store_notices.py`). The driver: the route package, notices and run history (`services/field_views.py`). The loader: the dock, its PIN people, the PIN check, the load list, a flag and a plan diff (same file). Each store, driver and loader write goes through the same services as before (`POST /sync` and the store routes) and writes an audit row in the same transaction.

## How the clients behave

- **Offline.** A device that is offline, simulated offline or behind a closed coverage gate fails with the `NetworkError` the outbox already handles, before any request is made. A request that gets no answer (unreachable, 15 s timeout) becomes the same `NetworkError`. A network failure never ends a session; only a real 401 does, and it clears only that role.
- **Writes** are saved on the device first and sent through `POST /sync`, one record at a time, each keyed by its own `clientId`. A replay after a dropped connection is answered `duplicate` and counted once. Photos upload after their record through `POST /attachments`, keyed by the photo's id.
- **The driver** keeps the route package on the phone: `getRun` answers from that copy, refreshes one older than 30 s when online, and never fails once the route has been downloaded. Server notices are merged with the ones the phone makes itself.
- **The loader** reads from the server with the tablet's unsent counts, acknowledgement and confirmation laid on top. A flag has no server id until it syncs, so its id is the record's `clientId` until then.
- **The store** sends no outlet id; the server takes it from the token. A 409 on an order edit or cancel is the cutoff and a 404 a missing order.
- **Vocabulary.** The backend writes `store_request`, `pending_sync` and `ambient`; the frontend's shared types say `store request`, `Pending sync` and `dry`. `frontend/src/api/vocab.ts` is the one place that translates, as full tables over the generated types, so a new backend value fails the build.

## The dispatcher client (`feature/api-wiring-dispatcher`)

`createHttpDispatcherApi` (`frontend/src/api/httpDispatcherApi.ts`) implements all 20 `DispatcherApi` operations through `apiClient("dispatcher")`. `dispatcherContract.ts` already proves at compile time that the wire field names match the screens' view types; `dispatcherMappers.ts` is the one place for what that check leaves out:

- **Enum values, both ways.** Wire `store_request`, `keep_delivery`, `keep_partial`, `swap_vehicle` and `ordered` are the screens' `"store request"`, `"keep delivery"`, `"keep as partial"`, `"swap vehicle"` and `"Ordered"`. Converted in responses (queue and history order status, every deferral kind, the conflict recommendation, an exception's recommendation kind) and in requests (`QueueFilters.status`, `DeferStopIn.kind`, `ResolveConflictIn.resolution`, `DecideExceptionIn.decision`). The wire's `keep_deferral` has no screen value, so a conflict recommending it fails as `unexpected_reply` instead of drawing a guess. Fields the backend already sends as display text (the history `step`, a live stop's `status`, a queue tag) are not touched.
- **Ids.** A conflict or exception id is `"7"` in the views and `7` in the URL. A non-numeric id fails as `unexpected_reply` before any request.
- **The move target.** `{ vehicleId, trip } | "deferred"` on the screens, `{ vehicleId, trip, deferred: false }` or `{ deferred: true }` on the wire, in `validateMove`, `saveMoves` and the result's `to`.
- **Null versus absent.** The server sends every empty optional field as `null`; the views declare them optional and the screens test `!== undefined` (`newInVersion`, `daysSinceServed`, `matching`, a preview row's `before`). `compact` drops those nulls. Five fields are null on purpose and stay null: `CapacityView.plan` and `binding`, `AcknowledgementsView.banner`, a trip's `kgCap` and `m3Cap`. `dispatcherContract.ts` does not cover this: it compares kinds of value with `null` removed.
- **Query and body shapes.** `getQueue`'s filters are repeated params (`brand`, `temp`, `status`, `window`, `tags`, `district`) and an empty filter sends nothing; `getLiveBoard` sends `depot` (including `both`) and `all=true` only when on; `releasePlan` sends `sendNotices` and the server reads it as `send_notices`.
- **Depot on plan writes.** `redraftPlan`, `saveMoves` and `releasePlan` take a `depot` query param (the depot whose view comes back; they act on the whole service day). `DispatcherApi` has none there, so the client uses the depot of the last `getPlan` call and `peliyagoda` before that. `listAcknowledgements` takes no depot.
- **Errors.** The dispatcher keeps its own `ApiError(code, message)` and `NetworkError` (`DispatcherApi.ts`), and the screens catch those. The client maps the HTTP layer's `ApiError`, `NotImplementedApiError` and `NetworkUnavailableError` onto them with the server's message: a 404 is `not_found` (the conflict and exception screens test for it), a 409 on `redraftPlan`, `saveMoves` or `releasePlan` is `read_only`, `illegal_transition` or `illegal_move` on `saveMoves` is `illegal_move`, a 501 is `not_implemented`. The 409 and `illegal_transition` mapping is a guess from the mock's codes: no plan route is built, so no real code has been seen.
- **The clock.** `GET /clock` is read once when the dispatcher opens and the app's clock holds that time. It does not tick, because the server's clock does not and every time the server computes (minutes to the cutoff, an ETA) is for that instant. Only the presenter control moves it.
- **The presenter control** is kept in `api` mode. "Go to next step" is `POST /demo/advance` (a bare wall-clock time, which the server reads as Asia/Colombo) and "Reset demo" is `POST /demo/reset`; each re-reads the clock and reloads the screens. `?presenter=1` and the avatar menu still switch it on. The server refuses to go backwards (409 `clock_backwards`); the control then leaves the clock where it was.
- **Offline.** A request that gets no answer sets the provider's `offline`, the same flag `useOnline()` and `?state=offline` set: the screens keep what they last loaded and switch writes off. While it is set the provider asks `GET /clock` every 8 s, and the first answer ends it and reloads the screens.

## Contract gaps the clients work around

The backend's replies do not carry everything the screens show. Each missing field is filled with a visibly neutral value, never a plausible-looking one, and listed in `RUN_GAPS` (`screens/driver/api/runMapper.ts`) and `LOADER_GAPS` (`screens/loader/apiLoaderMapper.ts`). These need backend changes before `driver` and `loader` can be demoed on the API:

| Reply | Missing | Owner |
|---|---|---|
| `RunOut` (driver) | the loader's confirmation (who, when, shortfalls), each stop's brand, district, dock type and parking note, each order's weight and volume, when the plan version was released and its note, the vehicle's capacities. "Loaded" is read from the order statuses; brand is read from the outlet name | `feature/driver` (backend read endpoints) |
| `DockOut`, `LoadPlanOut` (loader) | vehicle capacities and temperature class, loading progress, why a vehicle is held, who acknowledged the plan, each load line's brand, temperature, dock, weight and volume, who confirmed a load | `feature/loader` |
| `PlanDiffOut` (loader) | the outlet, deferral type and next run of a removed order, and the new totals | `feature/loader` |
| `SyncResultOut.serverPayload` | the keys of a conflict's detail. The client reads `serverVersion`, `change`, `changedAt` and `changedBy`, and `exceptionId` on a flag, none of which the contract names | `feature/offline-sync` |
| `SyncRecordIn.payload` | a schema per record type. It is a free dict; the client sends the payload shapes the mocks already use | `feature/offline-sync` |
| `LoaderExceptionOut.type` | its vocabulary. The client accepts the six names on the flag sheet and refuses any other as `unexpected_reply` | `feature/loader` |

## Known limits

- **Dispatcher: an expired token fires the redirect once per rejected request.** `sessionTokens.onUnauthorized` dispatches `wp:session-expired` on every 401, and the dispatcher reads several things at once, so `SessionExpiryListener` calls `navigate("/sign-in", { replace: true })` once per request (six in the live check). Every call is a `replace`, so there is one history entry and the person lands on sign-in, but the call is repeated.
- **Dispatcher: the Capacity error banner** says "Capacity couldn't be calculated, fleet data missing." for every failed read, a 501 or a dropped connection included. The other eight screens say "Couldn't load ...".
- **Dispatcher: no route is built**, so the view types are checked against the contract and a stubbed `fetch`, not against a real reply. The enum, id, move and null conversions are proven only in `httpDispatcherApi.test.ts`.

- **Screens without a read-error state.** The Store's read pages and the driver's run screen render a loading skeleton forever when a read fails (they only handle write errors). Only the loader shows an error with Retry. Fixing it means an error state on each of those screens.
- **The loader's PIN people come from the API** (`LoaderApi.getPeople`, read from the dock's `people`). The offline PIN hashes and the guest PIN ("Other...") are not built in `api` mode: the server only knows the named people, and a PIN needs a connection.
- **The driver's receiver suggestions** (the "recent receivers" chips on the outcome screen) are demo names, so `api` mode shows none. There is no receiver history in the database to suggest from.
- **Past deliveries for a store** (S1.6 Recent orders, S2.10, S4 History) are empty for an outlet until it has been served in the database. The seed only writes history for the pinned outlets, and sampling the earlier weeks needs the column names of `deliveries_train.csv`, which the data owner has to supply (Contributing §29: no AI tool opens the CSVs).
- **Time.** The Store and the field apps still run on the app's own scenario clock, not on `GET /clock`.
- **The driver's run date** is the fixture constant, and the photo-failed notice reads the stop number from the fixture.
- **Mixed roles in one tab.** The sync engine has one photo uploader. When one tab visits a role on the API and then one on the mock, the provider that mounted last owns it.
- **A session lasts 12 hours** (`JWT_TTL_HOURS`) and there is no logout endpoint, so sign-out is local. A driver working past 16:45 from a 04:45 sign-in is sent to sign in; the outbox survives it.
- **Sync at app start.** Records waiting when the app opens online still wait up to 30 s for the first run.
- **The server-unreachable sign-in notice** reuses the G1.5 offline text, which is not quite true here. No Figma frame draws it (a departure to record).

## Files

- `frontend/src/api/http/`: the typed client, error classes, token handling, config.
- `frontend/src/api/vocab.ts`, `storeMappers.ts`, `apiStoreApi.ts`: the Store.
- `frontend/src/field/offline/fetchTransport.ts`, `apiSync.ts`: the field transport, the sync handlers, the photo uploader.
- `frontend/src/screens/driver/api/apiDriverApi.ts`, `runMapper.ts` and `frontend/src/screens/loader/apiLoaderApi.ts`, `apiLoaderMapper.ts`.
- `frontend/src/screens/auth/apiAuthApi.ts`, `SessionExpiryListener.tsx`.
- `frontend/src/api/httpDispatcherApi.ts`, `dispatcherMappers.ts` and `httpDispatcherApi.test.ts`: the Dispatcher client, its conversions and its tests; `frontend/scripts/api-dispatcher-check.ts`: the live check.
- Edited outside this branch's own files: `App.tsx` (mounts the session-expiry listener), `StoreProvider.tsx`, `DriverProvider.tsx` and `LoaderProvider.tsx` (pick the client by flag), `mockDriverApi.ts` (five helpers exported for reuse), `SignInScreen.tsx` (an optional `serverDown` prop). The dispatcher client also edits `DispatcherProvider.tsx` (picks the client by flag, reads the server clock), `context.ts` (an optional `resetDemo`) and `PresenterControl.tsx` (Reset demo calls it when present; the mock still reloads the page).

---
