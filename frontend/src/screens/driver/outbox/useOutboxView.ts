import { useMemo, useState } from "react";
import { useOutbox } from "../../../field/offline";
import { useDriverRun } from "../context/useDriverRun";
import { RUN_DATE } from "../fixtures";
import { outboxRows, type OutboxRow } from "./outboxModel";
import type { OutboxProgress } from "./OutboxSheet";

export type OutboxView = {
  rows: OutboxRow[];
  /** "3 / 5" while a sync run is under way: records sent so far out of those the run started with. */
  progress?: OutboxProgress;
  /** The outlet whose conflict is still open, for the presenter's "Dispatch resolves now". */
  openConflictOutletId?: string;
};

/**
 * The outbox as the R4 rows plus the run's progress, from the phone's own data. A stop Dispatch has
 * already resolved reads Synced again. `syncing` is the connectivity store's own flag.
 */
export function useOutboxView(syncing: boolean): OutboxView {
  const records = useOutbox();
  const { run } = useDriverRun(RUN_DATE);

  const resolvedStops = useMemo(
    () => new Set((run?.stops ?? []).filter((stop) => stop.resolution).map((stop) => stop.outletId)),
    [run],
  );
  const rows = useMemo(() => outboxRows(records, resolvedStops), [records, resolvedStops]);
  const pending = rows.filter((row) => row.state === "saved" || row.state === "sending" || row.state === "retrying").length;

  // The total is what was pending when the run began; it only grows if more is saved mid-run.
  // Adjusted during render rather than in an effect, so there is no extra paint with a stale count.
  const [runTotal, setRunTotal] = useState(0);
  const nextTotal = syncing ? Math.max(runTotal, pending) : 0;
  if (nextTotal !== runTotal) setRunTotal(nextTotal);

  const progress = syncing && nextTotal > 0 ? { done: Math.max(0, nextTotal - pending), total: nextTotal } : undefined;
  const openConflictOutletId = (run?.stops ?? []).find((stop) => stop.conflict && !stop.resolution)?.outletId;
  return { rows, progress, openConflictOutletId };
}
