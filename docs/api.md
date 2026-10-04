# API

The backend is FastAPI. Every route is under `/api/v1`, and the schema is served at `/api/openapi.json` (Swagger at `/api/docs`).
The frontend's types are generated from it into `frontend/src/api/schema.ts`; regenerate after any route change:

```bash
npx openapi-typescript http://localhost:8000/api/openapi.json -o frontend/src/api/schema.ts
```

## Conventions

- **JSON is camelCase**, Python is snake_case. Ids are the dataset ids (`ORD2001`, `OUT084`, `VEH039`) and the field is `id` on its own entity and
  `orderId`, `outletId`, `vehicleId` when it points to another.
- **Auth.** `POST /auth/login` returns a bearer token; send `Authorization: Bearer <token>`. Each route checks the role and, for a store,
  loader or driver account, the scope (its own outlet, dock or vehicle). A missing token is 401, the wrong role or scope is 403.
- **Errors** always have one shape: `{ "code": "clock_backwards", "message": "...", "details": ... }`.
- **Time.** Business code reads one clock. `GET /clock` returns `{ now, checkpoint, serviceDate, runDate, rate, serverWall }`: `now` is scenario time in
  Asia/Colombo, `rate` is scenario seconds per wall second (1 real time, 0 paused). Between answers a client extrapolates
  `now + (Date.now() - fetchedAt) * rate`. `runDate` is the delivery run the apps are working on; `serviceDate` is the day an order placed now counts for.
- **Jobs run themselves.** The 16:00 cutoff, the 16:05 draft and the scripted events fire when the clock reaches them, once each (`job_runs`).
- **Writes from devices** go through `POST /sync`, one record at a time, keyed by `clientId`: a replayed record answers `duplicate` and changes nothing.
- **Status values** are the 11 order statuses (PRD 4b). The wire value for an order under review is `conflict`; a store's screens show "Under review".

## Health

Who: anyone.

| Method | Path | Operation | What it does |
|---|---|---|---|
| GET | `/health` | `getHealth` | Liveness plus a database round trip (used by the Compose healthcheck). |

## Sign-in

Who: anyone (sign-in); any signed-in account (`/me`).

| Method | Path | Operation | What it does |
|---|---|---|---|
| POST | `/auth/login` | `login` | Login |
| GET | `/me` | `getMe` | Get Me |

## Clock and presenter controls

Who: any signed-in account; the demo controls are dispatcher only.

| Method | Path | Operation | What it does |
|---|---|---|---|
| GET | `/clock` | `getClock` | Get Clock |
| POST | `/demo/advance` | `advanceClock` | The presenter control's "Go to next step". Refuses to go backwards (409 ``clock_backwards``). |
| POST | `/demo/pause` | `pauseClock` | Freeze scenario time where it is (DP-26). Countdowns stop and no timed job comes due until it is resumed. |
| POST | `/demo/resume` | `resumeClock` | Let scenario time run again at the configured ``CLOCK_RATE`` (real time if that is 0). |
| POST | `/demo/reset` | `resetDemo` | Truncate the operational tables and re-run the seed (PRD §13). Presenter only: the dispatcher's avatar menu. |

## Store (`StoreApi`)

Who: a store account, scoped to its own outlet.

| Method | Path | Operation | What it does |
|---|---|---|---|
| GET | `/store/order-form` | `getOrderDraft` | The S1 form for one day. ``date`` defaults to the day an order placed now counts for. |
| POST | `/store/orders` | `placeOrders` | Chilled and dry together: all are received or none is. |
| PATCH | `/store/orders/{order_id}` | `editOrder` | Rejects (409) once the order is past cutoff. |
| POST | `/store/orders/{order_id}/cancel` | `cancelOrder` | Rejects (409) once the order is past cutoff. |
| GET | `/store/deliveries` | `listDeliveries` | The outlet's delivery days, earliest first (S2). |
| GET | `/store/deliveries/{day}` | `getDeliveryDay` | One day's delivery; an empty list when the outlet has no orders for it. |
| GET | `/store/history` | `listRecent` | Past delivery days, newest first, Sundays skipped (S1.6, S2.10, S4 History). |
| GET | `/store/issues` | `listIssues` | The problems the store has reported, open first, newest first (S3.7). |
| POST | `/store/issues` | `reportIssue` | A problem tied to the proof of delivery (S3.3). Dispatch is told at once. |
| POST | `/store/deferrals/{deferral_id}/seen` | `acknowledgeDeferral` | The store tapped Got it (S2.6, S2.9). Dispatch then sees it was read. |
| POST | `/store/reviews/{conflict_id}/answer` | `answerReceivedQuestion` | The store's answer to "Did you receive this delivery?" while Dispatch is reviewing (S2.7, S3.5). |
| POST | `/store/receipts` | `confirmReceipt` | Confirms what arrived (S3.1), or records a shortfall (S3.1 B). 409 when nothing has been delivered. |
| GET | `/store/updates` | `getUpdates` | The S4 feed, newest first, with the unread count for the bell. |
| POST | `/store/updates/read-all` | `markAllRead` | Mark All Read |

