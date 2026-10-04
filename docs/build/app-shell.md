<!-- Build log moved out of README.md so the README reads as the deliverable. -->

# 🔐 App shell (sign-in, role picker, sessions, presenter control)

The frames every role passes through before its own screens: sign-in (G1), the role picker (G2), per-role sessions and the one presenter control the judge walkthrough drives. Branch: `feature/auth`, cut from `develop`, frontend only. There is no backend yet, so everything runs against a mock.

**Status:** A0, A1 and A3 built (`tsc -b`, `oxlint`, `vitest run`, `vite build` all clean; 39 tests, 18 of them in `screens/auth`). A3 landed before A1 and A2 because the Figma connection was down; `/start` and `/auth/_states` answer with placeholders until A2 and A6 replace them. A2 and A4 to A6 are not started.

## Accounts

One demo password for all four accounts. PRD v3 section 4c leaves passwords to A40 and the README. The password is the backend's `DEMO_PASSWORD` (`.env.example`, seeded by `backend/seed/accounts.py`); the mock uses the same value so signing in behaves the same in mock and API mode. The default is `waypoint-demo` in `.env.example`, `backend/app/config.py` and `docker-compose.yml`. Anyone whose own `.env` still sets `DEMO_PASSWORD=waypoint` must change it, or sign-in against the real backend fails. The backend tests set their own password and are unaffected.

| Role | Email | Shown as | Lands on |
|---|---|---|---|
| Dispatcher | `dispatcher@waypoint.demo` | Kumari | `/dispatcher/queue` |
| Loader | `loader@waypoint.demo` | Dock tablet (a shared device, not a person) | `/loader/dock` |
| Driver | `driver@waypoint.demo` | Nimal | `/driver/run` |
| Store | `store@waypoint.demo` | Anusha | `/store/orders` |

Password for all four: `waypoint-demo`. The loader still enters a PIN per action after signing in; `PinSheet` from the field foundation does that and is not rebuilt here.

## Sessions (`src/screens/auth/session.ts`)

Stored per role under `wp.session.dispatcher`, `wp.session.loader`, `wp.session.driver` and `wp.session.store`, so one browser holds all four roles in four tabs. Signing out clears one role only. A session holds the role, email, display name, an opaque token and the sign-in time; the token is a demo string in mock mode and is shaped so a real JWT is a swap.

- Every read and write is wrapped. A blocked or cleared `localStorage`, or a quota error, never breaks sign-in: a failed read means "not signed in", a failed write leaves a session that lasts the tab.
- The tab-lifetime fallback answers only for a role whose write failed. A role that saved normally is dropped from it, so a session cleared in another tab or by clearing site data reads as signed out.
- Nothing clears a session on a failed network call, so the driver token survives going offline and the outbox can sync later (PRD v3 section 15).
- `readAnySession()` backs the `/` redirect and returns the first role in picker order (dispatcher, loader, driver, store); `readAllSessions()` backs the signed-in state on the `/start` cards.

## Sign-in API (`AuthApi.ts`, `mockAuthApi.ts`)

`signIn(email, password)`, `signOut(role)` and `getSession(role)`. A wrong password returns `{ ok: false, reason: "invalid_credentials" }` and being offline returns `{ ok: false, reason: "offline" }`; neither throws. An unknown email and a wrong password give the same answer. The mock answers in 300 to 600 ms like the field transport, and at once under vitest.

`VITE_AUTH_API=mock|api` picks the implementation, defaulting to the mock. PRD v3 section 9 principle 7 names the pattern `VITE_<ROLE>_API` for the four roles only, so this is a small extension of it, not something the PRD already says.

## Figma nodes

File `0qCle1zCrSImSou4lVlvmL`, page "Nexora (main)" `0:1`. The G frames are one contiguous block at `442:67xxx`.

| Node | Frame |
|---|---|
| `442:67261` | G1.1 Sign-in, desktop (1440 x 900) |
| `442:67336` | G1.2 Sign-in, phone, Light (390 x 844) |
| `442:67411` | G1.3 Sign-in, phone, Dark · pre-dawn (390 x 844) |
| `442:67486` | G1.4 Sign-in, wrong password (390 x 844) |
| `442:67568` | G1.5 Sign-in, offline (390 x 844) |
| `442:67656` | G2.1 Role landing, Dispatcher (480 x 560) |
| `442:67672` | G2.2 Role landing, Loader (480 x 560) |
| `442:67688` | G2.3 Role landing, Driver (480 x 560) |
| `442:67704` | G2.4 Role landing, Store (480 x 560) |
| `442:67720` | G3 Presenter mode over D6.4 (1440 x 900) |
| `442:68072` | G4 "Why this screen" over D7.1 (1440 x 900) |

There are five G1 and four G2 frames, as PRD v3 section 3 says. The conventions table once listed `175:2174`, `175:2456` and `175:2472`. They render the same frames as their `442:67xxx` counterparts but are an older copy outside this block; build from the table above.

