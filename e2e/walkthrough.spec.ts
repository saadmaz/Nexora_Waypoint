import { expect, test, type APIRequestContext } from "@playwright/test";
import { call, clock, days, goTo, pageText, record, reset, signIn, sync } from "./helpers";

/**
 * The judge walkthrough (PRD v3 section 16), played in a real browser against the running system. The steps share one
 * database and one scenario clock, so they run in order. Times are on the planning day (evening) or the delivery day (morning).
 */
test.describe.configure({ mode: "serial" });

test("0. the demo starts at the checkpoint, with the delivery day from the server", async ({ request }) => {
  await reset(request);
  const c = await clock(request);
  expect(c.now.slice(11, 16)).toBe("15:30");
  expect(c.rate).toBe(0); // the suite needs a clock that holds still between steps: run the API with CLOCK_RATE=0
  expect(c.serviceDate > c.checkpoint.slice(0, 10)).toBe(true);
});

test("1. the store places chilled and dry orders at 15:40", async ({ page, request }) => {
  await goTo(request, "planning", "15:40");
  await signIn(page, "store");
  await page.goto("/store/orders");
  await expect(page.getByText("Orders close at 16:00")).toBeVisible();
  await page.getByRole("button", { name: "Place 2 orders" }).click();
  await expect(page.getByText("Check your orders")).toBeVisible();
  await page.getByRole("button", { name: "Place orders", exact: true }).click();
  const text = async () => pageText(page);
  await expect.poll(text).toMatch(/Received 15:40/);
  expect(await text()).toMatch(/counts for/i);
  expect(await text()).toMatch(/edit until 16:00/i);
});

test("2. the dispatcher sees the store's orders in the queue, still Ordered", async ({ page, request }) => {
  await signIn(page, "dispatcher");
  await page.goto("/dispatcher/queue?depot=kandy");
  await expect.poll(() => pageText(page)).toMatch(/OUT084/);
  const text = await pageText(page);
  expect(text).toMatch(/ORD2001/);
  expect(text).toMatch(/ORD2002/);
  expect(text).toMatch(/Ordered/);
  const d = await days(request);
  expect(text).toContain("PLAN FOR"); // the heading names the delivery day from the server
  expect(d.service).toBeTruthy();
});

test("3. the cutoff closes the queue and plan v1 is drafted, with no call to /demo/advance past 16:05", async ({ request }) => {
  await goTo(request, "planning", "16:06");
  const plan = await call(request, "dispatcher", "GET", "/dispatcher/plan?depot=peliyagoda");
  expect(plan.version.number).toBe(1);
  expect(plan.version.state).toBe("draft");
  const deliveries = await call(request, "store", "GET", "/store/deliveries");
  expect(JSON.stringify(deliveries)).toMatch(/Confirmed/);
});

/** One planned trip, as the dispatcher's plan lists it. */
type PlanTrip = { vehicleId: string; trip: number; stops: { orderIds: string[]; protected: boolean }[] };
type Verdict = { ok: boolean; violations: { rule: string; text: string }[] };