## Dispatcher (`DispatcherApi`)

Who: the dispatcher.

| Method | Path | Operation | What it does |
|---|---|---|---|
| GET | `/dispatcher/queue` | `getQueue` | D1: the order queue for a depot and service date, grouped, with the filters and search applied. |
| GET | `/dispatcher/orders/{order_id}/history` | `getOrderHistory` | D1.5: the order's history drawer, built from its audit events (oldest first). |
| GET | `/dispatcher/capacity` | `getCapacity` | D2: binding resource, availability and the headline sentence. |
| GET | `/dispatcher/plan` | `getPlan` | D3: a plan version with its trips and deferrals. Omit ``version`` for the latest. |
| POST | `/dispatcher/plan/redraft` | `redraftPlan` | Runs the planner again and saves the next draft. |
| POST | `/dispatcher/plan/validate-move` | `validateMove` | D3.2 to D3.6: ``ok``, every violation, and a before / after consequence preview. |
| POST | `/dispatcher/plan/moves` | `saveMoves` | Accepted moves write a new draft version. |
| GET | `/dispatcher/deferrals` | `listDeferrals` | D4: every deferral with its type, binding tag, impact, frees and notice state. |
| POST | `/dispatcher/deferrals/notify` | `notifyDeferrals` | Sends the store notices for every deferral at the depot that has not been told yet. |
| POST | `/dispatcher/plan/release` | `releasePlan` | D5: releasing the current draft creates the released snapshot. |
| GET | `/dispatcher/acknowledgements` | `listAcknowledgements` | D5: who has acknowledged a plan version, and who is pending. |
| GET | `/dispatcher/forecast` | `getForecast` | D9: the baseline capacity outlook (feature/analytics). |
| GET | `/dispatcher/live` | `getLiveBoard` | D6: one row per vehicle trip with lateness risk and last heard. |
| POST | `/dispatcher/stops/defer` | `deferStop` | D6: defer stops after release. Creates and releases the next plan version at once. |
| GET | `/dispatcher/inbox` | `getInbox` | Open conflicts, exceptions and dispatch notices. |
| GET | `/dispatcher/conflicts/{conflict_id}` | `getConflict` | D7: both records, the recommendation and its reasons. |
| POST | `/dispatcher/conflicts/{conflict_id}/ask-store` | `askStore` | D7: asks the store "Did you receive this delivery?" (status ``awaiting_store``). |
| POST | `/dispatcher/conflicts/{conflict_id}/resolve` | `resolveConflict` | D7.4: writes the decision and posts notices to driver, store and dock. |
| GET | `/dispatcher/exceptions/{exception_id}` | `getExceptionForReview` | D8: a loader flag or driver problem, with the recommended swap. |
| POST | `/dispatcher/exceptions/{exception_id}/decide` | `decideException` | D8: swap the vehicle and defer orders. Creates and releases the next plan version. |

## Loader (`LoaderApi`)

Who: the dock tablet account, scoped to the dock.

| Method | Path | Operation | What it does |
|---|---|---|---|
| GET | `/loader/docks/{dock}` | `getDock` | L1: the dock's vehicles for the current plan, with the PIN people who work it. |
| POST | `/loader/pins/verify` | `verifyPin` | The PIN sheet. The tablet also caches salted hashes so PIN actions can queue offline; the server re-verifies on sync. |
| GET | `/loader/vehicles/{vehicle_id}/trips/{trip}` | `getLoadPlan` | L2: the load list for one trip, in reverse stop order. |
| GET | `/loader/exceptions/{exception_id}` | `getException` | L3: a flag the loader raised and what dispatch decided. |
| GET | `/loader/docks/{dock}/diff` | `getPlanDiff` | L1.5: what changed between two plan versions at this dock (``?from=&to=`` are plan version numbers). |

## Driver (`DriverApi`)

Who: a driver account, scoped to its vehicle.

| Method | Path | Operation | What it does |
|---|---|---|---|
| GET | `/driver/runs/{day}` | `getRun` | The route package: the current plan version and each order's server state after sync. |
| GET | `/driver/notices` | `getNotices` | R8: notices for this driver's vehicle, newest first. |
| GET | `/driver/history` | `getHistory` | R7: this driver's past runs. |

## Sync and attachments (devices)

Who: a loader or driver device.

| Method | Path | Operation | What it does |
|---|---|---|---|
| POST | `/sync` | `sync` | One or many outbox records. Idempotent by ``clientId``: a replay returns ``duplicate``. |
| POST | `/attachments` | `uploadAttachment` | A photo or signature (multipart). Idempotent by the blob's ``clientId``. |
