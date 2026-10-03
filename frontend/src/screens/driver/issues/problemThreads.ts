import type { OutboxStatus } from "../../../field/offline";
import type { ProblemRecord, ProblemThread } from "../types";

/**
 * R6.4: the Issues tab lists one thread per first problem record; an update is a record of its own that carries
 * `updatesClientId` (PRD v3 V40). A thread is "sent" once every record in it has reached the server, and "saved" while any is
 * still on the phone. "Seen" (G-14) needs Dispatch's side: until the server says so, a sent thread is waiting for Dispatch.
 */
export function problemThreads(records: readonly ProblemRecord[], statusOf: (clientId: string) => OutboxStatus | undefined, seen: ReadonlySet<string> = new Set()): ProblemThread[] {
  const parents = records.filter((r) => !r.updatesClientId || !records.some((p) => p.clientId === r.updatesClientId));
  const reached = (r: ProblemRecord) => {
    const status = statusOf(r.clientId);
    return status === "accepted" || status === "conflict";
  };
  return parents
    .map((parent) => {
      const updates = records.filter((r) => r.updatesClientId === parent.clientId);
      const all = [parent, ...updates];
      const state: ProblemThread["state"] = seen.has(parent.clientId) ? "seen" : all.every(reached) ? "sent" : "saved";
      return { parent, updates, state };
    })
    .sort((a, b) => latest(b).localeCompare(latest(a)));
}

function latest(thread: { parent: ProblemRecord; updates: ProblemRecord[] }): string {
  return [thread.parent, ...thread.updates].map((r) => r.savedAt).sort().at(-1) ?? "";
}

/** The tab badge: threads Dispatch has not seen yet. */
export function unseenCount(threads: readonly ProblemThread[]): number {
  return threads.filter((t) => t.state !== "seen").length;
}
