# Security hardening: what the audit found and what we did

An architecture and security audit was run against Waypoint on 4 Oct 2026. It raised seven P0 findings
("pre-production"), six P1 ("required for deployment") and a set of P2 quality items. This document records what is
fixed, what was already fixed, and what is deliberately deferred with the reason.

It is a companion to [`auth-audit.md`](auth-audit.md), which covered the authentication front door. Where the two
overlap, this document is the later word.

The honest summary: **the P0 findings are closed. The P1 findings are not, and most of them cannot be closed by code in
this repository alone** - they need Redis, object storage, a separate worker process and a proxy configuration that a
hackathon deployment does not have. They are listed with the shape of the fix so the next person does not have to
rediscover them.

---

## P0: fixed

### 1. A driver could mark any order delivered

`POST /sync` checked that the vehicle on a record belonged to the signed-in driver, but never checked that the **order**
belonged to that vehicle. A driver could name any order id and move it to Delivered. Order ids are dataset ids
(`ORD2001`), so guessing one is trivial.

Fixed in `services/sync.py`: `_require_carried` refuses a `driver.outcome` or `driver.problem` record for an order that
no plan version of that day puts on the caller's vehicle. It checks **any** version, not only the released one, because
a driver who went offline on v4 legitimately reports against v4 and a later version may have moved the stop. Deciding
what such a record *means* is still `waypoint_rules.reconcile`'s job; this only decides whether the phone was ever asked
to make the delivery.

Tests: `tests/api/test_p0_hardening.py`, first three cases. One of them asserts the hero driver's own delivery still
goes through, because a guard that breaks the walkthrough is not a fix.

### 2. POD photos could be written but never read

`POST /attachments` stored photos and signatures. Nothing could read them back, so the proof of delivery that the whole
reconciliation flow depends on was write-only.

Added `GET /attachments/{id}`, scoped rather than role-gated: a delivery photo is evidence about one stop, so the
dispatcher (unbound), the driver whose vehicle recorded it, and the store manager of the outlet it was taken at can each
open it, and nobody else. A blob no device record claims yet is dispatcher-only, because there is nothing to scope it
by. See `services/attachments.py` (`_may_read`).

Uploads are now validated by their **bytes**, not by the `Content-Type` the client typed: JPEG, PNG and WebP are
accepted by magic number and anything else is refused 415. The stored type is the sniffed one, and the `GET` serves that
with `X-Content-Type-Options: nosniff`, so a blob cannot be served back as something a browser would execute.

**Not done:** S3 signed URLs, and EXIF stripping. Files still live on the `uploads` Docker volume, and a POD photo still
carries whatever EXIF the phone put in it, including GPS. Stripping it properly means decoding and re-encoding the
image, which means an image library (Pillow) added on release day; the risk of that is not worth it in the final hours.
Both belong with finding 12 below, which moves attachments to object storage anyway.

### 3. Stores dictated their own order weights

Already fixed on `develop` before this audit landed, in `fix(store): compute an order's weight on the server, not on the
device`. `store_writes.place` and `.edit` compute kg and m³ from the outlet's unit factors; the client's estimate is
compared and logged when it disagrees, never stored. No change was needed here.

### 4. `/demo/reset` truncated the database in every environment

The four presenter controls, `/demo/reset` among them, were mounted everywhere and guarded only by the dispatcher role.
`/demo/reset` truncates every operational table.

They now live on a separate router mounted only when `DEMO_MODE` is on, which follows `ENVIRONMENT` when unset. In a
real deployment the routes **do not exist**, which is the right last line of defence for a destructive operation: a role
check is one bug away from being bypassed, a route that was never registered is not.

`docker compose up` on a clean checkout still has them, because the judge walkthrough drives the scenario from the
dispatcher's avatar menu.

### 5. Concurrent order placement returned 500s

Two problems with one shape. Order ids came from `max(id) + 1`, so two stores placing an order in the same moment
computed the same id and one got a primary key violation that reached the client as a 500. The "already ordered" check
had the same race: both transactions saw no existing order and both inserted one, leaving an outlet with two live
chilled orders for one day.

Migration `0005` adds a sequence for order ids and a partial unique index on live orders. `place()` takes ids from the
sequence and turns the database's refusal into the same `409 already_ordered` the read check produces.

The index covers store-placed orders, not seeded ones. One order per outlet, day and kind is a rule about *ordering*,
and the generated day (`SEED_GENERATED_ORDERS`, A41) deliberately breaks it: 212 Peliyagoda orders over 49 outlets means
an outlet holds about four, which is what gives the planner a full day to pack. Indexing those too would have meant
choosing between the race and that seed. Seeded rows are written once by one process and cannot race.

