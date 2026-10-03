# 🤝 Waypoint: Team Git & Repository Guide

Welcome to the Waypoint repository! 🚚

This document explains **how everyone should use the repository**, how we manage branches, how we submit code, and the rules we follow to avoid conflicts and Git chaos. 😭

> **Golden Rule:** Nobody pushes directly to `main`.

---

# 🗺️ 1. How Our Git Structure Works

We use three levels of branches:

```text
                         🚀 main
                           ▲
                           │
                           │ Pull Request
                           │
                     🧪 develop
                           ▲
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             │             │             │
        feature/auth   feature/orders   feature/driver
             │             │             │
             👨‍💻            👩‍💻            👨‍💻
```

### 🟢 `main`

The **stable version** of Waypoint.

This should always be:

* Working
* Tested
* Demo-ready
* Safe to deploy

🚫 **Do NOT push directly to `main`.**

---

### 🟡 `develop`

The **main development/integration branch**.

All completed features are merged here first.

```text
feature/*
     ↓
 develop
     ↓
 testing
     ↓
 main
```

This is where the team's work comes together.

---

### 🔵 `feature/*`

Individual development branches.

Each person works on their assigned feature branch.

Example:

```text
feature/auth
feature/order-management
feature/dispatch-planning
feature/allocation-engine
feature/loader
feature/driver
feature/offline-sync
feature/store-receipt
feature/analytics
```

---

# 👥 2. Team Branch Assignment

Every branch below is cut from `develop` and merges back into `develop` by Pull Request.
What each branch owns is defined by the PRD (`waypoint-prd-v3.md`). The section numbers are listed so nobody builds the same thing twice.

| Branch | Responsibility | Owns (code) | PRD |
| --- | --- | --- | --- |
| `feature/team-conventions` | 📜 This guide (including the rules for AI coding tools), syncing `develop` with `main` | `Contributing.md` | |
| `feature/field-foundation` | 🧱 Frontend base: Vite app, shared UI, tokens, store screens, PRD docs | `frontend/` base, `frontend/src/shared`, `frontend/src/styles` | §6, §15 |
| `feature/backend-foundation` | 🗄️ Schema, migrations, app core, rules package, seed, Docker, CI | `backend/app` core, `backend/app/models`, `backend/alembic`, `backend/waypoint_rules`, `backend/seed`, `docker-compose.yml`, `.github/` | §9, §10, §11, §13, §14 |
| `feature/auth` | 🔐 Sign-in (G1), role picker (G2), per-role sessions, loader PIN sheet | `frontend/src/screens/auth`, `backend/app/routers/auth.py` extensions | §9 Auth, §15 |
| `feature/order-management` | 📦 Store ordering (S1), cutoff, order lifecycle, dispatcher queue (D1) | `backend/app/services/orders.py`, `routers/store.py` (orders), `routers/dispatcher.py` (queue, history) | §4b, §13, §19 |
| `feature/allocation-engine` | 🧠 Planner, validate-move, plan versions, release, planning jobs | `backend/waypoint_rules/planner.py`, `backend/app/services/planning.py`, `routers/dispatcher.py` (plan, capacity, deferrals, release) | §4a, §12, §13 |
| `feature/dispatch-planning` | 🗺️ Dispatcher screens D1 to D9 and the `DispatcherApi` client | `frontend/src/screens/dispatcher` | §3, §15 |
| `feature/loader` | 🏭 Loader screens L1 to L4, loader read endpoints | `frontend/src/screens/loader`, `routers/loader.py` | §3, §15, §19 |
| `feature/driver` | 🚚 Driver screens R1 to R10, driver read endpoints | `frontend/src/screens/driver`, `routers/driver.py` | §3, §15, §19 |
| `feature/offline-sync` | 📡 Outbox, `/sync`, attachments, reconciliation, live board, conflicts and exceptions (D6 to D8) | `frontend/src/field/offline`, `routers/sync.py`, `routers/attachments.py`, `services/sync.py`, `routers/dispatcher.py` (live, inbox, conflicts, exceptions) | §15 Offline, §17, §19 |
| `feature/store-receipt` | 🏪 Store deliveries, receipt, issues, updates feed (S2 to S4) and wiring the store app to the API | `routers/store.py` (all but orders), `frontend/src/screens/store` | §3, §19 |
| `feature/analytics` | 📊 Capacity outlook D9 and the Datathon notebook | `routers/dispatcher.py` (forecast), `analytics/` | §12 D9 |
| `feature/release` | 🏁 Presenter control, Playwright walkthrough, docs, deploy | `e2e/`, `docs/`, `deploy/`, `README.md` | §16 to §19 |
| `feature/api-wiring` | 🔌 Typed HTTP client, the real clients for auth, store, driver and loader behind `VITE_<ROLE>_API`, the field fetch transport (`/sync`, `/attachments`) | `frontend/src/api/http`, `frontend/src/api/api*Api.ts`, `frontend/src/field/offline/fetchTransport.ts`, `apiSync.ts`, `frontend/src/screens/*/api*Api.ts` | §9, §15, §19 |

