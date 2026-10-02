import { Icon } from "../../../shared/ui/Icon";
import { RecordPill } from "../outbox/RecordPill";
import { Mono } from "../../../shared/ui/Mono";
import { Tag } from "../../../shared/ui/Tag";
import { useT } from "../context/DriverContext";
import { summarizeStopOutcome } from "../stopFormat";
import type { DriverStop } from "../types";
import styles from "./CompletedStopRow.module.css";

export type CompletedStopRowProps = {
  stop: DriverStop;
  /** Mid-run (R3.5 C, R3.7): "moved to trip history" plus "saved on phone, syncs later" or the
   * issue line. Synced: the all-recorded card (R3.9, R3.10, R1.7, R1.8). */
  variant: "midRun" | "synced";
  /** The synced row is a button: it opens the trip history entry (prompt 5; a hook for now). */
  onOpen?: () => void;
  /** The "synced" row while the stop's records still wait on the phone (R3.9, R3.10): cloud icon and a Saved on phone pill. */
  waiting?: boolean;
  /** The stop's records are with Dispatch but its photo is still on the phone (R8.2). */
  photoOnPhone?: boolean;
};

/** A done stop's row on the Run screen: the same summary, worded for the moment it is shown. */
export function CompletedStopRow({ stop, variant, onOpen, waiting, photoOnPhone }: CompletedStopRowProps) {
  const t = useT();
  const summary = summarizeStopOutcome(stop);
  if (!summary) return null;

  if (variant === "midRun") {
    return (
      <div className={styles.row}>
        <div>
          <p className={styles.movedHeading}>{t("outcome.movedToHistory", { outletId: stop.outletId })}</p>
          <p className={styles.meta}>
            {summary.isIssue
              ? t("outcome.issueSent", { outcome: summary.outcome })
              : t("outcome.savedSyncsLater", { outcome: summary.outcome, time: summary.savedAt })}
          </p>
        </div>
        {summary.isIssue && <Tag kind="danger">Issue</Tag>}
      </div>
    );
  }

  if (variant === "synced") {
    // R1.7 and R1.8: after the sync each stop reads as what happened to it, with a way into history.
    const underReview = Boolean(stop.conflict && !stop.resolution);
    const partial = stop.resolution?.decision === "keep_partial";
    return (
      <button type="button" className={[styles.row, styles.syncedRow].join(" ")} onClick={onOpen}>
        <span className={waiting ? styles.syncedCloud : styles.syncedCheck}>
          <Icon name={waiting ? "cloud" : "check"} size={20} />
        </span>
        <span className={styles.syncedStack}>
          <span className={styles.syncedTitle}>
            <Mono>{stop.outletId}</Mono> · {stop.outletName}
          </span>
          <span className={styles.meta}>
            {photoOnPhone
              ? t("run.photoStillOnPhone", { outcome: summary.outcome, time: summary.savedAt })
              : summary.receiverName
                ? t("outcome.deliveredSignedBy", { outcome: summary.outcome, time: summary.savedAt, name: summary.receiverName })
                : `${summary.outcome} ${summary.savedAt}`}
          </span>
          {waiting ? (
            <RecordPill state="saved" />
          ) : photoOnPhone ? (
            <RecordPill state="saved" label={t("run.photoOnPhone")} />
          ) : underReview ? (
            <Tag kind="review" icon="alert-triangle">
              {t("outbox.stateReview")}
            </Tag>
          ) : (
            <Tag kind={summary.isIssue ? "danger" : "success"} icon="check">
              {partial ? t("sync.pillPartial") : summary.outcome}
            </Tag>
          )}
        </span>
        <Icon name="chevron-right" size={20} />
      </button>
    );
  }

  return null;
}
