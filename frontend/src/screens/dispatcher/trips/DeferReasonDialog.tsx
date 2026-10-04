import { useState } from "react";
import { Check, Redo2 } from "lucide-react";
import { Modal } from "../../../shared/ui/Modal";
import { Mono } from "../../../shared/ui/Mono";
import { Btn } from "../ui/Btn";
import { cx } from "../ui/cx";
import styles from "./Trips.module.css";

/** The reasons a dispatcher gives most often for holding an order back (dispatch fix plan, decision D). */
const DEFER_REASONS = ["Over capacity", "Window cannot be met", "Store asked to move it", "Vehicle unavailable"] as const;
const OTHER = "Other";
/** The server keeps up to this many characters. */
const MAX_REASON = 200;

export type DeferReasonDialogProps = {
  orderId: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

/**
 * Asked before a deferral on the trip board is saved: the booklet has the dispatcher decide which orders wait and record why.
 * Whether it is a capacity or a policy deferral stays the rules' call; this is only the dispatcher's reason, shown in D4 and
 * in the store's notice.
 */
export function DeferReasonDialog({ orderId, busy, error, onCancel, onConfirm }: DeferReasonDialogProps) {
  const [choice, setChoice] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const reason = choice === OTHER ? other.trim() : (choice ?? "");

  return (
    <Modal open onOpenChange={(o) => !o && !busy && onCancel()} title={`Why defer ${orderId}?`}>
      <div className={styles.reasonDialog}>
        <p className={styles.reasonLead}>
          <Mono>{orderId}</Mono> waits for the next run. The reason goes to Deferrals and to the store.
        </p>
        <div className={styles.reasonList} role="radiogroup" aria-label="Reason">
          {[...DEFER_REASONS, OTHER].map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={choice === r}
              className={cx(styles.reasonOption, choice === r && styles.reasonOptionOn)}
              onClick={() => setChoice(r)}
            >
              {choice === r && <Check size={15} />}
              {r}
            </button>
          ))}
        </div>
        {choice === OTHER && (
          <input
            className={styles.reasonInput}
            aria-label="Other reason"
            value={other}
            maxLength={MAX_REASON}
            placeholder="A few words for Deferrals and the store"
            autoFocus
            onChange={(e) => setOther(e.target.value)}
          />
        )}
        {error && <div className={styles.reasonError}>{error}</div>}
        <div className={styles.reasonActions}>
          <Btn variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Btn>
          <Btn icon={<Redo2 size={16} />} disabled={busy || !reason} onClick={() => onConfirm(reason)}>
            Defer {orderId}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
