import type { MoveRequest } from "../../../api/DispatcherApi";
import { at } from "./time";

/**
 * The hero night as the mock knows it (PRD v3 sections 2, 4c, 13). Two kinds of event:
 *
 * - **Scripted** (background) events happen when the clock reaches them: the 16:00 cutoff, the 16:05
 *   draft, Kumari's 21:15 adjustments, VEH036 back from the workshop at 02:45, Priya's flag at 02:55,
 *   the driver going offline at 05:17, the sync that finds a conflict at 06:40.
 * - **Decisions** are the dispatcher's: release, the VEH003 swap, the store-request deferral, resolving
 *   the conflict. Each is an action through the DispatcherApi and is stamped with the clock when it is
 *   taken. If the clock passes the moment Kumari takes it in the design (23:40, 03:00, 05:21) without the
 *   judge acting, the script takes it, so the numbering matches the design (section 13). Conflicts are never
 *   resolved by the script.
 */
export type World = {
  now: () => Date;
  released?: Date;
  sendNotices: boolean;
  noticesAt?: Date;
  swapAt?: Date;
  /** Orders deferred by the VEH003 swap (ORD1002 in the recommendation). */
  swapDeferred: string[];
  storeRequestAt?: Date;
  askedAt?: Date;
  resolved?: { outcome: "Delivered" | "Partial"; at: Date };
  /** Edits to the open draft: accepted moves, in order. */
  moves: MoveRequest[];
  movesSavedAt?: Date;
  /** The mock's second reading of a dev preview: no vehicle needs attention (D6.8). */
  calm: boolean;
};

export function createWorld(now: () => Date, calm = false): World {
  return { now, sendNotices: true, swapDeferred: [], moves: [], calm };
}

/** Scripted moments, on the hero evening and morning. */
export const SCRIPT = {
  cutoff: at("16:00"),
  v1: at("16:05"),
  v2: at("21:15"),
  v3Draft: at("23:30"),
  release: at("23:40"),
  spare: at("02:45", true),
  flagged: at("02:55", true),
  swap: at("03:00", true),
  depart: at("03:30", true),
  kandyDepart: at("05:10", true),
  offline: at("05:17", true),
  storeCall: at("05:20", true),
  storeRequest: at("05:21", true),
  vehicleSync: at("06:40", true),
  storeReport: at("07:04", true),
} as const;

/** When the script takes a decision the judge has not taken (section 13 numbering). */
const FALLBACK = { swap: at("03:05", true), storeRequest: at("05:23", true) } as const;

export type Milestones = {
  now: Date;
  cutoffClosed: boolean;
  v1: boolean;
  v2: boolean;
  v3Draft: boolean;
  releasedAt?: Date;
  spareAvailable: boolean;
  held: boolean;
  swapAt?: Date;
  storeRequestAt?: Date;
  offline: boolean;
  conflictOpen: boolean;
  conflictAt?: Date;
  resolvedAt?: Date;
  noticesAt?: Date;
  /** The latest plan version number that exists at this moment. */
  latestVersion: number;
};

function reached(now: Date, moment: Date): boolean {
  return now.getTime() >= moment.getTime();
}

/** What has happened by `now`, combining the script and the dispatcher's decisions. */
export function milestones(w: World): Milestones {
  const now = w.now();
  const released = w.released ?? (reached(now, SCRIPT.release) ? SCRIPT.release : undefined);
  const v3Draft = released !== undefined || reached(now, SCRIPT.v3Draft);
  const held = reached(now, SCRIPT.flagged);
  // The script takes a decision a few minutes after the design shows it taken, so the frames that show it
  // still undecided (D8.2 at 03:00, D6.3 at 05:21) stay reachable. It stamps the decision with the design's time.
  const swapAt = released ? (w.swapAt ?? (reached(now, FALLBACK.swap) ? SCRIPT.swap : undefined)) : undefined;
  const storeRequestAt = swapAt ? (w.storeRequestAt ?? (reached(now, FALLBACK.storeRequest) ? SCRIPT.storeRequest : undefined)) : undefined;
  const conflictAt = storeRequestAt && reached(now, SCRIPT.vehicleSync) ? SCRIPT.vehicleSync : undefined;
  const resolvedAt = w.resolved?.at;
  const noticesAt = w.noticesAt ?? (released && w.sendNotices ? new Date(released.getTime() + 60_000) : undefined);
  const milestone: Milestones = {
    now,
    cutoffClosed: reached(now, SCRIPT.cutoff),
    v1: reached(now, SCRIPT.v1),
    v2: reached(now, SCRIPT.v2),
    v3Draft,
    spareAvailable: reached(now, SCRIPT.spare),
    held,
    // The phone is out of coverage from 05:17 until the 06:40 sync.
    offline: reached(now, SCRIPT.offline) && !reached(now, SCRIPT.vehicleSync),
    conflictOpen: conflictAt !== undefined && resolvedAt === undefined,
    latestVersion: storeRequestAt ? 5 : swapAt ? 4 : v3Draft ? 3 : reached(now, SCRIPT.v2) ? 2 : reached(now, SCRIPT.v1) ? 1 : 0,
  };
  if (released) milestone.releasedAt = released;
  if (swapAt) milestone.swapAt = swapAt;
  if (storeRequestAt) milestone.storeRequestAt = storeRequestAt;
  if (conflictAt) milestone.conflictAt = conflictAt;
  if (resolvedAt) milestone.resolvedAt = resolvedAt;
  if (noticesAt) milestone.noticesAt = noticesAt;
  return milestone;
}

/** The plan version numbers, as the Figma frames number them. */
export function versionsAt(m: Milestones): { number: number; state: "draft" | "released"; at: string; note: string; scope?: string }[] {
  const list: { number: number; state: "draft" | "released"; at: string; note: string; scope?: string }[] = [];
  if (m.v1) list.push({ number: 1, state: "draft", at: "Mon 16:05", note: "System draft from the closed queue" });
  if (m.v2) list.push({ number: 2, state: "draft", at: "Mon 21:15", note: "Kumari's adjustments after the capacity review" });
  if (m.v3Draft) {
    list.push(
      m.releasedAt
        ? { number: 3, state: "released", at: `Mon ${hhmm(m.releasedAt)}`, note: "Peliyagoda + Kandy", scope: "Peliyagoda + Kandy" }
        : { number: 3, state: "draft", at: "now", note: "Peliyagoda + Kandy · ready to release", scope: "Peliyagoda + Kandy" },
    );
  }
  if (m.swapAt) list.push({ number: 4, state: "released", at: `Tue ${hhmm(m.swapAt)}`, note: "VEH003 → VEH036; ORD1002 deferred (policy)" });
  if (m.storeRequestAt) {
    list.push({
      number: 5,
      state: "released",
      at: `Tue ${hhmm(m.storeRequestAt)}`,
      note: "ORD2001 + ORD2002 deferred (store request); driver offline since 05:17",
    });
  }
  return list;
}

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
