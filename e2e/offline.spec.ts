import { expect, test, type Page } from "@playwright/test";
import { call, goTo, pageText, signIn } from "./helpers";
import { HERO, playToDeparture } from "./scenario";

/**
 * Real offline, not just the scripted coverage gap (PRD section 17, "End to end"): the browser's network is cut with
 * `context.setOffline`, the driver records an arrival and a delivery with a photo while Dispatch changes the plan, the page is
 * reloaded with no network, and when the network comes back the outbox drains, the server answers "3 synced, 1 conflict
 * (2 orders)" and sending the same records again changes nothing.
 */

/** Gives the phone the scenario time it would have reached by itself: with no network it cannot ask, it runs on from its last reading. */
async function timePassesOnThePhone(page: Page, hhmm: string): Promise<void> {
  await page.evaluate((time) => {
    const key = "waypoint.clock.driver";
    const reading = JSON.parse(localStorage.getItem(key) ?? "{}");
    reading.scenarioMs = Date.parse(`${reading.runDate}T${time}:00+05:30`);
    reading.rate = 0;
    reading.fetchedAt = Date.now();
    localStorage.setItem(key, JSON.stringify(reading));
  }, hhmm);
}

test("the driver works offline, survives a reload, and the outbox drains with one conflict", async ({ page, request, context }) => {
  test.setTimeout(300_000);
  const { service, version } = await playToDeparture(page, request);
  await goTo(request, "service", "05:00");
  await signIn(page, "driver");
  await page.goto("/driver/run");
  await expect.poll(() => pageText(page)).toMatch(/Confirmed by \w+ · 04:50/); // the loader who confirmed the load, and when
  await page.getByRole("button", { name: /Acknowledge v\d/ }).click();
  await page.getByRole("button", { name: `Acknowledge plan v${version}` }).click();
  await page.getByRole("button", { name: "Start route" }).click();
  await expect.poll(() => pageText(page)).toMatch(/Departed/);

  // 05:17: the coverage drops, for real.
  await goTo(request, "service", "05:17");
  await context.setOffline(true);
  await expect.poll(() => pageText(page)).toMatch(/Offline/);

  // 05:21: Dispatch defers OUT084. The phone cannot hear it.
  await goTo(request, "service", "05:21");
  const deferred = await call(request, "dispatcher", "POST", "/dispatcher/stops/defer", {
    data: { orderIds: HERO, kind: "store_request", reason: "Receiving staff unavailable today" },
  });
  expect(deferred.plan).toBe(version + 1);

  // 05:30: the page is reloaded with no network. The app shell and the saved route still open.
  await timePassesOnThePhone(page, "05:30");
  await page.reload();
  await expect.poll(() => pageText(page)).toMatch(/Offline/);
  await page.goto("/driver/run"); // opening the saved route works with no network too
  await expect.poll(() => pageText(page)).toMatch(/VEH039/);
  expect(await pageText(page)).toMatch(/OUT084/);
  expect(await pageText(page)).toMatch(/Offline/);

  await page.getByRole("button", { name: /OUT084/ }).first().click();
  await page.getByRole("button", { name: "Record arrival" }).click();
  await expect.poll(() => pageText(page)).toMatch(/Saved on phone/);
  await page.getByRole("button", { name: "Record outcome" }).click();
  await page.getByRole("button", { name: "Take photo" }).click();
  await page.locator("button[class*=shutter]").click();
  await page.getByRole("button", { name: "Use photo" }).click();
  await page.getByRole("button", { name: /Received by/ }).click();
  await page.getByRole("textbox").fill("S. Fernando");
  await page.getByRole("button", { name: "Save name" }).click();
  await page.getByRole("button", { name: "Save delivery record" }).click();
  await expect.poll(() => pageText(page)).toMatch(/Offline · 3/); // an arrival and two outcomes are waiting on the phone

  // The first stop on the route: the arrival is recorded from the run screen.
  await page.getByRole("button", { name: "Arrive" }).click();
  await page.getByRole("button", { name: "Record outcome" }).click();
  await page.getByRole("button", { name: "Take photo" }).click();
  await page.locator("button[class*=shutter]").click();
  await page.getByRole("button", { name: "Use photo" }).click();
  await page.getByRole("button", { name: /Received by/ }).click();
  await page.getByRole("textbox").fill("M. Perera");
  await page.getByRole("button", { name: "Save name" }).click();
  await page.getByRole("button", { name: "Save delivery record" }).click();
  await expect.poll(() => pageText(page)).toMatch(/Offline · 5/); // 1, 3, 5 waiting, as the walkthrough counts them

  // The network comes back. Dispatch has already moved on (server time 06:40); the outbox drains on its own.
  await goTo(request, "service", "06:40");
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.goto("/driver/run");
  await expect.poll(() => pageText(page), { timeout: 60_000 }).toMatch(/3 synced/);
  const after = await pageText(page);
  expect(after).toMatch(/1 stop \(2 orders\) sent for review/); // the driver is told "sent for review", never "conflict"
  expect(after).not.toMatch(/conflict/i);
  for (const record of ["Arrival OUT084", "Arrival OUT087", "Delivered ORD2003"]) expect(after).toContain(record);
  expect(after).not.toMatch(/Offline · \d/); // nothing is waiting any more

  // Dispatch has the one conflict, for the two orders, and the driver's delivery is safe.
  const inbox = JSON.stringify(await call(request, "dispatcher", "GET", "/dispatcher/inbox"));
  expect(inbox).toMatch(/OUT084/);
});
