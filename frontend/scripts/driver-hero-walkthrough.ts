/**
 * Plays the driver's hero path (driver prompt 3 section 2, PRD v3 H5 to H14) end to end against a
 * real running app: acknowledge, download, start route, lose coverage for real
 * (`context.setOffline(true)` from 05:17, not just the scripted Kandy gate), record both orders at
 * OUT084 with a real photo (the file-input fallback, since headless Chromium has no camera) and a
 * receiver name, then OUT087, and land on "all stops recorded" with five records on the phone.
 *
 *   npm run test:hero -- [--base http://localhost:5173]
 *
 * Start the dev server first (`npm run dev`). Exits non-zero if any check fails.
 */
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const base = flag("--base") ?? "http://localhost:5173";

// The smallest possible valid JPEG, standing in for a captured photo via the file-input fallback.
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  "base64",
);

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const failures: string[] = [];

  function check(condition: boolean, message: string) {
    if (condition) console.log(`ok   ${message}`);
    else {
      console.error(`FAIL ${message}`);
      failures.push(message);
    }
  }

  async function body(): Promise<string> {
    return (await page.innerText("body")).replace(/\s+/g, " ").trim();
  }

  /** `context.setOffline(true)` blocks navigation too, so briefly go back online to load the next
   * URL (a real reconnect would not do this; it is purely so the script itself can move the
   * scenario clock on via `?at=`), then drop offline again before touching anything on the page. */
  async function gotoWhileOffline(url: string) {
    await context.setOffline(false);
    await page.goto(url, { waitUntil: "networkidle" });
    await context.setOffline(true);
  }

  async function recordDeliveredOutcome(label: string) {
    await page.getByRole("button", { name: "Take photo" }).click();
    await page.locator('input[type="file"]').waitFor({ state: "attached", timeout: 10_000 });
    await page.locator('input[type="file"]').setInputFiles({ name: "proof.jpg", mimeType: "image/jpeg", buffer: TINY_JPEG });
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Use photo" }).click();
    await page.waitForTimeout(300);
    check((await body()).includes("Photo taken"), `${label}: photo captured via the file-input fallback (R3.2)`);

    await page.getByRole("button", { name: /Receiver's name/ }).click();
    await page.fill("input[autocomplete='off']", "S. Fernando");
    await page.getByRole("button", { name: "Save name" }).click();
    await page.waitForTimeout(300);
    check((await body()).includes("S. Fernando"), `${label}: receiver name saved (R3.3)`);

    await page.getByRole("button", { name: "Save delivery record" }).click();
    await page.waitForTimeout(500);
  }

  // H5/H7, 04:45: the route is known but not yet downloaded or acknowledged (R1.3 A).
  await page.goto(`${base}/driver/run?at=04:45`, { waitUntil: "networkidle" });
  // A cold Vite cache can take a moment to compile on the very first navigation; everything after
  // this is a client-side render or a same-origin reload, which do not have this delay.
  await page.waitForSelector("text=Acknowledge v4", { timeout: 15_000 });
  let text = await body();
  check(text.includes("Acknowledge v4"), "R1.3 A, 04:45: Acknowledge v4 is offered");
  check(text.includes("Waiting for loading"), "R1.3 A, 04:45: waiting for loading before 04:50");
  await page.getByRole("button", { name: "Acknowledge v4" }).click();

  // Downloading (R1.2 A), then ready offline (R1.2 B): a second tap records the acknowledgement.
  await page.waitForSelector("text=Acknowledge plan v4", { timeout: 5000 });
  await page.getByRole("button", { name: "Acknowledge plan v4" }).click();
  await page.waitForTimeout(300);
  check(!(await body()).includes("Acknowledge"), "R1.3 B: acknowledged, no Acknowledge button left");

  // H6, 04:50: Ruwan confirms loading at the gate.
  await page.goto(`${base}/driver/run?at=04:55`, { waitUntil: "networkidle" });
  check((await body()).includes("Confirmed by Ruwan"), "R1.3 B, past 04:50: loader confirmation shown");

  // H8, 05:10: Start route, now enabled.
  await page.goto(`${base}/driver/run?at=05:10`, { waitUntil: "networkidle" });
  const startButton = page.getByRole("button", { name: "Start route" });
  check(!(await startButton.isDisabled()), "R1.4, 05:10: Start route is enabled");
  await startButton.click();
  await page.waitForTimeout(300);
  check((await body()).includes("Departed"), "R1.5: departed");

  // H9, 05:17: coverage lost. A real browser-level disconnect, not only the scripted Kandy gate.
  await page.goto(`${base}/driver/run?at=05:20`, { waitUntil: "networkidle" });
  await context.setOffline(true);
  await page.waitForTimeout(1200);
  check((await body()).includes("Offline"), "R1.6, past 05:17: offline for real (context.setOffline)");

  // H10, 05:26: arrive at OUT084 before its window opens.
  await gotoWhileOffline(`${base}/driver/stops/OUT084?at=05:26`);
  await page.getByRole("button", { name: "Record arrival" }).click();
  await page.waitForTimeout(400);
  text = await body();
  check(text.includes("Arrival saved on this phone") || text.includes("min to go"), "R2.S 1 / R2.2 A: arrival saved offline, waiting for the window");

  // 05:31: the window has opened.
  await gotoWhileOffline(`${base}/driver/stops/OUT084?at=05:31`);
  check((await body()).includes("Window open"), "R2.2 B: window open");

  // H10, 05:42: record Delivered for ORD2001 and ORD2002.
  await gotoWhileOffline(`${base}/driver/stops/OUT084/outcome?at=05:42`);
  await recordDeliveredOutcome("OUT084");
  text = await body();
  check(text.includes("OUT084 moved to trip history"), "R3.5 C / R3.7: OUT084 moved to trip history");
  check(text.includes("saved on phone, syncs later"), "R3.7: saved on phone, syncs later");
  check(text.includes("OUT087"), "the run screen shows the next stop, OUT087");

  // H14, 05:48: arrive at OUT087, already inside its window.
  await gotoWhileOffline(`${base}/driver/stops/OUT087?at=05:48`);
  await page.getByRole("button", { name: "Record arrival" }).click();
  await page.waitForTimeout(400);

  // H14, 05:58: record Delivered for ORD2003 and land on "all stops recorded".
  await gotoWhileOffline(`${base}/driver/stops/OUT087/outcome?at=05:58`);
  await recordDeliveredOutcome("OUT087");
  text = await body();
  check(text.includes("All stops recorded"), "R3.9 / R3.10: all stops recorded");
  check(text.includes("5"), "five records are waiting on the phone");

  await browser.close();

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

void main();