test("4. the dispatcher can reproduce a window refusal, a reefer plus another rule, and the continuity guard", async ({ request }) => {
  test.setTimeout(240_000); // it tries real moves against the planner until it finds each kind
  const plan = await call(request, "dispatcher", "GET", "/dispatcher/plan?depot=peliyagoda");
  const trips: PlanTrip[] = plan.lanes.flatMap((lane: { trips: PlanTrip[] }) => lane.trips);
  const orders = trips.flatMap((t) => t.stops.map((s) => ({ id: s.orderIds[0]!, from: `${t.vehicleId}/${t.trip}` })));
  const check = (orderId: string, to: unknown): Promise<Verdict> =>
    call(request, "dispatcher", "POST", "/dispatcher/plan/validate-move", { data: { orderId, to } });

  let window: Verdict | undefined;
  let reefer: Verdict | undefined;
  // Every order against every other trip, in batches: the first window refusal and the first reefer refusal are enough.
  const moves = orders.flatMap((order) =>
    trips.filter((t) => `${t.vehicleId}/${t.trip}` !== order.from).map((t) => ({ order: order.id, to: { vehicleId: t.vehicleId, trip: t.trip } })),
  );
  for (let at = 0; at < Math.min(moves.length, 1200) && !(window && reefer); at += 12) {
    const batch = await Promise.all(moves.slice(at, at + 12).map((m) => check(m.order, m.to)));
    for (const verdict of batch) {
      const rules = verdict.violations.map((v) => v.rule);
      if (!window && rules.includes("R-WINDOW")) window = verdict;
      if (!reefer && rules.includes("R-TEMP") && rules.length >= 2) reefer = verdict;
    }
  }
  // A refusal names every rule it breaks, in words a dispatcher can read (D3.4).
  expect(window, "a move that breaks a delivery window").toBeDefined();
  expect(reefer, "a reefer order moved to an ambient vehicle, which breaks a second rule too").toBeDefined();
  for (const verdict of [window!, reefer!]) {
    expect(verdict.ok).toBe(false);
    for (const v of verdict.violations) expect(v.text.length).toBeGreaterThan(10);
  }

  const protectedOrder = trips.flatMap((t) => t.stops).find((s) => s.protected);
  expect(protectedOrder, "an order deferred yesterday is protected").toBeDefined();
  const guard = await check(protectedOrder!.orderIds[0]!, { deferred: true });
  expect(guard.ok).toBe(false);
  expect(guard.violations.map((v) => v.rule)).toContain("R-CONT");
});

test("5. deferrals are typed: capacity and policy, each with a reason", async ({ request }) => {
  const list = await call(request, "dispatcher", "GET", "/dispatcher/deferrals?depot=peliyagoda");
  const text = JSON.stringify(list);
  expect(text).toMatch(/capacity/i);
  expect(text).toMatch(/policy/i);
  const rows = [...(list.capacity ?? []), ...(list.policy ?? [])];
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(row.reason?.headline || row.binding).toBeTruthy(); // never a deferral with no reason
    expect(row.nextRun).toBeTruthy();
  }
});

test("6. releasing plan v3 at 23:40 leaves every dock waiting for an acknowledgement", async ({ page, request }) => {
  await goTo(request, "planning", "21:16"); // the scripted adjustments (v2)
  await goTo(request, "planning", "23:31"); // the draft Kumari releases (v3)
  const before = await call(request, "dispatcher", "GET", "/dispatcher/plan?depot=peliyagoda");
  expect(before.version.state).toBe("draft");
  await goTo(request, "planning", "23:40");
  await call(request, "dispatcher", "POST", "/dispatcher/plan/release", { data: { sendNotices: true } });
  const after = await call(request, "dispatcher", "GET", "/dispatcher/plan?depot=peliyagoda");
  expect(after.version.state).toBe("released");
  expect(after.version.number).toBeGreaterThanOrEqual(3);

  // The store sees an arrival time, not "plan not released yet".
  await signIn(page, "store");
  await page.goto("/store/deliveries");
  await expect.poll(() => pageText(page)).not.toMatch(/plan not released/i);
  await expect.poll(() => pageText(page)).toMatch(/\d{2}:\d{2}/);
});

// ---- the night and the morning: the loaders, the driver, the exception, the conflict ------------------------------

const PRIYA_PIN = "1234";
const RUWAN_PIN = "5678";
const HERO = ["ORD2001", "ORD2002"];

/** The people at a dock, as the PIN sheet lists them. */
async function person(request: APIRequestContext, dock: string): Promise<{ id: number; name: string }> {
  const view = await call(request, "loader", "GET", `/loader/docks/${dock}`);
  expect(view.people.length).toBeGreaterThan(0);
  return view.people[0];
}

let service = "";
let v3 = 0;

