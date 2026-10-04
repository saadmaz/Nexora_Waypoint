/**
 * Confirms the production build works with no network after one visit (driver prompt 4 section 8, PRD v3 section 15), against
 * the real API, which is all a production build runs (70d00cf):
 *
 *   1. The service worker controls the page after one visit, and the run is cached on the phone.
 *   2. With no network the app still opens and shows the run; a departure recorded offline survives a reload offline.
 *   3. Back online, that departure reaches the server: the live board sees VEH039 departed.
 *
 * The script puts the server in the right place first (demo reset, plan released at 23:40, VEH039 loaded at 04:50, clock at
 * 05:05), so run it on a database you do not mind re-seeding. The build must reach the API from its own origin:
 *
 *   docker compose up -d --build db api          (with http://localhost:4173 in CORS_ORIGINS)
 *   VITE_API_BASE=http://localhost:8000 npm run build && npm run preview
 *   npm run test:offline -- --base http://localhost:4173 [--api http://localhost:8000] [--password waypoint-demo]
 *
 * Exits non-zero if any check fails. This is the part of the real-device check that a desktop browser can do; the phone
 * steps are in the README.
 */
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const base = flag("--base") ?? "http://localhost:4173";
const api = `${flag("--api") ?? "http://localhost:8000"}/api/v1`;
const PASSWORD = flag("--password") ?? "waypoint-demo";

async function token(email: string): Promise<string> {
  const res = await fetch(`${api}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  if (!res.ok) throw new Error(`${email} could not sign in (${res.status}). Pass --password if DEMO_PASSWORD is not ${PASSWORD}.`);
  return ((await res.json()) as { accessToken: string }).accessToken;
}

async function call(tok: string, method: string, path: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: { Authorization: `Bearer ${tok}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} answered ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

/** The server's side: reset, release at 23:40, the dock confirms VEH039 loaded, clock at 05:05. Returns the version and stops. */
async function setUpServer(): Promise<{ version: number; outlets: string[]; dispatcher: string }> {
  const dispatcher = await token("dispatcher@waypoint.demo");
  const loader = await token("loader@waypoint.demo");
  await call(dispatcher, "POST", "/demo/reset");
  await call(dispatcher, "POST", "/demo/advance", { to: "2026-09-28T23:40:00+05:30" });
  const plan = await call(dispatcher, "POST", "/dispatcher/plan/release?depot=kandy", { sendNotices: true });
  const version = (plan.version as { number: number }).number;
  const lanes = plan.lanes as { vehicleId: string; trips: { trip: number; stops: { outletId: string }[] }[] }[];
  const outlets = lanes.find((l) => l.vehicleId === "VEH039")?.trips.find((t) => t.trip === 1)?.stops.map((s) => s.outletId) ?? [];
  if (outlets.length === 0) throw new Error(`VEH039 has no trip 1 in plan v${version}`);
  await call(dispatcher, "POST", "/demo/advance", { to: "2026-09-29T04:50:00+05:30" });
  await call(loader, "POST", "/sync", {
    deviceId: "tablet-kandy",
    records: [
      {
        clientId: crypto.randomUUID(),
        type: "loader.confirmLoaded",
        payload: { vehicleId: "VEH039", trip: 1, personId: "Ruwan", personName: "Ruwan" },
        deviceTime: "2026-09-29T04:50:00+05:30",
        actor: "Ruwan",
      },
    ],
  });
  await call(dispatcher, "POST", "/demo/advance", { to: "2026-09-29T05:05:00+05:30" });
  return { version, outlets, dispatcher };
}

async function veh039Departed(dispatcher: string): Promise<boolean> {
  const board = await call(dispatcher, "GET", "/dispatcher/live?depot=kandy&all=true");
  const row = (board.rows as { vehicleId: string; status: string }[]).find((r) => r.vehicleId === "VEH039");
  return row?.status === "Departed";
}

async function main() {
  const health = await fetch(`${api}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`FAIL the API is not answering at ${api}. Start it with: docker compose up -d --build db api`);
    process.exit(1);
  }
  const { version, outlets, dispatcher } = await setUpServer();

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const failures: string[] = [];
  const check = (condition: boolean, message: string) => {
    if (condition) console.log(`ok   ${message}`);
    else {
      console.error(`FAIL ${message}`);
      failures.push(message);
    }
  };
  const body = async () => (await page.innerText("body")).replace(/\s+/g, " ").trim();

  // Every role area is behind sign-in (route guards, a547006): sign in as the driver from the demo rows first.
  await page.goto(`${base}/sign-in`, { waitUntil: "networkidle" });
  await page.getByText("driver@waypoint.demo").click();
  await page.waitForURL(/\/driver\//, { timeout: 15_000 });

  // One visit online, long enough for the service worker to install and take control.
  await page.goto(`${base}/driver/run`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: `Acknowledge v${version}` }).waitFor({ timeout: 15_000 });
  await page.evaluate("navigator.serviceWorker.ready.then(() => true)");
  await page.reload({ waitUntil: "networkidle" });
  const controlled = await page.evaluate<boolean>("navigator.serviceWorker.controller !== null");
  check(controlled, "the service worker controls the page after one visit");
  const persisted = await page.evaluate<boolean>("navigator.storage.persisted()");
  console.log(`info storage.persisted() = ${persisted} (the browser decides; the app asks at start)`);

  // The plan is downloaded and acknowledged while there is still coverage (the download needs it).
  await page.getByRole("button", { name: `Acknowledge v${version}` }).click();
  await page.getByRole("button", { name: `Acknowledge plan v${version}` }).click();
  await page.getByRole("button", { name: "Start route", disabled: false }).waitFor({ timeout: 15_000 });

  // No network from here on: the app must still open and show the cached run.
  await context.setOffline(true);
  await page.goto(`${base}/driver/run`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start route" }).waitFor({ timeout: 15_000 });
  const text = await body();
  check(outlets.every((outlet) => text.includes(outlet)), `opened with no network: the cached run is on screen (${outlets.join(", ")})`);

  // A record saved with no network survives a reload with no network, and has not reached the server.
  await page.getByRole("button", { name: "Start route" }).click();
  await page.waitForSelector("text=Departed", { timeout: 15_000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Departed", { timeout: 15_000 });
  check((await body()).includes("Departed"), "a departure recorded offline survives a reload offline");
  check(!(await veh039Departed(dispatcher)), "while the phone is offline the server has not heard of the departure");

  await page.goto(`${base}/driver/me`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  check(/MB used/i.test(await body()), "the Me tab shows storage used");

  // Coverage returns: the outbox sends what it kept, and the server sees the departure.
  await context.setOffline(false);
  await page.goto(`${base}/driver/run`, { waitUntil: "networkidle" });
  let reached = false;
  for (let i = 0; i < 20 && !reached; i += 1) {
    reached = await veh039Departed(dispatcher);
    if (!reached) await page.waitForTimeout(1000);
  }
  check(reached, "back online, the departure recorded offline reaches the server (the live board shows VEH039 departed)");

  await browser.close();
  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

main().catch((error: unknown) => {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