**Branches that will not be merged**

| Branch | Why |
| --- | --- |
| `feature/store-manager-frontend` | Fully contained in `feature/field-foundation`. Close it once field-foundation is merged. |
| `feature/dispatcher-frontend` | Built against old Figma node ids and one route per frame. Reference only; `feature/dispatch-planning` is the dispatcher branch. |
| `backend/foundation` | Wrong prefix. Renamed to `feature/backend-foundation`. |

**Shared router files.** `routers/dispatcher.py` and `routers/store.py` are split between owners, one function per endpoint. Don't reorder or reformat other people's functions in these files, or every merge will conflict.

> ⚠️ Branch ownership does not mean nobody else can contribute to that area. It simply gives each area a primary owner.

---

# 📅 2b. Deadline and Release Plan

The deadline is **Sun 4 Oct 2026, 23:59**. We merge in this order: whatever other branches depend on goes first.

| When | What must be in `develop` |
| --- | --- |
| Thu 1 Oct, morning | `feature/team-conventions`, `feature/field-foundation` |
| Thu 1 Oct, night | `feature/backend-foundation`. From here on the database schema and the API routes exist; the other backend branches start from them |
| Fri 2 Oct, night | `feature/allocation-engine`, `feature/order-management`, `feature/offline-sync` (backend part), and each role's screens against its typed API |
| Sat 3 Oct, 18:00 | Every role wired to the real API. **Release candidate:** `develop` → `main` |
| Sun 4 Oct, 12:00 | Feature freeze. Only fixes after this |
| Sun 4 Oct, 18:00 | Final `develop` → `main`, tag `v1.0.0`, deploy, record the video |

---

# 💻 3. First Time Setup

Clone the repository:

```bash
git clone <REPOSITORY_URL>
```

Enter the project:

```bash
cd <REPOSITORY_NAME>
```

Check the available branches:

```bash
git branch -a
```

You should see something similar to:

```text
main
develop
remotes/origin/main
remotes/origin/develop
remotes/origin/feature/auth
...
```

---

# 🔀 4. Switch to Your Branch

For example, if you are working on authentication:

```bash
git checkout feature/auth
```

Or:

```bash
git switch feature/auth
```

Check that you're on the correct branch:

```bash
git branch
```

You should see:

```text
* feature/auth
  develop
  main
```

The `*` shows your current branch.

---

# 🧠 5. BEFORE You Start Coding

Always make sure your branch is up to date.

Run:

```bash
git checkout develop
git pull origin develop
```

Then return to your feature branch:

```bash
git checkout feature/auth
```

Update your feature branch with the latest development code:

```bash
git merge develop
```

Now you are working with the latest version of the project.

---

# ✍️ 6. Start Working

Now you can safely work on your assigned feature.

For example:

```text
feature/order-management
```

You might create:

```text
orders/
├── components/
├── services/
├── hooks/
└── ...
```

Follow the existing project structure.

🚨 **Do not randomly create new folders or architectures without discussing them with the team.**

---

# 💾 7. Check Your Changes

Before committing:

```bash
git status
```

Review what you've changed.

You can inspect specific changes with:

```bash
git diff
```

Make sure you haven't accidentally modified unrelated files.

---

# 📦 8. Commit Your Work

Add your changes **by path**, not with `git add .`:

```bash
git add frontend/src/screens/loader backend/app/routers/loader.py
```

`git add .` is how datasets, `.env` files and build output end up in a commit. If you do use it, run `git status` first and read every line.

Then commit:

```bash
git commit -m "feat(loader): add dock screen L1"
```

---

# 📝 9. Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org). A scope is optional but helps: `feat(store): …`, `fix(rules): …`.

