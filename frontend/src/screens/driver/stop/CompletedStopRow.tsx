import { Mono } from "../../../shared/ui/Mono";
import { Tag } from "../../../shared/ui/Tag";
import { useT } from "../context/DriverContext";
import { summarizeStopOutcome } from "../stopFormat";
import type { DriverStop } from "../types";
import styles from "./CompletedStopRow.module.css";

export type CompletedStopRowProps = {
  stop: DriverStop;
  /** Mid-run (R3.5 C, R3.7): "moved to trip history" plus "saved on phone, syncs later" or the
   * issue line. All-recorded (R3.9, R3.10): the outlet name plus "signed {name}" and a tag. */
  variant: "midRun" | "allDone";
};

/** A done stop's row on the Run screen: the same summary, worded for the moment it is shown. */
export function CompletedStopRow({ stop, variant }: CompletedStopRowProps) {
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

  return (
    <div className={styles.row}>
      <div>
        <p className={styles.title}>
          <Mono>{stop.outletId}</Mono> · {stop.outletName}
        </p>
        <p className={styles.meta}>
          {summary.receiverName
            ? t("outcome.deliveredSignedBy", { outcome: summary.outcome, time: summary.savedAt, name: summary.receiverName })
            : `${summary.outcome} ${summary.savedAt}`}
        </p>
      </div>
      <Tag kind="success" icon="check">
        {t("stop.savedOnPhone")}
      </Tag>
    </div>
  );
}
