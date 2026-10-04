/**
 * Shoots the loader screens at every size the PRD names (§15) and fails on anything a small screen must never do.
 *
 * The booklet judges phone-sized screens, so the frames are 390 x 844 (L2 scroll variants to 390 x 1,360) and the
 * L1.7 tablet is 1024 x 768. `LoaderApp` switches to the master-detail layout at `min-width: 1024px`, so an iPad in
 * portrait (768) gets the phone layout and only landscape gets the tablet one. Both are shot.
 *
 * Per size and screen it checks three things and writes a PNG:
 *   - nothing scrolls sideways (`scrollWidth` wider than `clientWidth`);
 *   - no console error and no uncaught exception;
 *   - every tap target is at least 44 px, the smallest a gloved hand on a dock tablet can hit.
 *
 * It signs in against the real API and injects the session, so it lands straight on the dock:
 *
 *   cd backend && DATABASE_URL=... DEMO_PASSWORD=waypoint-demo .venv/bin/uvicorn app.main:app --port 8000
 *   VITE_AUTH_API=api VITE_LOADER_API=api npm run dev
 *   npm run test:loader-devices -- --base http://localhost:5173 --api http://localhost:8000
 *
 * Exits non-zero if any check fails, so CI can run it. Add `--out <dir>` to put the PNGs somewhere else.
 */
import { mkdirSync } from "node:fs";

import { chromium, type Browser, type Page } from "@playwright/test";

const args = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const base = flag("--base", "http://localhost:5173");
const api = flag("--api", "http://localhost:8000");
const outDir = flag("--out", "device-shots");
const PASSWORD = flag("--password", "waypoint-demo");

/** CSS pixels and device pixel ratio: the two numbers that decide what the layout does. */
const DEVICES = [
  { name: "phone-390x844-prd-frame", width: 390, height: 844, dpr: 3 },
  { name: "phone-390x1360-long-scroll", width: 390, height: 1360, dpr: 3 },
  { name: "iphone-16-pro-max-440x956", width: 440, height: 956, dpr: 3 },
  { name: "iphone-16-pro-max-landscape", width: 956, height: 440, dpr: 3 },
  { name: "ipad-portrait-768x1024-phone-layout", width: 768, height: 1024, dpr: 2 },
  { name: "tablet-1024x768-L1.7", width: 1024, height: 768, dpr: 2 },
];

/** The dock is a device setting, so `?dock=` picks it without the picker (`LoaderProvider`). */
type Screen = { name: string; path: string; open?: (page: Page) => Promise<void> };

const SCREENS: Screen[] = [
  { name: "L1-dock-peliyagoda", path: "/loader/dock?dock=peliyagoda" },
  { name: "L1-dock-kandy", path: "/loader/dock?dock=kandy" },
  {
    name: "L1.2-pin-sheet",
    path: "/loader/dock?dock=peliyagoda",
    open: async (page) => {
      await page.getByRole("button", { name: /acknowledge plan/i }).first().click();
      // The people are chips rather than buttons, so wait for the sheet itself and then the name on it.
      await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
      await page.getByText("Priya", { exact: true }).first().waitFor({ state: "visible", timeout: 5000 });
    },
  },
  { name: "L2-load-plan", path: `/loader/vehicles/${flag("--vehicle", "VEH001")}/trips/1?dock=peliyagoda` },
  { name: "L4-changes", path: "/loader/changes?dock=peliyagoda" },
  { name: "me", path: "/loader/me?dock=peliyagoda" },
];

/** Smaller than this is not a reliable tap target on a dock tablet. */
const MIN_TAP_PX = 44;

async function session(): Promise<string> {
  const res = await fetch(`${api}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "loader@waypoint.demo", password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}. Is the API up on ${api}?`);
  const body = (await res.json()) as { accessToken: string; displayName?: string };
  return JSON.stringify({
    role: "loader",
    email: "loader@waypoint.demo",
    displayName: body.displayName ?? "Dock tablet",
    token: body.accessToken,
    signedInAt: new Date().toISOString(),
  });
}

/** Measured through Playwright rather than in the page, so this stays a Node script with no DOM types. */
async function tooSmall(page: Page): Promise<string[]> {
  const bad: string[] = [];
  for (const target of await page.locator("button, a[href], [role='button']").all()) {
    const box = await target.boundingBox();
    if (box === null) continue; // not rendered
    if (box.height < MIN_TAP_PX || box.width < MIN_TAP_PX) {
      const label = (await target.innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 24);
      bad.push(`${label || "(no label)"} ${Math.round(box.width)}x${Math.round(box.height)}`);
    }
  }
  return [...new Set(bad)];
}

async function run(browser: Browser, stored: string): Promise<string[]> {
  const failures: string[] = [];
  for (const device of DEVICES) {
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.dpr,
      isMobile: true,
      hasTouch: true,
      colorScheme: "dark",
    });
    await context.addInitScript(
      ([key, value]) => localStorage.setItem(key as string, value as string),
      ["wp.session.loader", stored],
    );
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    page.on("pageerror", (error) => errors.push(String(error)));

    for (const screen of SCREENS) {
      errors.length = 0;
      await page.goto(base + screen.path, { waitUntil: "networkidle" });
      if (screen.open) {
        try {
          await screen.open(page);
        } catch (error) {
          failures.push(`${device.name} ${screen.name}: could not open (${String(error).split("\n")[0]})`);
          continue;
        }
      }
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${outDir}/${device.name}__${screen.name}.png` });

      // Evaluated as source text, the way scripts/api-dispatcher-check.ts reads history.length: no DOM types needed.
      const box = {
        scrollWidth: (await page.evaluate("document.documentElement.scrollWidth")) as number,
        clientWidth: (await page.evaluate("document.documentElement.clientWidth")) as number,
      };
      const bleeds = box.scrollWidth > box.clientWidth + 1;
      const small = await tooSmall(page);
      // Read the page back, so a blank screen can never pass as a pass.
      const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();

      const notes = [
        bleeds ? `SIDEWAYS ${box.scrollWidth}>${box.clientWidth}` : "ok",
        small.length ? `SMALL TAPS ${small.length}` : "",
        errors.length ? `ERRORS ${errors.length}` : "",
      ].filter(Boolean);
      console.log(`${device.name.padEnd(36)} ${screen.name.padEnd(20)} ${notes.join(" ")} | ${text.slice(0, 48)}`);

      if (bleeds) failures.push(`${device.name} ${screen.name}: scrolls sideways (${box.scrollWidth} > ${box.clientWidth})`);
      if (!text) failures.push(`${device.name} ${screen.name}: rendered nothing`);
      if (small.length) failures.push(`${device.name} ${screen.name}: tap targets under ${MIN_TAP_PX}px: ${small.join(", ")}`);
      if (errors.length) failures.push(`${device.name} ${screen.name}: ${errors[0]}`);
    }
    await context.close();
  }
  return failures;
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  const failures = await run(browser, await session());
  console.log(`\nshots in ${outDir}`);
  if (failures.length) {
    console.log(`\n${failures.length} problem(s):`);
    for (const failure of failures) console.log("  -", failure);
    process.exitCode = 1;
  } else {
    console.log("every size: no sideways scroll, no small tap targets, no console errors");
  }
} finally {
  await browser.close();
}
