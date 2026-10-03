/**
 * Plays the role clients against the REAL backend (API wiring W3 to W5). It is the acceptance test for
 * `VITE_STORE_API=api`, `VITE_DRIVER_API=api` and `VITE_LOADER_API=api`, as far as the backend can answer today.
 *
 * Only auth, `/me` and the clock are built on the backend; every other route answers 501. So this proves what can be proven:
 *   - each role's provider really switches to the real client, and the screen's first read goes to the real route with that
 *     role's own bearer token (a role that is not signed in makes no request at all);
 *   - the fetch transport reaches the real API: `driver.getMe` is a live 200, `driver.getRun` and `driver.sync` come back as the
 *     typed 501, and a device that is offline fails with the NetworkError the outbox already handles, with no request made;
 *   - a driver record sent to `/sync` stays in the outbox as an error (to retry), never lost and never accepted by accident.
 * Whatever a route returns beyond that needs the backend branches to land first.
 *
 *   docker compose up -d --build db api                                   (the API on http://localhost:8000)
 *   VITE_AUTH_API=api VITE_STORE_API=api VITE_DRIVER_API=api VITE_LOADER_API=api npm run dev -- --port 5192 --strictPort
 *   npm run test:api-roles -- --base http://localhost:5192 [--api http://localhost:8000]
 *
 * The API must allow the app's origin: start it with CORS_ORIGINS including http://localhost:5192 (see the README, "API mode").
 * Exits non-zero if any check fails.
 */
import { chromium, type Page } from "@playwright/test";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const base = flag("--base") ?? "http://localhost:5192";
const api = flag("--api") ?? "http://localhost:8000";
const PASSWORD = "waypoint-demo";
const OFFLINE_MODULE = "/src/field/offline/index.ts";
const CLIENT_MODULE = "/src/api/http/config.ts";

const ROLES = [
  { role: "store", email: "store@waypoint.demo", open: "/store/orders", route: /\/api\/v1\/store\/(updates|order-form|deliveries)/ },
  { role: "driver", email: "driver@waypoint.demo", open: "/driver/run", route: /\/api\/v1\/driver\/(runs\/|me)|\/api\/v1\/me/ },
  { role: "loader", email: "loader@waypoint.demo", open: "/loader/dock?dock=peliyagoda", route: /\/api\/v1\/loader\/docks\/peliyagoda/ },
] as const;

type Seen = { url: string; method: string; auth: string | undefined; status?: number };

