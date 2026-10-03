# Authentication and authorization audit

Date: Sat 3 Oct 2026. Audited on `develop` at `bb8453d`; fixed on `feature/auth`.
Scope: PRD v3 section 9 Auth and section 15; Contributing sections 2, 18, 19, 24, 29.

## Status

Findings 1 to 8 are fixed on `feature/auth` and verified against the rebuilt stack. Findings
9 to 13 are deliberately left, with the reasons in their rows. The fix plan further down is kept
as written, so the reasoning behind each change stays readable next to the finding it closes.

| # | Finding | Status |
| --- | --- | --- |
| 1 | Only `/dispatcher` was guarded | Fixed. All four role areas wrapped in `RequireSession` |
| 2 | Published JWT secret usable | Fixed. `check_secrets()` refuses it outside dev |
| 3 | Dev galleries in the production build | Fixed. All six gated on `import.meta.env.DEV` |
| 4 | Any role could move the scenario clock | Fixed. `/demo/advance` is dispatcher only |
| 5 | A shaped fake session passes the guard | Accepted, documented, and covered by a test |
| 6 | Scope helpers called from nowhere | Open by design. A merge requirement, not a code change |
| 7 | No rate limit on sign-in | Fixed. 20 failures per address per 5 minutes |
| 8 | No security headers | Fixed. Three headers, on the page and on assets |

**One correction to the original audit.** It listed four dev galleries. There are six: the loader
and driver apps each mount their own at `/loader/_states` and `/driver/_states`, found while
checking the build output. Both are now gated too.

### Verified after the fixes

Against a rebuilt `docker compose up --build`, signed out, on the production bundle at `:8080`:

- All 13 role and gallery paths land on `/sign-in`.
- Signing in as store reaches `/store/orders`; the same session is refused `/driver/run` and
  `/dispatcher/queue`.
- **A driver signed in, then taken fully offline, still loads the run from cache and keeps the
  token for the outbox.** The guard reads storage only, so the constraint in PRD v3 section 15
  holds.
- `/demo/advance`: store, driver and loader all 403; dispatcher authorized.
- Sign-in: 20 failures then 429, with the correct password also refused while the window is open.
- `ENVIRONMENT=production` with a published secret refuses to start; with a real secret it starts.
- Security headers present on the page and on a hashed asset.
- No gallery string remains in `dist/assets/` (the bundle is also about 33 KiB smaller).

Suites: 271 frontend tests pass (3 new files), backend pytest exits 0, ruff and mypy clean,
`alembic heads` prints one head, `tsc -b` and `oxlint` clean.

## Headline

**The backend guards are correct. The hole is client-side route guarding only.**

Every role route refuses the wrong role with 403 and refuses no token with 401. A forged
token fails; an expired token fails; `alg:none` fails; a tampered `role` claim does not
escalate, because the role is re-read from the database rather than trusted from the claim.
What is missing is `RequireSession` on three of the four role prefixes, so store, loader and
driver screens render their mock fixtures to anyone who types the URL.

That distinction changes the fix. This is not an access-control rebuild. It is three guard
wrappers, a dev-gallery gate, and a secret that must not ship with its documented default.

The severity ceiling is also set by build state: 49 of 52 role routes still answer 501
`not_implemented`. The dispatcher's 21 routes are the implemented ones. Today a stolen store
token reaches no store data because no store route returns data yet. The IDOR class the brief
asks about is therefore **latent, not live**: the scope helpers exist, are unit-tested, and are
called from nowhere. They become exploitable the moment the store, driver, loader and sync
branches land. That is the single most important thing in this document.

## What was verified by running it

Run against the live stack (`nexora_waypoint-api-1`, `web-1`, `db-1` up and healthy) and a
dev server on `:5177`.

- Signed-out visits to every role prefix and all four dev galleries, cleared site data between
  each, via Playwright. Recorded the landing URL, the rendered body and every request.
- The same four gallery paths against the **production** container on `:8080`.
- A full cross-role matrix: four real tokens from `POST /auth/login` against ten routes plus
  `/sync`, `/demo/advance` and `/demo/reset`.
- Unauthenticated and garbage-token probes against ten routes.
- Token forgery inside the api container with PyJWT: four candidate secrets, `alg:none`,
  an expired token, and a `role=dispatcher` claim on a store user's `sub`.
- `localStorage` tampering: a well-formed fake session, a role-mismatched session, and a
  session missing `token`.

Read and inferred, not executed: the nginx header set under TLS, loader PIN verification
(`verifyPin` is a 501 stub, so there is nothing running to rate-limit), and the attachment
ownership question (`/attachments` is also a stub).

