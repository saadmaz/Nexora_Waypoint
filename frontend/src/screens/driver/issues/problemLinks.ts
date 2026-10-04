import type { ProblemType } from "../types";

/** R6 opened already filled in (`ProblemScreen` reads these). The problem still saves on the phone and goes through the outbox. */
function problemHref(type: ProblemType, opts: { stop?: string; note?: string } = {}): string {
  const params = new URLSearchParams({ type });
  if (opts.stop) params.set("stop", opts.stop);
  if (opts.note) params.set("note", opts.note);
  return `/driver/issues/new?${params.toString()}`;
}

/** "Ask Dispatch to call": a problem for the vehicle as a whole, with the reason in the note, so it reaches the D6 inbox. */
export function askDispatchHref(note: string): string {
  return problemHref("Something else", { note });
}

/** "Can't reach the store" for one stop: Dispatch contacts the store. */
export function cantReachStoreHref(outletId: string): string {
  return problemHref("Can't reach the store", { stop: outletId });
}
