/**
 * Plays the store's part of the hero day against the REAL backend, through the app's own `StoreApi`: the acceptance test
 * for `VITE_STORE_API=api` (PRD v3 §3 S1 to S4, §4b, §16, §19).
 *
 * Every store call goes through `createApiStoreApi`, imported from the dev server and run in the page, so the mappers
 * (`storeMappers.ts`) and the wire vocabulary (`vocab.ts`) are part of the test: a reply shaped differently from the
 * contract fails here as an `unexpected_reply` instead of being quietly accepted. The assertions are on the values the
 * PRD fixes, not on HTTP 200.
 *
 * The other roles only set the stage, so they go over raw HTTP: the dispatcher moves the scenario clock, releases the
 * plan, defers the stop and settles the review; the dock tablet and the phone sync through `/sync`.
 *
 *   1. Mon 15:40, the order form opens on Tue 29 Sep, before the cutoff, with both unit factors (S1.1).
 *   2. Anusha places chilled 12 and dry 8: ORD2001 and ORD2002, naive local `receivedAt` (S1.3, H1).
 *   3. 15:59 an edit is taken and 16:01 the same edit is the typed `CutoffError` (S1.5).
 *   4. The feed has its "Order received" row and the bell counts it (S4).
 *   5. The night and the run, read from S2 as the store sees it: 23:41 the arrival range, 04:51 loaded,
 *      05:11 on the way, 05:22 deferred at your request with Got it, 06:41 Under review, 06:45 delivered
 *      with the deferral withdrawn.
 *   6. The store answers "Did you receive this delivery?" while Dispatch is reviewing (S2.7, A47).
 *   7. 07:28 receipt confirmed, then a short count: Partial, with the reason kept (S3.1, S3.1 B).
 *   8. A problem reported on the proof reaches S3.7, and the order carries Short (S3.3, A49).
 *   9. The history lists the day it finished, with no Sunday in it (S2.10, S4.2).
 *  10. Mark all read empties the bell (A53).
 *
 *   CORS_ORIGINS='["http://localhost:8080","http://localhost:5173"]' docker compose up -d --build db api
 *   VITE_AUTH_API=api VITE_STORE_API=api npm run dev -- --port 5173 --strictPort
 *   npm run test:api-store -- [--base http://localhost:5173] [--api http://localhost:8000] [--password waypoint-demo]
 *
 * Which vehicle carries the stop is the planner's, so nothing here names one. With no `data/*.csv` the seed generates
 * the rest of the day (`SEED_GENERATED_ORDERS`, A41) and the planner puts OUT084 on a vehicle the demo phone is not
 * bound to; the five departed checks then say so and skip, and the run still proves everything else. On the small
 * world the backend tests use (`SEED_GENERATED_ORDERS=false`) the stop is the hero one and every check runs.
 *
 * It resets the demo at the start and at the end, so run it on a database you do not mind re-seeding. Exits non-zero
 * if any check fails.
 */
import { chromium, type Page } from "@playwright/test";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const base = flag("--base") ?? "http://localhost:5173";
const api = `${flag("--api") ?? "http://localhost:8000"}/api/v1`;
const PASSWORD = flag("--password") ?? "waypoint-demo";

const STORE_MODULE = "/src/api/apiStoreApi.ts";
const OUTLET = "OUT084";
const DAY = "2026-09-29";
const MONDAY = "2026-09-28";
const HERO = ["ORD2001", "ORD2002"];
/** "05:42": what the store's screens print as a clock time. */
const HHMM = /^\d{2}:\d{2}$/;
/** The store's own timestamps are naive local ISO, with no offset (§19). */
const NAIVE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
/** The five tags S4 may use (PRD §4b, Store feed). */
const FEED_TAGS = ["Order", "Plan", "Delivery", "Deferral", "Review"];

const ACCOUNTS = { store: "store@waypoint.demo", dispatcher: "dispatcher@waypoint.demo", loader: "loader@waypoint.demo", driver: "driver@waypoint.demo" } as const;
type Role = keyof typeof ACCOUNTS;

const failures: string[] = [];
function check(condition: boolean, message: string, detail?: unknown): void {
  if (condition) console.log(`ok   ${message}`);
  else {
    console.error(`FAIL ${message}${detail === undefined ? "" : `: ${JSON.stringify(detail)}`}`);
    failures.push(message);
  }
}

const tokens = {} as Record<Role, string>;
/** The account behind each token, as sign-in describes it. The driver's own `vehicleId` is read from here. */
const accounts = {} as Record<Role, { displayName: string; vehicleId: string | null; outletId: string | null }>;

// --------------------------------------------------------------------------- the other roles, over raw HTTP