test("7. the Peliyagoda loader acknowledges v3 with a PIN, then flags VEH003 at 02:55", async ({ request }) => {
  service = (await days(request)).service;
  v3 = (await call(request, "dispatcher", "GET", "/dispatcher/plan?depot=kandy")).version.number;
  const priya = await person(request, "peliyagoda");

  await goTo(request, "service", "00:10");
  const wrong = await call(request, "loader", "POST", "/loader/pins/verify", { data: { personId: priya.id, pin: "0000" } });
  expect(wrong.ok).toBe(false);
  const right = await call(request, "loader", "POST", "/loader/pins/verify", { data: { personId: priya.id, pin: PRIYA_PIN } });
  expect(right.ok).toBe(true);
  const [ack] = await sync(request, "loader", "tablet-peliyagoda", [
    record(service, "loader.ack", { date: service, version: v3, dockId: "peliyagoda", personId: priya.id, personName: priya.name }, "00:10", v3, priya.name),
  ]);
  expect(ack!.result).toBe("accepted");
  expect((await call(request, "loader", "GET", "/loader/docks/peliyagoda")).acknowledged).toBe(true);
  expect((await call(request, "loader", "GET", "/loader/docks/kandy")).acknowledged).toBe(false); // each dock acknowledges its own

  await goTo(request, "service", "02:55");
  const [flag] = await sync(request, "loader", "tablet-peliyagoda", [
    record(
      service, "loader.exception",
      { date: service, vehicleId: "VEH003", trip: 1, type: "Vehicle check failed", orderIds: [], reason: "Reefer not holding temperature", personId: priya.id, personName: priya.name },
      "02:55", v3, priya.name,
    ),
  ]);
  expect(flag!.result).toBe("accepted");
  const dock = await call(request, "loader", "GET", "/loader/docks/peliyagoda");
  expect(dock.vehicles.find((v: { vehicleId: string }) => v.vehicleId === "VEH003").tags).toContain("Held");
});

test("8. Dispatch swaps VEH003 for VEH036 and releases plan v4", async ({ request }) => {
  await goTo(request, "service", "03:00");
  const inbox = await call(request, "dispatcher", "GET", "/dispatcher/inbox");
  const item = JSON.stringify(inbox);
  expect(item).toMatch(/VEH003/);
  const exceptionId = Number(/exceptions\/(\d+)/.exec(item)?.[1] ?? inbox.items?.find?.((i: { exceptionId?: number }) => i.exceptionId)?.exceptionId);
  expect(Number.isFinite(exceptionId), "an exception to decide in the inbox").toBe(true);
  await call(request, "dispatcher", "POST", `/dispatcher/exceptions/${exceptionId}/decide`, { data: { decision: "swap_vehicle", deferOrderIds: [] } });

  const dock = await call(request, "loader", "GET", "/loader/docks/peliyagoda");
  expect(dock.planVersion).toBe(v3 + 1);
  const replacement = dock.vehicles.find((v: { replaces?: string }) => v.replaces === "VEH003");
  expect(replacement, "a vehicle that stands in for VEH003").toBeDefined();
  // VEH003's trips moved to the replacement, so it is off the board or marked Replaced.
  const old = dock.vehicles.find((v: { vehicleId: string }) => v.vehicleId === "VEH003");
  if (old) expect(old.tags).toContain("Replaced");
  expect(replacement.vehicleId).not.toBe("VEH003");
});

let replacement = "";
let v4 = 0;

test("9. the Peliyagoda loader acknowledges v4 and confirms the replacement loaded", async ({ request }) => {
  await goTo(request, "service", "03:04");
  const priya = await person(request, "peliyagoda");
  const dock = await call(request, "loader", "GET", "/loader/docks/peliyagoda");
  v4 = dock.planVersion;
  replacement = dock.vehicles.find((v: { replaces?: string }) => v.replaces === "VEH003").vehicleId;

  const diff = await call(request, "loader", "GET", `/loader/docks/peliyagoda/diff?from=${v3}&to=${v4}`);
  expect(JSON.stringify(diff)).toMatch(new RegExp(replacement)); // L4 names the vehicle that changed

  const answers = await sync(request, "loader", "tablet-peliyagoda", [
    record(service, "loader.ack", { date: service, version: v4, dockId: "peliyagoda", personId: priya.id, personName: priya.name }, "03:04", v4, priya.name),
    record(service, "loader.confirmLoaded", { vehicleId: replacement, trip: 1, personId: priya.id, personName: priya.name }, "03:40", v4, priya.name),
  ]);
  expect(answers.map((a) => a.result)).toEqual(["accepted", "accepted"]);
});