## Notes from reading the frames

- **The sign-in frames already read "Waypoint".** The brief expected "Waypoint Dispatch" and a departure to fix it. G1.3 prints the neutral wordmark already, which is what PRD v3 section 6 asks for, so no departure was needed. Each role's own app name still appears in its chrome.
- **G1.4 and G1.5 are drawn.** The brief expected no retry and no offline frame. Both exist, taller than the base phone frame because they carry extra content, so they are copied as drawn. The retry behaviour (inline error, password cleared, focus back on it, email kept, no attempt counting) is still built, and only where the frames stop short.
- **G1.5's offline text, in full.** The warning alert reads "You're offline" (Archivo SemiBold 14) over "Sign-in needs a connection once. After that, field screens work offline." (Archivo Regular 13, line height 18). That is the whole string; the earlier metadata dump cut it at "After t...". The rest of the frame: the Sign in button at 40% opacity, the email field showing the placeholder "name@waypoint.lk", the password field empty, and below a divider the "Demo accounts" helper with a "Prototype" tag and four rows ("Kumari · Dispatcher", "Dock tablet · Loader", "Nimal · Driver", "Anusha · Store manager", each over its `@waypoint.demo` address in Plex Mono 12). The brief suggested "Your orders and deliveries are safe. Nothing was changed." for offline sign-in; Figma wins, so that line is not used.
- **PRD section 3's G2 card copy is abbreviated against the frames.** The frames add "· synced" to the Loader and Driver cards, plus a context line above and a target line below each card (for example "Peliyagoda dock · enter PIN per action" above and "Opens L1 Dock board" below). The frames are what gets built.
- **The G2 corner labels** (`DISPATCHER · LIGHT`, `LOADER · DARK`, `DRIVER · DARK`, `STORE · LIGHT`) name the theme of the role app each card opens, which is the per-role table in PRD v3 section 6. `/start` itself stays Light · office, and `/sign-in` is Light on desktop and Dark at phone width.
- **G2.1 names two screens** ("Opens D1 Queue / D6 Operations") but the card goes to `/dispatcher/queue`. The line is kept as drawn because it is descriptive text.

## Sign-in (A1)

`/sign-in` is one screen, `SignInScreen`, that draws every G1 frame from props: the layout (desktop or phone), a wrong password, offline and busy. `SignInRoute` owns the state and talks to the AuthApi through `getAuthApi()`, which is where `VITE_AUTH_API` is read. In `api` mode it returns the real client (`apiAuthApi`), so nobody signs in against the mock by accident; see "API mode" below.

- **Files** (`src/screens/auth/`): `SignInScreen.tsx` and its CSS module, `SignInRoute.tsx`, `signInStrings.ts` (every string, copied from Figma), `useIsPhone.ts`, `useSignInConnectivity.ts`, `authClient.ts`, and `gallery/` (the frame registry and the page).
- **Gallery and compare.** `/auth/_states` lists the five frames at their Figma size; `?frame=G1.4` draws one. `npm run compare -- auth G1.1 G1.2 G1.3 G1.4 G1.5` screenshots them beside `.figma/<id>.png` (it needs `npm run dev` running).
- **Retry.** A wrong password or an unknown email shows "Email or password is wrong. Check both and try again." under the password, keeps the email, clears the password and puts focus back on it. Attempts are not counted and nothing locks.
- **Offline.** `navigator.onLine` events are fed into the field `connectivity` store by `useSignInConnectivity`, because the field runtime that normally does this does not run on `/sign-in`. Offline shows the G1.5 notice and disables Sign in; an existing session is never touched.
- **Loading.** The form is a disabled `fieldset` and the button is busy. The button keeps its box, so nothing moves.
- **Demo accounts.** Tapping a row signs in at once with the demo password. Offline it only fills the fields.

**Decisions confirmed (2 Oct).** Demo rows sign in at once; desktop controls are 40 px as drawn and 44 px on touch; the wrong-password message names what to do. Where Figma is silent or contradicts the brief on a UX point, the stronger experience is chosen and any visible difference from a frame is recorded under "Departures from the brief".

**How it was checked.** Each frame was captured at 1x and diffed against its Figma PNG: every frame has the exact Figma size, every box edge (card, inputs, button, rows, notice) is within 1 px, and what remains is text and icon anti-aliasing plus a 1 px offset on the Prototype tag. The behaviour was driven in Chromium: wrong password then retry, no lockout, unknown email, no layout shift while loading, the four demo rows, four roles in four tabs of one browser, `/` redirecting a signed-in browser, the Dark phone theme and offline blocking and recovery. That script is scratch; the permanent four-role Playwright check comes in A6.

## Departures from the brief