## Reproduction of the reported symptom

Dev server, site data cleared before each load, mock mode (the default):

| URL | Landed on | Rendered | API calls | API returned |
|---|---|---|---|---|
| `/store/orders` | `/store/orders` | Full Store app. "Order for Mon 5 Oct", outlet OUT084, live order form | none | n/a |
| `/loader` | `/loader` | Loader app. Dock picker, "Which dock is this tablet at?" | none | n/a |
| `/loader/dock` | `/loader/dock` | Same dock picker | none | n/a |
| `/driver` | `/driver/run` | Full driver run. "Run 1 · VEH039", plan v4, stop list, OUT084 | none | n/a |
| `/driver/run` | `/driver/run` | Same | none | n/a |
| `/dispatcher` | **`/sign-in`** | Sign-in screen | none | n/a |
| `/dispatcher/queue` | **`/sign-in`** | Sign-in screen | none | n/a |

No API call is made in any case, because mock mode serves fixtures from memory. The data on
screen is fixture data, not another tenant's records. In API mode the same screens render and
then their first read returns 401 or 501, which is the second finding below.

## Findings

### Genuinely exploitable now

| # | Severity | Layer | File:line | What an attacker can do | Fix |
|---|---|---|---|---|---|
| 1 | High | Frontend routing | [App.tsx:47-49](../frontend/src/app/App.tsx#L47-L49), [App.tsx:81-83](../frontend/src/app/App.tsx#L81-L83) | Type `/store/orders`, `/loader` or `/driver/run` with no session and get the full role UI. Only `/dispatcher` is wrapped in `RequireSession`. In mock mode this exposes fixture data and the whole interface; in API mode it exposes the interface and every screen's structure. For the judge demo it reads as "the app has no sign-in" | Wrap `LoaderApp`, `DriverApp` and `StoreApp` in `RequireSession` with their role, exactly as the dispatcher branch at line 81 already does |
| 2 | High | Config | [config.py:19](../backend/app/config.py#L19), [.env.example:14](../.env.example#L14), [docker-compose.yml:33](../docker-compose.yml#L33) | `jwt_secret` defaults to `change-me-in-env`, Compose defaults to `change-me-in-env-change-me-in-env`, and `.env.example` ships that same literal. **Verified: a token forged with the documented value is accepted as any user, including dispatcher.** Nothing warns or fails at startup. Any deployment that skips `.env` is fully compromised by reading the repository | Fail startup when `jwt_secret` is a known default and the app is not in dev; generate a random secret in Compose; stop printing a usable value in `.env.example` |
| 3 | Medium | Frontend routing | [App.tsx:37-38](../frontend/src/app/App.tsx#L37-L38), [App.tsx:50](../frontend/src/app/App.tsx#L50), [App.tsx:52](../frontend/src/app/App.tsx#L52) | **Verified against the production container on :8080:** `/store/_states`, `/auth/_states` and `/field/_components` render in the shipped build, unauthenticated. `/dispatcher/_states` is correctly gated by `import.meta.env.DEV` and redirects to sign-in. The galleries carry fixtures and mount real role providers, so they also enlarge the bundle and show judges internal scaffolding. PRD section 15 says "Judges never see it" | Gate the other three on `import.meta.env.DEV` the way the dispatcher gallery at line 37 already is |
| 4 | Medium | Backend authz | [shared.py:31-36](../backend/app/routers/shared.py#L31-L36) | `POST /demo/advance` takes `AnyUser`. **Verified: store, driver and loader tokens all moved the scenario clock (200).** Any signed-in role can jump the demo clock mid-walkthrough, changing cutoffs and plan state for everyone. `/demo/reset` is correctly `Dispatcher`-only (403 for the rest, verified) | Change `AnyUser` to `Dispatcher` on `advance_clock`, matching `reset_demo` on line 40 |
| 5 | Medium | Frontend session | [RequireSession.tsx:11](../frontend/src/screens/auth/RequireSession.tsx#L11), [session.ts:50-75](../frontend/src/screens/auth/session.ts#L50-L75) | **Verified:** writing a well-formed `wp.session.dispatcher` with `token: "totally-made-up"` renders the full Dispatch UI. `parse()` correctly rejects a role mismatch and a missing `token` (both land on sign-in), so the shape check works; it just cannot tell a real token from a string. In API mode every read then 401s and `tokens.ts` clears the session and bounces to sign-in, so what they see is a shell that empties. In mock mode they see fixtures indefinitely | Accept this as the client-side limit it is. The real fix is that the server never trusts the token, which it already does not. Optionally have the role root confirm with `GET /me` on mount in API mode |

### Hardening

| # | Severity | Layer | File:line | What an attacker can do | Fix |
|---|---|---|---|---|---|
| 6 | Medium | Backend authz (latent) | [deps.py:78-93](../backend/app/deps.py#L78-L93) | `require_outlet`, `require_vehicle` and `require_depot` are **called from no router and no service** (verified: the only call sites in the repo are `tests/api/test_scope.py`). No live route takes an `outletId` or `vehicleId` from a path or body today, so nothing is exploitable yet. The moment store, driver, loader or sync land, every one of them is an IDOR unless the author remembers to call these. The helpers are correct; the wiring is absent | Not a fix to make now. Make it a merge requirement: any PR adding a route that accepts an `outletId`, `vehicleId`, `orderId` or depot must call the matching helper and ship a cross-scope 403 test. Worth a line in Contributing section 19 |
| 7 | Medium | Backend auth | [routers/auth.py:18-25](../backend/app/routers/auth.py#L18-L25) | No rate limiting or lockout on `POST /auth/login`. With one shared demo password documented in the README, brute force is not the realistic threat, but the endpoint is unbounded. The timing-safe part is already handled: `_DUMMY_HASH` on line 15 makes an unknown email cost the same bcrypt round as a wrong password, and both return the same `invalid_credentials` body | Add a simple per-IP attempt limit. Low value for the demo, expected for a real deployment |
| 8 | Medium | Transport | [deploy/web/nginx.conf](../deploy/web/nginx.conf) | No security headers at all: no HSTS, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy` or CSP. The app is frameable and sniffable. There is no `Caddyfile` in `deploy/`, despite Contributing section 24 listing one | Add the header block to `nginx.conf`. A CSP needs testing against the Vite bundle and the service worker, so treat it separately from the cheap four |
| 9 | Low | Transport | [main.py:22-23](../backend/app/main.py#L22-L23) | **Verified:** `/api/docs` and `/api/openapi.json` return 200 through the public nginx proxy on `:8080`. This is intentional per Contributing section 19 (the frontend generates `schema.ts` from it) and it leaks no data, only the shape of the API. For a judged demo it is arguably a feature | Leave for the demo. For a real deployment, serve the schema from a build artifact and disable both in production |
| 10 | Low | Backend auth | [auth.py:30-44](../backend/app/auth.py#L30-L44) | No refresh and no revocation. A 12 h token stays valid for its full life after a role change, a deactivation or a sign-out: sign-out only clears `localStorage`. There is no `deactivated` flag on `User` to check. `current_user` does re-read the user each request, so a **deleted** account is caught ("That account no longer exists") and a changed role takes effect immediately, which blunts most of this | Acceptable for the demo given the 12 h window. A real deployment needs a deny list or short tokens plus refresh |
| 11 | Low | Backend authz | [loader.py:20-23](../backend/app/routers/loader.py#L20-L23), [deps.py:90-93](../backend/app/deps.py#L90-L93) | **Verified:** the loader token reaches both `/loader/docks/kandy` and `/loader/docks/peliyagoda`. This is deliberate and documented in `deps.py:73-75`: the dock is a device setting, not an identity, so the shared tablet account is unbound. Worth recording so a later reviewer does not "fix" it into a bug | No change. The comment already explains it; the audit now does too |
| 12 | Low | Backend auth | [loader.py:26-29](../backend/app/routers/loader.py#L26-L29) | Loader PIN: `verifyPin` is a 501 stub, so there is no verification path to attack yet. Storage is right already: `pin_people.pin_hash` holds bcrypt (`seed/accounts.py:59`), never the PIN. When it is built, the 4-digit space is 10 000 wide and the schema allows 1 to 12 characters, so it needs a per-person attempt limit, and the result must bind to the session, not just the device | A note for `feature/loader`, not a change here |
| 13 | Low | Logging and audit | [errors.py](../backend/app/errors.py), [routers/auth.py](../backend/app/routers/auth.py) | No token, password hash or PIN appears in any error body or audit row. `audit_events` records `actor=user.email` (`shared.py:34`, `shared.py:45`), which is correct. The one thing to watch: `LoginIn` carries a plaintext password, so any future request-body logging middleware would capture it | No change. Note it if request logging is ever added |

### Checked and correct

Worth stating plainly, because it determines how small the fix list is.

- **Role separation.** Every wrong-role call returns 403, every right-role call reaches its
  handler. Verified across all four tokens and ten routes.
- **No token, no access.** All ten routes 401 unauthenticated. `/health` is the only open
  route and returns `{"status":"ok"}` with a database round trip. No version, no build, no
  environment.
- **Token integrity.** Algorithm pinned to HS256 at `auth.py:15` and passed as a single-element
  list to `jwt.decode` at line 49, so `alg:none` is rejected (verified: 401). `exp` and `iat`
  are set at lines 41-42 and PyJWT verifies `exp` by default (verified: an expired token 401s
  with "Your session has expired. Sign in again").
- **Claims are not trusted.** `current_user` at `deps.py:43-46` re-reads the `User` row and
  builds `CurrentUser` from the database, ignoring the claim's `role`, `outletId` and
  `vehicleId`. Verified: a token signed with the real secret carrying the store user's `sub`
  and `role=dispatcher` got 403 on `/dispatcher/live` and reported `role: store` on `/me`.
  This is the single strongest thing in the auth design.
- **Driver offline token.** `session.ts:16-18` and `tokens.ts:12-13` are correct and
  deliberate: only a real 401 clears a session, never a network failure. `client.ts:131-132`
  enforces it at the one place it matters. Nothing in the fix plan touches this.
- **401 handling.** On a real 401 the role's session is cleared, `wp:session-expired` fires,
  and `SessionExpiryListener` moves the person to sign-in only if they are in that role's
  area, so a Store expiry in one tab cannot move a driver in another.
- **Login hygiene.** Same error for unknown email and wrong password, and a dummy bcrypt
  round so the two take the same time.
- **CORS.** Origins are an explicit allow list, not `*` (verified in the running container:
  `["http://localhost:8080","http://localhost:5173"]`). `allow_credentials: True` is harmless
  here because the app uses bearer tokens, not cookies. The dev origin `:5173` is in the
  Compose default, which is a smell for production but not a vulnerability by itself, since
  `allow_origins` is overridable by environment.

## Fix plan

Ordered smallest safe change first. Items 1 to 3 are the ones I would do before the demo.

### 1. Guard the three unguarded role prefixes

**File:** `frontend/src/app/App.tsx` (lines 47-49 and 81-83).
**Approach:** wrap `LoaderApp`, `DriverApp` and `StoreApp` in `RequireSession` with their role,
copying the dispatcher's existing pattern. No new component, no new strings, no change to
`RequireSession` itself.

**Risk to the judge walkthrough (PRD section 16):** real but manageable. The walkthrough opens
four tabs and signs in as each role, so each tab will have its session before it reaches a role
screen. What breaks is any habit of deep-linking straight to `/driver/run` without signing in,
and the `?dock=` entry path for the loader tablet. Both need a pass through the walkthrough
after the change.

**Risk to the offline driver flow:** none if done as described. `RequireSession` calls
`readSession`, which reads storage and never makes a request, so an offline driver with a
stored session still passes. The guard must stay a pure storage read: adding a `GET /me`
check here would strand an offline driver at sign-in, which is exactly what the brief forbids.

**Shared contract:** `App.tsx` is `feature/field-foundation` territory, not `feature/auth`.
Per Contributing section 2 this is a note in the PR, and ideally the owner's nod. The import
already exists, so the diff is three wrappers.

### 2. Make the default JWT secret unusable

**Files:** `backend/app/config.py`, `.env.example`, `docker-compose.yml`.
**Approach:** keep the default for local dev, but refuse to start when the secret is a known
default and the environment is not dev. Replace the literal in `.env.example` with an
instruction and a generator command rather than a working value. Give Compose a generated
default instead of a shared constant.

**Risk to the walkthrough:** low, but this is the one that can stop the stack booting if the
check is too strict. Gate it on an explicit environment flag so `docker compose up` on a clean
checkout still works for the judges.

**Shared contract:** `app/auth.py` and `app/config.py` belong to `feature/backend-foundation`
(Contributing section 18). Needs the owner's approval and a PR note. Do not land this silently
from `feature/auth`.

### 3. Gate the three dev galleries

**File:** `frontend/src/app/App.tsx` (lines 37-38, 50, 52).
**Approach:** apply `import.meta.env.DEV` to the store, auth and field galleries the way line 37
already does for the dispatcher's. Vite then tree-shakes them out of the production bundle,
which also shrinks it.

**Risk:** none to the walkthrough, which never opens a gallery. Check that no build or compare
script (`scripts/compare-frames.ts`, `scripts/loader-stories.ts`) drives a gallery against a
production build, or those scripts need a dev server.

**Shared contract:** `App.tsx` again, same note as fix 1. Fold both into one PR.

### 4. Make the clock dispatcher-only

**File:** `backend/app/routers/shared.py` line 32.
**Approach:** change `user: AnyUser` to `user: Dispatcher`.

**Risk to the walkthrough:** this needs checking before it lands. The presenter control is the
dispatcher's, per the comment on `reset_demo`, but confirm no store, loader or driver screen
calls `advance` during the walkthrough. If one does, this breaks the demo, and the right answer
is a presenter token rather than opening the route.

**Shared contract:** `routers/shared.py` is backend-foundation. PR note and owner's approval.

### 5. Security headers on nginx

**File:** `deploy/web/nginx.conf`.
**Approach:** add `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`X-Frame-Options: DENY` and, under TLS only, HSTS. Leave CSP out of this change: the Vite
bundle and the service worker need it tested properly, and a wrong CSP breaks the app silently.

**Risk:** none to the walkthrough. `X-Frame-Options: DENY` would break any iframe embedding of
the app, so confirm the presenter setup does not use one.

**Shared contract:** `deploy/` is backend-foundation. PR note.

### 6. Login rate limiting

**File:** `backend/app/routers/auth.py`.
**Approach:** a per-IP counter on `POST /auth/login`. In-process is fine for a single API
container.

**Risk:** a limit set too low will lock out judges who mistype the shared password, or the
Playwright walkthrough, which signs in four times in quick succession from one IP. Set it
generously, and exclude the demo accounts if that proves awkward.

**Shared contract:** `routers/auth.py` auth extensions are `feature/auth`'s own, per the
constraint in the brief. This one is in scope without a note.

### Not doing now

Refresh and revocation (finding 10), disabling `/api/docs` (finding 9), the PIN attempt limit
(finding 12) and CSP. All are real for a production deployment and none affects the demo. The
PIN limit belongs with `feature/loader` when `verifyPin` is actually built.

## Missing tests

Nothing below exists today. The backend's role coverage in `tests/api/test_auth.py` is genuinely
good: `test_wrong_role_is_403` covers 11 role-and-route pairs and `test_right_role_reaches_the_501_body`
covers 4. These are the gaps around it.

**Frontend guard tests (none exist).** Verified: no test file references `RequireSession` or
`RootRedirect`. Needed, one per role:

- Signed out, each of `/store/orders`, `/loader/dock`, `/driver/run` and `/dispatcher/queue`
  lands on `/sign-in`. The first three fail today and are the regression test for fix 1.
- Signed in as role X, X's home renders.
- Signed in as role X only, role Y's prefix still lands on sign-in. Cross-role, four pairs.
- A session for role X stored under role Y's key is refused. `session.test.ts` covers the
  `parse` level; this covers it through the guard.
- `/` with no session goes to sign-in; `/` with one session goes to that role's home.

**401-handling test (none exists).** In API mode, when a role's first read returns 401: the
session for that role is cleared, the other three survive, `wp:session-expired` fires, and a
person inside that role's area lands on sign-in while a person elsewhere does not move. Then the
companion that protects the offline driver: a **network failure** on the same call clears
nothing and leaves the outbox intact. That second test is the guard rail for every future change
to `tokens.ts`, and it matters more than the first.

**Backend per-route tests.** Two assertions for every route, as the brief asks:

- Wrong role gets 403. The table in `test_auth.py` covers 11 of 52 routes by hand. Make it
  exhaustive by generating from `app.routes`, so a new route cannot be added without a role
  decision. That one change also permanently prevents a route shipping with no dependency.
- Cross-scope id gets 403. This is the one that cannot be written yet for most routes, because
  the routes are stubs and nothing calls the scope helpers. `tests/api/test_scope.py` tests the
  helpers in isolation, which is necessary but proves nothing about any endpoint. As each branch
  implements its routes, it owes a test that a store token is refused another outlet's order, a
  driver token another vehicle's run, and a loader token a stop that is not at its dock.

**Also worth adding:**

- An expired token is 401 and a forged token is 401. Both verified by hand here, neither
  asserted in the suite.
- `POST /demo/advance` is dispatcher-only. The regression test for fix 4; `test_clock.py`
  already has `test_reset_is_dispatcher_only` to copy.
- A production build does not contain the dev galleries. The regression test for fix 3, as a
  grep over `dist/` in CI.
- Startup refuses the default JWT secret in non-dev. The regression test for fix 2.
