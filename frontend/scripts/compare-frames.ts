/**
 * Dev-only: renders frames of a role's state gallery and lines each up beside its Figma screenshot.
 *
 *   npm run compare -- loader L2.1-A L2.1-B
 *   npm run compare -- driver R1.6 R3.1 --base http://localhost:5173
 *   npm run compare -- driver --all          (every frame found in the gallery)
 *
 * For each frame ID it opens `/<role>/_states?frame=<id>` at device scale factor 2, saves
 * `.compare/<id>.app.png`, and, if `.figma/<id>.png` exists (field conventions section 3, step 1),
 * writes `.compare/<id>.side-by-side.png` with Figma on the left and the app on the right.
 * Start the dev server first (`npm run dev`). Tall frames are captured full height.
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const base = flag("--base") ?? "http://localhost:5173";
const positional = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--base");
const role = positional[0];
let frameIds = positional.slice(1);

if (!role || (frameIds.length === 0 && !args.includes("--all"))) {
  console.error("Usage: npm run compare -- <loader|driver> <frameId...> | --all [--base URL]");
  process.exit(1);
}

const figmaDir = join(process.cwd(), ".figma");
const outDir = join(process.cwd(), ".compare");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

async function listFrames(page: Page): Promise<string[]> {
  await page.goto(`${base}/${role}/_states`);
  await page.waitForSelector("figure");
  return page.$$eval("figure a[href^='?frame=']", (links) =>
    links.map((link) => decodeURIComponent((link.getAttribute("href") ?? "").replace("?frame=", ""))),
  );
}

async function sideBySide(figmaPath: string, appPath: string, outPath: string): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const uri = (path: string) => `data:image/png;base64,${readFileSync(path).toString("base64")}`;
  await page.setContent(
    `<body style="margin:0;background:#888;display:flex;gap:24px;align-items:flex-start;padding:24px">
       <figure style="margin:0;color:#fff;font:12px sans-serif">Figma<br><img style="display:block;height:auto;max-width:700px" src="${uri(figmaPath)}"></figure>
       <figure style="margin:0;color:#fff;font:12px sans-serif">App<br><img style="display:block;height:auto;max-width:700px" src="${uri(appPath)}"></figure>
     </body>`,
  );
  await page.waitForLoadState("load");
  writeFileSync(outPath, await page.screenshot({ fullPage: true }));
  await page.close();
}

const listPage = await browser.newPage();
if (args.includes("--all")) frameIds = await listFrames(listPage);
await listPage.close();

for (const id of frameIds) {
  const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${base}/${role}/_states?frame=${encodeURIComponent(id)}`);
  const frame = page.locator(`[data-frame="${id}"]`);
  try {
    await frame.waitFor({ timeout: 10_000 });
  } catch {
    console.error(`${id}: not found in /${role}/_states`);
    await context.close();
    continue;
  }
  await page.evaluate("document.fonts.ready");
  const appPath = join(outDir, `${id}.app.png`);
  await frame.screenshot({ path: appPath });
  const figmaPath = join(figmaDir, `${id}.png`);
  if (existsSync(figmaPath)) {
    await sideBySide(figmaPath, appPath, join(outDir, `${id}.side-by-side.png`));
    console.log(`${id}: wrote .compare/${id}.app.png and .side-by-side.png`);
  } else {
    console.log(`${id}: wrote .compare/${id}.app.png (no .figma/${id}.png to compare with)`);
  }
  await context.close();
}

await browser.close();