| Type | Use for | Example |
| --- | --- | --- |
| `feat` | New feature | `feat(dispatcher): add refusal popover` |
| `fix` | Bug fix | `fix(rules): count shared arrival once` |
| `refactor` | Refactoring | `refactor(planning): split draft job` |
| `docs` | Documentation | `docs: add ERD` |
| `test` | Tests | `test(sync): replay H11 to H16` |
| `style` | Visual only | `style(driver): field theme contrast` |
| `chore` | Config, deps, Docker, CI | `chore: add postgres healthcheck` |

**No AI attribution lines** in commits or PR descriptions: no `Co-Authored-By: Claude…`, no `Generated with…`. We disclose AI use once, in `docs/ai-disclosure.md`. If you use an AI coding tool, make it read this file first (section 29). Check the message before you push anyway.

Commit as yourself (your own GitHub name and email), not as a bot identity.

---

# 🚀 10. Push Your Branch

After committing:

```bash
git push
```

If it's your first push:

```bash
git push -u origin feature/auth
```

Replace the branch name with your own branch.

---

# 🔀 11. Create a Pull Request

Once your feature is ready:

Go to GitHub.

You should see:

> **Compare & pull request**

Create a Pull Request:

```text
FROM:
feature/your-branch

TO:
develop
```

### ✅ Correct

```text
feature/auth
      ↓
     PR
      ↓
   develop
```

### ❌ Wrong

```text
feature/auth
      ↓
     PR
      ↓
    main
```

Only `develop` → `main` PRs target `main`, at the times in section 2b.

A PR can be merged only when:

* CI is green (section 17)
* It is up to date with `develop`
* It has **one** Alembic head (section 19)
* Someone other than the author has approved it

---

# 📋 12. Pull Request Format

Use a clear title.

Example:

```text
feat: implement order management
```

Description:

```markdown
## 🚀 What was added?

- Order creation
- Order validation
- Order status management
- Order API endpoints

## 🧪 Testing

- Tested order creation
- Tested order validation
- Tested status changes

## 📸 Screenshots

Add screenshots if relevant.

## ⚠️ Notes

Mention anything reviewers should know.
```

---

# 👀 13. Code Review

Every important PR should be reviewed by another team member.

The reviewer should check:

* ✅ Does it work?
* ✅ Is the code understandable?
* ✅ Does it follow the project structure?
* ✅ Does it break existing functionality?
* ✅ Are edge cases handled?
* ✅ Are database/API changes correct?
* ✅ Are tests included where appropriate?

If everything looks good:

**Approve → Merge**

---

# 🔄 14. Keeping Your Branch Updated

Because 9 people are working simultaneously, `develop` will change frequently.

Before starting work each day:

```bash
git checkout develop
git pull origin develop
```

Then:

```bash
git checkout feature/your-branch
git merge develop
```

If there are conflicts, resolve them carefully.

Then:

```bash
git add .
git commit -m "chore: resolve merge conflicts"
```

---

# ⚠️ 15. Merge Conflicts

Don't panic. 😭

A merge conflict usually means two people changed the same piece of code.

You'll see something like:

```text
<<<<<<< HEAD
Your changes
=======
Changes from develop
>>>>>>> develop
```

Decide which code should remain, or combine both changes.

Then remove the conflict markers:

```text
<<<<<<<
=======
>>>>>>>
```

After fixing:

```bash
git add .
git commit -m "fix: resolve merge conflict"
```

If you're unsure:

> 🛑 **Ask the person who owns that feature before resolving it.**

Do NOT blindly delete someone's work.

---

# 🚨 16. VERY IMPORTANT: Never Do This

### ❌ Don't push directly to main

```bash
git checkout main
git push
```

Don't.

---

### ❌ Don't force push

Avoid:

```bash
git push --force
```

Especially on:

```text
main
develop
```

Force pushing can destroy other people's work.

---

### ❌ Don't commit secrets

Never commit:

```text
.env
API keys
passwords
private keys
credentials
```

Use:

```text
.env.example
```

instead.

---

### ❌ Don't commit competition datasets

The Tech-Triathlon datasets must not be publicly distributed.

Keep them local.

---

### ❌ Don't commit random files

Before:

```bash
git add .
```

check:

```bash
git status
```

Make sure you're not accidentally committing:

```text
node_modules/
.env
large files
datasets
build files
temporary files
IDE files
```