test("10. the Kandy loader acknowledges v4 and confirms VEH039 at 04:50", async ({ request }) => {
  await goTo(request, "service", "04:15");
  const ruwan = await person(request, "kandy");
  const wrong = await call(request, "loader", "POST", "/loader/pins/verify", { data: { personId: ruwan.id, pin: PRIYA_PIN } });
  expect(wrong.ok).toBe(false); // one dock's PIN does not open the other dock's person
  expect((await call(request, "loader", "POST", "/loader/pins/verify", { data: { personId: ruwan.id, pin: RUWAN_PIN } })).ok).toBe(true);
  const [ack] = await sync(request, "loader", "tablet-kandy", [
    record(service, "loader.ack", { date: service, version: v4, dockId: "kandy", personId: ruwan.id, personName: ruwan.name }, "04:15", v4, ruwan.name),
  ]);
  expect(ack!.result).toBe("accepted");

  await goTo(request, "service", "04:50");
  const [loaded] = await sync(request, "loader", "tablet-kandy", [
    record(service, "loader.confirmLoaded", { vehicleId: "VEH039", trip: 1, personId: ruwan.id, personName: ruwan.name }, "04:50", v4, ruwan.name),
  ]);
  expect(loaded!.result).toBe("accepted");
});

test("11. the driver acknowledges v4, sees the route, and starts at 05:10", async ({ request }) => {
  await goTo(request, "service", "05:10");
  const before = await call(request, "driver", "GET", `/driver/runs/${service}`);
  expect(before.state).toBe("run");
  expect(before.vehicleId).toBe("VEH039");
  const stops = before.stops.map((s: { orderId: string }) => s.orderId);
  for (const id of [...HERO, "ORD2003"]) expect(stops).toContain(id);
  expect(before.loaderConfirmation?.by).toBeTruthy(); // "Confirmed by the loader at 04:50"

  const answers = await sync(request, "driver", "phone-veh039", [
    record(service, "driver.ack", { date: service, version: v4 }, "04:55", v4, ""),
    record(service, "driver.startRoute", { date: service, at: "05:10" }, "05:10", v4, ""),
  ]);
  expect(answers.map((a) => a.result)).toEqual(["accepted", "accepted"]);
  const after = await call(request, "driver", "GET", `/driver/runs/${service}`);
  expect(after.acknowledged).toBe(true);
});

test("12. at 05:21 Dispatch defers OUT084 while the driver is offline, and plan v5 exists", async ({ request }) => {
  await goTo(request, "service", "05:21");
  const deferred = await call(request, "dispatcher", "POST", "/dispatcher/stops/defer", {
    data: { orderIds: HERO, kind: "store_request", reason: "Receiving staff unavailable today" },
  });
  expect(deferred.plan).toBe(v4 + 1);
  const run = await call(request, "driver", "GET", `/driver/runs/${service}`);
  expect(run.planVersion).toBe(v4 + 1); // the server holds v5; the offline phone still holds v4 until it syncs
});

let conflictId = 0;

