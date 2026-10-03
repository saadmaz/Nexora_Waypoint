# Allocation engine audit and validation

## Sources and scope

The operating constraints come from the Challenge Booklet. `waypoint-prd-v3.md` contains the
approved v3.1 updates (there is no separate v3.1 filename); its sections 4a, 4b, 4c, 11 and 12
define behavior. `waypoint-central-context-v3.md` defines the architecture. Physical persistence
uses `docs/data-model.md` and the merged, unchanged `0001 → 0002` migration chain, one head
`0002`, with the configured `postgres:18.6`. No schema, migration, dependency or UI changes.

## Audit matrix

| Requirement | Before | Smallest change / evidence |
|---|---|---|
| Per-order budget/fuel, physical-stop clock | Correct | Preserved; six minute goldens and hero arrival/handling tests |
| Physical planned run legs | Missing | Added/exported `planned_run_legs`, explicit 19 km versus 22 km test |
| Trip legality and refusal text | Correct | Preserved structured all-violation checks and meaningful structural/schedule boundary |
| Vehicle-day legality | Partial | Added trip-number/duplicate, availability and return-time sequencing checks |
| Capability vs usability | Partial | Separate physical `capable_vehicles` and operation-specific `usable_vehicles`; held/workshop-only shortfall is policy |
| Whole-plan validation | Missing | `check_plan` validates exact input partition, trip/day legality and deferral metadata before writes |
| Operational priority | Partial | Keep continuity/window/age/ID ordering; remove temperature subgroup priority |
| Vehicle comparator | Incorrect | Replace batch served/protected counts with current-order residual-capacity comparator |
| Complete candidate scan | Incorrect | Remove fixed 12-miss cutoff; regression has 12 failures followed by a fitting order |
| Policy selection | Partial | Explicit binding-resource marginal calculations and lexicographic policy key; bounded exchanges and D8 sets |
| Continuity repair | Missing | Existing-trip insertion, single unprotected swap, relocation, full validation and persisted warning/reason |
| Move validation | Partial | Same complete validator, including source/day consequences; existing preview contract preserved |
| Persistence and API | Partial | Preserve ORM/repository mapping and transactions; validate before draft/release/change writes; real API tests and Compose HTTP smoke |
| Determinism | Partial | Explicit IDs, stable binding ties and shuffled orders/fleet/day maps; no randomness in rules |

## Algorithm and validation boundaries

For each depot, physically impossible whole orders are capacity-deferred. Group by brand and
district and use continuity, earliest close, days since served and ID inside each group. The
existing bounded heavy/light group-order strategies remain, with complete-plan quality assessed
outside the vehicle comparator. Each order tries every legal existing/new trip, with a maximum
of two trips per vehicle. Automatic insertions recompute affected later departures after return.
All candidates pass trip/day and complete partition validation. There is no fixed failure cutoff.

Rank legal candidates ascending by reefer-reservation penalty, maximum residual kg/m³ ratio,
sum of those ratios, raw kg capacity, raw m³ capacity and vehicle ID. Trip number breaks ties
between insertions on the same vehicle. Reefer reservation applies only to ambient work when
unplanned chilled work remains and an actually legal ambient insertion exists. Nine decimal
places are used for ranking only; legality uses the existing unrounded calculations and numerical
tolerance. No total served or protected-count objective appears in this local comparator.

After greedy placement, protected policy deferrals try existing insertion, then one unprotected
swap and relocation to another existing legal trip. Stable vehicle/trip/order traversal accepts
the first whole-plan-valid repair. A remaining protected deferral has an explicit reason, also
returned as a draft warning. Physics always wins. Unprotected policy exchanges then consider
strictly better store impact per actual binding unit, accepting only fully legal plans.

`order_vehicle_violations` handles capability; `check_trip` handles load/composition/windows;
`check_vehicle_day` handles availability/count/budget/fuel/sequencing; `check_plan` handles the
whole input partition and complete physical validation; `validate_policy_action` handles manual
continuity/store-request semantics. `validate_move` uses these same functions and retains its
source/target before/after and deferral previews. An unrepairable automatic continuity warning
does not make a physically legal plan invalid, whereas manually choosing a protected policy
deferral is refused.

## Explicit policy assumptions and bounds

