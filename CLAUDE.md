# Waypoint: rules for AI coding tools

Read `Contributing.md` (sections 2, 18, 19, 24, 29) and `waypoint-prd-v3.md` before changing code. The PRD is the spec; when a Figma frame and the PRD disagree, follow the PRD and add a row to the departures register (PRD §18).

## Git
- Branch from `develop` as `feature/<area>`; open the PR to `develop`. Never commit to `main` or `develop` directly. Never force push.
- Stage files by path; never `git add .` without reading `git status`.
- Conventional Commits (`feat(scope): …`). **No AI attribution lines** in commits or PR descriptions (no `Co-Authored-By`, no "Generated with"). Add a line to `docs/ai-disclosure.md` instead.
- Stay inside the paths your branch owns (Contributing §2). Touching a shared contract (§18) needs a note in the PR description.

## Data and Figma
- Never open, print, paste or commit rows from the competition CSVs in `data/`. If you need a column name, ask the human.
- Figma file `0qCle1zCrSImSou4lVlvmL` is read-only. Read frames to compare; never create, move, rename or edit anything.

## Architecture
- Every rule, calculation and refusal message lives in `backend/waypoint_rules` (pure Python, no FastAPI or SQLAlchemy). The frontend never re-implements a rule.
- Business code never calls `datetime.now()` / `new Date()` for "now": use `app.clock.now()` and `useNow()`.
- Every state change writes an `audit_events` row in the same transaction; order transitions go through `waypoint_rules.transition`.
- Device writes are idempotent by `clientId`.
- JSON is camelCase, Python snake_case. Dataset IDs (`ORD2001`, `OUT084`, `VEH039`) are primary keys.
- Frontend types come only from generated `frontend/src/api/schema.ts`. Screens call only their role interface (`StoreApi`, `DispatcherApi`, `LoaderApi`, `DriverApi`), which has a mock and a real implementation.
- A Figma frame is a state of a route, not a route. Every screen has loading, empty, offline and error states.
- One Alembic migration per PR; `alembic heads` must print one head.

## Screen copy
No em dashes, never the word "Mock", no bracketed placeholders, no invented phone numbers. Stores see "Under review", never "Conflict".

## Before you say you are done
- Frontend: `npm run lint && npm run typecheck && npm run build`
- Backend: `ruff check . && mypy && pytest && alembic heads`
- State what you verified and what you guessed.
