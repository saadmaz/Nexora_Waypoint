# Testing the live stack

What to click to see the system do real work, on branch `fix/live-build-and-seed`.

The app now runs on the database, not on fixtures. Every number you see is computed by the backend.

## Start it

```bash
docker compose down -v        # only if you want a clean database
docker compose up --build -d
```

Then open `http://localhost:8080`. The API is on `http://localhost:8000` (Swagger at `/api/docs`).

Sign in with any of these; the password for all of them is `waypoint-demo`:

| Role | Email | Who |
|---|---|---|
| Dispatcher | `dispatcher@waypoint.demo` | Kumari, planning office |
| Store manager | `store@waypoint.demo` | Anusha, OUT084 (Kandy) |
| Loader | `loader@waypoint.demo` | Peliyagoda dock tablet |
| Driver | `driver@waypoint.demo` | Nimal, VEH039 |

On a fresh database the seed loads **60 vehicles, 84 outlets and 274 orders** for Tue 29 Sep. Without
the competition CSVs in `data/` these are the generated stand-ins (PRD section 4c plus
`seed/generated.py`); with the CSVs present the real reference data is used instead.

## Pause the clock first

**Do this before anything else.** `CLOCK_RATE` is 1, so scenario time runs at real time and the demo
walks off the end of the day while you are using it.

The run the field apps work on (`runDate` in `GET /clock`) is today's until **12:00**, and the next
operating day's after that (`planning_repo.active_service_date`). So once scenario time passes Tue
noon, the loader and the driver ask for **Wednesday's** work. Wednesday has no released plan, so the
dock shows no vehicles and the driver shows no run, while the clock in the corner keeps ticking. The
plan you released is still there, for Tuesday; nothing is lost, the apps are simply looking at the
next day.

The clock only moves forward (`clock_backwards`), so there is no way to step back into the run window.
Reset demo is the only way back, and it clears the plan, so you have to draft and release again.

Keep it still while you work:

```bash
TOKEN=$(curl -s -X POST localhost:8000/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"dispatcher@waypoint.demo","password":"waypoint-demo","role":"dispatcher"}' \
  | python -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
curl -s -X POST localhost:8000/api/v1/demo/pause -H "Authorization: Bearer $TOKEN"
```

Then move time only when you mean to, with the presenter control's "Go to next step". `/demo/resume`
starts it ticking again. Alternatively set `CLOCK_RATE=0` in the environment before
`docker compose up` and it never ticks on its own.

## The order matters

The scenario starts **Mon 28 Sep, 15:30**, before the 16:00 cutoff. Nothing is planned yet, so the
loader and driver have nothing to do until the dispatcher has drafted *and released* a plan. If you
open the loader first you will correctly see an empty dock. That is not a bug.

```
store places an order  ->  cutoff 16:00  ->  dispatcher drafts  ->  dispatcher releases
                                                                         |
                                                     loader loads  ->  driver delivers  ->  store confirms
```

## Walkthrough

**1. Store manager, before 16:00.** Place an order. It is accepted for Tue 29 Sep and appears as
Ordered. The weight and volume are computed by the server from the outlet's own unit factors, not by
the screen.

**2. Dispatcher: close the cutoff.** The queue is read-only until 16:00. Use the presenter control
("Go to next step") to move the clock past the cutoff. The queue then shows **212 Peliyagoda and 62
Kandy orders** confirmed.

**3. Dispatcher: draft the plan.** With the queue closed and no plan yet, a **Draft plan** button sits
next to "Go to capacity board". Press it. The planner runs for real and you land on the trip board:
about **23 vehicle lanes, 29 trips and 134 stops**, with **17 orders deferred**.

This is the part that previously did nothing. It is now the allocation engine, respecting weight,
volume, reefer-only, van-only, delivery and mall windows, the weekly fuel quota, and two trips per
vehicle per day.

**4. Dispatcher: read the deferrals.** D4 says "17 orders wait for Wed 30 Sep", split into capacity
and policy deferrals. Open one: `ORD1020` reads "Van-only access: van_only and 1,250 kg". Those
sentences come from the constraint that refused the order, so they change if the data changes.

Try a move the rules forbid (drag an order onto a vehicle that cannot take it). The refusal comes from
`/validate-move` on the server.

**5. Dispatcher: release.** D5 locks the version and notifies the stores. The board goes read-only.

**6. Loader.** The Peliyagoda dock now shows plan v1 and about **29 vehicles** to load, in stop
sequence. Acknowledge the plan, scan a load, and flag a shortfall to see it reach the dispatcher.

**7. Driver.** Nimal's run for Tue 29 Sep is **VEH039 with 12 stops**. Work a stop, add a photo, and
try it with the network off: records queue in the outbox and reconcile through `/sync` when you
reconnect.

**8. Store manager.** Confirm receipt and report an issue on what arrived.

## Resetting

The dispatcher's avatar menu has **Reset demo**. It truncates the operational tables and reseeds, so
the clock returns to Mon 15:30 with the full 274-order day and no plan. Use it between runs.

After a reset there is no plan, so the loader dock and the driver run are empty until you draft and
release again. That is correct, not a regression.

## If the loader or driver shows nothing

Check these in order.

1. **What run date are the field apps on?** `GET /clock` returns both `serviceDate` and `runDate`.
   `runDate` is the one the loader and driver use. If it is a day later than the plan you released,
   the clock has passed 12:00 and rolled over. Reset, pause, and walk the sequence again.
2. **Is a plan actually released?** A draft is not enough.
   ```bash
   docker compose exec db psql -U waypoint -d waypoint \
     -c "SELECT service_date, number, state, released_at FROM plan_versions ORDER BY service_date, number;"
   ```
   Every row saying `draft` with an empty `released_at` means D5 was never completed. The 16:05 job
   drafts automatically but never releases: releasing is the dispatcher's own action.
3. **Does the released plan's `service_date` match `runDate`?** They have to be the same day.

`serviceDate` and `runDate` are deliberately different. `serviceDate` is the day a new order placed
now would be delivered, which after 16:00 is the day after next; `runDate` is the run being delivered.
At Mon 16:30 they are Wed and Tue respectively, and both are right.

## Checking it is really live

```bash
cd frontend && npm run check:bundle
```

It should report that none of the forbidden literals are in `dist/`: no fixtures, no mock persona
names. If the app ever looks scripted again, this is the first thing to check, along with
`VITE_DATA_SOURCE` being `live` in the `web` build.