The PRD requires impact per binding unit but supplies no numeric impact formula. The implemented
key uses **days overdue above the normal one-day cadence divided by actual resource freed**,
then deferred count, binding surplus, kg surplus, m³ surplus and sorted order IDs. Consequences
(Fresh morning sales, mall slot, waiting) remain human-readable facts, never a numerical UI score.
This keeps the four D8 stores served yesterday at equal impact, preserving the mandated ORD1002
least-surplus recommendation. The formula is an explicit interpretation for product review.

Resource reductions use actual load, budget minutes, planned litres or physical route duration.
Every exchange must pass all constraints, so releasing one resource never excuses another failure.
Normal policy refinement accepts at most one bounded set exchange per waiting order. D8 and the policy pass enumerate
whole-order sets exactly for up to 12 unprotected orders; larger trips use singles/pairs/triples
and deterministic prefixes. This is a bounded greedy recommendation, not a global optimizer.
Protected orders are excluded; a recommendation that cannot close the gap stays empty and the
existing swap validator refuses the illegal result.

## Golden calculations and scenario tests

- Trip budget minutes: **132, 109, 125, 101, 83, 73**, counted per order, no return leg.
- Canonical VEH039: OUT084 arrival **05:26**, handling **05:30**, OUT087 arrival **06:06**.
- Planned fuel: **22 km**, per order, includes return. Physical run legs: **8 + 3 + 8 = 19 km**.
- D3.3: ORD1009 to VEH003 trip 2 is refused at **08:06**, `R-WINDOW`.
- D3.4: ORD1002 to VEH011 returns **both `R-TEMP` and `R-BRAND`**.
- D3.5: policy-deferring ORD1001 returns **`R-CONT`**.
- D8 canonical replacement VEH036: gap **120 kg / 0.7 m³**, recommend **ORD1002**,
  free **210 kg / 1.4 m³**, surplus **90 kg / 0.7 m³**; protected ORD1001 is excluded.

The canonical golden fixture is deliberately separate from generic fallback allocation. D8 HTTP
tests persist the documented plan through the real write validator before review/decision. Normal
redraft/get/capacity/deferrals/validate/apply/release tests use the actual allocator. No production
planner branch examines a pinned order ID.

## Full fallback-day results and divergences

`test_allocation_foundation.py` uses the real deterministic fallback fleet/day and adds the two
documented hero orders as the judge would. It rolls back its transaction. Store placement remains
another team's existing 501 endpoint; no unrelated ordering API is implemented here.

| Anchor | Computed result |
|---|---|
| ORD1020 | Capacity, van access: 1,250 kg exceeds the largest eligible reefer van's 1,040 kg; whole orders cannot split |
| ORD1009 | Served, VEH003 trip 1 |
| ORD1017 | Served, VEH004 trip 1 |
| ORD1006 | Served, VEH013 trip 1 |
| ORD2001 | Served, VEH044 trip 1 |
| ORD2002 | Served, VEH060 trip 1 |
| Peliyagoda deferrals | **1** (capacity), versus the designed 19 |

These are **seed calibration differences**: the full fallback fleet can legally serve more work
under the required comparator. Hero orders do not share VEH039 in this generated allocation, so
the live seeded hero routing is a remaining departure requiring review/calibration. The canonical
reference fixture still proves the required timing, routing and D3/D8 values. No counts, fleet
availability or order weights were altered to manufacture a screenshot total or vehicle assignment.

**Existing versioning divergence:** releasing locks the reviewed draft in place; the scripted
23:30 final draft naturally produces v3. The PRD also describes a new snapshot on release.
Existing frontend/API tests mandate the in-place behavior, which this PR preserves. All version
numbers still arise from persisted sequencing and the scenario clock, never hard-coded numbering.

## Verification

Run `pytest`, `ruff check .`, `mypy waypoint_rules` and `alembic heads` from `backend/`.
API tests require a separate disposable PostgreSQL database via `TEST_DATABASE_URL` and wipe it.
The schema suite checks v3 metadata and PostgreSQL rejection of invalid plan/trip/order/FK rows.
The rules suite covers every planning rule, complete invariants, shuffled input, best fit, the
12-miss regression and each bounded continuity path. CI's fresh isolated Compose project runs
migrations/seed, checks DB/API/web health and executes `python backend/tests/allocation_smoke.py`
through the real nginx → FastAPI → repository → PostgreSQL path. It removes only its own disposable
volumes. No normal local user database or Docker volume is reset.
