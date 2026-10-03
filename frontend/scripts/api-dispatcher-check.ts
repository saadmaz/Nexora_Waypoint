/**
 * Plays the Dispatcher client against the REAL backend (API wiring D-C). It is the acceptance test for
 * `VITE_DISPATCHER_API=api`, as far as the backend can answer today.
 *
 * It proves, in four parts:
 *   1. For all 20 dispatcher operations over raw HTTP: no token is a 401, a driver token a 403, a dispatcher token the typed
 *      501 `not_implemented` naming the operation. A route that has landed must answer 200; its reply is then compared with
 *      the mock's view of the same operation (same field names at every depth), so the check keeps working as routes land.
 *   2. The same 20 operations through the app's own client (`createHttpDispatcherApi`, imported from the dev server): each
 *      comes back as the dispatcher's `ApiError` with code `not_implemented`, or as a view for a route that has landed.
 *   3. The screens: with every route at 501, each of the nine dispatcher screens shows its own error state, with Retry, and
 *      no fixture data. `?state=` and `?preset=` do nothing. Then a screen fed a real-shaped reply draws it, and when the
 *      network drops the screen keeps that data and switches to its offline behaviour (a real NetworkUnavailableError, not
 *      only the browser's online flag).
 *   4. The presenter control and the clock: "Go to next step" is `POST /demo/advance`, the server clock moves, and "Reset demo"
 *      is `POST /demo/reset` and puts it back. A 401 sends a signed-out person to sign-in once.
 *
 *   CORS_ORIGINS='["http://localhost:8080","http://localhost:5173"]' docker compose up -d --build db api
 *   VITE_AUTH_API=api VITE_DISPATCHER_API=api npm run dev -- --port 5173 --strictPort
 *   npm run test:api-dispatcher -- --base http://localhost:5173 [--api http://localhost:8000]
 *
 * It resets the demo at the end of part 4, so run it on a database you do not mind re-seeding. Exits non-zero if any check fails.
 */
import { chromium, type Page } from "@playwright/test";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const base = flag("--base") ?? "http://localhost:5173";
const api = flag("--api") ?? "http://localhost:8000";
const PASSWORD = "waypoint-demo";
const CLIENT_MODULE = "/src/api/httpDispatcherApi.ts";
const MOCK_MODULE = "/src/screens/dispatcher/mock/mockDispatcherApi.ts";

type Op = { name: string; method: "GET" | "POST"; path: string; body?: unknown };

/** The 20 operations, with a request each backend dependency chain will accept, so a 401 or 403 is never hidden by a 422. */
const OPS: Op[] = [
  { name: "getQueue", method: "GET", path: "/dispatcher/queue?depot=peliyagoda" },
  { name: "getOrderHistory", method: "GET", path: "/dispatcher/orders/ORD2001/history" },
  { name: "getCapacity", method: "GET", path: "/dispatcher/capacity?depot=peliyagoda" },
  { name: "getPlan", method: "GET", path: "/dispatcher/plan?depot=peliyagoda" },
  { name: "redraftPlan", method: "POST", path: "/dispatcher/plan/redraft?depot=peliyagoda" },
  { name: "validateMove", method: "POST", path: "/dispatcher/plan/validate-move", body: { orderId: "ORD2001", to: { vehicleId: "VEH003", trip: 1, deferred: false } } },
  { name: "saveMoves", method: "POST", path: "/dispatcher/plan/moves?depot=peliyagoda", body: { moves: [{ orderId: "ORD2001", to: { deferred: true } }] } },
  { name: "listDeferrals", method: "GET", path: "/dispatcher/deferrals?depot=peliyagoda" },
  { name: "notifyDeferrals", method: "POST", path: "/dispatcher/deferrals/notify", body: { depot: "peliyagoda" } },
  { name: "releasePlan", method: "POST", path: "/dispatcher/plan/release?depot=peliyagoda", body: { sendNotices: true } },
  { name: "listAcknowledgements", method: "GET", path: "/dispatcher/acknowledgements" },
  { name: "getForecast", method: "GET", path: "/dispatcher/forecast?depot=peliyagoda" },
  { name: "getLiveBoard", method: "GET", path: "/dispatcher/live?depot=both" },
  { name: "deferStop", method: "POST", path: "/dispatcher/stops/defer", body: { orderIds: ["ORD2001"], kind: "store_request", reason: "Store asked" } },
  { name: "getInbox", method: "GET", path: "/dispatcher/inbox" },
  { name: "getConflict", method: "GET", path: "/dispatcher/conflicts/1" },
  { name: "askStore", method: "POST", path: "/dispatcher/conflicts/1/ask-store" },
  { name: "resolveConflict", method: "POST", path: "/dispatcher/conflicts/1/resolve", body: { resolution: "keep_delivery" } },
  { name: "getExceptionForReview", method: "GET", path: "/dispatcher/exceptions/1" },
  { name: "decideException", method: "POST", path: "/dispatcher/exceptions/1/decide", body: { decision: "swap_vehicle", deferOrderIds: [] } },
];

