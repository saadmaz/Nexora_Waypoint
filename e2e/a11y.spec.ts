import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { goTo, pageText, reset, signIn, type Role } from "./helpers";

/**
 * Accessibility (PRD section 17): axe on each role's home screen, in the production build, against the real API. WCAG 2.1 A and AA
 * rules; any violation fails with the rule, the element and how many there are. Colour pairs are checked separately, in the
 * unit tests, over the design tokens.
 */

type Screen = { name: string; role?: Role; path: string; ready: RegExp };

const SCREENS: Screen[] = [
  { name: "sign-in", path: "/sign-in", ready: /Sign in/ },
  { name: "role picker", path: "/start", ready: /Choose a role/ },
  { name: "store orders", role: "store", path: "/store/orders", ready: /Orders close at/ },
  { name: "dispatcher queue", role: "dispatcher", path: "/dispatcher/queue", ready: /Orders for/ },
  { name: "loader dock", role: "loader", path: "/loader/dock?dock=peliyagoda", ready: /Peliyagoda dock/ },
  { name: "driver run", role: "driver", path: "/driver/run", ready: /Run|No run|plan/i },
];

/** Dispatch's screens that need a plan to show anything. */
const PLAN_SCREENS: Screen[] = [
  { name: "dispatcher queue, closed", role: "dispatcher", path: "/dispatcher/queue", ready: /Confirmed orders|Orders for/ },
  { name: "dispatcher queue, Kandy", role: "dispatcher", path: "/dispatcher/queue?depot=kandy", ready: /Orders for/ },
  { name: "dispatcher capacity", role: "dispatcher", path: "/dispatcher/capacity", ready: /Supply vs demand/ },
  { name: "dispatcher trips", role: "dispatcher", path: "/dispatcher/trips", ready: /VEH0\d\d/ },
  { name: "dispatcher deferrals", role: "dispatcher", path: "/dispatcher/deferrals", ready: /ORD1020/ },
];

test.describe.configure({ mode: "default" });

/** Opens a screen as a role and checks it with axe, once its data is in. */
async function check(page: Page, screen: Screen): Promise<void> {
  if (screen.role) await signIn(page, screen.role);
  else await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(screen.path);
  await expect.poll(() => pageText(page), { timeout: 20_000 }).toMatch(screen.ready);
  await page.waitForLoadState("networkidle"); // the data is in, so axe sees the screen a person sees, not its skeleton
  await page.waitForTimeout(500);

  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = result.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}, ${v.nodes.length} element(s), e.g. ${v.nodes[0]?.target.join(" ")} :: ${(v.nodes[0]?.html ?? "").slice(0, 160)} :: ${(v.nodes[0]?.any[0]?.message ?? "").slice(0, 200)}`,
  );
  expect(summary, summary.join("\n")).toEqual([]);
}

test.describe("before the cutoff, Monday 15:40", () => {
  test.beforeAll(async ({ request }) => {
    await reset(request);
    await goTo(request, "planning", "15:40");
  });
  for (const screen of SCREENS) test(`axe finds nothing on the ${screen.name} screen`, ({ page }) => check(page, screen));
});

test.describe("with the draft plan, Monday 16:06", () => {
  test.beforeAll(async ({ request }) => {
    await reset(request);
    await goTo(request, "planning", "16:06");
  });
  for (const screen of PLAN_SCREENS) test(`axe finds nothing on the ${screen.name} screen`, ({ page }) => check(page, screen));
});