---

# 🧹 17. Keep Your Code Clean

Run these before opening a PR. CI runs the same commands and blocks the merge if any fail.

**Frontend** (`frontend/`)

```bash
npm ci
npm run lint        # oxlint
npm run typecheck   # tsc -b
npm run build       # tsc -b && vite build
```

**Backend** (`backend/`)

```bash
uv venv && uv pip install -e ".[dev]"   # or: python -m venv .venv && pip install -e ".[dev]"
ruff check .
mypy                                     # strict on waypoint_rules
pytest
alembic heads                            # must print exactly one head
```

**Whole system**

```bash
docker compose up --build
```

Then open `http://localhost:8080` and play the part of the judge walkthrough (PRD §16) that your feature touches.

---

# 🏗️ 18. Don't Change Core Architecture Without Discussion

Some parts of Waypoint affect everyone. Each one has an owner. Changing it needs a message in the team chat **before** the PR, and the owner's approval on the PR.

| Contract | Lives in | Owner branch |
| --- | --- | --- |
| Database schema | `backend/app/models`, `backend/alembic/versions` | `feature/backend-foundation` |
| Rules and refusal messages | `backend/waypoint_rules` | `feature/backend-foundation` (planner: `feature/allocation-engine`) |
| API contract | FastAPI routes → `/api/openapi.json` → `frontend/src/api/schema.ts` | `feature/backend-foundation` |
| Shared frontend types | `frontend/src/domain` (11 statuses, tags, `statusLabel()`) | `feature/field-foundation` |
| Design tokens and shared UI | `frontend/src/styles/tokens.css`, `frontend/src/shared` | `feature/field-foundation` |
| Auth and scopes | `backend/app/auth.py`, `backend/app/deps.py` | `feature/backend-foundation` |
| Docker and CI | `docker-compose.yml`, `deploy/`, `.github/` | `feature/backend-foundation` |

Especially:

```text
Database
    ↓
API
    ↓
Frontend
```

If one person changes the database structure without informing the others, three other people's code might break.

---

# 🔗 19. Shared Contracts

These rules apply to every contract listed in section 18.

### Rules live in one place

Every constraint, calculation and refusal message lives in `backend/waypoint_rules`. It is pure Python: no FastAPI and no SQLAlchemy imports.

* The API calls it.
* The frontend **never** re-implements a rule. It shows what the API computed, or asks `/validate-move`.
* The Datathon notebook imports the same package.

### Names

* Dataset IDs stay as they are and are the primary key: `ORD2001`, `OUT084`, `VEH039`.
* The field is always `id` on its own entity, and `orderId`, `outletId` or `vehicleId` when it points to another entity. Never `order_ref` or `orderNo`.
* **JSON is camelCase, Python is snake_case.** Pydantic schemas use a camelCase alias generator, so the OpenAPI schema and `schema.ts` match the frontend.
* The status values are the 11 in PRD §4b. `pending_sync` exists only on devices. Stores see "Under review", never "Conflict".

### API

* Every route is under `/api/v1`, returns one error shape `{code, message, details}` and checks role and scope.
* The frontend gets its types only from generated `frontend/src/api/schema.ts`. After a backend change, run:

```bash
npx openapi-typescript http://localhost:8000/api/openapi.json -o frontend/src/api/schema.ts
```

  and commit the result in the same PR.
* Each role's screens call only their typed interface (`StoreApi`, `DispatcherApi`, `LoaderApi`, `DriverApi`), which has a mock and a real implementation. Never call `fetch` or fixtures from a screen.

### Time

Business code never calls `datetime.now()` or `new Date()` for "now". Backend code uses `app.clock.now()`, and frontend code uses `useNow()`. The scenario clock starts on **Mon 28 Sep 2026, 15:30, Asia/Colombo**.

### State changes

* Every state change writes an `audit_events` row in the same transaction.
* Order transitions go through `waypoint_rules.transition`.
* Device writes are idempotent by `clientId`.

### Screens

* A Figma frame is a state of a route, not a route.
* Every screen has loading, empty, offline and error states.

### Database migrations

Several backend branches will add migrations at the same time. To avoid broken heads:

1. One migration per PR, created with `alembic revision --autogenerate -m "short name"`, then reviewed by hand.
2. Before merging, merge `develop` into your branch and run `alembic heads`.
3. If it prints two heads, set your migration's `down_revision` to the head that came from `develop`, then run `alembic upgrade head` on a fresh database to check it.