/** The nine screens and the words each one's own error state says. */
const SCREENS = [
  { path: "/dispatcher/queue", error: "Couldn't load orders" },
  { path: "/dispatcher/capacity", error: "Capacity couldn't be calculated" },
  { path: "/dispatcher/trips", error: "Couldn't load the plan" },
  { path: "/dispatcher/deferrals", error: "Couldn't load the deferrals" },
  { path: "/dispatcher/release", error: "Couldn't load the plan" },
  { path: "/dispatcher/live", error: "Couldn't load the live board" },
  { path: "/dispatcher/conflicts/1", error: "Couldn't load this conflict" },
  { path: "/dispatcher/exceptions/1", error: "Couldn't load this exception" },
  { path: "/dispatcher/forecast", error: "Couldn't load the forecast" },
] as const;

async function main() {
  const health = await fetch(`${api}/api/v1/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`FAIL the API is not answering at ${api}. Start it with: docker compose up -d --build db api`);
    process.exit(1);
  }

  const failures: string[] = [];
  const check = (condition: boolean, message: string) => {
    if (condition) console.log(`ok   ${message}`);
    else {
      console.error(`FAIL ${message}`);
      failures.push(message);
    }
  };

  const login = async (email: string): Promise<string> => {
    const reply = await fetch(`${api}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
    return ((await reply.json()) as { accessToken: string }).accessToken;
  };
  const dispatcherToken = await login("dispatcher@waypoint.demo");
  const driverToken = await login("driver@waypoint.demo");

  async function call(op: Op, token: string | null) {
    const reply = await fetch(`${api}/api/v1${op.path}`, {
      method: op.method,
      headers: { Accept: "application/json", ...(op.body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(op.body ? { body: JSON.stringify(op.body) } : {}),
    });
    const text = await reply.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: reply.status, body: body as { code?: string; details?: { operation?: string } } };
  }

  // ---- 1. The 20 operations over raw HTTP -------------------------------------------------------------------------------
  const landed: string[] = [];
  for (const op of OPS) {
    const none = await call(op, null);
    const driver = await call(op, driverToken);
    const dispatcher = await call(op, dispatcherToken);
    check(none.status === 401, `${op.name}: no token is 401 (${none.status})`);
    check(driver.status === 403, `${op.name}: a driver token is 403 (${driver.status})`);
    if (dispatcher.status === 501) {
      check(dispatcher.body.code === "not_implemented" && dispatcher.body.details?.operation === op.name, `${op.name}: a dispatcher token is the typed 501 naming the operation`);
    } else {
      landed.push(op.name);
      check(dispatcher.status === 200 || dispatcher.status === 404 || dispatcher.status === 409, `${op.name}: the route has landed and answers ${dispatcher.status}`);
    }
  }
  console.log(`     routes that have landed: ${landed.length > 0 ? landed.join(", ") : "none (all 20 answer 501)"}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });

  async function signIn(email: string): Promise<Page> {
    const page = await context.newPage();
    await page.goto(`${base}/sign-in`, { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 15_000 });
    return page;
  }

  const page = await signIn("dispatcher@waypoint.demo");

  // ---- 2. The same operations through the app's own client --------------------------------------------------------------
  const viaClient = await page.evaluate(
    async ([clientModule, mockModule]) => {
      const { createHttpDispatcherApi } = await import(/* @vite-ignore */ clientModule);
      const { createMockDispatcherApi } = await import(/* @vite-ignore */ mockModule);
      const real = createHttpDispatcherApi();
      const mock = createMockDispatcherApi(() => new Date(2026, 8, 29, 6, 46), { delayMs: 0 });
      const calls: Record<string, () => Promise<unknown>> = {
        getQueue: () => real.getQueue({ depot: "peliyagoda" }),
        getOrderHistory: () => real.getOrderHistory("ORD2001"),
        getCapacity: () => real.getCapacity({ depot: "peliyagoda" }),
        getPlan: () => real.getPlan({ depot: "peliyagoda" }),
        redraftPlan: () => real.redraftPlan(),
        validateMove: () => real.validateMove({ orderId: "ORD2001", to: { vehicleId: "VEH003", trip: 1 } }),
        saveMoves: () => real.saveMoves({ moves: [{ orderId: "ORD2001", to: "deferred" }] }),
        listDeferrals: () => real.listDeferrals({ depot: "peliyagoda" }),
        notifyDeferrals: () => real.notifyDeferrals({ depot: "peliyagoda" }),
        releasePlan: () => real.releasePlan({ sendNotices: true }),
        listAcknowledgements: () => real.listAcknowledgements({}),
        getForecast: () => real.getForecast({ depot: "peliyagoda" }),
        getLiveBoard: () => real.getLiveBoard({ depot: "both" }),
        deferStop: () => real.deferStop({ orderIds: ["ORD2001"], kind: "store request", reason: "Store asked" }),
        getInbox: () => real.getInbox(),
        getConflict: () => real.getConflict("1"),
        askStore: () => real.askStore("1"),
        resolveConflict: () => real.resolveConflict("1", "keep delivery"),
        getExceptionForReview: () => real.getExceptionForReview("1"),
        decideException: () => real.decideException("1", { decision: "swap vehicle", deferOrderIds: [] }),
      };
      const mockCalls: Record<string, () => Promise<unknown>> = {
        getQueue: () => mock.getQueue({ depot: "peliyagoda" }),
        getCapacity: () => mock.getCapacity({ depot: "peliyagoda" }),
        getPlan: () => mock.getPlan({ depot: "peliyagoda" }),
        listDeferrals: () => mock.listDeferrals({ depot: "peliyagoda" }),
        listAcknowledgements: () => mock.listAcknowledgements({}),
        getForecast: () => mock.getForecast({ depot: "peliyagoda" }),
        getLiveBoard: () => mock.getLiveBoard({ depot: "both" }),
        getInbox: () => mock.getInbox(),
      };
      /** Every field path in a value, to compare a real reply with the mock's view of the same operation. */
      const paths = (value: unknown, prefix = ""): string[] =>
        Array.isArray(value)
          ? value.flatMap((item) => paths(item, `${prefix}[]`))
          : value !== null && typeof value === "object"
            ? Object.entries(value).flatMap(([key, item]) => [`${prefix}.${key}`, ...paths(item, `${prefix}.${key}`)])
            : [];
      const out: Record<string, string> = {};
      for (const [name, run] of Object.entries(calls)) {
        try {
          const view = await run();
          const reference = mockCalls[name] ? await mockCalls[name]() : undefined;
          const have = new Set(paths(view));
          const missing = reference ? [...new Set(paths(reference))].filter((p) => !have.has(p)) : [];
          out[name] = `view${reference ? ` missing=${missing.join("|") || "none"}` : " (no mock reference)"}`;
        } catch (error) {
          const e = error as { name?: string; code?: string };
          out[name] = `${e.name}:${e.code ?? ""}`;
        }
      }
      return out;
    },
    [CLIENT_MODULE, MOCK_MODULE],
  );
  for (const op of OPS) {
    const result = viaClient[op.name] ?? "no result";
    if (landed.includes(op.name)) check((result.startsWith("view") && !/missing=(?!none)/.test(result)) || (result.startsWith("ApiError:") && !result.endsWith("not_implemented")), `${op.name}: through the client, the landed route's reply matches its view (${result})`);
    else check(result === "ApiError:not_implemented", `${op.name}: through the client, the 501 is the dispatcher's ApiError not_implemented (${result})`);
  }

  // ---- 3. The screens ----------------------------------------------------------------------------------------------------
  const seen: { url: string; status?: number }[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(api)) seen.push({ url: request.url() });
  });
  page.on("response", (response) => {
    const entry = seen.find((s) => s.url === response.url() && s.status === undefined);
    if (entry) entry.status = response.status();
  });

  for (const screen of SCREENS) {
    if (landed.length > 0) break; // once routes land, the error states are no longer reachable by 501: part 3 needs a stubbed 501
    await page.goto(`${base}${screen.path}`, { waitUntil: "networkidle" });
    const heading = page.getByText(screen.error, { exact: false }).first();
    const shown = await heading.waitFor({ timeout: 10_000 }).then(() => true, () => false);
    check(shown, `${screen.path}: the 501 reaches the screen's own error state ("${screen.error}")`);
    check((await page.getByRole("button", { name: "Retry" }).count()) > 0, `${screen.path}: the error state offers Retry`);
    check((await page.getByText("ORD2001").count()) === 0, `${screen.path}: no fixture order is drawn behind the error`);
  }
  check(seen.some((s) => /\/api\/v1\/dispatcher\//.test(s.url) && s.status === 501), "the screens' reads reached the real API and came back 501");

  // ?state= and ?preset= do nothing in api mode: the real answer (501) still shows, not the mock's empty or preset state.
  await page.goto(`${base}/dispatcher/queue?state=empty&preset=swap`, { waitUntil: "networkidle" });
  check(await page.getByText("Couldn't load orders", { exact: false }).first().waitFor({ timeout: 10_000 }).then(() => true, () => false), "?state=empty&preset=swap does nothing in api mode");

  // A reply with real data: serve the mock's live board as the wire reply, so the screen draws through the real client and mappers.
  const liveBoard = await page.evaluate(async (mockModule) => {
    const { createMockDispatcherApi } = await import(/* @vite-ignore */ mockModule);
    return createMockDispatcherApi(() => new Date(2026, 8, 29, 6, 46), { delayMs: 0 }).getLiveBoard({ depot: "both" });
  }, MOCK_MODULE);
  const liveRoute = "**/api/v1/dispatcher/live**";
  await page.route(liveRoute, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(liveBoard) }));
  await page.goto(`${base}/dispatcher/live`, { waitUntil: "networkidle" });
  const firstVehicle = liveBoard.rows[0]?.vehicleId as string;
  check(await page.getByText(firstVehicle, { exact: false }).first().waitFor({ timeout: 10_000 }).then(() => true, () => false), `a real-shaped reply is drawn by the live screen (${firstVehicle})`);

  // The network drops: the screen keeps what it had and says it is offline. It polls every 5 s, so the next poll fails.
  await page.unroute(liveRoute);
  await page.route(liveRoute, (route) => route.abort("connectionrefused"));
  const offlineShown = await page.getByText("Offline", { exact: true }).first().waitFor({ timeout: 15_000 }).then(() => true, () => false);
  check(offlineShown, "a request that gets no answer puts the screen in its offline state");
  check(await page.getByText(firstVehicle, { exact: false }).first().isVisible(), "offline: the screen keeps the data it last loaded");
  // It comes back: the next poll is answered, and the offline state ends by itself.
  await page.unroute(liveRoute);
  await page.route(liveRoute, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(liveBoard) }));
  const recovered = await page.getByText("Offline", { exact: true }).first().waitFor({ state: "hidden", timeout: 25_000 }).then(() => true, () => false);
  check(recovered, "when the server answers again the offline state ends");
  await page.unroute(liveRoute);

  // ---- 4. The presenter control and the clock ----------------------------------------------------------------------------
  const clock = async () => ((await (await fetch(`${api}/api/v1/clock`, { headers: { Authorization: `Bearer ${dispatcherToken}` } })).json()) as { now: string }).now.slice(11, 16);
  await call({ name: "reset", method: "POST", path: "/demo/reset" }, dispatcherToken);
  check((await clock()) === "15:30", "the server clock starts at the scenario checkpoint, 15:30");
  await page.goto(`${base}/dispatcher/queue?presenter=1`, { waitUntil: "networkidle" });
  const advanced = page.waitForResponse((response) => response.url().endsWith("/api/v1/demo/advance") && response.request().method() === "POST");
  await page.getByRole("button", { name: /Go to 16:00/ }).click();
  check((await advanced).status() === 200, "Go to next step is POST /demo/advance and the server answers 200");
  check((await clock()) === "16:00", "the server clock moved to 16:00");
  await page.getByText("16:00", { exact: false }).first().waitFor({ timeout: 5_000 }).catch(() => undefined);
  const reset = page.waitForResponse((response) => response.url().endsWith("/api/v1/demo/reset") && response.request().method() === "POST", { timeout: 60_000 });
  await page.getByRole("button", { name: "Reset demo" }).click();
  check((await reset).status() === 200, "Reset demo is POST /demo/reset and the server answers 200");
  check((await clock()) === "15:30", "the server clock is back at 15:30");
  check((await page.locator("aside[aria-label='Presenter control']").innerText()).includes("15:30"), "the screen's clock followed the server back to 15:30");

  // A rejected token: one redirect to sign-in, and the session is gone. Corrupt only the dispatcher's token.
  await page.evaluate(() => {
    const key = "wp.session.dispatcher";
    const session = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, unknown>;
    localStorage.setItem(key, JSON.stringify({ ...session, token: "not-a-real-token" }));
  });
  // The expiry event fires once per rejected request, and the dispatcher reads several things at once, so `navigate` can run
  // more than once. Every call is a `replace`, so what must hold is: one history entry, the person ends on /sign-in.
  await page.addInitScript(`window.__expired = 0; window.addEventListener("wp:session-expired", () => { window.__expired += 1; });`);
  const historyBefore = (await page.evaluate("history.length")) as number;
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForURL((url) => url.pathname.startsWith("/sign-in"), { timeout: 15_000 }).catch(() => undefined);
  check(new URL(page.url()).pathname.startsWith("/sign-in"), "a rejected dispatcher token sends the person to sign-in");
  check((await page.evaluate(() => localStorage.getItem("wp.session.dispatcher"))) === null, "and clears the dispatcher session");
  const expiredEvents = (await page.evaluate("window.__expired || 0")) as number;
  console.log(`     session-expired events fired: ${expiredEvents} (one per rejected request)`);
  check(((await page.evaluate("history.length")) as number) === historyBefore, "the redirect adds no history entry (every navigation is a replace)");
  check(expiredEvents >= 1, "the 401 reached the session listener");

  await browser.close();
  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed`);
    process.exit(1);
  }
  console.log("\nall checks passed");
}

void main();