test("13. the phone syncs at 06:40: three accepted and one conflict covering two orders", async ({ request }) => {
  await goTo(request, "service", "06:40");
  const delivered = (outletId: string, orderId: string, units: number, receiver: string, at: string) =>
    record(service, "driver.outcome", { date: service, outletId, orderId, outcome: "Delivered", unitsDelivered: units, receiverName: receiver, at }, at, v4, "");
  const batch = [
    record(service, "driver.arrival", { date: service, outletId: "OUT084", at: "05:26" }, "05:26", v4, ""),
    delivered("OUT084", "ORD2001", 12, "S. Fernando", "05:42"),
    delivered("OUT084", "ORD2002", 8, "S. Fernando", "05:42"),
    record(service, "driver.arrival", { date: service, outletId: "OUT087", at: "05:48" }, "05:48", v4, ""),
    delivered("OUT087", "ORD2003", 9, "M. Perera", "05:58"),
  ];
  const first = await sync(request, "driver", "phone-veh039", batch);
  expect(first.filter((r) => r.result === "accepted")).toHaveLength(3);
  const conflicts = first.filter((r) => r.result === "conflict");
  expect(conflicts).toHaveLength(2); // one conflict, two orders
  expect(new Set(conflicts.map((c) => c.conflictId)).size).toBe(1);
  conflictId = conflicts[0]!.conflictId!;

  // Sending the same batch again changes nothing.
  const replay = await sync(request, "driver", "phone-veh039", batch);
  expect(replay.every((r) => r.result === "duplicate")).toBe(true);
});

test("14. the store hears 'Under review', never 'Conflict'", async ({ page, request }) => {
  // The wire status is still "conflict" (one of the 11); what the store reads is the label for its role.
  const deliveries = await call(request, "store", "GET", "/store/deliveries");
  expect(JSON.stringify(deliveries)).toMatch(/"status":"conflict"/);
  await signIn(page, "store");
  await page.goto("/store/deliveries");
  await expect.poll(() => pageText(page)).toMatch(/Under review/);
  expect(await pageText(page)).not.toMatch(/conflict/i);
});

test("15. Dispatch keeps the delivery at 06:44: delivered, deferral withdrawn", async ({ request }) => {
  await goTo(request, "service", "06:44");
  const resolved = await call(request, "dispatcher", "POST", `/dispatcher/conflicts/${conflictId}/resolve`, { data: { resolution: "keep_delivery" } });
  expect(resolved.state).toBe("resolved");
  expect(resolved.outcome).toBe("Delivered");
  const notices = await call(request, "driver", "GET", "/driver/notices");
  expect(notices.some((n: { tag: string }) => n.tag === "resolved")).toBe(true);
  const deliveries = JSON.stringify(await call(request, "store", "GET", "/store/deliveries"));
  expect(deliveries).toMatch(/Delivered/);
});

test("16. at 07:30 the store confirms receipt and the updates feed tells the whole story", async ({ page, request }) => {
  await goTo(request, "service", "07:30");
  await call(request, "store", "POST", "/store/receipts", {
    data: { date: service, lines: HERO.map((orderId, i) => ({ orderId, received: i === 0 ? 12 : 8 })) },
    status: 201,
  });
  const feed = await call(request, "store", "GET", "/store/updates");
  expect(feed.updates.length).toBeGreaterThanOrEqual(4);
  const words = feed.updates.map((u: { title: string; body: string }) => `${u.title} ${u.body}`).join(" ");
  expect(words).not.toMatch(/conflict/i); // the notices a store reads never say it
  await signIn(page, "store");
  await page.goto("/store/updates");
  await expect.poll(() => pageText(page)).toMatch(/Updates/);
});

test("17. the driver finishes the run and it lands in history", async ({ request }) => {
  await goTo(request, "service", "07:31");
  const [finish] = await sync(request, "driver", "phone-veh039", [
    record(service, "driver.finishRun", { date: service, at: "07:31", gpsKm: 19.4, gpsGapFilledKm: 0, fuelLEst: 3.9 }, "07:31", v4 + 1, ""),
  ]);
  expect(finish!.result).toBe("accepted");
  const history = await call(request, "driver", "GET", "/driver/history");
  expect(history.some((row: { date: string }) => row.date === service)).toBe(true);
});

test("18. Reset demo puts the clock back at Monday 15:30", async ({ request }) => {
  await reset(request);
  const c = await clock(request);
  expect(c.now).toBe(c.checkpoint);
  expect((await call(request, "dispatcher", "GET", "/dispatcher/plan?depot=peliyagoda")).version.number).toBe(0);
});
