import type { AcknowledgementRow, AcknowledgementsView } from "../../../api/DispatcherApi";
import { PEOPLE } from "./fixtures";
import { at, hm, untilLabel } from "./time";
import { SCRIPT, type Milestones } from "./world";

/**
 * Who has which version, and when they acknowledged (PRD v3 section 4c, D5). The background
 * people acknowledge at the times the design shows; the dispatcher's own release starts the wait.
 */
const ACKS: Record<number, Record<string, Date>> = {
  3: { Priya: at("00:10", true), "R. Silva": at("00:30", true), Ruwan: at("00:20", true) },
  4: { Priya: at("03:05", true), "R. Silva": at("03:10", true), Ruwan: at("04:15", true), Nimal: at("04:55", true) },
  // Priya and R. Silva are not affected by v5 (Kandy only), so they keep v4; Nimal is offline until 06:40.
  5: { Ruwan: at("05:22", true), Nimal: at("06:40", true) },
};

function ackAt(person: string, version: number, now: Date, releasedAt: Date): Date | undefined {
  const t = ACKS[version]?.[person];
  if (!t) return undefined;
  // A loader or driver cannot acknowledge before the version exists.
  if (t.getTime() < releasedAt.getTime()) return undefined;
  return t.getTime() <= now.getTime() ? t : undefined;
}

export function acknowledgements(m: Milestones, requested?: number): AcknowledgementsView {
  const version = requested ?? (m.storeRequestAt ? 5 : m.swapAt ? 4 : 3);
  const releasedAt = version === 5 ? (m.storeRequestAt ?? SCRIPT.storeRequest) : version === 4 ? (m.swapAt ?? SCRIPT.swap) : (m.releasedAt ?? SCRIPT.release);
  const now = m.now;

  const rows: AcknowledgementRow[] = [];
  for (const person of Object.values(PEOPLE)) {
    const acked = ackAt(person.name, version, now, releasedAt);
    const row: AcknowledgementRow = {
      person: person.name,
      role: person.role,
      place: person.place,
      has: version,
      state: acked ? "acknowledged" : "pending",
      departsIn: "n/a",
    };
    if (acked) row.at = hm(acked);

    if (version === 5 && !acked) {
      if (person.name === "Nimal") {
        row.state = m.offline ? "not received" : "pending";
        if (m.offline) row.note = "v5 not received · offline since 05:17";
      } else if (person.name === "Priya" || person.name === "R. Silva") {
        // Unaffected by v5: they keep the v4 they acknowledged.
        const v4 = ackAt(person.name, 4, now, m.swapAt ?? SCRIPT.swap);
        row.has = 4;
        row.state = "no change";
        if (v4) row.at = hm(v4);
        row.note = "no change in v5";
      }
    }

    if (person.name === "Nimal") {
      const depart = SCRIPT.kandyDepart;
      row.departsIn = now.getTime() >= depart.getTime() ? `Departed ${hm(depart)}` : untilLabel(now, depart);
    } else if (person.name === "R. Silva") {
      const depart = SCRIPT.depart;
      row.departsIn = now.getTime() >= depart.getTime() ? `Departed ${hm(depart)}` : untilLabel(now, depart);
    } else if (person.name === "Ruwan") {
      // The Kandy dock hands over VEH039 at 05:10; the row says the dock has no departure of its own.
      row.departsIn = "n/a";
    }
    rows.push(row);
  }

  const done = rows.filter((r) => r.state === "acknowledged" || r.state === "no change").length;
  const pendingKandy = rows.find((r) => r.person === "Ruwan")?.state === "pending";
  const nimalOffline = rows.find((r) => r.person === "Nimal")?.state === "not received";

  let banner: AcknowledgementsView["banner"] = null;
  if (nimalOffline) {
    banner = {
      tone: "offline",
      title: "VEH039 hasn't received v5, driver offline since 05:17.",
      text: "v5 defers ORD2001 + ORD2002 at OUT084's request. The phone will get it on next sync.",
      action: "open-live",
    };
  } else if (pendingKandy) {
    banner = {
      tone: "warning",
      title: `Kandy dock hasn't acknowledged v${version}, the load gate stays blocked for its vehicles.`,
      text: `VEH039 departs 05:10. Ruwan sees v${version} on the dock tablet now.`,
      action: "call-kandy",
    };
  } else if (done === rows.length) {
    banner = {
      tone: "success",
      title: `Everyone has plan v${version}.`,
      text: "Both docks and every driver acknowledged. Load gates are open.",
    };
  }
  return { version, acknowledged: done, total: rows.length, rows, banner };
}