Never edit a migration that is already in `develop`.

---

# 🚦 20. Development Flow

Our normal workflow is:

```text
🧑‍💻 Pick Task
      ↓
🌿 Checkout Feature Branch
      ↓
⬇️ Pull Latest develop
      ↓
💻 Code
      ↓
🧪 Test
      ↓
💾 Commit
      ↓
🚀 Push
      ↓
🔀 Pull Request
      ↓
👀 Code Review
      ↓
✅ Merge into develop
      ↓
🧪 Integration Testing
      ↓
🚀 develop → main
```

---

# 🏁 21. When Do We Merge Into `main`?

Not every feature.

`main` should only receive code when the team agrees that the current version is stable.

For example:

```text
All major features complete
          ↓
Integration testing
          ↓
End-to-end testing
          ↓
Judge walkthrough tested
          ↓
Critical bugs fixed
          ↓
develop → main
```

---

# 🧪 22. Testing the Full Waypoint Workflow

The acceptance test is the **judge walkthrough in PRD §16** (steps 1 to 19, scenario clock from Mon 15:30). Before calling a build "ready", play it end to end on a clean `docker compose up`. `feature/release` automates it in Playwright (`e2e/`).

It covers the flow:

```text
🏪 Store Manager → 📦 Order → 🧠 Dispatcher plan → 🏭 Loader → 🚛 Driver → 📸 POD → 🏪 Confirm receipt
```

Also test:

```text
⚠️ Refused moves (window 08:06, reefer + two brands, continuity guard)
⚠️ Capacity vs policy deferrals (ORD1020, ORD1009)
⚠️ Reefer swap at the dock (VEH003 → VEH036, plan v4)
📡 Driver offline from 05:17, store-request deferral at 05:21
🔄 Sync at 06:40: 3 accepted + 1 conflict (2 orders), keep delivery
```

---

# 👨‍💻 23. Working With Another Developer

Sometimes two people need to work on the same feature.

Don't have both people randomly push to the same branch.

Instead:

```text
feature/driver
      │
      ├── feature/driver-route
      │
      └── feature/driver-pod
```

Each person works independently.

Then merge the smaller branches into the main feature branch.

---

# 📁 24. Repository Structure

This follows PRD v3 §9. The store and field frontend (52 commits) is already built this way.

```text
Nexora_Waypoint/
├── frontend/                  React + TypeScript (Vite), one app with four role areas
│   └── src/
│       ├── api/               schema.ts (generated), real API clients per role
│       ├── app/               router, RoleRoot, providers
│       ├── domain/            statuses, tags, statusLabel()
│       ├── shared/            ui/ and chrome/ shared by every role
│       ├── field/             loader + driver infrastructure: offline/ (outbox, sync), gps/
│       ├── screens/
│       │   ├── dispatcher/    screens, fixtures.ts, mock DispatcherApi
│       │   ├── store/
│       │   ├── loader/
│       │   └── driver/
│       └── styles/            tokens.css (light, dark, field), base.css
├── backend/
│   ├── app/                   FastAPI: main.py, routers/, services/, models/, schemas/, clock.py, auth.py
│   ├── alembic/               migrations
│   ├── waypoint_rules/        pure rules package (no framework imports)
│   ├── seed/                  load_reference.py, checks.py, fixtures/, scenario_events.yaml
│   └── tests/                 rules/, api/
├── analytics/                 Datathon notebook (imports waypoint_rules)
├── e2e/                       Playwright judge walkthrough
├── deploy/                    web Dockerfile, nginx.conf, Caddyfile
├── data/                      competition CSVs, local only, git-ignored
├── docs/                      architecture.md, data-model.md, api.md, ai-disclosure.md, build/
├── docker-compose.yml
├── .env.example
├── Contributing.md
└── README.md
```

We replaced the earlier `apps/web` and `services/api` / `allocation-engine` / `prediction` layout:

* A separate allocation-engine service would add a network hop and a second deployable. It would buy nothing, because the planner is a pure function the API calls in-process.
* Moving the existing frontend would cost a day we don't have.

Don't create other top-level folders. If you think you need one, ask first.

---

# 🔐 25. Protected Branches

Protect **both** `main` and `develop` now. With 9 people and 4 days, an unprotected `develop` will break.

