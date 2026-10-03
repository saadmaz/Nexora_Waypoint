/**
 * The outlet a store account manages, as the store's own screens name it. It comes from the database with the sign-in
 * (`GET /me`), never from the code, so a different seeded outlet or a different store account just works.
 */
export type StoreOutlet = {
  id: string;
  name: string;
  brand: string;
  district: string;
  dock: string;
  window: { start: string; end: string };
};

/** "05:30–08:00" */
export function windowLabel(outlet: Pick<StoreOutlet, "window">): string {
  return `${outlet.window.start}–${outlet.window.end}`;
}
