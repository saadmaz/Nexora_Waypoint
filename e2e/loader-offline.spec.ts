import { expect, test, type Page } from "@playwright/test";
import { call, goTo, pageText, signIn } from "./helpers";
import { playToDeparture } from "./scenario";

/**
 * The loader's tablet loses the network (PRD section 17, "End to end"): with the connection cut, the loader checks every order
 * on VEH039. The counts are saved on the tablet, shown at once, and sent when the connection returns. The gate needs a PIN, which
 * the server checks, so it is confirmed after the connection is back.
 */

/** Enters a PIN on the sheet the tablet opens for each action. The sheet is a dialog whose buttons are plain text. */
async function enterPin(page: Page, person: string, pin: string): Promise<void> {
  const sheet = page.locator("[role=dialog]");
  await sheet.locator("button", { hasText: new RegExp(`^${person}$`) }).click();
  for (const digit of pin) await sheet.locator("button", { hasText: new RegExp(`^${digit}$`) }).click();
}

test("the loader checks a vehicle with no network, the counts reach the server, and the gate is confirmed once back online", async ({ page, request, context }) => {
  test.setTimeout(240_000);
  await playToDeparture(page, request, "kandyDock");
  await goTo(request, "service", "04:15");

  // Online: Ruwan acknowledges the plan so the dock unlocks.
  await signIn(page, "loader");
  await page.goto("/loader/dock?dock=kandy");
  await page.getByRole("button", { name: /Acknowledge plan/ }).click();
  await enterPin(page, "Ruwan", "5678");
  await page.locator("button", { hasText: /VEH039/ }).first().click();
  await expect.poll(() => pageText(page)).toMatch(/Load list · VEH039/);

  // The connection drops while the vehicle is being loaded.
  await context.setOffline(true);
  const checks = page.locator("button", { hasText: /^Load \d+ units$/ });
  await expect(checks.first()).toBeVisible();
  const orders = await checks.count();
  expect(orders).toBe(3);
  for (let i = 0; i < orders; i += 1) {
    await checks.first().click(); // opens the count, prefilled with what the order expects
    await page.locator("button", { hasText: /^Confirm \d+ units$/ }).click();
  }
  await expect.poll(() => pageText(page)).toMatch(/3 of 3 checked/);

  await expect(page.getByText(/Offline · 3/).first()).toBeVisible(); // three counts are saved on the tablet, waiting to be sent

  // Nothing has reached the server yet: it still sees no units loaded.
  const before = await call(request, "loader", "GET", "/loader/vehicles/VEH039/trips/1");
  expect(before.lines.every((line: { unitsLoaded: number | null }) => !line.unitsLoaded)).toBe(true);

  // The connection returns, and the tablet sends what it kept.
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect
    .poll(
      async () => {
        const plan = await call(request, "loader", "GET", "/loader/vehicles/VEH039/trips/1");
        return plan.lines.every((line: { unitsLoaded: number | null; unitsExpected: number }) => line.unitsLoaded === line.unitsExpected);
      },
      { timeout: 60_000 },
    )
    .toBe(true);

  // The PIN is checked by the server, so the gate is confirmed once the connection is back (the tablet keeps no PIN hashes).
  await page.locator("button", { hasText: /Confirm loaded/ }).click();
  await enterPin(page, "Ruwan", "5678");
  await expect
    .poll(async () => (await call(request, "loader", "GET", "/loader/vehicles/VEH039/trips/1")).confirmedAt, { timeout: 60_000 })
    .not.toBeNull();
});