async function main() {
  const health = await fetch(`${api}/api/v1/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`FAIL the API is not answering at ${api}. Start it with: docker compose up -d --build db api`);
    process.exit(1);
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const failures: string[] = [];
  const check = (condition: boolean, message: string) => {
    if (condition) console.log(`ok   ${message}`);
    else {
      console.error(`FAIL ${message}`);
      failures.push(message);
    }
  };

  /** Records every request the page makes to the API, with the status it got. */
  function watch(page: Page): Seen[] {
    const seen: Seen[] = [];
    page.on("request", (request) => {
      if (request.url().startsWith(api)) seen.push({ url: request.url(), method: request.method(), auth: request.headers().authorization });
    });
    page.on("response", (response) => {
      const entry = seen.find((s) => s.url === response.url() && s.status === undefined);
      if (entry) entry.status = response.status();
    });
    return seen;
  }

  async function signIn(email: string): Promise<Page> {
    const page = await context.newPage();
    await page.goto(`${base}/sign-in`, { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 15_000 });
    return page;
  }

  // 1. Each role's screens call the real API, as that role, on first load. The screen shows the typed error, not fixtures.
  for (const account of ROLES) {
    const page = await signIn(account.email);
    const seen = watch(page);
    const token = await page.evaluate((role) => (JSON.parse(localStorage.getItem(`wp.session.${role}`) ?? "{}") as { token?: string }).token, account.role);
    await page.goto(`${base}${account.open}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const hit = seen.find((s) => account.route.test(s.url));
    check(hit !== undefined, `${account.role}: the first screen read goes to the real API (${hit ? new URL(hit.url).pathname : "no request seen"})`);
    check(hit?.auth === `Bearer ${token}`, `${account.role}: that request carries this role's own token`);
    const stuck = seen.filter((s) => s.status === 501 || s.status === 403).map((s) => `${s.method} ${new URL(s.url).pathname} ${s.status}`);
    console.log(`     ${account.role}: unbuilt routes answered ${stuck.length > 0 ? stuck.join("; ") : "none"}`);
    await page.close();
  }

  // 2. The fetch transport, driven the way the sync engine drives it, from inside the app (the dev server serves the real modules).
  const driver = await signIn("driver@waypoint.demo");
  const results = await driver.evaluate(
    async ([offlineModule, clientModule]) => {
      const offline = await import(/* @vite-ignore */ offlineModule);
      const { apiClient } = await import(/* @vite-ignore */ clientModule);
      const out: Record<string, string> = {};
      const describe = (error: unknown) => {
        const e = error as { name?: string; status?: number; operation?: string; code?: string };
        return `${e.name} ${e.status ?? ""} ${e.operation ?? e.code ?? ""}`.trim();
      };

      out.installed = String(offline.installFieldTransport());

      try {
        const me = await offline.request("driver.getMe");
        out.getMe = `${(me as { role: string }).role} ${(me as { depot: string }).depot}`;
      } catch (error) {
        out.getMe = describe(error);
      }
      try {
        await offline.request("driver.getRun", { date: "2026-09-29" });
        out.getRun = "no error";
      } catch (error) {
        out.getRun = describe(error);
      }

      // A real outbox record through the real sync handler: the server answers 501, so the record must stay, as an error.
      offline.registerApiSyncHandlers("driver", ["driver.arrival"]);
      const record = await offline.enqueue({ type: "driver.arrival", payload: { date: "2026-09-29", outletId: "OUT084", at: "05:40" }, actor: "nimal", planVersionOnDevice: 4 });
      await offline.runSync({ force: true });
      const saved = await offline.getRecord(record.clientId);
      out.record = `${saved?.status} ${saved?.attempts} ${saved?.lastError ?? ""}`.trim();
      out.clientIdKept = String(saved?.clientId === record.clientId);

      // Offline: no request is made, and the failure is the NetworkError the outbox handles.
      await offline.connectivity.setSimulatedOffline(true);
      const before = performance.getEntriesByType("resource").length;
      try {
        await offline.request("driver.getMe");
        out.offline = "no error";
      } catch (error) {
        out.offline = `${describe(error)} requests=${performance.getEntriesByType("resource").length - before}`;
      }
      await offline.connectivity.setSimulatedOffline(false);

      try {
        await apiClient("driver").get("/api/v1/clock");
        out.clock = "driver token accepted";
      } catch (error) {
        out.clock = describe(error);
      }
      return out;
    },
    [OFFLINE_MODULE, CLIENT_MODULE],
  );
  check(results.installed === "true", "the routing transport installs when a field role is on the API");
  check(results.getMe === "driver kandy", `driver.getMe is a live 200 through the transport (${results.getMe})`);
  check(results.getRun === "NotImplementedApiError 501 getRun", `driver.getRun comes back as the typed 501 (${results.getRun})`);
  // The running engine may already have tried once when the record was saved, so only "error, tried, with the server's reason" is asserted.
  check(/^error [1-9]\d* sync is not built yet$/.test(results.record ?? ""), `a record the server cannot take yet stays in the outbox as an error (${results.record})`);
  check(results.clientIdKept === "true", "the record keeps its clientId");
  check(results.offline?.startsWith("NetworkError") === true && results.offline.endsWith("requests=0"), `offline: a NetworkError and no request (${results.offline})`);
  check(results.clock === "driver token accepted", "GET /clock round-trips through the driver client");
  await driver.close();

  // 3. A role that is not signed in makes no request: the route guard is the client.
  const signedOut = await context.newPage();
  await signedOut.goto(`${base}/sign-in`, { waitUntil: "domcontentloaded" });
  await signedOut.evaluate(() => localStorage.clear());
  const seenOut = watch(signedOut);
  await signedOut.goto(`${base}/store/orders`, { waitUntil: "networkidle" });
  await signedOut.waitForTimeout(1000);
  check(seenOut.every((s) => !/\/api\/v1\/store\//.test(s.url)), "signed out: the store screen makes no store request");
  await signedOut.close();

  await browser.close();
  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed`);
    process.exit(1);
  }
  console.log("\nall checks passed");
}

void main();
