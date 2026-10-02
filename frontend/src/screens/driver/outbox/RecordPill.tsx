import { Icon, type IconName } from "../../../shared/ui/Icon";
import { useT } from "../context/DriverContext";
import type { OutboxRowState } from "./outboxModel";
import styles from "./RecordPill.module.css";

const PILL: Record<OutboxRowState, { icon: IconName; key: string; tone: "saved" | "sending" | "synced" | "review" }> = {
  saved: { icon: "cloud", key: "outbox.stateSaved", tone: "saved" },
  sending: { icon: "refresh-cw", key: "outbox.stateSending", tone: "sending" },
  synced: { icon: "check", key: "outbox.stateSynced", tone: "synced" },
  review: { icon: "alert-triangle", key: "outbox.stateReview", tone: "review" },
  retrying: { icon: "cloud", key: "outbox.stateSaved", tone: "saved" },
};

/** Where a record is: Saved on phone, Sending, Synced or Sent for review. `label` swaps the word (R5.3's "Delivered"). */
export function RecordPill({ state, label }: { state: OutboxRowState; label?: string }) {
  const t = useT();
  const pill = PILL[state];
  return (
    <span className={[styles.pill, styles[pill.tone]].join(" ")}>
      <Icon name={pill.icon} size={14} />
      {label ?? t(pill.key)}
    </span>
  );
}