`POST /store/orders` also accepts an `Idempotency-Key` header now. A store on a patchy connection taps "Place order",
the request is answered but the answer never arrives, and the app retries: without the key the retry either creates a
second order or is refused, and neither tells the store what it has. With it, the first attempt's orders come back
unchanged. The key is read from the audit row that `place()` already writes in the same transaction, so there is no
second table to keep in step.

One existing test moved outlet as a result. `test_an_order_placed_after_the_cutoff_waits_for_the_following_run` inserted
an OUT001 order for 30 Sep directly, and OUT001 chilled on 30 Sep is already taken by `ORD1020-R`, the re-run copy of
the scenario's policy deferral. The collision is real: a store placing that order through the API gets a 409 from
`place()` for the same reason. The test now uses OUT006.

### 6. Unhandled exceptions escaped as raw 500s

Anything a service raised that was not an `ApiError` fell through to Starlette, which re-raised it; the client got an
error page no frontend could parse.

`errors.install` now ends with a handler for bare `Exception`. It answers the standard
`{code: "internal_error", message, details: {requestId}}` with a generic message, and logs the traceback under that same
id. The cause belongs in the log, not in the response.

### 7. No structured logging, no readiness signal

`app/logs.py` logs one line per request with the method, path, status, duration and request id, passed as `extra` so a
JSON formatter emits the same fields as JSON. The id comes from an inbound `X-Request-Id` when a proxy set one, else is
minted, and goes back on every response - so a field report of "it said something went wrong" maps to exactly one log
line.

`/health/live` and `/health/ready` are now separate. Liveness touches nothing it depends on: a dead process should be
restarted. Readiness checks the database and the job loop's heartbeat and answers 503 with a `failing` list: an unready
process should be taken out of rotation, not restarted. One endpoint that checked the database conflated the two, so a
database blip would restart every API container at once.

**Not done:** metrics, tracing and alerting. There is nowhere to send them in this deployment.

---

## P1: not fixed, and why

These are real. None of them is closable by code in this repository on its own.

| # | Finding | What the fix needs |
| --- | --- | --- |
| 8 | Rate limits are in-memory, reset on restart, not shared across workers, and trust `X-Forwarded-For` | Redis for the counters, and a trusted-proxy list. Both are deployment configuration. The current limiter is still worth having against a single-process brute force; it is not a defence against a distributed one |
| 9 | 12-hour tokens in `localStorage`, no refresh, no revocation, no CSP | Short access tokens plus refresh, a CSP, and long-lived narrow device tokens for `/sync` only. This is a change to every role's session handling and the field outbox; it is a day's work and a day of regression risk |
| 10 | Loader PIN hashes are cached on the device, and a 4-digit PIN is instantly crackable | Device-bound credentials. A 4-digit PIN on a shared dock tablet is a deliberate product decision (a loader wearing gloves cannot type a passphrase), so the fix is to stop the hash leaving the server, not to lengthen the PIN |
| 11 | Two dispatchers editing a plan overwrite each other | `If-Match` on the plan version for every edit, 409 `plan_changed` on mismatch. Worth doing and reasonably contained, but it touches every dispatcher write and the D2-D5 screens that call them. Deferred for the deadline, not for difficulty |
| 12 | The job loop, the rate limiter and local uploads all assume one process | A worker process for jobs, object storage for attachments, and migrations run outside the container start command |
| 13 | Scenario timestamps and some client-side logic are hardcoded | Extract to configuration behind a flag. Low risk, no user-visible benefit; it is cleanup, and the scenario is the product right now |

## P2: noted

Floats to `Numeric` for weights; `REVOKE UPDATE, DELETE` on `audit_events` so append-only is enforced by the database
and not only by convention; the planner as a background job with a time budget, benchmarked against OR-Tools with real
traffic data instead of per-district constants; batch size caps and server-time-over-device-time on `/sync`; `mypy`
coverage gates, `npm audit` and a migration-downgrade test in CI.

The `audit_events` revocation is the cheapest of these and the most valuable: the append-only guarantee is load-bearing
for every "who changed this" answer in the product, and right now nothing but code discipline enforces it.

---

## What was verified

`ruff check`, `mypy` and the full `pytest` suite pass against PostgreSQL 18.6, and `alembic heads` prints one head.
`frontend/src/api/schema.ts` was regenerated from the changed API and is committed with these changes.

The new behaviour is covered by `backend/tests/api/test_p0_hardening.py`. The findings above that are marked not done
have no tests, by definition.
