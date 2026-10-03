# PostgreSQL 18.6 database foundation

The latest schema is [data-model.md](data-model.md). It supersedes PRD §10's older array-based
column lists. SQLAlchemy uses the existing model modules, non-native enums with named CHECKs,
and the existing SQLAlchemy 2 session/service architecture. Python stays at 3.12 and dependencies
are unchanged. `waypoint_rules` has no database logic.

Migration `0001` is unchanged. The single new migration is `0002_v3_data_model_alignment`:

```text
empty PostgreSQL 18.6 → 0001 → 0002 → deterministic seed → FastAPI → web/nginx
```

`0002` adds six tables, normalizes order links and notice audiences, adds actor/calendar FKs,
renames planned handling and depot fields, changes history clock time to SQL `time`, and replaces
raw traffic JSON with district/hour rows. It adds the trip-number CHECK, per-plan order uniqueness,
per-trip run uniqueness, driver-account uniqueness and district/depot integrity. A composite trip/plan
FK prevents assigning an order under a plan version different from its trip's version.

The migration supports the fresh-install path. Local PG16 data is disposable: follow the manual,
project-specific volume recreation steps in the README. No startup or seed script removes a volume.
Downgrading to `0001` deliberately discards operational rows, preserves reference/account rows,
and recreates the old empty raw traffic table; it is a development reset, not a data recovery tool.

## Reference seed

The fallback seed still works without competition CSVs. The normalized optional reference loaders
use the explicit `COLUMNS` mapping in `backend/seed/load_reference.py`. Traffic `speed_index` is
stored as `speed_factor = speed_index / 100`; road `disruption_index` is stored as
`delay_factor = 100 / disruption_index`. The road kind header is not documented in the booklet;
configure `COLUMNS['road_conditions.csv']['kind']` to the real header before loading that optional
file. Missing mappings/headers fail clearly. No kinds or confidential source rows are fabricated.
Tests use small synthetic schema examples, never competition datasets. Forecast storage is defined;
no forecasting or allocation behavior is introduced here.

## Validation commands

Run the backend suite only against a disposable PostgreSQL 18.6 database. Tests truncate and seed
operational data. Create separate empty `waypoint_seed` and `waypoint_test` databases first.
Keep both separate from the normal development database. Full-day seed validation uses
`waypoint_seed`; the existing regression suite initializes its small fallback world in `waypoint_test`.

```bash
cd backend
export DATABASE_URL=postgresql+psycopg://waypoint:waypoint@localhost:5432/waypoint_seed
export TEST_DATABASE_URL=postgresql+psycopg://waypoint:waypoint@localhost:5432/waypoint_test
alembic upgrade 0001
alembic upgrade 0002
alembic heads                 # exactly 0002 (head)
alembic check                 # no schema drift
DEMO_PASSWORD=waypoint SEED_ON_START=true python -m seed.run
pytest
ruff check .
mypy waypoint_rules
```

The CI backend job checks the exact database version, migration chain, seed and complete suite on
`postgres:18.6`. The Compose job starts a fresh isolated project with `docker compose up --build --wait`,
checks all three services, direct and proxied API health and the web page, then removes only that
job's disposable project volumes. The normal Compose startup keeps its named `pgdata` and `uploads`
volumes. The web healthcheck verifies nginx serves the app shell.

Schema tests compare the named table set, every diagram column/type/primary key and solid FK link,
important nullability and constraints, and the migrated database against SQLAlchemy metadata.
CHECK names are compared separately because Alembic autogenerate does not detect them;
the required trip, road-kind and forecast-brand rules are exercised with invalid values. PostgreSQL tests
reject duplicate plan numbers, invalid/duplicate trips, duplicate order assignments, mismatched
trip/plan pairs, missing normalized parent/order references, mismatched district/depot pairs and
missing calendar dates. Notice read state is per user; audit records retain actor display text
alongside relational account/PIN and order references.
