import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { call, days, goTo, pageText, record, reset, signIn, sync } from "./helpers";

/** The two orders the judge places for OUT084 and the third that VEH039 carries (PRD section 4c). */
export const HERO = ["ORD2001", "ORD2002"];

export type Morning = { service: string; version: number };

/**
 * Plays the walkthrough up to the moment the driver is on the road (step 11): the store orders, the cutoff and draft, the
 * release, the loaders' acknowledgements, the swap, and the driver's acknowledgement and departure. The store's order goes
 * through the real screen; the rest goes through the same API calls the other roles' screens make. Returns the delivery day
 * and the plan version the driver holds. With `until` "kandyDock" it stops after the swap, before the Kandy dock acknowledges or loads.
 */
export async function playToDeparture(page: Page, request: APIRequestContext, until: "departure" | "kandyDock" = "departure"): Promise<Morning> {
  await reset(request);
  await goTo(request, "planning", "15:40");
  await signIn(page, "store");
  await page.goto("/store/orders");
  await page.getByRole("button", { name: "Place 2 orders" }).click();
  await page.getByRole("button", { name: "Place orders", exact: true }).click();
  await expect.poll(() => pageText(page)).toMatch(/Received 15:40/);

  await goTo(request, "planning", "16:06");
  await goTo(request, "planning", "23:31");
  await goTo(request, "planning", "23:40");
  await call(request, "dispatcher", "POST", "/dispatcher/plan/release", { data: { sendNotices: true } });
  const { service } = await days(request);
  const v3 = (await call(request, "dispatcher", "GET", "/dispatcher/plan?depot=kandy")).version.number as number;

  const people = async (dock: string): Promise<{ id: number; name: string }> => (await call(request, "loader", "GET", `/loader/docks/${dock}`)).people[0];
  const priya = await people("peliyagoda");
  const ruwan = await people("kandy");

  await goTo(request, "service", "02:55");
  await sync(request, "loader", "tablet-peliyagoda", [
    record(service, "loader.exception", { date: service, vehicleId: "VEH003", trip: 1, type: "Vehicle check failed", orderIds: [], reason: "Reefer not holding temperature", personId: priya.id, personName: priya.name }, "02:55", v3, priya.name),
  ]);
  await goTo(request, "service", "03:00");
  const inbox = JSON.stringify(await call(request, "dispatcher", "GET", "/dispatcher/inbox"));
  const exceptionId = Number(/exceptions\/(\d+)/.exec(inbox)?.[1]);
  await call(request, "dispatcher", "POST", `/dispatcher/exceptions/${exceptionId}/decide`, { data: { decision: "swap_vehicle", deferOrderIds: [] } });
  const version = (await call(request, "loader", "GET", "/loader/docks/kandy")).planVersion as number;

  if (until === "kandyDock") return { service, version }; // the Kandy dock has not acted yet
  await goTo(request, "service", "04:15");
  await sync(request, "loader", "tablet-kandy", [
    record(service, "loader.ack", { date: service, version, dockId: "kandy", personId: ruwan.id, personName: ruwan.name }, "04:15", version, ruwan.name),
  ]);
  await goTo(request, "service", "04:50");
  await sync(request, "loader", "tablet-kandy", [
    record(service, "loader.confirmLoaded", { vehicleId: "VEH039", trip: 1, personId: ruwan.id, personName: ruwan.name }, "04:50", version, ruwan.name),
  ]);
  return { service, version };
}
