import { expect, type APIRequestContext, type Page } from "@playwright/test";

export type Role = "store" | "dispatcher" | "loader" | "driver";

export const EMAIL: Record<Role, string> = {
  store: "store@waypoint.demo",
  dispatcher: "dispatcher@waypoint.demo",
  loader: "loader@waypoint.demo",
  driver: "driver@waypoint.demo",
};
export const PASSWORD = process.env.E2E_PASSWORD ?? "waypoint-demo";

/** Phone width for the store, loader and driver; desktop for Dispatch (PRD section 17). */
export const VIEWPORT: Record<Role, { width: number; height: number }> = {
  store: { width: 390, height: 844 },
  loader: { width: 390, height: 844 },
  driver: { width: 390, height: 844 },
  dispatcher: { width: 1440, height: 900 },
};

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:8080";
/** The API: the same origin through nginx under docker compose, or `E2E_API_URL` for a local build. */
export const API = `${process.env.E2E_API_URL ?? baseURL}/api/v1`;

const tokens = new Map<Role, string>();

async function token(request: APIRequestContext, role: Role): Promise<string> {
  const known = tokens.get(role);
  if (known) return known;
  const res = await request.post(`${API}/auth/login`, { data: { email: EMAIL[role], password: PASSWORD } });
  expect(res.status(), `signing in as ${role}`).toBe(200);
  const value = (await res.json()).accessToken as string;
  tokens.set(role, value);
  return value;
}

/** Calls the API as a role, the way the app does, and returns the parsed body. */
export async function call(
  request: APIRequestContext,
  role: Role,
  method: "GET" | "POST" | "PATCH",
  path: string,
  options: { data?: unknown; status?: number } = {},
): Promise<any> {
  const res = await request.fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token(request, role)}` },
    ...(options.data === undefined ? {} : { data: options.data }),
  });
  expect(res.status(), `${method} ${path} as ${role}: ${await res.text()}`).toBe(options.status ?? 200);
  const text = await res.text();
  return text ? JSON.parse(text) : undefined;
}

export type Clock = { now: string; checkpoint: string; serviceDate: string; runDate: string; rate: number };

export const clock = (request: APIRequestContext): Promise<Clock> => call(request, "dispatcher", "GET", "/clock");

/**
 * The planning day and the delivery day, from the server: no calendar date is written in this suite. The delivery day is
 * `runDate` (the run being prepared, then driven), not `serviceDate`, which moves on at the 16:00 cutoff to the day an order
 * placed *now* would count for.
 */
export async function days(request: APIRequestContext): Promise<{ planning: string; service: string }> {
  const c = await clock(request);
  return { planning: c.checkpoint.slice(0, 10), service: c.runDate };
}

/** Moves the scenario clock to a time on the planning day (`which` "planning", the evening) or the delivery day (the morning). */
export async function goTo(request: APIRequestContext, which: "planning" | "service", hhmm: string): Promise<Clock> {
  const d = await days(request);
  const day = which === "planning" ? d.planning : d.service;
  await call(request, "dispatcher", "POST", "/demo/advance", { data: { to: `${day}T${hhmm}:00+05:30` } });
  return clock(request);
}

/** Starts the demo again (PRD walkthrough step 19) and checks the clock is back at the checkpoint. */
export async function reset(request: APIRequestContext): Promise<void> {
  await call(request, "dispatcher", "POST", "/demo/reset");
  const c = await clock(request);
  expect(c.now).toBe(c.checkpoint);
}

/** Opens the app as one role on the demo account's sign-in row. */
export async function signIn(page: Page, role: Role): Promise<void> {
  await page.setViewportSize(VIEWPORT[role]);
  await page.goto("/sign-in");
  await page.getByRole("button", { name: new RegExp(EMAIL[role].replace(".", "\\.")) }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

/** The text of the page as a person reads it, whitespace folded. */
export async function pageText(page: Page): Promise<string> {
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

/** An outbox record as a phone or a dock tablet sends it (`POST /sync`). Times are on the delivery day. */
export function record(
  day: string,
  type: string,
  payload: Record<string, unknown>,
  hhmm: string,
  version: number | null,
  actor: string,
): Record<string, unknown> {
  return {
    clientId: crypto.randomUUID(),
    type,
    payload,
    deviceTime: `${day}T${hhmm}:00+05:30`,
    planVersionOnDevice: version,
    actor,
  };
}

/** Sends records the way a device does, and returns the per-record answers. */
export async function sync(
  request: APIRequestContext,
  role: Role,
  device: string,
  records: Record<string, unknown>[],
): Promise<{ clientId: string; result: string; conflictId?: number }[]> {
  const body = await call(request, role, "POST", "/sync", { data: { deviceId: device, records } });
  return body.results;
}
