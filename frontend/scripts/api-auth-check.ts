/**
 * Plays sign-in against the REAL backend (API wiring W2). It is the acceptance test for `VITE_AUTH_API=api`:
 * the four demo accounts sign in with the real password, land on their role home, hold four real JWTs at once, the
 * wrong-password and server-down cases behave, a rejected token signs out only its own role, and a store route answers
 * with the store's own data from the database.
 *
 *   docker compose up -d --build db api                           (the API on http://localhost:8000)
 *   VITE_AUTH_API=api npm run dev -- --port 5191 --strictPort      (the app, in api mode)
 *   npm run test:api-auth -- --base http://localhost:5191 [--api http://localhost:8000]
 *
 * Exits non-zero if any check fails.
 */
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const base = flag("--base") ?? "http://localhost:5191";
const api = flag("--api") ?? "http://localhost:8000";
const PASSWORD = "waypoint-demo";
/** The app's own HTTP client, imported inside the page from the dev server. */
const CLIENT_MODULE = "/src/api/http/config.ts";

const ACCOUNTS = [
  { role: "dispatcher", email: "dispatcher@waypoint.demo", home: "/dispatcher/queue", name: "Kumari" },
  { role: "loader", email: "loader@waypoint.demo", home: "/loader/dock", name: "Dock tablet" },
  { role: "driver", email: "driver@waypoint.demo", home: "/driver/run", name: "Nimal" },
  { role: "store", email: "store@waypoint.demo", home: "/store/orders", name: "Anusha" },
] as const;

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

  /** Signs in through the form on a fresh page of the shared context, and returns where it landed. */
  async function signInThroughForm(email: string, password: string) {
    const page = await context.newPage();
    await page.goto(`${base}/sign-in`, { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    return page;
  }

  // 1. The four demo accounts sign in with the real password and land on their role home.
  for (const account of ACCOUNTS) {
    const page = await signInThroughForm(account.email, PASSWORD);
    await page.waitForURL(`**${account.home}`, { timeout: 15_000 }).catch(() => undefined);
    check(new URL(page.url()).pathname === account.home, `${account.role}: signed in and landed on ${account.home}`);
    await page.close();
  }

  // 2. All four sessions coexist, each a real JWT (three dot-separated parts), never the mock's "demo." token.
  const probe = await context.newPage();
  await probe.goto(`${base}/sign-in`, { waitUntil: "domcontentloaded" });
  const sessions = await probe.evaluate(() => {
    const out: Record<string, { token: string; displayName: string; role: string }> = {};
    for (const role of ["dispatcher", "loader", "driver", "store"]) {
      const raw = localStorage.getItem(`wp.session.${role}`);
      if (raw) out[role] = JSON.parse(raw);
    }
    return out;
  });
  for (const account of ACCOUNTS) {
    const session = sessions[account.role];
    check(Boolean(session) && session.token.split(".").length === 3 && !session.token.startsWith("demo."), `${account.role}: a real JWT is stored under wp.session.${account.role}`);
    check(session?.displayName === account.name && session?.role === account.role, `${account.role}: the session carries the backend's name and role (${account.name})`);
  }

  // 3. Each stored token is accepted by the backend, and /me agrees with the role.
  for (const account of ACCOUNTS) {
    const res = await fetch(`${api}/api/v1/me`, { headers: { Authorization: `Bearer ${sessions[account.role]?.token}` } });
    const me = (await res.json()) as { role?: string; email?: string };
    check(res.status === 200 && me.role === account.role && me.email === account.email, `${account.role}: GET /me accepts the stored token and returns ${account.role}`);
  }

  // 4. A wrong password shows the existing message, keeps the email, and stores nothing new.
  await context.clearCookies();
  await probe.evaluate(() => localStorage.clear());
  const wrong = await signInThroughForm("driver@waypoint.demo", "not-the-password");
  await wrong.getByText("Email or password is wrong. Check both and try again.").waitFor({ timeout: 10_000 }).catch(() => undefined);
  check(await wrong.getByText("Email or password is wrong. Check both and try again.").isVisible(), "wrong password: the sign-in message shows");
  check((await wrong.getByLabel("Email").inputValue()) === "driver@waypoint.demo", "wrong password: the email stays");
  check((await wrong.evaluate(() => localStorage.getItem("wp.session.driver"))) === null, "wrong password: no session is stored");
  await wrong.close();

  // 5. The old demo password (before this branch) no longer works.
  const old = await signInThroughForm("driver@waypoint.demo", "waypoint");
  await old.getByText("Email or password is wrong. Check both and try again.").waitFor({ timeout: 10_000 }).catch(() => undefined);
  check(await old.getByText("Email or password is wrong. Check both and try again.").isVisible(), 'the old password "waypoint" is rejected');
  await old.close();

  // 6. The server cannot be reached: the offline notice shows, nothing is stored, and pressing Sign in again works once it is back.
  const down = await context.newPage();
  await down.route("**/api/v1/auth/login", (route) => route.abort("connectionrefused"));
  await down.goto(`${base}/sign-in`, { waitUntil: "networkidle" });
  await down.getByLabel("Email").fill("driver@waypoint.demo");
  await down.getByLabel("Password").fill(PASSWORD);
  await down.getByRole("button", { name: "Sign in", exact: true }).click();
  await down.getByText("You're offline").waitFor({ timeout: 10_000 }).catch(() => undefined);
  check(await down.getByText("You're offline").isVisible(), "server unreachable: the offline notice shows");
  check((await down.evaluate(() => localStorage.getItem("wp.session.driver"))) === null, "server unreachable: no session is stored");
  check(!(await down.getByRole("button", { name: "Sign in", exact: true }).isDisabled()), "server unreachable: the button stays enabled, so the person can try again");
  await down.unroute("**/api/v1/auth/login");
  await down.getByRole("button", { name: "Sign in", exact: true }).click();
  await down.waitForURL("**/driver/run", { timeout: 15_000 }).catch(() => undefined);
  check(new URL(down.url()).pathname === "/driver/run", "server back: the same form signs in");

  // 7. A rejected token signs out its own role only, and sends the person to sign-in. The call is made through the
  //    app's own client, loaded from the dev server, so this is the real 401 -> clear -> event -> redirect chain.
  const store = await context.newPage();
  await store.goto(`${base}/sign-in`, { waitUntil: "networkidle" });
  await store.getByLabel("Email").fill("store@waypoint.demo");
  await store.getByLabel("Password").fill(PASSWORD);
  await store.getByRole("button", { name: "Sign in", exact: true }).click();
  await store.waitForURL("**/store/orders", { timeout: 15_000 });
  await down.bringToFront();
  await down.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("wp.session.driver") as string);
    localStorage.setItem("wp.session.driver", JSON.stringify({ ...raw, token: `${raw.token}x` }));
  });
  const expired = await down.evaluate(async (module) => {
    const { apiClient } = await import(/* @vite-ignore */ module);
    try {
      await apiClient("driver").get("/api/v1/me");
      return "no error";
    } catch (error) {
      const e = error as { name?: string; status?: number; code?: string };
      return `${e.name} ${e.status} ${e.code}`;
    }
  }, CLIENT_MODULE);
  check(expired === "ApiError 401 unauthenticated", `a tampered token: the backend answers 401 (${expired})`);
  await down.waitForURL("**/sign-in", { timeout: 10_000 }).catch(() => undefined);
  check(new URL(down.url()).pathname === "/sign-in", "a tampered token: the driver is sent to /sign-in");
  check((await down.evaluate(() => localStorage.getItem("wp.session.driver"))) === null, "a tampered token: the driver's session is cleared");
  check((await store.evaluate(() => localStorage.getItem("wp.session.store"))) !== null, "a tampered token: the store session is untouched");
  check(new URL(store.url()).pathname === "/store/orders", "a tampered token: the store tab is not moved");

  // 8. A store route answers from the database with the store's own token, and the session is kept.
  await store.bringToFront();
  const feed = await store.evaluate(async (module) => {
    const { apiClient } = await import(/* @vite-ignore */ module);
    try {
      const out = await apiClient("store").get("/api/v1/store/updates");
      return `feed unread=${typeof out.unread} updates=${Array.isArray(out.updates)}`;
    } catch (error) {
      const e = error as { name?: string; status?: number; code?: string };
      return `${e.name} ${e.status} ${e.code}`;
    }
  }, CLIENT_MODULE);
  check(feed === "feed unread=number updates=true", `a built route: the store's updates feed comes back (${feed})`);
  check((await store.evaluate(() => localStorage.getItem("wp.session.store"))) !== null, "a built route: the session is kept");

  // 9. The scenario clock, round-trips through the typed client.
  const clock = await store.evaluate(async (module) => {
    const { apiClient } = await import(/* @vite-ignore */ module);
    const out = await apiClient("store").get("/api/v1/clock");
    return `${out.now} ${out.serviceDate}`;
  }, CLIENT_MODULE);
  check(/^2026-09-2\d.* 2026-09-\d\d$/.test(clock), `GET /clock round-trips through the typed client (${clock})`);

  await browser.close();
  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

void main();