- **Offline detection** reads the field `connectivity` object, not `navigator.onLine` directly. It wraps the browser's online state and adds "Simulate offline", which the walkthrough uses, so sign-in agrees with the rest of the app about being offline.
- **The API pattern** follows `api/StoreApi.ts` and `mockStoreApi.ts`. The brief points at `LoaderApi` and `mockLoaderApi.ts`, which live on the unmerged `feature/loader`.
- **`Role`** is the existing union in `domain/status.ts`; no second one was declared.
- **The wrong-password message names what to do.** G1.4 draws "Email or password is wrong." The brief asked for an error that says what to do next, so the live message adds "Check both and try again." The drawn sentence is verbatim and still does not say which of the two was wrong. This is a visible difference from G1.4, chosen deliberately, so the gallery frame and the compare for G1.4 show the longer text.
- **Line height is 1.08**, not the project's fixed 34 and 24. The frames set the sign-in text to automatic line height, and the browser's own `normal` (1.088) drifts 2 px down the card. 1.08 was measured against G1.2 and lines every box up exactly.
- **The desktop button is the shared `Button`**, medium, with its height and label size overridden through the `--size-button-md` and `--text-button-md` tokens inside the sign-in screen (40 px and 14 px, as G1.1). No second button was built and no shared file changed.
- **The disabled Sign in is the shared Button's 50%**; G1.5 draws 40%.
- **The demo row icons are 18 px**, as drawn. The shared `Icon` has no 18 size, so the SVG is sized in the sign-in CSS.
- **The email value is set in Plex Mono**, as G1.4 draws it, with the placeholder in Archivo.
- Sign-in assumptions where Figma is silent (demo row behaviour, the live theme, desktop control height, focus on load, empty submit) are in PRD section 4d under "App shell assumptions", unnumbered for central numbering.

## Shared files this role has changed

- **`frontend/src/app/App.tsx`** (A3, its own commit; a shared contract under Contributing section 18). It now routes `/` (a redirect), `/sign-in`, `/start`, `/auth/_states`, `/loader/*`, `/driver/*`, `/dispatcher/*`, `/field/_components` and `/store/*`. The route components live in `screens/auth/` under their final names, so sign-in, the role picker and the gallery replace their placeholders without touching this file again.
  - **The Store is no longer the catch-all.** Unknown paths go back to `/`, which sends a signed-in person to their role home and everyone else to `/sign-in`. The Store keeps every `/store/...` URL it had. It cannot sit under a `/store/*` parent, because `StoreRoutes` uses absolute `/store/...` paths and React Router would resolve them relative to `/store`, so it stays at the catch-all and answers only for its own prefix.
  - **Dispatcher slot.** `feature/dispatch-planning` is not merged, so `/dispatcher/*` renders a placeholder. The route has to exist: a signed-in dispatcher is sent from `/` to `/dispatcher/queue`, and without it that path would bounce back to `/` forever. The slot is marked in `App.tsx`. When the dispatcher branch merges, replace that line with `<Route path="/dispatcher/*" element={<DispatcherApp />} />` and delete `DispatcherSlot`.
- The presenter control (`app/PresenterControl.tsx`) and the Store top bar change in A4 and A5, each in its own commit, and will be listed here.

## Phases

- [x] A0 `AuthApi`, mock, `session.ts`, types (10 tests)
- [x] A1 G1 sign-in, five states, desktop and phone, retry, offline (8 new tests)
- [ ] A2 G2 `/start`, four role cards
- [x] A3 router: `/sign-in`, `/start`, `/` redirect, `/auth/_states` (`/start` and `/auth/_states` are placeholders until A2 and A6)
- [ ] A4 one shared presenter panel in `app/presenter/`, replacing the Store's copy
- [ ] A5 avatar menu, mounted in the Store top bar
- [ ] A6 gallery, Figma compare, Playwright four-role sign-in, this section completed, `docs/ai-disclosure.md` line

## Still to check

- The Store keeps `app/scenarioClock.ts` and the field apps keep `field/clock/clock.ts`. Two clocks, not unified here; whoever wires the real API should merge them.
- The vitest session tests stub `window.localStorage` because the test environment is `node`. A browser-level check of the four-tab sign-in comes with the Playwright script in A6.
- **Real client, wire format.** Over the wire the backend sends camelCase (`accessToken`, `expiresAt`, `displayName`), because its `ApiModel` has a camelCase alias generator. The real `AuthApi` maps those to `Session`; the field names in `types.ts` already match.
- **A server error has no frame.** `SignInFailureReason` is `invalid_credentials` or `offline`. A `5xx`, or a `429` if the backend adds rate limiting, would need a third reason and copy, and Figma draws neither. Decide with the real client.
- **Sign-in button weight and disabled opacity.** The label renders at the shared token's 600 where the Figma dump says Bold, and the disabled button is the shared 50% where G1.5 draws 40%. Check both against the Store's buttons in the A6 compare pass.
- **G1.4 compare.** The live message is longer than the frame's by design, so the G1.4 compare will differ on that one line.

---
