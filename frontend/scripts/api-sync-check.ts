/**
 * Plays the offline hero path H4 to H16 against the REAL backend, over HTTP only: the acceptance test for `POST /sync`,
 * `POST /attachments` and the reconciliation they feed (PRD v3 sections 2, 15, 17 and 19).
 *
 *   1. Reset the demo, release the plan at 23:40, and read VEH039 trip 1 from it.
 *   2. The dock tablet confirms VEH039 loaded (04:50); the phone acknowledges and starts the route, last heard 05:17.
 *   3. 05:21: Dispatch defers the stop at the store's request (`/dispatcher/stops/defer`), creating the next plan version.
 *   4. 06:40: the phone, still on the old version, syncs an arrival at every stop and an outcome for every order. The deferred
 *      stop's outcomes come back `conflict`, all with one `conflictId` (one stop, one conflict); everything else is `accepted`.
 *      The same batch again is all `duplicate`. Its photo uploads, and uploads again as `duplicate`.
 *   5. The live board says when the phone was heard and what the sync did; D7 recommends Keep delivery; 06:44 Dispatch keeps it.
 *   6. A dock acknowledgement of the replaced version is a `conflict`.
 *
 * The stop deferred is OUT084 (ORD2001 + ORD2002) when the store has placed them. They are not seeded: the judge places them as
 * Anusha, and while `POST /store/orders` is not built the check uses the first stop of VEH039 trip 1 instead, and says so.
 *
 *   docker compose up -d --build db api
 *   npm run test:api-sync -- [--api http://localhost:8000] [--password waypoint-demo]
 *
 * It resets the demo at the start and at the end, so run it on a database you do not mind re-seeding. Exits non-zero if any check fails.
 */

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const api = `${flag("--api") ?? "http://localhost:8000"}/api/v1`;
const PASSWORD = flag("--password") ?? "waypoint-demo";
const DAY = "2026-09-29";
const ACCOUNTS = {
  dispatcher: "dispatcher@waypoint.demo",
  loader: "loader@waypoint.demo",
  driver: "driver@waypoint.demo",
  store: "store@waypoint.demo",
} as const;
type Role = keyof typeof ACCOUNTS;

type Json = Record<string, unknown>;
type SyncAnswer = { clientId: string; result: string; reason: string | null; conflictId: number | null; serverPayload: Json | null };
type Stop = { orderIds: string[]; outletId: string; seq: number };

const failures: string[] = [];
function check(condition: boolean, message: string, detail?: unknown): void {
  if (condition) console.log(`ok   ${message}`);
  else {
    console.error(`FAIL ${message}${detail === undefined ? "" : `: ${JSON.stringify(detail)}`}`);
    failures.push(message);
  }
}

const tokens = {} as Record<Role, string>;

