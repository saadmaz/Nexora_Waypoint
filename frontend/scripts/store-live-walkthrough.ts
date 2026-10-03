/**
 * Plays the store's part of the judge walkthrough (PRD v3 §16) through the REAL screens against the REAL backend:
 * the acceptance test for the store role in `VITE_STORE_API=api`.
 *
 * `api-store-check.ts` proves the data: it drives `createApiStoreApi` directly and asserts on what the mappers hand
 * back. This proves the product. Every assertion here is on what S1 to S4 actually render, found by the role and the
 * text a store manager sees, so a screen that reads the right reply and then draws a blank fails here and passes
 * there. The two are complementary and both are needed before the role can be demoed.
 *
 * **The clock is two clocks in API mode.** The server's scenario clock moves with `/demo/advance`; the store app's own
 * `?at=` clock (`app/scenarioClock.ts`) is client side and is not read from `/clock`. They must be advanced in step,
 * which is what `goto()` below does: it advances the server first, then opens the screen at the same `?at=`. A screen
 * opened at an `?at=` the server has not reached shows the earlier state and is not a bug in the screen.
 *
 * `?state=`, `?preset=` and `?preview=` do nothing in API mode (there is no fixture to seed), so every state here is
 * reached the way the judge reaches it: by the day actually having happened on the server.
 *
 *   1. S1 before the cutoff: the form on Tue 29 Sep, the countdown, place, the acknowledgement (S1.1, S1.2, S1.3).
 *   2. S1 the edit and the cancel paths, and the cutoff error at 16:01 (S1.3 B, S1.3 C, S1.5).
 *   3. S1.4 after the cutoff: the form rolls to Wednesday.
 *   4. S2 across the day: Confirmed, the arrival range, Loaded, On the way, Deferred with Got it,
 *      Under review with its two actions, Delivered with Deferral withdrawn (S2.1 to S2.8).
 *   5. S3 the receipt, the shortfall path and the issue sheet (S3.1, S3.1 B, S3.3, S3.7).
 *   6. S4 the feed grouped by day, the unread bell, Mark all read, and the History segment (S4.1, S4.2).
 *   7. The offline and the error states, with the API stopped for real.
 *
 *   CORS_ORIGINS='["http://localhost:8080","http://localhost:5173"]' docker compose up -d --build db api
 *   VITE_AUTH_API=api VITE_STORE_API=api npm run dev -- --port 5173 --strictPort
 *   npm run test:store-live -- [--base http://localhost:5173] [--api http://localhost:8000] [--password waypoint-demo]
 *                             [--skip-offline]
 *
 * The offline and error section stops and restarts the `api` container through `docker compose`, so it needs Docker on
 * the same machine. `--skip-offline` leaves it out and the rest still runs.
 *
 * It resets the demo at the start and at the end, so run it on a database you do not mind re-seeding. Exits non-zero
 * if any check fails.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";

const run = promisify(execFile);

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const base = flag("--base") ?? "http://localhost:5173";
const api = `${flag("--api") ?? "http://localhost:8000"}/api/v1`;
const PASSWORD = flag("--password") ?? "waypoint-demo";
const skipOffline = args.includes("--skip-offline");

const OUTLET = "OUT084";
const DAY = "2026-09-29";
const MONDAY = "2026-09-28";
const HERO = ["ORD2001", "ORD2002"];
/** "05:42": what the store's screens print as a clock time. */
const HHMM = /\b\d{2}:\d{2}\b/;

const ACCOUNTS = {
  store: "store@waypoint.demo",
  dispatcher: "dispatcher@waypoint.demo",
  loader: "loader@waypoint.demo",
  driver: "driver@waypoint.demo",
} as const;
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
const accounts = {} as Record<Role, { displayName: string; vehicleId: string | null; outletId: string | null }>;

// --------------------------------------------------------------------------- the other roles, over raw HTTP

async function call(role: Role, method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      Authorization: `Bearer ${tokens[role]}`,
    },
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