| Rule | `main` | `develop` |
| --- | --- | --- |
| Pull Request required | ✅ | ✅ |
| Approvals | 1 | 1 |
| CI must pass | ✅ | ✅ |
| Branch up to date before merge | ✅ | ✅ |
| No direct pushes | ✅ | ✅ |
| No force pushes | ✅ | ✅ |
| No branch deletion | ✅ | ✅ |

---

# 🆘 26. If You Mess Something Up

Don't panic.

Git is usually recoverable. 😭

If you're unsure what to do:

### STOP.

Don't run random commands from Stack Overflow.

Especially avoid:

```bash
git reset --hard
git push --force
git clean -fd
```

unless you know exactly what they do.

Ask the team first.

---

# 📌 27. Quick Command Cheat Sheet

### Check branch

```bash
git branch
```

### Switch branch

```bash
git checkout feature/your-branch
```

### Get latest develop

```bash
git checkout develop
git pull origin develop
```

### Update your feature branch

```bash
git checkout feature/your-branch
git merge develop
```

### Check changes

```bash
git status
```

### Add changes

```bash
git add .
```

### Commit

```bash
git commit -m "feat: your message"
```

### Push

```bash
git push
```

### Create a new branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/new-feature
git push -u origin feature/new-feature
```

---

# 🚀 28. Our Golden Rules

## 🥇 Rule 1

**Never push directly to `main`.**

## 🥈 Rule 2

**Always work on a feature branch.**

## 🥉 Rule 3

**Pull from `develop` regularly.**

## 4️⃣ Rule 4

**Make small, focused commits.**

## 5️⃣ Rule 5

**Test before creating a PR.**

## 6️⃣ Rule 6

**Review other people's code.**

## 7️⃣ Rule 7

**Don't commit secrets or competition datasets.**

## 8️⃣ Rule 8

**Don't change shared architecture without telling the team.**

## 9️⃣ Rule 9

**If you don't understand a merge conflict, ask.**

## 🔟 Rule 10

**Keep `main` stable.**

## 1️⃣1️⃣ Rule 11

**Rules live only in `waypoint_rules`; types come only from `schema.ts`.**

## 1️⃣2️⃣ Rule 12

**No AI attribution lines in commits. Figma is read-only. CSVs never leave your machine.**

---

# 🤖 29. AI Tools, Figma and Data

* **AI coding tools** (Claude Code, Copilot, Cursor and the like) must read this file, especially sections 2, 18, 19, 24 and 29, and `waypoint-prd-v3.md` before changing code. This is the only rules file. `CLAUDE.md` is a one-line pointer to it so Claude Code loads it automatically; other tools need to be pointed at this file at the start of each session.
  * The PRD is the spec. When a Figma frame and the PRD disagree, follow the PRD and add a row to the departures register (PRD §18).
  * Stay inside the paths your branch owns (section 2). Touching a shared contract (section 18) needs a note in the PR description.
  * Stage files by path and never run `git add .` without reading `git status` (section 8). Never commit to `main` or `develop` directly and never force push.
  * Before saying it is done, run the checks in section 17, then state what you verified and what you guessed.
* **Figma is read-only** now that the Designathon is judged. The file is `0qCle1zCrSImSou4lVlvmL`. Never create, move, rename or edit anything in it, whether by hand or through a plugin or the Figma MCP. Reading frames to compare against is fine.
* **Competition CSVs** are never committed, never pasted into ChatGPT, Claude or any other AI tool, and never uploaded anywhere public. The seed reads them from `data/` at runtime. If an AI tool needs to know a column name, type the header yourself; don't let it open the file.
* **Screen copy** follows the design rules:
  * No em dashes (—).
  * Never the word "Mock" in the UI.
  * No bracketed placeholders like `[name]`.
  * No invented phone numbers.
  * Stores see "Under review", never "Conflict".
* **AI disclosure.** Add a line to `docs/ai-disclosure.md` when AI tools do a meaningful part of your PR.

---

# ❤️ Final Principle

We're 9 people working on one product.

That means Git is not just about pushing code.

It's about making sure:

```text
Your work
   +
Their work
   +
Everyone else's work
   ↓
One working Waypoint
```

Don't optimize for:

> "My feature is finished."

Optimize for:

> **"Our system works."** 🚚

---

# 🚚 Waypoint

**Order. Plan. Allocate. Load. Deliver. Confirm.**

Let's build something that works. 🔥
