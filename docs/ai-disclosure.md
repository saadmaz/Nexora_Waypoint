# AI disclosure

Waypoint was built with the help of AI coding tools, mainly **Claude** and **Claude Code** (with the Claude Sonnet 5.5,
Claude Opus 5 and Claude Opus 5.5 models). This file is the single place we say where and how, as the Challenge Booklet
asks and as `Contributing.md` §29 requires. There are no AI badges or "Mock data" chips on any screen; the disclosure
lives here, on the Figma AI disclosure page (F17), in the README and in the submission video.

**In short:** AI sped up the work, and the team stayed responsible for it. People decided what to build, set the rules
and the scope of each change, reviewed what the tools produced, and approved every merge. The [build log](#build-log-what-ai-did-and-what-a-person-checked)
below records, change by change, what a tool produced and what a person checked, including the checks a tool could not
run.

---

## How we used AI

We used AI to speed up development, not to replace engineering judgement. The tools helped us explore implementation
options, write and refactor code, write tests, review parts of the codebase, track down bugs and improve the
documentation.

The architecture, the product decisions, the business rules, the user flows, the reading of the competition
requirements and every final implementation decision stayed with the team. We treated what a tool produced as a first
draft: it was reviewed, tested and changed where needed before it was merged.

## Where AI helped

| Area | How AI was used |
|---|---|
| **Frontend** | React and TypeScript screens for the four roles, typed API clients, state handling and responsive layouts |
| **Backend** | FastAPI routes and services, database models, migrations, validation and supporting code |
| **Offline** | The field apps' local storage, the outbox and the sync logic for the driver and the loader |
| **Testing** | Unit and API tests, finding missing cases, and investigating failing tests |
| **Debugging** | Reading errors, tracing a fault across the frontend and backend, and proposing fixes |
| **Code review** | Reviewing existing code for inconsistencies, edge cases, dead buttons and security issues |
| **Security** | Reviewing authentication, route protection, token handling and input validation, and hardening them |
| **Documentation** | Structuring the README, the technical docs, the build notes and the API reference |
| **Submission review** | Auditing the build against the competition requirements and listing the gaps a person then decided on |

AI was most useful for repetitive implementation work and for reading large parts of the codebase quickly. Deciding
**what** to build, **why**, and **whether the result was good enough** stayed with the team.

## How AI output was reviewed

Nothing a tool produced went in automatically. For each meaningful change, a team member:

1. defined the problem or requirement;
2. gave the tool the context and constraints (the PRD, the Booklet rules, `Contributing.md`);
3. reviewed what it produced;
4. tested the behaviour;
5. checked it against the PRD, the Challenge Booklet and how the app already behaved;
6. changed or rejected the output where needed; and
7. approved the change before it was merged (both `develop` and `main` accept changes only through a pull request with
   one approval, and CI runs on every pull request).

Where a tool could not run a check itself, for example because there was no PostgreSQL or Docker on the machine, the
build log says so. CI runs the full set on every pull request: lint, type checks, unit tests, the backend tests on
PostgreSQL, migrations, a clean `docker compose up` and the Playwright walkthrough.

Review was strictest where a mistake costs the most:

- the allocation and planning rules, and the vehicle and capacity constraints;
- the order and delivery workflows;
- authentication and authorisation;
- offline sync and conflict handling;
- security controls; and
- anything the competition requirements name.

## What stayed with the team

There is a difference between help with **implementation** and making **product decisions**.

| A tool could suggest | A tool did not decide |
|---|---|
| how to structure a service | what Waypoint should do |
| how to implement a route | which competition requirements mattered |
| how to handle an error | what the operational rules are |
| how to write a test | which trade-offs to accept |
| how to remove duplicated code | what to submit |
| how to investigate a bug | whether an implementation was correct |

### An example: the turnaround rule (R-TURN)

During the submission audit on 4 October, Claude Code found that a dispatcher's hand move could send a vehicle out on
its second trip before its first trip was back at the depot, and reproduced it with a script over the reference plan.
The team reviewed the finding, decided the rule was right, and adopted it: it now lives in `backend/waypoint_rules`
and is recorded in the PRD as rule R-TURN and departure DP-31. It is the only rule a tool proposed.

That is how we worked with AI throughout: **a tool could find or propose something; the team decided whether it was
valid and whether it became part of the product.**

## Competition data and Figma

- **The competition CSVs** stay on each developer's machine under `data/`. They are git-ignored, never committed, and
  never pasted into an AI tool. The seed reads them at runtime. When a tool needed a column name, a person typed the
  header.
- **The business rules** come from the Challenge Booklet and the PRD. Where the demonstration needed assumptions or
  extra scenario data, it is recorded as invented (see [Invented data](#invented-data)) and never presented as official
  competition data.
- **The Figma file** was used as a reference only. Nothing in it was created, moved, renamed or edited by a tool or by
  hand, and it is read-only now that the Designathon is judged.

## How it was verified

Depending on the change: unit tests, API tests on PostgreSQL, type checks, linting, static analysis (ruff and mypy),
migration checks (one Alembic head, `alembic check`), production builds with a check that no mock ships, browser
testing at phone and laptop widths, offline testing, testing against the real API, security checks such as token
forgery and cross-role access, and the end-to-end judge walkthrough in Playwright on a clean `docker compose up`.

When AI-assisted code failed a check or behaved differently from the requirements, the code was changed. A tool's
output was never assumed correct because a tool wrote it.

## Why we used AI

Waypoint covers four roles, a frontend and a backend, offline field apps, sync, a planner, an API, tests and two
deployments, in a few days. AI let us move faster when exploring an unfamiliar approach, writing repetitive code,
reviewing a lot of code, adding test coverage, chasing bugs and documenting decisions.

The value was not only in generating code. It was in using AI as an engineering tool: giving it clear requirements,
challenging what it produced, checking the result, and keeping only what made sense.

---

## Build log: what AI did, and what a person checked

The rows are a dated log, oldest first. A row describes the code on its date: where an early row says a route was still
501 or a client was proven against a stub, a later row records that it was built and checked. Read them in order.

**Adding to it:** add a row when an AI tool does a meaningful part of your pull request. One row per branch; add to your
own row, never replace someone else's. Keep it factual: what the tool produced, and what you checked.

| Date | Area | Tool | What the tool produced | What a person checked |
|---|---|---|---|---|
| 29 Sep to 1 Oct | Store manager screens (S1 to S4) | Claude | Screen components, fixtures and the `StoreApi` mock from the Figma frames and PRD §3 | Frames compared side by side, copy read against Figma, lint, typecheck and build |
| 1 Oct | Field apps foundation (`frontend/src/field/**`, shared field components, offline core, scenario clock, state gallery harness, PWA setup) | Claude | The shared base the loader and driver sit on: themes, components, Dexie outbox and sync engine, clock, gallery, compare script | 21 unit tests written and run; the production build opened offline after one visit; lint, typecheck and build clean. The components were not yet compared pixel by pixel with Figma, which the role branches do per screen |
| 1 Oct | Backend foundation (`feature/backend-foundation`, PR #5) | Claude Code (Claude Sonnet 5.5) | The FastAPI app core, SQLAlchemy models, the initial Alembic migration, the section 19 route contract, the seed, Docker and CI files, and the API tests | The brief was set by a person, who reviewed the generated migration and owns the merge |
| 1 to 2 Oct | Loader screens (L1 to L4) | Claude | Screens, states, `LoaderApi` and fixtures from the Figma frames | See the loader PR |
| 1 to 2 Oct | Driver screens (R1 to R3 so far) | Claude Code | Types, fixtures, `DriverApi` and mock, sync handlers, the shell and Me tab, Route, Stop detail and Record outcome, state gallery and a Playwright hero-path walkthrough, built against `claude/field-build/03-driver-core.md` and the field conventions | HH reviewed and directed each phase; lint, typecheck and build run on every commit |
| 2 to 3 Oct | Driver offline and recovery (R4 Outbox, R5 Sync result, R8 Notifications, the conflict and its resolution) | Claude Code | The mock server's v5 conflict rule and resolution, the Outbox sheet, the sync result states, photo upload ordering and the WP-SYNC-409 branch, the notifications list, unit tests and the Playwright walkthrough, built against `claude/field-build/04-driver-offline.md` | HH directed each phase. 55 unit tests, a 64-check Playwright run of the hero path (and a partial-resolution variant), an offline production-build check, and a side-by-side comparison with Figma for the R4, R5, R8 and touched R1 and R3 frames. The real-device check (a phone in airplane mode) was not done by the tool |
| 2 Oct | PRD v3.1 and central context (`waypoint-prd-v3.md`, `waypoint-central-context-v3.md`) | Claude | Changes V32 to V42: the planned-distance basis, the dock setting, PIN rules, R10 in API mode, the mock-to-real switch, Dispatch handling of non-vehicle flags, R6 problem threads, assumptions A55 to A58, departures DP-17 to DP-23, open decisions O-8 to O-11 | Register numbering checked against the existing rows so nothing was overwritten; A55 on frame L1.2 A is still to be confirmed against Figma and says so in the row |
| 2 Oct | App shell (`frontend/src/screens/auth`, `frontend/src/app/App.tsx`): sign-in, role picker, per-role sessions, presenter control | Claude | `AuthApi` and its mock, per-role sessions, the router change, the sign-in screen for frames G1.1 to G1.5 and its state gallery | Sessions and the mock covered by 18 unit tests; sign-in driven in a real browser (retry, offline, four roles in one browser); frames diffed against Figma at 1x. Role picker, presenter control and avatar menu follow in later phases and will be added to this row |
| 3 Oct | API wiring (`feature/api-wiring`): the typed HTTP client, real auth, store, driver and loader clients, the field fetch transport, the demo password change | Claude Code | `frontend/src/api/http/`, `apiAuthApi`, `apiStoreApi`, `apiDriverApi`, `apiLoaderApi`, their mappers, the fetch transport and sync handlers, two live Playwright scripts, the README "API mode" section | A person directed each phase. 202 unit tests on a stubbed `fetch`, 32 live sign-in checks and a live roles check against the real API in Docker, the 64-check mock hero path and the offline production-build check re-run. Only auth, `/me` and the clock exist on the backend, so every other client is proven against a stub and the live 501 only. Where the backend replies lack fields the screens need, the client fills a neutral value and lists the gap in the README; those were not checked against a real reply |
| 3 Oct | Dispatcher API wiring (`feature/api-wiring-dispatcher`): the real `DispatcherApi` client, its mappers and the live check | Claude Code (Claude Sonnet 5.5) | `httpDispatcherApi.ts`, `dispatcherMappers.ts`, the provider's api mode (server clock, presenter control, offline), 42 stubbed-`fetch` tests and `scripts/api-dispatcher-check.ts` | Lint, typecheck (including `dispatcherContract.ts`), build, `npm test`, the live check against the Docker API (all 20 routes at 401, 403 and the typed 501, the nine screens' error states, the presenter control against `/demo/advance` and `/demo/reset`), and the mock path with `test:hero` and a dispatcher smoke run. No dispatcher route is built, so the conversions have not seen a real reply |
| 3 to 4 Oct | Dispatcher (`feature/dispatcher`): the planner, plan versions and release, the scenario-clock jobs, queue, live board, conflicts, exceptions and forecast services, the 20 dispatcher routes, the generated day and the dispatcher README | Claude Code (Claude Sonnet 5.5) | `waypoint_rules/planner.py`, `app/services/*` for planning, queue, live, conflicts, exceptions and forecast, `app/jobs.py`, `seed/generated.py`, the tests and the docs | A person set each phase and merged each PR. Rules tests and ruff and mypy run each phase; the API tests were run on an in-memory SQLite stand-in because PostgreSQL was not available, so the PostgreSQL run is still to do. The real screens were driven against the API in Chrome. The planner's 17 deferrals against the PRD's 19 are recorded as DP-01 |
| 3 Oct | Offline sync (`feature/offline-sync`): `POST /sync`, `POST /attachments`, their tests and the live check | Claude Code (Claude Opus 5.5) | `backend/app/services/sync.py`, `services/attachments.py`, the two route bodies in `routers/sync.py`, `tests/api/test_sync.py` (13 tests) and `frontend/scripts/api-sync-check.ts` | A person set the scope, the order of work and the trip lookup by the device's plan version, and reviewed each step. ruff, mypy, `alembic heads` and the full backend suite (349 tests) on PostgreSQL 16; frontend lint, typecheck, build and `npm test`; `npm run test:api-sync` against the API in Docker. The hero orders can't be placed over HTTP yet, so the live check deferred OUT087 instead and skipped the board checks; the pytest replay covers the hero stop and the board |
| 3 to 4 Oct | Real data for the store, driver and loader (`feature/api-wiring` follow-up): the 14 store routes, the driver's three reads, the loader's five reads, the store's updates notices, the production build flags | Claude Code (Claude Sonnet 5.5) | `backend/app/services/store_views.py`, `store_writes.py`, `store_notices.py`, `field_views.py`, the route bodies in `routers/store.py`, `driver.py` and `loader.py`, `tests/api/test_store_field.py` (8 tests), `frontend/.env.production`, `LoaderApi.getPeople`, the `FieldRuntime` transport fix and the README "API mode" updates | A person set the goal (no mock data in a deployed build). The full backend suite and ruff on PostgreSQL 17 (a local test database), frontend lint, typecheck, 252 unit tests and the production build; the built app driven in Chrome as the store, driver and loader against the real API and a freshly seeded database; the loader's walkthrough re-run in mock mode. The README lists what is still fixture-backed. The `api-dispatcher-check` script has 9 failing checks that fail identically on the code before this change |
| 4 Oct | UX and cross-flow review and fixes (`feature/ux-cross-flow-fixes`): `docs/ux-fix-plan.md`, the README corrections, the live-ETA anchor, the D6 driver-problem item, the loader shortfall handoff, the store's release and cutoff times, server-side order weights | Claude Code (Claude Opus 5) | `docs/ux-fix-plan.md`, `README.md`, `live_views.py`, `store_views.py`, `store_notices.py`, `driver_views.py`, `sync.py`, `exceptions.py`, `exception_logic.py`, `waypoint_rules/units.py`, `store_writes.py`, `ReceivedView.tsx`, `DockContainer.tsx`, `domain/schedule.ts`, and six new tests | A person asked for the review, chose the scope and owns the merge. The findings are evidence-led: all 19 walkthrough steps driven through the real API on a migrated and seeded PostgreSQL database, plus the branches the README names, before any code changed. Each fix has a test proven to fail without it. ruff, mypy, 519 backend tests, one Alembic head, oxlint, `tsc -b`, 405 frontend tests, the production build and `check:bundle`. The review first ran against `main` and was re-checked against `develop`, which had already fixed one finding. Not done by the tool: `docker compose up`, the Playwright suite and the judge walkthrough in a browser, because no Docker daemon was available; the PostgreSQL 18.6 version assertion fails on the local 16 |
| 3 Oct | Auth audit and fixes (`feature/auth`): `docs/auth-audit.md`, route guarding, the JWT secret guard, dev-gallery gating, the clock guard, sign-in rate limiting, security headers | Claude Code (Claude Opus 5) | `docs/auth-audit.md`, `App.tsx`, `LoaderApp.tsx`, `DriverApp.tsx`, `apiAuthApi.ts`, `app/config.py`, `routers/auth.py`, `routers/shared.py`, `deploy/web/nginx.conf`, `docker-compose.yml`, `.env.example`, three new test files | A person asked for the audit and approved the fix list before any code changed. The audit was evidence-led: the symptom reproduced in a browser, a cross-role matrix over the live API, and token forgery (wrong secret, `alg:none`, expired, tampered `role` claim) run against the running container. Every fix re-verified on a rebuilt stack against the production bundle, including a driver taken fully offline to prove the guard does not strand the outbox. 271 frontend tests, backend pytest exit 0, ruff, mypy, `tsc -b`, oxlint, one Alembic head. The backend guards were already correct; the audit says so rather than padding the list |
| 3 Oct | Store ordering backend (`feature/order-management`): the S1 order form, placing, editing and cancelling | Claude Code (Claude Opus 5) | `app/services/store_repo.py`, `app/services/store_orders.py` (later folded into `store_views.py` / `store_writes.py` by the real-data follow-up above), the four order bodies in `routers/store.py` and `tests/api/test_store_orders.py` (20 tests) | A person set the contract from the already built `apiStoreApi` client and the PRD, and reviewed each file. ruff, mypy, one Alembic head and the full backend suite (396 tests) on PostgreSQL 16. The deliveries, receipt, issues and updates routes are still 501; they are Phase 2 on `feature/store-receipt` |
| 3 Oct | Frontend audit fixes (`fix/frontend-audit`): driver R6 Issues, R7 History, R9 Finish run, Call store, Me identity; the store's offline queue kept on the device; the `/start` role picker; driver problem and finish records on the real API | Claude Code (Claude Opus 5.5) | The screens, their data on the phone and the mock, the API client methods, unit tests and a backend test, from PRD v3 section 3 (R6, R7, R9, G2), V30, V40, A24 and A34 | A person chose the scope from the audit, approved editing files changed on develop that day, and reviewed each step. Lint, typecheck, build, 288 unit tests, the full backend suite (397), `test:hero` and `test:offline` (mock) and `test:api-sync` (API), and each screen in the browser at 390 px and 1280 px. The Figma frames could not be opened (no file access), so the new screens follow the PRD rows and the existing field components, not a frame comparison |
| 3 to 4 Oct | Ticking scenario clock (`fix/realtime-data`): clock anchor and rate, pause and resume, the job loop and `job_runs`, DP-26 | Claude Code (Claude Sonnet 5.5) | `app/clock.py`, `app/jobs.py`, the 0004 migration, `/demo/pause` and `/demo/resume`, `tests/api/test_clock_rate.py` | A person reviews each commit; lint, mypy, alembic check and the backend tests were run against a real PostgreSQL |
| 3 Oct | Store live checks (`feature/store-live-checks`): the two scripts that prove the store role against the real API, and the README section for API mode | Claude Code (Claude Opus 5) | `frontend/scripts/api-store-check.ts` (drives the app's own `createApiStoreApi` through the hero day) and `frontend/scripts/store-live-walkthrough.ts` (plays PRD §16 through the rendered screens, including the API container stopped and restarted), their `package.json` entries and the README section "The store against the real API" | A person set the scope and reviewed each step. Run against the API in Docker on the fallback seed: `test:api-store` reports 10 failures and `test:store-live` 1, all differences between `develop`'s backend and the contract the mock and the PRD set, listed in the PR (offset timestamps against §19, a shortfall accepted with no reason against A50, the review question shown before Dispatch asks against A51, an inconsistent journey). Frontend lint, typecheck, build and the unit tests pass. The store backend these scripts check was built on `develop`, not here; the scripts are the part that was missing, and finding those three is what they are for |
| 4 Oct | Offline sync hardening (`fix/offline-sync-clock`): a race when one phone syncs from two tabs at once, `test:offline` against the real API | Claude Code (Claude Opus 5.5) | The fix in `backend/app/services/sync.py`, `tests/api/test_sync_resilience.py` (5 tests), the rewritten `scripts/driver-offline-shell.ts` and README rows | A person set the goal and reviewed the result. The full backend suite (493) and frontend checks (307 unit tests), `test:hero` (mock), `test:offline` and `test:api-sync` against the API in Docker, and the offline record reaching the server in the browser in API mode |
| 4 Oct | Store contract fixes (`feature/store-live-checks`): the four breaks the live scripts found, and the tests that hold them | Claude Code (Claude Opus 5) | `waypoint_rules/receipts.py` (new, the A50 shortfall rule), `ReviewOut` with `asked` in `schemas/store.py`, `services/store_views.py` (`stamp()` with the Colombo offset, the A51 gate, the run and driver found by the vehicle on the driver's record), `services/store_writes.py` (the receipt refusals), the `asked` flag through `domain/delivery.ts`, `storeMappers.ts`, `mockDeliveries.ts`, `DeliveriesPage.tsx` and `ReceiptPage.tsx`, a regenerated `schema.ts`, and `tests/api/test_store_contract.py` (13 tests) plus `tests/rules/test_receipts.py` (5) | A person set the scope from the live-script failures and reviewed each step. The fix for `askedAt` changed an existing assertion in `test_store_field.py` from 06:40 to 05:21: PRD Q2, H10 and the "Why you're seeing this" copy all make it the store's own call to hold the delivery, so the old value was the bug, not the new one. ruff, mypy, one Alembic head, the full backend suite, frontend lint, typecheck, build and 293 unit tests all pass |
| 4 Oct | Security hardening (`feature/security-hardening`): the seven P0 findings of the architecture audit, and the roadmap for the rest | Claude Code (Claude Opus 5) | `services/sync.py` (the delivery scope guard), `GET /attachments/{id}` with byte-level type checks in `services/attachments.py`, the gated demo router in `routers/shared.py` and `main.py`, migration `0005` (order id sequence, partial unique index) with `services/store_writes.py` (sequence ids, 409 on conflict, `Idempotency-Key`), the catch-all handler and request id in `errors.py`, `app/logs.py` (new), split `/health/live` and `/health/ready`, a regenerated `schema.ts`, `tests/api/test_p0_hardening.py` (21 tests) and `docs/security-hardening.md` | A person supplied the audit, chose the scope and settled the one real conflict it raised: the audit asked for a unique index on live orders, which the generated day (A41) deliberately breaks by giving an outlet about four, so the index covers store-placed orders only and the migration says why. Three existing tests changed: the queue test moved off OUT001 (ORD1020-R, the policy deferral re-run, already holds OUT001 chilled on 30 Sep, and `place()` refuses that order for the same reason), the empty-attachment test now expects 415 rather than 422, and the route contract gained the three new routes. EXIF stripping and S3 signed URLs were left out on purpose, with the reason in the document. ruff, mypy, one Alembic head, the full backend suite, frontend lint, typecheck and build all pass |
| 4 Oct | The demo expiring, and the presenter buttons (`fix/clock-drift-presenter`): the clock drifting past the seeded day, and every presenter button failing silently | Claude Code (Claude Opus 5) | `CLOCK_RATE` default 0 in `app/config.py`, `docker-compose.yml` and `.env.example`; `seed.run.drifted_past_run` and the restart that starts the demo again; `presenterFailure.ts` (new) with the error reporting and busy state in `PresenterControl.tsx`; `advanceTo` made awaitable through `context.ts` and `DispatcherProvider.tsx`; README clock and hosted-demo sections; `tests/api/test_clock_rate.py` (1 test) and `presenterFailure.test.ts` (4) | A person reported both symptoms from the deployed URL. The root cause of the dead buttons was found by reading the live API: all four `/demo` routes are absent from `/api/openapi.json` because the host does not set `DEMO_MODE=true`, which is a variable on the host and not a repository change, so the code change is that the panel now says so. The drift repair was replayed against a real PostgreSQL: a database forced to Wed 30 Sep is restored by one restart to Mon 15:30 with Peliyagoda 23 and Kandy 1 and no `-R` orders, and a second restart does nothing. ruff, mypy, one Alembic head, the full backend suite (555), frontend lint, typecheck, 426 unit tests and the build all pass. Not run by the tool: the Playwright suite |
| 4 Oct | Dead buttons (`fix/dead-buttons`): every "Call" and "Call Dispatch" button, and D4's "Resend notice" | Claude Code (Claude Opus 5.5) | An AST scan of every `.tsx` for buttons with no handler or a no-op one, and every `toast.show`; then the fixes: driver and loader "Ask Dispatch to call" through the existing problem and flag records, "Can't reach the store", `POST /dispatcher/contact` (notices to the store, driver and dock, no migration), the per-order resend on `/deferrals/notify`, the `call_request` driver notice and the L1 dock banner, a regenerated `schema.ts`, and tests | A person asked for the sweep and approved the plan. Frontend lint, `tsc -b`, 421 unit tests, build and `check:bundle`; backend ruff, mypy, the rules tests and `test_routes.py`. Not run by the tool: the backend API tests (`test_contact.py` and the rest need PostgreSQL), `docker compose up` and the Playwright suite |
| 4 Oct | Submission audit and fixes (`fix/submission-audit`, `docs/ai-disclosure`) | Claude Code (Claude Opus 5.5) | A readiness audit of the repository and the hosted demo against the competition requirements. It found that the hosted API had no presenter routes, and that a hand move could send a vehicle on trip 2 before trip 1 had returned (reproduced with a script over plan v3: ten such moves were accepted). The fixes: rule R-TURN in `waypoint_rules/constraints.py` with its message and rule id, and in `moves.py` the rule left off a move that already breaks a structural rule; three tests in `tests/rules/test_golden.py`; PRD rows R-TURN and DP-31; the README restructured for judges, with the hosted-demo step (`DEMO_MODE=true`) and the loader-flag gap; and this disclosure rewritten from the team's draft | A person chose which findings to fix before the deadline, made the R-TURN decision, set `DEMO_MODE` on the host, and ran every commit, push and merge. The tool ran ruff, mypy, the rules tests, `alembic heads`, frontend typecheck and unit tests, and re-ran its scripts (no overlapping move accepted, no structural refusal that also lists R-TURN). The first CI run caught a refusal listing a third, meaningless rule at walkthrough step 4; that was fixed, and CI (backend tests on PostgreSQL, compose and the Playwright walkthrough) passed before the merge |

| 4 Oct | Draft plan that works on a full day (`fix/live-build-and-seed`): an audit of why ordering and planning looked inert, and the fixes | Claude Code (Claude Opus 5, then Opus 5.5) | `docs/build/audit-booklet-conformance.md`, `docs/build/testing-the-live-stack.md`, a per-request `timeoutMs` in `api/http` used by the four planner routes, the collision guard in `services/planning.py:sync_rerun_copies`, the Draft plan button in `QueueRoute.tsx`, and `SEED_GENERATED_ORDERS=false` pinned in the e2e job | A person reported the symptoms and tested in the browser. The tool's first audit blamed a mock build and a too-small seed; both were wrong (`frontend/.env.production` already makes the image live, and the README documents why the generated day is off by default), and defaulting the generated day on broke three e2e tests, so both changes were reverted and the audit corrected. What held up: drafting a full day took 11 to 19 s against a 15 s client timeout, so the screen said "No connection" while the draft was being saved; and a `system` `-R` carry-over copy is not exempt from `uq_orders_live_outlet_day_temp`, so two deferrals from one outlet made the 16:00 job return 500. Frontend lint, typecheck, 421 unit tests, build and `check:bundle`; backend ruff, mypy, one Alembic head and the full suite; the Playwright suite against `docker compose up` |

## Invented data

PRD §4d is the full register. Every figure, time and name the Day 5 design did not give us was invented or inferred and
is listed there (A1 to A58). The competition CSVs supply the real reference data: outlets, vehicles, the calendar,
district travel, service allowances and traffic speeds.

Invented or inferred, and registered in §4d:

- The hero-day orders, times, history, plan versions and live-board rows.
- The four demo accounts, the loader PINs (Priya 1234, Ruwan 5678) and all driver names other than those named in the PRD.
- The scripted background events (`backend/seed/scenario_events.yaml`), which the README says are simulated.
- The fallback reference set in `backend/seed/` used when `data/*.csv` is absent (PRD §4c figures and a generated calendar).
- Generated orders (A41): `backend/seed/generated.py` makes the 60-vehicle fleet, the extra outlets and ORD3001 upward
  from a fixed seed, only when `data/*.csv` is absent.

## Machine-translated strings

The driver app offers Sinhala and Tamil (R1.9). Those strings are a machine draft and have not been reviewed by a native
speaker. Open decision O-8 tracks who reviews them, and the README lists it under known gaps.

## What AI did not do

- It did not define the product requirements or the user experience.
- It did not invent the business rules. They come from the Challenge Booklet and live in `backend/waypoint_rules`. The
  one exception is R-TURN, which Claude Code proposed and a person decided to adopt (see the example above and DP-31).
- It did not approve its own work, and it could not merge: every change went through a pull request a person approved.
- It never saw the competition data: no CSV row was pasted into an AI tool (`Contributing.md` §29).
- It did not touch the Figma file.
- Its output was never treated as correct just because a tool produced it.

---

**AI accelerated the work. The team remained responsible for it.**