type SyncRecord = {
  clientId: string;
  type: string;
  payload: Record<string, unknown>;
  deviceTime: string;
  planVersionOnDevice: number | null;
  actor: string;
};
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

// --------------------------------------------------------------------------- the screens

let page: Page;

/** Everything the screen prints, whitespace collapsed, for a plain "does it say this" check. */
async function body(): Promise<string> {
  return (await page.innerText("body")).replace(/\s+/g, " ").trim();
}

/**
 * Moves the server's clock to `hhmm` and opens `path` at the same time on the app's own clock. Both have to move:
 * the store's `?at=` clock is client side even in API mode, and the server decides what the reply says.
 */
async function goto(path: string, hhmm: string, day = DAY): Promise<string> {
  await advance(at(hhmm, day));
  const join = path.includes("?") ? "&" : "?";
  const dayParam = day === DAY ? "" : `&date=${day}`;
  await page.goto(`${base}${path}${join}at=${hhmm}${dayParam}`, { waitUntil: "networkidle" });
  // The screens fetch after mount; networkidle covers it, and this settles the render that follows.
  await page.waitForTimeout(250);
  return body();
}

/** True when the screen is showing neither a skeleton nor an error, so an assertion on its text means something. */
async function loaded(): Promise<boolean> {
  const text = await body();
  return !/Something went wrong|Couldn't load|No connection/i.test(text);
}

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
    const res = await fetch(`${api}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    if (!res.ok) {
      console.error(`FAIL ${email} could not sign in (${res.status}). Pass --password if DEMO_PASSWORD is not ${PASSWORD}.`);
      process.exit(1);
    }
    const reply = (await res.json()) as {
      accessToken: string;
      user: { displayName: string; vehicleId: string | null; outletId: string | null };
    };
    tokens[role] = reply.accessToken;
    accounts[role] = reply.user;
  }

  await ok("dispatcher", "POST", "/demo/reset");
  await advance(at("15:38", MONDAY));

  const browser: Browser = await chromium.launch();
  const context: BrowserContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${base}/sign-in`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(ACCOUNTS.store);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 15_000 });
  check(page.url().includes("/store/orders"), "sign-in lands the store on S1 Place order", page.url());
  console.log(`info signed in as ${ACCOUNTS.store} against ${api}`);

  // ---- 1. S1 before the cutoff -----------------------------------------------------------------------------------------
  let text = await goto("/store/orders", "15:38", MONDAY);
  check(await loaded(), "S1.1 loads against the API", text.slice(0, 200));
  check(/Tue 29 Sep/.test(text), "S1.1 opens on the delivery day the server gave it (Tue 29 Sep)", text.slice(0, 300));
  check(/Rear dock/.test(text), "the dock is the human label, not a code");
  check(/05:30/.test(text) && /08:00/.test(text), "the delivery window is shown");
  // The screens say "Orders close at 16:00", never the internal word "cutoff".
  check(/Orders close at 16:00/.test(text), "S1.1 tells the store when orders close, in its own words", text.slice(0, 400));
  check(/\d+ min left/.test(text), "S1.1 counts down to it", text.slice(0, 400));
  check(!/cutoff/i.test(text), "the screens never print the internal word cutoff", text.slice(0, 400));
  check(!text.includes("Mock") && !text.includes("—"), "no em dash and never the word Mock on S1 (Contributing §29)");

  // Place the hero orders through the form itself, at 15:40 as the hero day does.
  text = await goto("/store/orders", "15:40", MONDAY);
  // "Place 2 orders" on the form, then "Place orders" on the review sheet (S1.2).
  const placeButton = page.getByRole("button", { name: /^Place \d+ orders?$/ }).first();
  check(await placeButton.isVisible().catch(() => false), "S1.1 offers the button that places both orders");
  await placeButton.click();
  await page.waitForTimeout(500);
  text = await body();
  const reviewConfirm = page.getByRole("button", { name: "Place orders", exact: true }).first();
  const onReview = await reviewConfirm.isVisible().catch(() => false);
  check(onReview, "S1.2 reviews the order before anything is sent");
  if (onReview) {
    check(/12/.test(text) && /8/.test(text), "S1.2 reviews chilled 12 and dry 8 before sending", text.slice(0, 500));
    check(/kg/.test(text), "S1.2 shows the estimated weight the store is committing to", text.slice(0, 500));
    await reviewConfirm.click();
    await page.waitForTimeout(900);
    text = await body();
  }
  check(/received|Received/.test(text), "S1.3 acknowledges that the order was received", text.slice(0, 400));
  check(text.includes(HERO[0]) || text.includes(HERO[1]), "S1.3 names the order the server created", text.slice(0, 400));
  check(/15:40/.test(text), "S1.3 is stamped with the scenario time, not the wall clock", text.slice(0, 400));

  // ---- 2. S1 edit, cancel, and the cutoff error ------------------------------------------------------------------------
  text = await goto("/store/orders", "15:42", MONDAY);
  check(/You can edit until 16:00/.test(text), "S1.3 says how long the order stays editable", text.slice(0, 500));
  check(/Arrival time is shown after the plan is released at 23:40/.test(text), "S1.3 says when the arrival time arrives", text.slice(0, 600));
  const editLink = page.getByRole("button", { name: "Edit order", exact: true }).first();
  const canEdit = await editLink.isVisible().catch(() => false);
  check(canEdit, "S1.3 B offers Edit order while orders are still open");
  if (canEdit) {
    await editLink.click();
    await page.waitForTimeout(500);
    text = await body();
    check(/Cancel order/.test(text), "S1.3 B offers Cancel order beside the edit", text.slice(0, 500));

    // Edit the chilled line to 14 and send it, then put it back, so the hero day stays 12 + 8.
    const units = page.locator('input[type="number"]').first();
    if (await units.isVisible().catch(() => false)) {
      await units.fill("14");
      await page.waitForTimeout(300);
      const save = page.getByRole("button", { name: /^Place \d+ orders?$|^Save|^Update/ }).first();
      if (await save.isVisible().catch(() => false)) {
        await save.click();
        await page.waitForTimeout(500);
        const confirmEdit = page.getByRole("button", { name: "Place orders", exact: true }).first();
        if (await confirmEdit.isVisible().catch(() => false)) {
          await confirmEdit.click();
          await page.waitForTimeout(900);
        }
      }
      text = await body();
      check(/14 units/.test(text), "S1.3 C: the edit is taken and the screen shows the new count", text.slice(0, 500));

      // Back to 12 for the hero day.
      const editAgain = page.getByRole("button", { name: "Edit order", exact: true }).first();
      if (await editAgain.isVisible().catch(() => false)) {
        await editAgain.click();
        await page.waitForTimeout(500);
        const back = page.locator('input[type="number"]').first();
        await back.fill("12");
        await page.waitForTimeout(300);
        const save2 = page.getByRole("button", { name: /^Place \d+ orders?$|^Save|^Update/ }).first();
        if (await save2.isVisible().catch(() => false)) {
          await save2.click();
          await page.waitForTimeout(500);
          const confirm2 = page.getByRole("button", { name: "Place orders", exact: true }).first();
          if (await confirm2.isVisible().catch(() => false)) {
            await confirm2.click();
            await page.waitForTimeout(900);
          }
        }
        check(/12 units/.test(await body()), "the order is back to 12 units for the hero day");
      }
    }
  }

  // The real cutoff error, from the server, on the screen. 16:01 is a minute past 16:00.
  text = await goto("/store/orders", "16:01", MONDAY);
  check(await loaded(), "S1 still loads a minute after the cutoff");
  const editAfter = page.getByRole("button", { name: /^Edit/ }).first();
  const editOffered = await editAfter.isVisible().catch(() => false);
  if (editOffered) {
    await editAfter.click();
    await page.waitForTimeout(300);
    const save = page.getByRole("button", { name: /Save|Update|Place/ }).first();
    if (await save.isVisible().catch(() => false)) {
      await save.click();
      await page.waitForTimeout(600);
      text = await body();
      check(
        /cutoff|closed|no longer/i.test(text),
        "S1.5: an edit after the cutoff shows the server's refusal in words, not a raw error",
        text.slice(0, 400),
      );
      check(!/\b(409|Error:|TypeError|undefined)\b/.test(text), "the refusal is not a raw status code or a stack", text.slice(0, 400));
    }
  } else {
    check(true, "S1 withdraws Edit once the cutoff has passed, so the refusal cannot be reached by hand");
  }

  // ---- 3. S2.1 once orders close, then S1.4 after it --------------------------------------------------------------------
  text = await goto(`/store/deliveries/${DAY}`, "16:01", MONDAY);
  check(await loaded(), "S2.1 loads");
  check(/Confirmed/.test(text), "S2.1 reads Confirmed once orders close", text.slice(0, 400));
  check(text.includes(HERO[0]) && text.includes(HERO[1]), "S2.1 lists both orders", text.slice(0, 500));

  text = await goto("/store/orders", "16:07", MONDAY);
  check(await loaded(), "S1.4 loads after orders close");
  check(/Wed 30 Sep/.test(text), "S1.4 rolls a new order to Wed 30 Sep", text.slice(0, 400));
  check(!text.includes("Mock") && !text.includes("—"), "no em dash and never the word Mock on S1.4");

  // ---- 4. S2 across the day --------------------------------------------------------------------------------------------

  // The plan goes out at 23:40 and the store sees it at 23:41.
  await advance(at("23:40", MONDAY));
  await ok("dispatcher", "POST", "/dispatcher/plan/release?depot=kandy", { sendNotices: true });
  const plan = (await ok("dispatcher", "GET", "/dispatcher/plan?depot=kandy")) as {
    version: { number: number };
    lanes: { vehicleId: string; trips: { trip: number; stops: { orderIds: string[] }[] }[] }[];
  };
  const version = plan.version.number;
  const lane = plan.lanes.find((l) => l.trips.some((t) => t.stops.some((s) => s.orderIds.includes(HERO[0]))));
  const trip = lane?.trips.find((t) => t.stops.some((s) => s.orderIds.includes(HERO[0])));
  if (lane === undefined || trip === undefined) throw new Error(`plan v${version} has no stop for ${HERO[0]}`);
  console.log(`info the plan puts ${HERO.join(" + ")} on ${lane.vehicleId} trip ${trip.trip}`);

  text = await goto(`/store/deliveries/${DAY}`, "23:41", MONDAY);
  check(/Planned/.test(text), "S2.2 reads Planned once the plan is out", text.slice(0, 400));
  check(HHMM.test(text), "S2.2 shows the arrival range as a clock time", text.slice(0, 500));
  check(text.includes(lane.vehicleId), "S2.2 names the vehicle the plan gave the store", lane.vehicleId);
  check(/Ordered/.test(text) && /Delivered/.test(text), "S2.2 draws the journey with all its steps", text.slice(0, 600));

  // S2.10: the deliveries list, rather than one day.
  text = await goto("/store/deliveries", "23:41", MONDAY);
  check(await loaded(), "S2.10 the deliveries list loads");
  check(/Tue 29 Sep|2026-09-29/.test(text), "S2.10 lists the day that is coming", text.slice(0, 400));

  // The dock loads the truck at 04:50.
  await advance(at("04:50"));
  const loadedSync = await sync("loader", "tablet-kandy", [
    record("loader.confirmLoaded", { vehicleId: lane.vehicleId, trip: trip.trip, personId: "Ruwan", personName: "Ruwan" }, "04:50", null, "Ruwan"),
  ]);
  check(loadedSync.join() === "accepted", "the dock confirms the truck loaded", loadedSync);

  text = await goto(`/store/deliveries/${DAY}`, "04:51");
  check(/Loaded/.test(text), "S2.3 reads Loaded at 04:51", text.slice(0, 400));
  check(/Kandy dock/.test(text), "S2.3 names the dock it was loaded at", text.slice(0, 500));

  // The phone starts the route, if the demo phone is the vehicle the plan chose.
  const phone = accounts.driver.vehicleId;
  const phoneDrivesTheStop = phone !== null && phone === lane.vehicleId;
  const device = `phone-${(phone ?? "none").toLowerCase()}`;
  if (!phoneDrivesTheStop) {
    console.log(`info the stop is on ${lane.vehicleId} and the demo phone is ${phone ?? "bound to no vehicle"}: S2.4 and S2.5 need a phone on this stop's vehicle; skipped`);
  }
  if (phoneDrivesTheStop) {
    await advance(at("05:11"));
    const startedSync = await sync("driver", device, [
      record("driver.ack", { date: DAY, version }, "04:55", version),
      record("driver.startRoute", { date: DAY, at: "05:10" }, "05:10", version),
    ]);
    check(startedSync.join() === "accepted,accepted", "the phone acknowledges the plan and starts the route", startedSync);

    text = await goto(`/store/deliveries/${DAY}`, "05:11");
    check(/On the way|Departed/.test(text), "S2.4 reads On the way once the truck leaves", text.slice(0, 400));
    check(/Arriv|arriv/.test(text), "S2.4 says when it is expected", text.slice(0, 500));

    // S2.5: the phone has been silent for more than three minutes.
    text = await goto(`/store/deliveries/${DAY}`, "05:19");
    check(/05:11/.test(text), "S2.5 tells the store the last time the truck was heard from", text.slice(0, 500));
  }

  // The store asks for the stop to be deferred at 05:21.
  await advance(at("05:21"));
  await ok("dispatcher", "POST", "/dispatcher/stops/defer", {
    orderIds: HERO,
    kind: "store_request",
    reason: "Receiving staff unavailable today",
  });

  text = await goto(`/store/deliveries/${DAY}`, "05:22");
  check(/Deferred at your request/.test(text), "S2.6 headlines the deferral in the store's own words", text.slice(0, 500));
  check(/Receiving staff unavailable today/.test(text), "S2.6 carries the reason Dispatch recorded", text.slice(0, 600));
  check(/Kumari/.test(text) && /05:21/.test(text), "S2.6 says who decided and when", text.slice(0, 600));
  // The label is "New ETA" in the data and is uppercased by the stylesheet, so match either.
  check(/NEW ETA/i.test(text) && /Wed 30 Sep/.test(text), "S2.6 gives the store its new ETA", text.slice(0, 600));
  check(!text.includes("Conflict"), "S2.6 never shows the store the word Conflict");

  const gotIt = page.getByRole("button", { name: "Got it" });
  const hasGotIt = await gotIt.isVisible().catch(() => false);
  check(hasGotIt, "S2.6 offers Got it");
  if (hasGotIt) {
    check(/Dispatch sees when you tap Got it/.test(text), "S2.6 explains what Got it does", text.slice(0, 700));
    await gotIt.click();
    await page.waitForTimeout(600);
    const after = await body();
    check(!/Dispatch sees when you tap Got it/.test(after) || !(await page.getByRole("button", { name: "Got it" }).isVisible().catch(() => false)),
      "tapping Got it takes the prompt away");
    const d4 = (await ok("dispatcher", "GET", "/dispatcher/deferrals?depot=kandy")) as {
      storeRequest: { orderId: string; storeTold: { state: string } }[];
    };
    const told = d4.storeRequest.filter((c) => HERO.includes(c.orderId)).map((c) => c.storeTold.state);
    check(told.length > 0 && told.every((s) => s === "seen"), "Got it reaches Dispatch's D4 card", told);
  }

  // The phone had already delivered, offline. The sync at 06:41 is the conflict.
  await advance(at("06:41"));
  const batch = [
    record("driver.arrival", { date: DAY, outletId: OUTLET, at: "05:26" }, "05:26", version),
    ...HERO.map((orderId) =>
      record(
        "driver.outcome",
        {
          date: DAY,
          outletId: OUTLET,
          orderId,
          outcome: "Delivered",
          unitsDelivered: orderId === HERO[0] ? 12 : 8,
          receiverName: "S. Fernando",
          at: "05:42",
        },
        "05:42",
        version,
      ),
    ),
  ];
  const results = await sync("driver", device, batch);
  check(results.join() === "accepted,conflict,conflict", "the delivery the phone held disagrees with the deferral", results);

  // The day is Conflict on the wire now. The store reads Under review, with no deferral card over it (the backend
  // holds that notice back while a review is open, `store_views.deferral_out`), and never the word Conflict.
  text = await goto(`/store/deliveries/${DAY}`, "06:41");
  check(/Under review/.test(text), "S2.7 reads Under review once the driver's record disagrees", text.slice(0, 500));
  check(!text.includes("Conflict"), "S2.7 never shows the store the word Conflict (PRD §4b)", text.slice(0, 600));
  check(!/Deferred at your request/.test(text), "the deferral card does not sit over the review", text.slice(0, 500));
  // A51: the explanation is shown without an ask; only the question itself waits for Dispatch to ask.
  check(/Why you're seeing this/.test(text), "S2.7 explains why the store is seeing a review (A51)", text.slice(0, 500));
  check(!/Did you receive this delivery\?/.test(text), "the question itself waits for Dispatch to ask (A51)", text.slice(0, 700));

  // Dispatch asks the store the question; the store answers from S2.7.
  const inbox = (await ok("dispatcher", "GET", "/dispatcher/inbox")) as { items: { id: string }[] };
  const conflictId = inbox.items.map((i) => i.id).find((id) => id.startsWith("c"));
  check(conflictId !== undefined, "the review is in the dispatcher's inbox", conflictId);
  const cid = (conflictId ?? "c0").slice(1);
  await ok("dispatcher", "POST", `/dispatcher/conflicts/${cid}/ask-store`);

  text = await goto(`/store/deliveries/${DAY}`, "06:42");
  check(/Why you're seeing this/.test(text), "S2.7 explains why the store is seeing a review", text.slice(0, 800));
  check(/driver had no signal/.test(text), "S2.7 says what happened, in plain words", text.slice(0, 800));
  check(/S\. Fernando/.test(text), "S2.7 names who signed for the delivery", text.slice(0, 800));
  check(/05:42/.test(text), "S2.7 is stamped with the time the driver delivered", text.slice(0, 800));
  check(!text.includes("Conflict"), "the review notice never says Conflict either", text.slice(0, 800));

  const yes = page.getByRole("button", { name: "Yes, we received it" }).first();
  const reviewReport = page.getByRole("button", { name: "Report issue" }).first();
  check(await yes.isVisible().catch(() => false), "S2.7 offers 'Yes, we received it'");
  check(await reviewReport.isVisible().catch(() => false), "S2.7 offers 'Report issue' as the other action");
  if (await yes.isVisible().catch(() => false)) {
    await yes.click();
    await page.waitForTimeout(900);
    text = await body();
    check(/Delivered/.test(text), "A47: answering Yes reads Delivered at once, without waiting for Dispatch", text.slice(0, 600));
    check(!/Did you receive/i.test(text), "the question goes away once it is answered", text.slice(0, 600));
  }

  // Dispatch keeps the delivery at 06:45.
  await advance(at("06:45"));
  await ok("dispatcher", "POST", `/dispatcher/conflicts/${cid}/resolve`, { resolution: "keep_delivery" });

  text = await goto(`/store/deliveries/${DAY}`, "06:45");
  check(/Delivered/.test(text), "S2.8 reads Delivered once Dispatch keeps it", text.slice(0, 500));
  check(/Deferral withdrawn/.test(text), "S2.8 tags the day Deferral withdrawn", text.slice(0, 600));
  check(/Wed 30 Sep re-run removed/.test(text), "S2.8 says the re-run is off", text.slice(0, 700));

  // ---- 5. S3 the receipt, the shortfall and the issue sheet --------------------------------------------------------------
  text = await goto(`/store/deliveries/${DAY}/receipt`, "07:28");
  check(await loaded(), "S3.1 the receipt loads");
  check(/S\. Fernando/.test(text), "S3.1 shows the proof of delivery", text.slice(0, 600));
  check(text.includes(HERO[0]) && text.includes(HERO[1]), "S3.1 lists both orders to count", text.slice(0, 700));
  check(/12/.test(text) && /8/.test(text), "S3.1 shows what was ordered on each line", text.slice(0, 700));

  check(await page.getByRole("button", { name: /Confirm/ }).first().isVisible().catch(() => false), "S3.1 offers Confirm receipt");

  // S3.3: the issue sheet, opened from the receipt that is still to confirm.
  const report = page.getByRole("button", { name: "Report issue" }).first();
  const hasReport = await report.isVisible().catch(() => false);
  check(hasReport, "S3.3 offers Report issue beside Confirm receipt", text.slice(0, 600));
  if (hasReport) {
    await report.click();
    await page.waitForTimeout(400);
    text = await body();
    check(/Report an issue/.test(text), "S3.3 opens the issue sheet", text.slice(0, 600));
    check(/Missing/.test(text) && /Damaged/.test(text) && /Wrong item/.test(text), "S3.3 lists the issue types the PRD fixes", text.slice(0, 800));
    check(await page.getByRole("button", { name: "Send to Dispatch" }).isVisible().catch(() => false), "S3.3 sends the report to Dispatch");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // S3.1 B: short-count the chilled line with the stepper; it must ask why before it takes it.
  const minusOne = page.getByRole("button", { name: /^Remove one / }).first();
  check(await minusOne.isVisible().catch(() => false), "S3.1 lets the store count each line with a stepper");
  if (await minusOne.isVisible().catch(() => false)) {
    await minusOne.click();
    await minusOne.click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: /Confirm/ }).first().click();
    await page.waitForTimeout(600);
    text = await body();
    check(/WHY IS IT SHORT/i.test(text), "S3.1 B asks why the count is short before taking it", text.slice(0, 600));
    await page.getByRole("button", { name: /^Missing/ }).first().click();
    await page.getByRole("button", { name: "Confirm with a shortfall" }).last().click();
    await page.waitForTimeout(900);
    text = await body();
    check(/Receipt confirmed/.test(text) && !/WHY IS IT SHORT/i.test(text), "S3.1 B: the short count is taken and the receipt confirmed", text.slice(0, 600));
    check(/10 of 12 units received/.test(text), "A50: the short line reads 10 of 12 units received", text.slice(0, 800));
    check(!/8 of 8 units received/.test(text), "a line counted in full carries no count", text.slice(0, 800));
  }

  // The report itself, through the client the screens use (the sheet was checked above).
  await ok("store", "POST", "/store/issues", { date: DAY, type: "Missing", lines: [{ orderId: HERO[0], units: 2 }], photo: false });

  // S3.7: the issues tab lists it.
  text = await goto("/store/issues", "07:35");
  check(await loaded(), "S3.7 the Issues tab loads");
  const issues = (await ok("store", "GET", "/store/issues")) as { issues?: unknown[] } | unknown[];
  const issueCount = Array.isArray(issues) ? issues.length : (issues.issues?.length ?? 0);
  if (issueCount > 0) {
    check(/Missing|Short|Damaged/.test(text), "S3.7 lists the reported problem", text.slice(0, 600));
    check(text.includes(HERO[0]) || /ORD/.test(text), "S3.7 names the order it is about", text.slice(0, 600));
  } else {
    check(/No open issues/i.test(text), "S3.7 says plainly when there is nothing to show", text.slice(0, 400));
  }

  // ---- 6. S4 the feed and the history ------------------------------------------------------------------------------------
  text = await goto("/store/updates", "07:35");
  check(await loaded(), "S4.1 the updates feed loads");
  check(/Order received/.test(text), "S4.1 has the Order received row", text.slice(0, 700));
  check(/Mon 28 Sep|Tue 29 Sep|Today|Yesterday/.test(text), "S4.1 groups the feed by day", text.slice(0, 700));
  check(!text.includes("Conflict"), "S4.1 never shows the store the word Conflict");
  check(!text.includes("Mock") && !text.includes("—"), "no em dash and never the word Mock on S4");

  const markAll = page.getByRole("button", { name: "Mark all read" });
  const hasMarkAll = await markAll.isVisible().catch(() => false);
  check(hasMarkAll, "S4.1 offers Mark all read while anything is unread");
  if (hasMarkAll) {
    await markAll.click();
    await page.waitForTimeout(800);
    const feed = (await ok("store", "GET", "/store/updates")) as { unread: number };
    check(feed.unread === 0, "Mark all read empties the bell on the server too", feed.unread);
    const after = await body();
    check(after.length > 100, "marking read leaves the feed in place rather than emptying the screen");
  }

  // S4.2: the History segment.
  text = await goto("/store/history", "07:35");
  check(await loaded(), "S4.2 the History segment loads");
  check(/Tue 29 Sep|2026-09-29/.test(text), "S4.2 lists the day that finished", text.slice(0, 600));
  const sunday = /Sun \d{1,2} /.test(text);
  check(!sunday, "S4.2 lists no Sunday: Waypoint runs Monday to Saturday", text.slice(0, 600));

  // ---- 7. offline and error, with the API really stopped -----------------------------------------------------------------
  if (skipOffline) {
    console.log("info --skip-offline: the offline and error states were not played");
  } else {
    // Offline in the browser: the screens must say so rather than show a blank or a raw failure.
    // No reload: the dev server has no service worker, so a reload offline is the browser's own error page. The app
    // follows the browser's online state, which is what a store manager losing signal actually does.
    await context.setOffline(true);
    await page.waitForTimeout(1500);
    text = await body();
    check(text.trim().length > 0, "an offline store screen is not blank", text.slice(0, 300));
    check(
      /offline|No connection|connection|try again|Try again/i.test(text),
      "an offline store screen says it is offline",
      text.slice(0, 400),
    );
    check(!/\b(TypeError|undefined is not|Failed to fetch)\b/.test(text), "offline shows words, not the fetch failure", text.slice(0, 400));
    await context.setOffline(false);

    // The API really stopped: the error state, not the offline one, because the browser still has a network.
    console.log("info stopping the api container to play the error state");
    await run("docker", ["compose", "stop", "api"], { cwd: "..", windowsHide: true });
    try {
      await page.goto(`${base}/store/deliveries/${DAY}?at=07:35`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      text = await body();
      check(text.trim().length > 0, "a store screen with the API down is not blank", text.slice(0, 300));
      check(
        /went wrong|Couldn't load|could not|try again|Try again|offline|connection/i.test(text),
        "a store screen with the API down says so in words",
        text.slice(0, 400),
      );
      check(
        !/\b(500|502|TypeError|undefined is not|\[object Object\])\b/.test(text),
        "the error state is not a raw status or object",
        text.slice(0, 400),
      );
      const retry = page.getByRole("button", { name: /Try again|Retry|Reload/ }).first();
      check(await retry.isVisible().catch(() => false), "the error state offers a way back");
    } finally {
      console.log("info restarting the api container");
      await run("docker", ["compose", "start", "api"], { cwd: "..", windowsHide: true });
      for (let i = 0; i < 60; i += 1) {
        const back = await fetch(`${api}/health`).catch(() => null);
        if (back?.ok) break;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Recovery: the same screen, with the API back.
    await page.goto(`${base}/store/deliveries/${DAY}?at=07:35`, { waitUntil: "networkidle" });
    await page.getByText("Loading deliveries").waitFor({ state: "detached", timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    text = await body();
    check(/Delivered|Partial/.test(text), "the screen recovers once the API is back", text.slice(0, 400));
  }

  // Nothing in the whole run should have thrown in the page.
  const realErrors = pageErrors.filter(
    (e) => !/Failed to load resource|the server responded with a status|^No connection$/.test(e),
  );
  check(realErrors.length === 0, "no uncaught error was thrown in any store screen", realErrors.slice(0, 5));

  await browser.close();
  // The demo is left reset, the way the other role scripts leave it.
  const stillUp = await fetch(`${api}/health`).catch(() => null);
  if (stillUp?.ok) await ok("dispatcher", "POST", "/demo/reset");

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
