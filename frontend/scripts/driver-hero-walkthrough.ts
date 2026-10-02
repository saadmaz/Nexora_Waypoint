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
    await page.waitForURL(/\/driver\/run/, { timeout: 10_000 });
    await page.waitForTimeout(800);
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
  // The acknowledgement and the departure go out while the phone still has coverage: wait for the
  // Outbox to say so before the script drops the connection (a reload would otherwise race the send).
  await page.getByRole("button", { name: /^(Online|Synced)/ }).first().click();
  await page.getByRole("dialog", { name: "Outbox" }).getByText("Nothing waiting - everything is synced.").waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("dialog", { name: "Outbox" }).waitFor({ state: "detached", timeout: 5_000 });

  // H9, 05:17: coverage lost. A real browser-level disconnect, not only the scripted Kandy gate.
  await page.goto(`${base}/driver/run?at=05:20`, { waitUntil: "networkidle" });
  // The departure and the plan acknowledgement went out while the phone still had coverage.
  await page.waitForTimeout(2000);
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

  // R4.1: the chip opens the Outbox with every record of the run and the Simulate offline switch.
  await page.getByRole("button", { name: /Offline/ }).first().click();
  await page.getByRole("dialog", { name: "Outbox" }).waitFor({ timeout: 5_000 });
  const outbox = (await page.getByRole("dialog", { name: "Outbox" }).innerText()).replace(/\s+/g, " ");
  if (!outbox.includes("5 records waiting - they")) console.log("OUTBOX>", outbox);
  check(outbox.includes("5 records waiting - they send automatically when you're back in coverage."), "R4.1: five records waiting, sends automatically");
  check(/05:10 Departed Synced/.test(outbox), "R4.1: Departed 05:10 is Synced (it left before coverage dropped)");
  check(["Arrival OUT084", "Delivered ORD2001", "Delivered ORD2002", "Arrival OUT087", "Delivered ORD2003"].every((row) => outbox.includes(row)), "R4.1: the five waiting records are listed");
  check((outbox.match(/Saved on phone/g) ?? []).length === 5, "R4.1: the five waiting records read Saved on phone");
  check(await page.getByRole("switch", { name: "Simulate offline" }).isVisible(), "R4.1: the Simulate offline switch is there");
  await page.getByRole("button", { name: "Send now" }).click();
  await page.waitForTimeout(300);
  check((await page.getByRole("dialog", { name: "Outbox" }).innerText()).includes("5 records waiting"), "R4.1: Send now while offline sends nothing and loses nothing");
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("dialog", { name: "Outbox" }).waitFor({ state: "detached", timeout: 5_000 });

  // H15, 06:40: coverage returns. The app's own Simulate offline switch is what holds the phone
  // offline across the reload (a browser-level setOffline would also block the page load), and
  // Send now is the driver pressing the button once the switch is off.
  await page.getByRole("button", { name: /Offline/ }).first().click();
  await page.getByRole("dialog", { name: "Outbox" }).waitFor({ timeout: 5_000 });
  await page.getByRole("switch", { name: "Simulate offline" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await context.setOffline(false);
  await page.goto(`${base}/driver/run?at=06:40&presenter=1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  check((await body()).includes("Offline"), "06:40: the phone is still offline behind the switch after a reload");
  check(!page.url().includes("sync-result"), "06:40: nothing syncs while Simulate offline is on");

  await page.getByRole("button", { name: /Offline/ }).first().click();
  await page.getByRole("dialog", { name: "Outbox" }).waitFor({ timeout: 5_000 });
  await page.getByRole("switch", { name: "Simulate offline" }).click();
  await page.waitForTimeout(300);
  // The presenter arms one failed photo upload, the WP-SYNC-409 branch (PRD section 13).
  await page.getByRole("switch", { name: "Fail next photo upload" }).click();
  await page.getByRole("button", { name: "Send now" }).click();

  // R4.2 then R5.1: the catch-up opens the sync result once.
  await page.waitForURL(/sync-result\?view=conflict/, { timeout: 15_000 });
  await page.waitForTimeout(500);
  text = await body();
  check(text.includes("3 synced · 1 stop (2 orders) sent for review"), "R5.1: 3 synced, 1 stop (2 orders) sent for review");
  check(text.includes("Dispatch deferred OUT084 at 05:21 at the store's request, while you were offline."), "R5.1: says Dispatch deferred OUT084 at 05:21, while the driver was offline");
  check(text.includes("Your delivery record is safe."), "R5.1: the delivery record is safe");
  check(text.includes("Delivered ORD2001 + ORD2002"), "R5.1: the two orders of OUT084 are one row");
  check(text.includes("Kumari · Dispatch"), "R5.1: who already knows");

  await page.getByRole("button", { name: "Back to run" }).click();
  await page.waitForURL(/\/driver\/run/, { timeout: 5_000 });
  await page.waitForTimeout(800);

  // R8.2: the photo of stop 1 could not be sent. The delivery record is safe; the photo stays on the phone.
  text = await body();
  check(text.includes("Couldn't send photo of stop 1. Kept on phone."), "R8.2: the run says the photo of stop 1 could not be sent");
  check(text.includes("Delivered 05:42 · photo still on phone") && text.includes("Photo on phone"), "R8.2: OUT084 reads photo still on phone");
  check(text.includes("1 on phone"), "R8.2: the run counts 1 on phone");
  await page.getByRole("button", { name: "Couldn't send photo of stop 1. Kept on phone." }).click();
  await page.waitForURL(/notifications\/photo\//, { timeout: 5_000 });
  await page.waitForTimeout(400);
  text = await body();
  check(text.includes("Couldn't send photo of stop 1") && text.includes("Your photo is kept on this phone. We keep retrying whenever you have signal."), "R8.3: what failed and what is safe");
  check(text.includes("Photo · OUT084"), "R8.3: names the photo");
  check(/Delivery record\s+Synced 06:4\d/i.test(text), "R8.3: the delivery record is already synced");
  check(text.includes("Ref WP-SYNC-409"), "R8.3: carries the reference WP-SYNC-409");
  await page.getByRole("button", { name: "View outbox" }).click();
  await page.getByRole("dialog", { name: "Outbox" }).waitFor({ timeout: 5_000 });
  check((await page.getByRole("dialog", { name: "Outbox" }).innerText()).includes("1 photo didn't send. Retrying automatically every 30 s."), "R4.3 2: the Outbox says a photo didn't send and the records stay Synced");
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("dialog", { name: "Outbox" }).waitFor({ state: "detached", timeout: 5_000 });

  // Try again sends the photo now; with the failure spent it goes, and the driver is taken back to the run.
  await page.getByRole("button", { name: "Try again" }).click();
  await page.waitForURL(/\/driver\/run/, { timeout: 15_000 });
  await page.waitForTimeout(800);
  text = await body();
  check(!text.includes("Couldn't send photo"), "R8.3: after Try again the photo is sent and the alert is gone");
  check(text.includes("Dispatch is reviewing your delivery at OUT084. Nothing for you to do."), "R1.7: the run is back to the stop under review");
  check(!text.includes("photo still on phone"), "R8.2: no stop has a photo left on the phone");
  text = await body();
  check(text.includes("Dispatch is reviewing your delivery at OUT084. Nothing for you to do."), "R1.7: the run shows the stop under review");
  check(text.includes("Sent for review") && text.includes("All synced"), "R1.7: OUT084 reads Sent for review, the run reads All synced");
  await page.getByRole("button", { name: "View", exact: true }).click();
  await page.getByRole("dialog", { name: "Outbox" }).waitFor({ timeout: 5_000 });
  check((await page.getByRole("dialog", { name: "Outbox" }).innerText()).includes("1 stop (2 orders) sent for review. Nothing for you to do."), "R4.3 1: View opens the Outbox on the conflict");
  await page.getByRole("button", { name: "Close" }).click();

  // H16, 06:44: Dispatch keeps the delivery. The phone is polling, so the resolution arrives by itself.
  await page.goto(`${base}/driver/run?at=06:45`, { waitUntil: "networkidle" });
  await page.waitForURL(/sync-result\?view=resolved/, { timeout: 15_000 });
  await page.waitForTimeout(500);
  text = await body();
  check(text.includes("Delivered at OUT084") && text.includes("Dispatch kept your delivery at OUT084 · 06:44."), "R5.3: Dispatch kept your delivery at OUT084 · 06:44");
  await page.getByRole("button", { name: "Back to run" }).click();
  await page.waitForURL(/\/driver\/run/, { timeout: 5_000 });
  await page.waitForTimeout(800);
  text = await body();
  check(text.includes("OUT084 - resolved: delivered. Kumari kept your delivery at 06:44."), "R1.8: the run shows the resolved notice");
  check(!text.includes("Sent for review"), "R1.8: no stop is still under review");
  check(!text.includes("Delivery saved on this phone"), "R1.8: coming back to the run does not repeat the just-saved toast");
  await page.goto(`${base}/driver/run?at=06:46`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check(!page.url().includes("sync-result"), "R5.3 shows once: reopening the run does not show it again");

  // R8.1: the bell counts what is unread, and the list keeps everything on the phone.
  const bell = page.getByRole("button", { name: /Notifications, \d+ unread/ });
  check(await bell.isVisible(), "R8.1: the bell shows an unread count");
  await bell.click();
  await page.waitForURL(/\/driver\/notifications$/, { timeout: 5_000 });
  await page.waitForTimeout(600);
  text = await body();
  for (const title of ["OUT084 resolved", "Sync failed", "Delivery sent for review", "3 records synced", "Plan v5 received", "You went offline", "3 orders on board", "Plan v4 released"]) {
    check(text.includes(title), `R8.1: lists "${title}"`);
  }
  check(/\d+ UNREAD/i.test(text), "R8.1: the day line counts what is unread");
  await page.getByRole("radio", { name: "Dispatch" }).click();
  text = await body();
  check(text.includes("OUT084 resolved") && !text.includes("3 orders on board"), "R8.1: the Dispatch filter keeps only what Dispatch did");
  await page.getByRole("radio", { name: "All" }).click();
  await page.getByRole("button", { name: "Mark all read" }).click();
  await page.waitForTimeout(600);
  check(!/UNREAD/i.test(await body()), "R8.1: Mark all read clears the count");
  check(!(await page.getByRole("button", { name: /Notifications, \d+ unread/ }).count()), "R8.1: and the bell badge goes");
  await page.getByRole("button", { name: /OUT084 resolved/ }).click();
  await page.waitForURL(/sync-result\?view=resolved/, { timeout: 5_000 });
  await page.waitForTimeout(500);
  check((await body()).includes("Dispatch kept your delivery at OUT084"), "R8.1: OUT084 resolved opens R5.3");

  await browser.close();

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

void main();