async function call(role: Role | null, method: string, path: string, body?: unknown): Promise<{ status: number; json: Json }> {
  const headers: Record<string, string> = role ? { Authorization: `Bearer ${tokens[role]}` } : {};
  let payload: FormData | string | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${api}${path}`, { method, headers, body: payload });
  const text = await res.text();
  return { status: res.status, json: text ? (JSON.parse(text) as Json) : {} };
}

async function ok(role: Role, method: string, path: string, body?: unknown): Promise<Json> {
  const res = await call(role, method, path, body);
  if (res.status >= 300) throw new Error(`${method} ${path} answered ${res.status}: ${JSON.stringify(res.json)}`);
  return res.json;
}

const at = (hhmm: string, day = DAY) => `${day}T${hhmm}:00+05:30`;
const advance = (to: string) => ok("dispatcher", "POST", "/demo/advance", { to });

function record(type: string, payload: Json, hhmm: string, version: number | null, actor = "Nimal", blobIds: string[] = []): Json {
  return { clientId: crypto.randomUUID(), type, payload, deviceTime: at(hhmm), planVersionOnDevice: version, actor, blobIds };
}

async function sync(role: Role, deviceId: string, records: Json[]): Promise<SyncAnswer[]> {
  const out = await ok(role, "POST", "/sync", { deviceId, records });
  return out.results as SyncAnswer[];
}

async function upload(blobId: string): Promise<{ status: number; json: Json }> {
  const form = new FormData();
  form.append("clientId", blobId);
  form.append("kind", "photo");
  // The smallest JPEG markers around a little body: a stand-in for the compressed POD photo.
  form.append("file", new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9])], { type: "image/jpeg" }), "photo.jpg");
  return call("driver", "POST", "/attachments", form);
}

async function main() {
  const health = await fetch(`${api}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`FAIL the API is not answering at ${api}. Start it with: docker compose up -d --build db api`);
    process.exit(1);
  }
  for (const [role, email] of Object.entries(ACCOUNTS) as [Role, string][]) {
    const res = await fetch(`${api}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
    if (!res.ok) {
      console.error(`FAIL ${email} could not sign in (${res.status}). Pass --password if DEMO_PASSWORD is not ${PASSWORD}.`);
      process.exit(1);
    }
    tokens[role] = ((await res.json()) as { accessToken: string }).accessToken;
  }

  // ---- 1. the plan
  await ok("dispatcher", "POST", "/demo/reset");
  await advance(at("23:40", "2026-09-28"));
  await ok("dispatcher", "POST", "/dispatcher/plan/release?depot=kandy", { sendNotices: true });
  const plan = await ok("dispatcher", "GET", "/dispatcher/plan?depot=kandy");
  const version = (plan.version as { number: number }).number;
  const lanes = plan.lanes as { vehicleId: string; trips: { trip: number; stops: Stop[] }[] }[];
  const trip = lanes.find((l) => l.vehicleId === "VEH039")?.trips.find((t) => t.trip === 1);
  if (!trip || trip.stops.length === 0) throw new Error(`VEH039 has no trip 1 in plan v${version}`);
  const stops = [...trip.stops].sort((a, b) => a.seq - b.seq);
  const hero = stops.find((s) => s.orderIds.includes("ORD2001")) ?? stops[0];
  if (hero.orderIds.includes("ORD2001")) console.log(`info deferring OUT084 (${hero.orderIds.join(" + ")}), the hero stop`);
  else console.log(`info ORD2001 is not placed (POST /store/orders is not built): deferring ${hero.outletId} (${hero.orderIds.join(" + ")}) instead`);
  check(version >= 1, `plan v${version} released with VEH039 trip 1 (${stops.length} stops)`);

  // ---- 2. loaded, acknowledged, started; last heard 05:17
  await advance(at("04:50"));
  const loaded = await sync("loader", "tablet-kandy", [record("loader.confirmLoaded", { vehicleId: "VEH039", trip: 1, personId: "Ruwan", personName: "Ruwan" }, "04:50", null, "Ruwan")]);
  check(loaded[0]?.result === "accepted", "the dock tablet's gate confirmation is accepted", loaded[0]);
  await advance(at("05:17"));
  const started = await sync("driver", "phone-veh039", [
    record("driver.ack", { date: DAY, version }, "04:55", version),
    record("driver.startRoute", { date: DAY, at: "05:10" }, "05:10", version),
  ]);
  check(started.every((r) => r.result === "accepted"), "the phone's acknowledgement and start route are accepted", started);

  // ---- 3. 05:21 the store asks Dispatch to defer
  await advance(at("05:21"));
  const deferred = await ok("dispatcher", "POST", "/dispatcher/stops/defer", { orderIds: hero.orderIds, kind: "store_request", reason: "Receiving staff unavailable today" });
  check(deferred.plan === version + 1, `deferring the stop releases plan v${version + 1}`, deferred);

  // ---- 4. 06:40 back in coverage
  await advance(at("06:40"));
  const photo = crypto.randomUUID();
  const batch: Json[] = [];
  let minute = 26;
  for (const stop of stops) {
    const hhmm = (m: number) => `${String(5 + Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    batch.push(record("driver.arrival", { date: DAY, outletId: stop.outletId, at: hhmm(minute) }, hhmm(minute), version));
    for (const orderId of stop.orderIds) {
      const isHero = stop === hero;
      batch.push(
        record(
          "driver.outcome",
          { date: DAY, outletId: stop.outletId, orderId, outcome: "Delivered", unitsDelivered: 1, receiverName: "S. Fernando", ...(isHero ? { photoBlobId: photo } : {}), at: hhmm(minute + 16) },
          hhmm(minute + 16),
          version,
          "Nimal",
          isHero && orderId === stop.orderIds[0] ? [photo] : [],
        ),
      );
    }
    minute += 22;
  }
  const answers = await sync("driver", "phone-veh039", batch);
  const heroIds = new Set(hero.orderIds);
  const heroAnswers = answers.filter((_, i) => batch[i].type === "driver.outcome" && heroIds.has((batch[i].payload as Json).orderId as string));
  const rest = answers.filter((a) => !heroAnswers.includes(a));
  const conflictIds = new Set(heroAnswers.map((a) => a.conflictId));
  check(heroAnswers.length === hero.orderIds.length && heroAnswers.every((a) => a.result === "conflict"), `the deferred stop's ${heroAnswers.length} outcomes are conflicts`, heroAnswers);
  check(conflictIds.size === 1 && !conflictIds.has(null), `one stop, one conflict: "1 conflict (${hero.orderIds.length} orders)"`, [...conflictIds]);
  check(rest.every((a) => a.result === "accepted"), `the other ${rest.length} records are accepted`, rest);
  const conflictId = heroAnswers[0]?.conflictId ?? 0;
  const payload = heroAnswers[0]?.serverPayload ?? {};
  check(payload.serverVersion === version + 1 && payload.changedAt === "05:21", "the phone is told which plan changed the stop, and when", payload);

  const again = await sync("driver", "phone-veh039", batch);
  check(again.every((r) => r.result === "duplicate"), "the same batch again is all duplicate", again.map((r) => r.result));
  check(again.every((r, i) => r.conflictId === answers[i].conflictId), "a replay still names each record's conflict");

  const first = await upload(photo);
  const second = await upload(photo);
  check(first.status === 201 && first.json.duplicate === false, "the POD photo uploads after its record", first);
  check(second.status === 201 && second.json.duplicate === true, "uploading it again is a duplicate", second);

  // ---- 5. what Dispatch sees, and the decision
  if (stops.length > 1) {
    const board = await ok("dispatcher", "GET", "/dispatcher/live?depot=kandy");
    const row = (board.rows as Json[]).find((r) => r.vehicleId === "VEH039");
    const heard = (row?.lastHeard ?? {}) as Json;
    check(heard.time === "06:40", "the live board last heard VEH039 at 06:40", heard);
    check(heard.note === `${rest.length} synced · 1 conflict`, `the live board says what the sync did`, heard.note);
    check(row?.planOnDevice === version && row?.changePending === true, `the phone still holds v${version}, with the change pending`, row && { planOnDevice: row.planOnDevice, changePending: row.changePending });
  } else {
    // Deferring the trip's only stop leaves VEH039 no trip in the new version, so the board has no row for it.
    console.log("info the live board checks need a second stop on VEH039 trip 1 (the hero's OUT087); skipped");
  }

  const inbox = await ok("dispatcher", "GET", "/dispatcher/inbox");
  check((inbox.items as Json[]).some((i) => i.id === `c${conflictId}`), "the conflict needs a decision in the inbox");
  const view = await ok("dispatcher", "GET", `/dispatcher/conflicts/${conflictId}`);
  const rec = view.recommendation as Json;
  check(rec.choice === "keep_delivery", "D7 recommends Keep delivery", rec);
  check((view.dispatchRecord as Json).reached === "No: offline since 05:17", "D7 says the deferral never reached the driver", view.dispatchRecord);

  await advance(at("06:44"));
  const resolved = await ok("dispatcher", "POST", `/dispatcher/conflicts/${conflictId}/resolve`, { resolution: "keep_delivery" });
  check(resolved.state === "resolved" && resolved.outcome === "Delivered", "06:44 Dispatch keeps the delivery", { state: resolved.state, outcome: resolved.outcome });
  const after = await ok("dispatcher", "GET", "/dispatcher/inbox");
  check(!(after.items as Json[]).some((i) => i.id === `c${conflictId}`), "the inbox no longer lists it");

  // ---- 6. the dock's acknowledgement of the replaced version
  const ack = await sync("loader", "tablet-kandy", [record("loader.ack", { dockId: "kandy", version, personId: "Ruwan", personName: "Ruwan" }, "06:45", version, "Ruwan")]);
  check(ack[0]?.result === "conflict" && ack[0]?.reason === `Plan v${version + 1} replaced v${version}`, "a dock acknowledgement of the replaced plan is a conflict", ack[0]);

  // ---- who may sync
  const store = await call("store", "POST", "/sync", { deviceId: "x", records: [record("driver.arrival", { date: DAY, outletId: hero.outletId }, "06:46", version)] });
  check(store.status === 403, "a store account cannot sync", store.status);

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
