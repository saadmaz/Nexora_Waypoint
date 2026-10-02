/**
 * Plays the loader's two stories at 390 x 844 in a real browser, including one offline step.
 *
 *   npm run test:loader-stories                      (starts nothing; needs the dev server)
 *   npm run test:loader-stories -- --base http://localhost:5199
 *
 * Mock state lives in memory, so each story stays inside one page session: after the first
 * page.goto, every step is a tap, never another navigation.
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, type BrowserContext, type Page } from "@playwright/test";

const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const base = baseIndex >= 0 ? args[baseIndex + 1] : "http://localhost:5173";
const headed = args.includes("--headed");

mkdirSync(".compare", { recursive: true });
const browser = await chromium.launch({ headless: !headed });
let lastPage: Page | undefined;

async function newSession(): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  lastPage = page;
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("close", () => assert.deepEqual(problems, [], "the page threw"));
  return { context, page };
}

async function enterPin(page: Page, pin: string): Promise<void> {
  for (const digit of pin) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
}

async function choosePerson(page: Page, name: string): Promise<void> {
  await page.getByRole("radio", { name }).click();
}

async function step(name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
    console.log(`  ok   ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    await lastPage?.screenshot({ path: ".compare/loader-stories-fail.png" }).catch(() => undefined);
    throw error;
  }
}

async function priya(): Promise<void> {
  console.log("Priya at Peliyagoda, from 02:55");
  const { context, page } = await newSession();
  const noOverflow = async () => {
    // A string, because this folder's tsconfig has no DOM types.
    const wide = await page.evaluate("document.documentElement.scrollWidth > window.innerWidth");
    assert.equal(wide, false, "horizontal overflow");
  };

  await step("the dock opens with plan v3 waiting", async () => {
    await page.goto(`${base}/loader/dock?dock=peliyagoda&date=2026-09-29&at=02:55&dev=1`);
    await page.getByRole("button", { name: /Acknowledge plan v3/ }).click();
  });
  await step("acknowledge v3 with Priya's PIN", async () => {
    await choosePerson(page, "Priya");
    await enterPin(page, "1234");
    await page.getByRole("button", { name: /Load VEH003/ }).waitFor();
  });
  await step("open VEH003 and flag Vehicle check failed", async () => {
    await page.getByRole("button", { name: /Load VEH003/ }).click();
    await page.getByRole("button", { name: "Flag issue" }).click();
    await page.getByRole("button", { name: /Vehicle check failed/ }).click();
    await page.getByRole("button", { name: "Send to Dispatch" }).click();
    await choosePerson(page, "Priya");
    await enterPin(page, "1234");
    await page.getByText(/reviewing/i).first().waitFor();
  });
  await step("offline: the flag screen keeps working and the chip says so", async () => {
    await context.setOffline(true);
    await page.getByText(/Offline/).first().waitFor();
    await noOverflow();
    await context.setOffline(false);
    await page.getByText(/Online|Synced/).first().waitFor();
  });
  await step("Dispatch decides, the sheet shows plan v4", async () => {
    await page.locator("[aria-label=\"Developer controls\"] button").click();
    await page.getByText(/plan changed to v4/i).first().waitFor();
  });
  await step("review the change: ORD1002 removed, VEH036 replaces VEH003", async () => {
    await page.getByRole("button", { name: /Review change/ }).click();
    await page.getByText("ORD1002").first().waitFor();
    await page.getByText("VEH036").first().waitFor();
    await noOverflow();
  });
  await step("acknowledge v4 with PIN and begin loading VEH036", async () => {
    await page.getByRole("button", { name: /Acknowledge and load/ }).click();
    await choosePerson(page, "Priya");
    await enterPin(page, "1234");
    await page.getByRole("button", { name: /Begin loading VEH036/ }).click();
    await page.getByText(/Load list/).first().waitFor();
    await page.getByText("VEH036").first().waitFor();
    await noOverflow();
  });
  await context.close();
}

async function ruwan(): Promise<void> {
  console.log("Ruwan at Kandy, from 04:14");
  const { context, page } = await newSession();

  await step("the Kandy dock asks for an acknowledgement", async () => {
    await page.goto(`${base}/loader/dock?dock=kandy&at=04:14`);
    await page.getByRole("button", { name: /Acknowledge plan v/ }).first().click();
  });
  await step("acknowledge with Ruwan's PIN", async () => {
    await choosePerson(page, "Ruwan");
    await enterPin(page, "5678");
    await page.getByRole("button", { name: /Load VEH039/ }).waitFor();
  });
  await step("load VEH039: check each order, then confirm with the gate", async () => {
    await page.getByRole("button", { name: /Load VEH039/ }).click();
    await page.getByText(/^\d of 3 checked$/).waitFor();
    for (let n = 1; n <= 3; n += 1) {
      await page.getByRole("button", { name: /^Load \d+ units$/ }).first().click();
      await page.getByRole("button", { name: /^Confirm \d+ units$/ }).click();
      await page.getByText(`${n} of 3 checked`).waitFor();
    }
    await page.getByRole("button", { name: /Confirm loaded: clear to depart/ }).click();
    await choosePerson(page, "Ruwan");
    await enterPin(page, "5678");
    await page.getByText(/Loaded|cleared/i).first().waitFor();
  });
  await context.close();
}

try {
  await priya();
  await ruwan();
  console.log("Both stories passed.");
} finally {
  await browser.close();
}