async function call(role: Role, method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }), Authorization: `Bearer ${tokens[role]}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function ok(role: Role, method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await call(role, method, path, body);
  if (res.status >= 300) throw new Error(`${method} ${path} answered ${res.status}: ${JSON.stringify(res.json)}`);
  return res.json;
}

const at = (hhmm: string, day = DAY) => `${day}T${hhmm}:00+05:30`;
const advance = (to: string) => ok("dispatcher", "POST", "/demo/advance", { to });

type SyncRecord = { clientId: string; type: string; payload: Record<string, unknown>; deviceTime: string; planVersionOnDevice: number | null; actor: string };
const record = (type: string, payload: Record<string, unknown>, hhmm: string, version: number | null, actor = "Nimal"): SyncRecord => ({
  clientId: crypto.randomUUID(),
  type,
  payload,
  deviceTime: at(hhmm),
  planVersionOnDevice: version,
  actor,
});

async function sync(role: Role, deviceId: string, records: SyncRecord[]): Promise<string[]> {
  const out = (await ok(role, "POST", "/sync", { deviceId, records })) as { results: { result: string }[] };
  return out.results.map((r) => r.result);
}

// --------------------------------------------------------------------------- the store, through its own client

type Answer = { ok: true; value: unknown } | { ok: false; name: string; code: string | null; status: number | null; message: string };

/**
 * Runs one `StoreApi` method in the page, on the real client. The reply comes back as plain JSON, and a failure as the
 * error's own name and code, so a `CutoffError` can be told from an `ApiError` without serialising the class.
 */
async function store(page: Page, method: string, ...parameters: unknown[]): Promise<Answer> {
  return page.evaluate(
    async ([modulePath, name, params]) => {
      const { createApiStoreApi } = (await import(/* @vite-ignore */ modulePath)) as {
        createApiStoreApi: () => Record<string, (...rest: unknown[]) => Promise<unknown>>;
      };
      try {
        const value = await createApiStoreApi()[name](...params);
        return { ok: true as const, value: value === undefined ? null : value };
      } catch (error) {
        const failure = error as { name?: string; code?: string; status?: number; message?: string };
        return {
          ok: false as const,
          name: failure.name ?? "Error",
          code: failure.code ?? null,
          status: failure.status ?? null,
          message: failure.message ?? String(error),
        };
      }
    },
    [STORE_MODULE, method, parameters] as [string, string, unknown[]],
  );
}

/** The same call, when the check only makes sense if it succeeded. */
async function value<T>(page: Page, method: string, ...parameters: unknown[]): Promise<T> {
  const answer = await store(page, method, ...parameters);
  if (!answer.ok) throw new Error(`${method} failed: ${answer.name} ${answer.code ?? ""} ${answer.message}`);
  return answer.value as T;
}

// The store's own types, as the mappers hand them over. Only the fields these checks read.
type Order = { id: string; line: { kind: string; units: number }; status: string; receivedAt: string; updatedAt?: string; afterCutoff: boolean };
type Draft = { deliveryDate: string; afterCutoff: boolean; dock: string; window: { start: string; end: string }; unitFactors: Record<string, { kg: number; m3: number }>; defaultUnits: Record<string, number>; orders: Order[] };
type Step = { step: string; actor: string; at?: string; state: string };
type Delivery = {
  date: string;
  outletId: string;
  status: string;
  dock: string;
  window: { start: string; end: string };
  vehicle?: string;
  orders: { id: string; kind: string; units: number; status: string; issue?: string; received?: number }[];
  journey: Step[];
  arrival?: { from: string; mayArriveAt?: string };
  planPending: boolean;
  loaded?: { place: string; at: string };
  onTheWay?: { arrivesAbout: string; unloadingFrom: string };
  lastUpdate?: string;
  receiversCue: boolean;
  deferral?: { type: string; headline: string; subline?: string; reason: string; decidedBy: string; decidedAt: string; nextRunLabel: string; nextRun: string; nextRunShort: string; acknowledged: boolean };
  review?: { askedAt: string; deliveredAt: string; receivedBy: string; asked: boolean };
  proof?: { receivedBy: string; at: string; driver: string; vehicle: string; units: number[] };
  tags: string[];
  withdrawnNote?: string;
  receiptConfirmedAt?: string;
  receiptBy?: string;
  shortfallReason?: string;
  issues: { id: string; type: string }[];
  receivedAnswered: boolean;
};
type Feed = { updates: { id: string; tag: string; date: string; time: string; title: string; body: string; unread: boolean; viewLabel?: string; target: { screen: string; date?: string }; resolvedAt?: string }[]; unread: number };
type Issue = { id: string; date: string; type: string; lines: { orderId: string; kind: string; units: number; orderUnits: number }[]; note?: string; photo: boolean; reportedAt: string; resolved: boolean };
type RecentDay = { date: string; orderCount: number; status: string; orderIds?: string[]; deliveredAt?: string; deferralWithdrawn?: boolean; shortUnits?: number; current?: boolean; receiptConfirmedAt?: string };

const theDay = async (page: Page): Promise<Delivery> => {
  const days = await value<Delivery[]>(page, "listDeliveries", OUTLET, DAY);
  if (days.length !== 1) throw new Error(`the store has ${days.length} delivery days for ${DAY}, expected 1`);
  return days[0];
};
const stepAt = (delivery: Delivery, name: string): Step | undefined => delivery.journey.find((s) => s.step === name);
const currentStep = (delivery: Delivery): string | undefined => delivery.journey.find((s) => s.state === "current")?.step;

async function main() {
  const health = await fetch(`${api}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`FAIL the API is not answering at ${api}. Start it with: docker compose up -d --build db api`);
    process.exit(1);
  }
  const app = await fetch(base).catch(() => null);
  if (!app?.ok) {
    console.error(`FAIL the app is not answering at ${base}. Start it with: VITE_AUTH_API=api VITE_STORE_API=api npm run dev -- --port 5173 --strictPort`);
    process.exit(1);
  }
  for (const [role, email] of Object.entries(ACCOUNTS) as [Role, string][]) {
    const res = await fetch(`${api}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
    if (!res.ok) {
      console.error(`FAIL ${email} could not sign in (${res.status}). Pass --password if DEMO_PASSWORD is not ${PASSWORD}.`);
      process.exit(1);
    }
    const reply = (await res.json()) as { accessToken: string; user: { displayName: string; vehicleId: string | null; outletId: string | null } };
    tokens[role] = reply.accessToken;
    accounts[role] = reply.user;
  }

  await ok("dispatcher", "POST", "/demo/reset");
  await advance(at("15:40", MONDAY));

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") console.log(`     page error: ${message.text()}`);
  });
  await page.goto(`${base}/sign-in`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(ACCOUNTS.store);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 15_000 });
  console.log(`info signed in as ${ACCOUNTS.store}, driving createApiStoreApi from ${STORE_MODULE}`);

  // ---- 1. the order form, Mon 15:40 ------------------------------------------------------------------------------------
  const draft = await value<Draft>(page, "getOrderDraft", OUTLET);
  check(draft.deliveryDate === DAY, `the form opens on Tue 29 Sep (${draft.deliveryDate})`);
  check(draft.afterCutoff === false, "15:40 is before the cutoff, so nothing rolls to Wednesday");
  check(draft.dock === "Rear dock", `the dock is the human label (${draft.dock})`);
  check(draft.window.start === "05:30" && draft.window.end === "08:00", "the window is 05:30 to 08:00", draft.window);
  check(draft.defaultUnits.chilled === 12 && draft.defaultUnits.dry === 8, "the form starts at chilled 12 and dry 8", draft.defaultUnits);
  const factors = draft.unitFactors;
  check(
    factors.chilled.kg > 0 && factors.chilled.m3 > 0 && factors.dry.kg > 0 && factors.dry.m3 > 0,
    "both unit factors are filled, so the estimates are the store's own",
    factors,
  );
  check(factors.chilled.kg !== factors.dry.kg, "chilled and dry weigh differently per unit (A14, A42)", factors);
  check(draft.orders.length === 0, "nothing is placed for the day yet");

  // ---- 2. placing the hero orders ---------------------------------------------------------------------------------------
  const placed = await value<Order[]>(page, "placeOrders", [
    { outletId: OUTLET, deliveryDate: DAY, line: { kind: "chilled", units: 12, estimatedKg: 70.0, estimatedM3: 0.7 } },
    { outletId: OUTLET, deliveryDate: DAY, line: { kind: "dry", units: 8, estimatedKg: 45.0, estimatedM3: 0.6 } },
  ]);
  check(placed.map((o) => o.id).join() === HERO.join(), `the two orders are ${HERO.join(" and ")}`, placed.map((o) => o.id));
  check(placed.map((o) => o.line.kind).join() === "chilled,dry", "chilled first, then dry", placed.map((o) => o.line.kind));
  check(
    placed.every((o) => o.status === "Ordered" && o.afterCutoff === false),
    "both are Ordered and neither is after the cutoff",
    placed.map((o) => o.status),
  );
  check(placed[0].receivedAt === `${MONDAY}T15:40:00`, `receivedAt is the naive local time the store placed it (${placed[0].receivedAt})`);
  check(NAIVE_ISO.test(placed[0].receivedAt), "the store's timestamps carry no offset (§19)", placed[0].receivedAt);
  check(placed.every((o) => o.updatedAt === undefined), "an order nobody has edited has no updatedAt");

  // ---- 3. the edit, and the cutoff ------------------------------------------------------------------------------------
  await advance(at("15:59", MONDAY));
  const edited = await value<Order>(page, "editOrder", HERO[0], { units: 14, estimatedKg: 81.7, estimatedM3: 0.82 });
  check(edited.line.units === 14, `15:59 the edit is taken (${edited.line.units} units)`);
  check(edited.updatedAt === `${MONDAY}T15:59:00`, `the edit stamps updatedAt (${edited.updatedAt})`);
  check(edited.receivedAt === `${MONDAY}T15:40:00`, "editing does not touch the time it was placed");
  // Back to 12, so the rest of the day is the hero one: 12 + 8.
  const restored = await value<Order>(page, "editOrder", HERO[0], { units: 12, estimatedKg: 70.0, estimatedM3: 0.7 });
  check(restored.line.units === 12, "the order goes back to 12 units for the hero day");

  await advance(at("16:01", MONDAY));
  const late = await store(page, "editOrder", HERO[0], { units: 14, estimatedKg: 81.7, estimatedM3: 0.82 });
  check(!late.ok && late.name === "CutoffError", "16:01 the same edit is the typed CutoffError", late);
  const lateCancel = await store(page, "cancelOrder", HERO[0]);
  check(!lateCancel.ok && lateCancel.name === "CutoffError", "a cancel after the cutoff is the same typed error", lateCancel);
  check((await theDay(page)).status === "Confirmed", "the cutoff leaves the day Confirmed");

  // ---- 4. the feed and the bell ---------------------------------------------------------------------------------------
  const first = await value<Feed>(page, "getUpdates", OUTLET);
  const received = first.updates.find((u) => u.title === "Order received");
  check(received !== undefined, "the feed has the Order received row", first.updates.map((u) => u.title));
  check(received?.tag === "Order" && received?.date === MONDAY && received?.time === "15:40", "it is an Order row, stamped 15:40 on Monday", received);
  check(received?.target.screen === "orders", "View opens the order form", received?.target);
  check(received?.body.includes(HERO[0]) === true, "it names the order it is about", received?.body);
  check(first.unread === first.updates.length && first.unread > 0, `the bell counts every row as unread (${first.unread})`);

  // ---- 5. the night and the run -----------------------------------------------------------------------------------------
  await advance(at("23:40", MONDAY));
  await ok("dispatcher", "POST", "/dispatcher/plan/release?depot=kandy", { sendNotices: true });
  await advance(at("23:41", MONDAY));
  const planned = await theDay(page);

  // Which vehicle and trip carry the stop is the planner's to decide, and it differs between the competition data and
  // the fallback seed. The dock and the phone below drive whatever the released plan says, so this check is about the
  // store's view of it, not about a vehicle id.
  const plan = (await ok("dispatcher", "GET", "/dispatcher/plan?depot=kandy")) as {
    version: { number: number };
    lanes: { vehicleId: string; trips: { trip: number; stops: { orderIds: string[] }[] }[] }[];
  };
  const version = plan.version.number;
  const lane = plan.lanes.find((l) => l.trips.some((t) => t.stops.some((s) => s.orderIds.includes(HERO[0]))));
  const trip = lane?.trips.find((t) => t.stops.some((s) => s.orderIds.includes(HERO[0])));
  if (lane === undefined || trip === undefined) throw new Error(`plan v${version} has no stop for ${HERO[0]}`);
  console.log(`info the plan puts ${HERO.join(" + ")} on ${lane.vehicleId} trip ${trip.trip}`);

  check(planned.status === "Planned" && planned.planPending === false, "23:41 the plan is out and the day reads Planned", planned.status);
  check(planned.vehicle === lane.vehicleId, `the store is told the vehicle the plan gave it (${planned.vehicle})`);
  check(planned.receiversCue === true, "receivers are cued");
  // PRD §4a: the later of the predicted arrival and the window opening, and the earlier time named only when the truck
  // would have to wait. Both shapes are correct; which one the store gets depends on the day's prediction.
  const arrival = planned.arrival;
  const waits = arrival?.mayArriveAt !== undefined;
  check(
    arrival !== undefined &&
      HHMM.test(arrival.from) &&
      (waits
        ? arrival.from === planned.window.start && (arrival.mayArriveAt ?? "") < planned.window.start
        : arrival.from > planned.window.start),
    waits
      ? `the truck is early, so the range opens with the window and names the wait (${arrival?.from}, may arrive ${arrival?.mayArriveAt})`
      : `the truck is predicted after the window opens, so that time is the range (${arrival?.from})`,
    arrival,
  );
  check(currentStep(planned) === "Planned", "Planned is where the order is now", currentStep(planned));
  check(stepAt(planned, "Planned")?.at === "23:40", "the Planned step keeps the time the plan went out");
  check(
    planned.journey.map((s) => s.step).join() === "Ordered,Confirmed,Planned,Loaded,Departed,Delivered,Receipt confirmed",
    "all seven journey steps are listed, in order",
    planned.journey.map((s) => s.step),
  );
  check(
    planned.journey.map((s) => s.actor).join() === "You,Dispatch,Dispatch,Loader,Driver,Driver,You",
    "each step names who acts",
    planned.journey.map((s) => s.actor),
  );

  await advance(at("04:50"));
  const loadedSync = await sync("loader", "tablet-kandy", [
    record("loader.confirmLoaded", { vehicleId: lane.vehicleId, trip: trip.trip, personId: "Ruwan", personName: "Ruwan" }, "04:50", null, "Ruwan"),
  ]);
  check(loadedSync.join() === "accepted", "the dock confirms VEH039 loaded", loadedSync);
  await advance(at("04:51"));
  const loaded = await theDay(page);
  check(loaded.status === "Loaded", "04:51 the day reads Loaded");
  check(loaded.loaded?.place === "Kandy dock" && loaded.loaded?.at === "04:50", "the card names the dock and the time", loaded.loaded);
  check(loaded.onTheWay === undefined, "nothing is on the way yet");

  // A driver account is bound to one vehicle, and `driver.startRoute` applies to that vehicle, so only the phone whose
  // own vehicle carries the stop can put this day on the road. The competition data plans OUT084 onto it; the fallback
  // seed need not, and then S2.4 is unreachable with the demo accounts rather than wrong.
  const phone = accounts.driver.vehicleId;
  const phoneDrivesTheStop = phone !== null && phone === lane.vehicleId;
  const device = `phone-${(phone ?? "none").toLowerCase()}`;
  if (!phoneDrivesTheStop) {
    console.log(`info the stop is on ${lane.vehicleId} and the demo phone is ${phone ?? "bound to no vehicle"}: the departed checks (S2.4) need a phone on this stop's vehicle; skipped`);
  }

  await advance(at("05:11"));
  if (phoneDrivesTheStop) {
    const startedSync = await sync("driver", device, [
      record("driver.ack", { date: DAY, version }, "04:55", version),
      record("driver.startRoute", { date: DAY, at: "05:10" }, "05:10", version),
    ]);
    check(startedSync.join() === "accepted,accepted", "the phone acknowledges the plan and starts the route", startedSync);
    const departed = await theDay(page);
    check(departed.status === "Departed", "05:11 the day reads Departed");
    check(departed.loaded === undefined, "the truck has left, so the load line is gone");
    check(
      departed.onTheWay?.unloadingFrom === departed.window.start && HHMM.test(departed.onTheWay?.arrivesAbout ?? ""),
      "the card says when it arrives and when unloading starts",
      departed.onTheWay,
    );
    check(stepAt(departed, "Departed")?.at === "05:10", "the Departed step is stamped 05:10");
    check(departed.lastUpdate === undefined, "the phone has just been heard, so there is nothing to apologise for");

    // S2.5: silent for more than three minutes on a run (waypoint_rules.schedule.is_offline). The phone was heard when
    // it synced at 05:11, and that is the last thing the store knows.
    await advance(at("05:15"));
    const quiet = await theDay(page);
    check(quiet.lastUpdate === "05:11", `the store is left with the last update it has (${quiet.lastUpdate})`);
  }

  await advance(at("05:21"));
  await ok("dispatcher", "POST", "/dispatcher/stops/defer", { orderIds: HERO, kind: "store_request", reason: "Receiving staff unavailable today" });
  // 05:22: the store reads the notice a minute later, by which time the phone has been silent long enough to say so.
  await advance(at("05:22"));
  const deferred = await theDay(page);
  check(deferred.status === "Deferred", "05:22 the day reads Deferred");
  check(deferred.arrival === undefined && deferred.receiversCue === false, "nothing is arriving today, so the cue is off");
  // The last update is a line about a truck on its way (`store_views._last_update` speaks only while the day is
  // Departed). Nothing is coming today, so it goes quiet and the deferral card is the whole message.
  check(deferred.lastUpdate === undefined, "the day is no longer on the road, so the last update line is gone", deferred.lastUpdate);
  const notice = deferred.deferral;
  check(notice?.type === "store request", `the notice is a store request (${notice?.type})`);
  check(notice?.headline === "Deferred at your request", `its headline is the store's own words (${notice?.headline})`);
  check(notice?.reason === "Receiving staff unavailable today", "it carries the reason Dispatch gave", notice?.reason);
  check(notice?.decidedBy === "Kumari" && notice?.decidedAt === "05:21", "it says who decided and when", { by: notice?.decidedBy, at: notice?.decidedAt });
  check(notice?.nextRunLabel === "New ETA", `a store request moves the store's own ETA (${notice?.nextRunLabel})`);
  check(notice?.nextRun === "Wed 30 Sep · from 05:30" && notice?.nextRunShort === "Wed", "the next run is named in full and short", { full: notice?.nextRun, short: notice?.nextRunShort });
  check(notice?.acknowledged === false, "Got it has not been tapped yet");
  check(
    stepAt(deferred, "Loaded")?.at === "04:50" && (!phoneDrivesTheStop || stepAt(deferred, "Departed")?.at === "05:10"),
    "a deferral does not undo the morning: the truck was still loaded at 04:50",
    deferred.journey.filter((s) => s.at !== undefined),
  );

  const gotIt = await store(page, "acknowledgeDeferral", { outletId: OUTLET, date: DAY });
  check(gotIt.ok, "Got it is accepted", gotIt);
  check((await theDay(page)).deferral?.acknowledged === true, "the notice now reads as seen");
  const d4 = (await ok("dispatcher", "GET", "/dispatcher/deferrals?depot=kandy")) as { storeRequest: { orderId: string; storeTold: { state: string; at: string } }[] };
  const told = d4.storeRequest.filter((card) => HERO.includes(card.orderId)).map((card) => card.storeTold);
  check(told.length === HERO.length && told.every((t) => t.state === "seen"), "D4 shows the store has seen it, on both orders", told);

  await advance(at("06:41"));
  const batch = [
    record("driver.arrival", { date: DAY, outletId: OUTLET, at: "05:26" }, "05:26", version),
    ...HERO.map((orderId) =>
      record(
        "driver.outcome",
        { date: DAY, outletId: OUTLET, orderId, outcome: "Delivered", unitsDelivered: orderId === HERO[0] ? 12 : 8, receiverName: "S. Fernando", at: "05:42" },
        "05:42",
        version,
      ),
    ),
  ];
  const results = await sync("driver", device, batch);
  check(results.join() === "accepted,conflict,conflict", "the delivery the phone held disagrees with the deferral", results);
  const review = await theDay(page);
  // The wire keeps `conflict`; the store's own vocabulary prints "Under review" (PRD §4b), which `statusLabel` does.
  check(review.status === "Conflict", "06:41 the day is Conflict on the wire, which the store reads as Under review", review.status);
  check(review.orders.every((o) => o.status === "Conflict"), "both orders are under review", review.orders.map((o) => o.status));
  check(review.receivedAnswered === false, "the store has not answered yet");
  check(review.proof?.receivedBy === "S. Fernando" && review.proof?.at === "05:42", "the proof says the goods are at the store", review.proof);
  check(review.proof?.units.join() === "12,8" && review.proof?.driver === "Nimal" && review.proof?.vehicle === "VEH039", "the proof names the units, the driver and the vehicle", review.proof);
  // Under review nothing is settled, so Delivered waits on Dispatch; what did happen keeps its times.
  check(stepAt(review, "Loaded")?.at === "04:50", "a deferral does not undo the morning: the truck was still loaded at 04:50", review.journey);
  // Only when a departure was recorded at all: on the fallback seed the stop rides a vehicle the demo phone is
  // not bound to, so `driver.startRoute` never ran and there is no departure to keep (see S2.4 above).
  if (phoneDrivesTheStop) check(stepAt(review, "Departed")?.at === "05:10", "nor that it left at 05:10", stepAt(review, "Departed"));
  check(stepAt(review, "Delivered")?.state === "pending", "Delivered waits while Dispatch chooses which record to keep", stepAt(review, "Delivered"));
  // A51 and PRD §3 S2.7: the explanation shows from 06:41; only the question waits for "Review with store first".
  check(review.review !== undefined && review.review.asked === false, "the store is told why, but is not asked yet (A51)", review.review);
  check(review.review?.askedAt === "05:21", "the explanation quotes the store's own 05:21 call to hold the delivery", review.review?.askedAt);

  // ---- 6. the store answers the review question -------------------------------------------------------------------------
  const conflictId = ((await ok("dispatcher", "GET", "/dispatcher/inbox")) as { items: { id: string }[] }).items.map((i) => i.id).find((id) => id.startsWith("c"));
  check(conflictId !== undefined, "the review is in the dispatcher's inbox", conflictId);
  const cid = (conflictId ?? "c0").slice(1);
  await ok("dispatcher", "POST", `/dispatcher/conflicts/${cid}/ask-store`);
  const asked = await theDay(page);
  check(asked.review?.receivedBy === "S. Fernando" && asked.review?.deliveredAt === "05:42" && HHMM.test(asked.review?.askedAt ?? ""), "S2.7 asks the store about the record it has", asked.review);
  check(asked.review?.asked === true, "now Dispatch has asked, S3.5 draws the question (A51)", asked.review?.asked);

  const answered = await store(page, "answerReceivedQuestion", { outletId: OUTLET, date: DAY, answer: "received" });
  // The route is keyed by the review's conflictId, which the client reads out of the reply. Reaching the server at all
  // proves the day carried one.
  check(answered.ok, "the answer reaches the review the day names", answered);
  const settled = await theDay(page);
  check(settled.status === "Delivered", "A47: the store reads Delivered at once, without waiting for Dispatch", settled.status);
  check(settled.receivedAnswered === true && settled.review === undefined, "the question is answered and gone", { answered: settled.receivedAnswered, review: settled.review });
  const stillOpen = (await ok("dispatcher", "GET", `/dispatcher/conflicts/${cid}`)) as { state: string };
  check(stillOpen.state !== "resolved", "the review stays Dispatch's to close", stillOpen.state);

  await advance(at("06:45"));
  await ok("dispatcher", "POST", `/dispatcher/conflicts/${cid}/resolve`, { resolution: "keep_delivery" });
  const kept = await theDay(page);
  check(kept.status === "Delivered", "06:45 Dispatch keeps the delivery");
  check(kept.deferral === undefined && kept.tags.join() === "Deferral withdrawn", "the deferral is withdrawn and the day is tagged", { deferral: kept.deferral, tags: kept.tags });
  check(kept.withdrawnNote === "Wed 30 Sep re-run removed.", `the note says the re-run is off (${kept.withdrawnNote})`);
  const reviewRows = (await value<Feed>(page, "getUpdates", OUTLET)).updates.filter((u) => u.tag === "Review");
  check(reviewRows.length > 0 && reviewRows.every((r) => r.resolvedAt === "06:45"), "the Review row in the feed is marked resolved", reviewRows.map((r) => r.resolvedAt));

  // ---- 7. the receipt, and a short count --------------------------------------------------------------------------------
  await advance(at("07:28"));
  const receipt = await value<Delivery>(page, "confirmReceipt", { outletId: OUTLET, date: DAY, lines: HERO.map((orderId) => ({ orderId, received: orderId === HERO[0] ? 12 : 8 })) });
  check(receipt.status === "Delivered", "a full count leaves the day Delivered", receipt.status);
  check(receipt.receiptConfirmedAt === "07:28" && receipt.receiptBy === "Anusha", "the receipt is stamped with the time and who confirmed it", { at: receipt.receiptConfirmedAt, by: receipt.receiptBy });
  check(stepAt(receipt, "Receipt confirmed")?.state === "done" && stepAt(receipt, "Receipt confirmed")?.at === "07:28", "the journey closes on Receipt confirmed", stepAt(receipt, "Receipt confirmed"));
  check(currentStep(receipt) === undefined, "nothing is waiting on anyone now");

  const shortfall = await value<Delivery>(page, "confirmReceipt", {
    outletId: OUTLET,
    date: DAY,
    lines: [{ orderId: HERO[0], received: 10 }, { orderId: HERO[1], received: 8 }],
    reason: "Missing",
  });
  check(shortfall.status === "Partial", "a count below what was ordered makes the day Partial", shortfall.status);
  check(shortfall.shortfallReason === "Missing", "the reason the store gave is kept", shortfall.shortfallReason);
  const short = shortfall.orders.find((o) => o.id === HERO[0]);
  check(short?.status === "Partial" && short?.received === 10, "A50: the order says 10 of 12 units received", short);
  check(shortfall.orders.find((o) => o.id === HERO[1])?.status === "Delivered", "the order that was complete stays Delivered");

  const noReason = await store(page, "confirmReceipt", { outletId: OUTLET, date: DAY, lines: [{ orderId: HERO[0], received: 9 }, { orderId: HERO[1], received: 8 }] });
  check(!noReason.ok && noReason.code === "reason_required", "a shortfall with no reason is refused", noReason);

  // ---- 8. a problem reported on the proof -------------------------------------------------------------------------------
  const issue = await value<Issue>(page, "reportIssue", { outletId: OUTLET, date: DAY, type: "Missing", lines: [{ orderId: HERO[0], units: 2 }], note: "Two crates not on the truck", photo: true });
  check(issue.type === "Missing" && issue.date === DAY, "the report is a Missing on the hero day", { type: issue.type, date: issue.date });
  check(issue.lines.length === 1 && issue.lines[0].orderId === HERO[0] && issue.lines[0].units === 2 && issue.lines[0].orderUnits === 12, "it names the order, the units affected and the order size", issue.lines);
  check(issue.note === "Two crates not on the truck" && issue.photo === true && issue.resolved === false, "the note and the photo are kept, and it is open", { note: issue.note, photo: issue.photo, resolved: issue.resolved });
  check(issue.reportedAt === "07:28", `it is stamped on the clock (${issue.reportedAt})`);

  const issues = await value<Issue[]>(page, "listIssues", OUTLET);
  check(issues.some((i) => i.id === issue.id), "S3.7 lists the report", issues.map((i) => i.id));
  const flagged = await theDay(page);
  // The order was already Partial from the short count above, and a report leaves a Partial order where it is
  // (`receipts._flag_orders` moves only a Delivered or Departed one), so the day keeps the worse of the two.
  check(flagged.status === "Partial", "the short count already moved the day, and the report leaves it Partial", flagged.status);
  check(flagged.orders.find((o) => o.id === HERO[0])?.issue === "Short", "A49: Missing on part of an order reads Short", flagged.orders.find((o) => o.id === HERO[0]));
  check(flagged.issues.some((i) => i.id === issue.id), "S3.4 shows it on the delivery");

  // ---- 9. the history -------------------------------------------------------------------------------------------------
  const history = await value<RecentDay[]>(page, "listRecent", OUTLET, { limit: 10 });
  const today = history.find((row) => row.date === DAY);
  check(today !== undefined, `the day it finished is in the history`, history.map((r) => r.date));
  check(today?.orderCount === 2 && today?.orderIds?.join() === HERO.join(), "it counts both orders and names them", { count: today?.orderCount, ids: today?.orderIds });
  check(today?.deliveredAt === "05:42", `it keeps the time the truck delivered (${today?.deliveredAt})`);
  check(today?.deferralWithdrawn === true, "the withdrawn deferral is on the row");
  check(today?.current === true, "only the current day opens a delivery (S4.2)");
  const sundays = history.filter((row) => new Date(`${row.date}T00:00:00`).getDay() === 0);
  check(sundays.length === 0, "no Sunday is listed: Waypoint runs Monday to Saturday", sundays.map((r) => r.date));
  check(
    history.map((r) => r.date).join() === [...history.map((r) => r.date)].sort().reverse().join(),
    "the history is newest first",
    history.map((r) => r.date),
  );
  const oneRow = await value<RecentDay[]>(page, "listRecent", OUTLET, { limit: 1 });
  check(oneRow.length <= 1, "the limit is honoured", oneRow.length);
  const before = await value<RecentDay[]>(page, "listRecent", OUTLET, { before: DAY });
  check(before.every((row) => row.date < DAY), "before keeps only earlier days", before.map((r) => r.date));

  // ---- 10. the feed, and the bell emptied -------------------------------------------------------------------------------
  const feed = await value<Feed>(page, "getUpdates", OUTLET);
  check(feed.updates.every((u) => FEED_TAGS.includes(u.tag)), "every row carries one of the five tags", [...new Set(feed.updates.map((u) => u.tag))]);
  check(
    feed.updates.every((u) => (u.target.screen === "orders" && u.target.date === undefined) || (u.target.screen === "delivery" && u.target.date === DAY)),
    "every row opens the order form or the hero delivery day",
    feed.updates.map((u) => u.target),
  );
  check(feed.updates.every((u) => u.title !== "" && u.body !== "" && HHMM.test(u.time)), "every row has a title, a body and a clock time");
  check(
    feed.updates.every((u) => !`${u.title}${u.body}`.includes("—") && !`${u.title}${u.body}`.includes("Mock")),
    "no em dashes and never the word Mock (Contributing §29)",
    feed.updates.filter((u) => `${u.title}${u.body}`.includes("—") || `${u.title}${u.body}`.includes("Mock")).map((u) => u.title),
  );
  check(feed.updates.every((u) => !u.title.includes("Conflict")), "stores are never shown the word Conflict", feed.updates.map((u) => u.title));
  const stamps = feed.updates.map((u) => `${u.date} ${u.time}`);
  check(stamps.join() === [...stamps].sort().reverse().join(), "the feed is newest first", stamps);
  check(
    feed.updates.every((u) => u.body.includes("OUT009") === false && u.body.includes("ORD1002") === false),
    "the feed holds only this outlet's rows",
  );

  const read = await store(page, "markAllRead", OUTLET);
  check(read.ok, "Mark all read is accepted", read);
  const after = await value<Feed>(page, "getUpdates", OUTLET);
  check(after.unread === 0 && after.updates.every((u) => !u.unread), "the bell is empty and every row reads as read", after.unread);
  check(after.updates.length === feed.updates.length, "marking read removes nothing from the feed");

  await browser.close();
  await ok("dispatcher", "POST", "/demo/reset");

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed`);
    process.exit(1);
  }
  console.log("\nall checks passed");
}

main().catch((error: unknown) => {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
