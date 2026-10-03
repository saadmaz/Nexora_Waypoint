/**
 * Confirms the production build opens with no network after one visit (driver prompt 4 section 8):
 * the service worker serves the app shell and the cached run, and a record saved offline is still
 * on the phone after a reload.
 *
 *   npm run build && npm run preview     (note the port)
 *   npm run test:offline -- --base http://localhost:4173
 *
 * Exits non-zero if any check fails. This is the part of the real-device check that a desktop
 * browser can do; the phone steps are in the README.
 */
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const index = args.indexOf("--base");
const base = index >= 0 ? args[index + 1] : "http://localhost:4173";

async function main() {
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

  // One visit online, long enough for the service worker to install and take control.
  await page.goto(`${base}/driver/run?at=04:45`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Acknowledge v4", { timeout: 15_000 });
  await page.evaluate("navigator.serviceWorker.ready.then(() => true)");
  await page.reload({ waitUntil: "networkidle" });
  const controlled = await page.evaluate<boolean>("navigator.serviceWorker.controller !== null");
  check(controlled, "the service worker controls the page after one visit");
  const persisted = await page.evaluate<boolean>("navigator.storage.persisted()");
  console.log(`info storage.persisted() = ${persisted} (the browser decides; the app asks at start)`);

  // The plan is downloaded and acknowledged while there is still coverage (the download needs it).
  await page.getByRole("button", { name: "Acknowledge v4" }).click();
  await page.getByRole("button", { name: "Acknowledge plan v4" }).click();
  await page.waitForTimeout(500);
  await page.goto(`${base}/driver/run?at=05:10`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start route" }).waitFor({ timeout: 15_000 });

  // No network from here on: the app must still open and show the cached run.
  await context.setOffline(true);
  await page.goto(`${base}/driver/run?at=05:10`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start route" }).waitFor({ timeout: 15_000 });
  const text = await body();
  check(text.includes("OUT084") && text.includes("OUT087"), "opened with no network: the cached run is on screen");

  // A record saved with no network survives a reload with no network.
  await page.getByRole("button", { name: "Start route" }).click();
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Departed", { timeout: 15_000 });
  check((await body()).includes("Departed"), "a departure recorded offline survives a reload offline");

  await page.goto(`${base}/driver/me`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  check(/MB used/i.test(await body()), "the Me tab shows storage used");

  await browser.close();
  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

void main();
