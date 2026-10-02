import { useState } from "react";
import { Check, Info, Redo2, WifiOff } from "lucide-react";
import type { DeferralKind, LiveStop } from "../../../api/DispatcherApi";
import { Modal } from "../../../shared/ui/Modal";
import { Mono } from "../../../shared/ui/Mono";
import { Btn } from "../ui/Btn";
import { Checkbox } from "../ui/Checkbox";
import { TempChip } from "../ui/Chip";
import { cx } from "../ui/cx";
import styles from "./Live.module.css";

const KINDS: { kind: DeferralKind; label: string; sub?: string; off?: boolean }[] = [
  { kind: "store request", label: "Store request" },
  { kind: "policy", label: "Policy" },
  { kind: "capacity", label: "Capacity", sub: "A legal vehicle exists", off: true },
];

const REASONS: Record<string, string[]> = {
  "store request": ["Receiving staff unavailable", "Store closed", "Store asked to wait"],
  policy: ["Protects a tighter window", "Keeps a protected stop on its trip"],
  capacity: [],
};

export type DeferStopDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stop: LiveStop | undefined;
  /** The vehicle's phone cannot be reached, so the change will wait for it. */
  vehicleId: string;
  offlineSince: string | undefined;
  /** The version the deferral creates ("v5"). */
  nextVersion: number;
  busy: boolean;
  error: string | null;
  onConfirm: (request: { orderIds: string[]; kind: DeferralKind; reason: string }) => void;
};

/** D6.3: defer a stop after release. It always creates a new plan version, and says who will and will not hear of it at once. */
export function DeferStopDialog({ open, onOpenChange, stop, vehicleId, offlineSince, nextVersion, busy, error, onConfirm }: DeferStopDialogProps) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(stop?.orders.map((o) => o.id) ?? []));
  const [kind, setKind] = useState<DeferralKind>("store request");
  const [reasonChip, setReasonChip] = useState(REASONS["store request"]![0]!);
  const [note, setNote] = useState("");

  if (!stop) return null;
  const ids = stop.orders.map((o) => o.id).filter((id) => picked.has(id));
  const choose = (next: DeferralKind) => {
    setKind(next);
    setReasonChip(REASONS[next]?.[0] ?? "");
  };
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };
  const reason = [reasonChip, note.trim()].filter(Boolean).join(": ");

  return (
    <Modal open={open} onOpenChange={(o) => !busy && onOpenChange(o)} title={`Defer stop ${stop.outletId}`}>
      <div className={styles.dialog}>
        <div className={styles.orderPick}>
          {stop.orders.map((o) => (
            <div key={o.id} className={styles.orderPickItem}>
              <Checkbox checked={picked.has(o.id)} onChange={() => toggle(o.id)}>
                <Mono>{o.id}</Mono>
              </Checkbox>
              <TempChip temp={o.temp} small />
              <Mono>{o.units} units</Mono>
            </div>
          ))}
        </div>

        <div>
          <div className={styles.label}>Deferral type</div>
          <div className={styles.segments} role="radiogroup" aria-label="Deferral type">
            {KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                role="radio"
                aria-checked={kind === k.kind}
                disabled={k.off}
                className={cx(styles.segment, kind === k.kind && styles.segmentOn, k.off && styles.segmentOff)}
                onClick={() => choose(k.kind)}
              >
                <span>
                  {kind === k.kind && <Check size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />}
                  {k.label}
                </span>
                {k.sub && <small>{k.sub}</small>}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className={styles.label}>Reason</div>
          <div className={styles.reasonRow}>
            {(REASONS[kind] ?? []).slice(0, 1).map((r) => (
              <button key={r} type="button" className={cx(styles.segment, styles.segmentOn)} onClick={() => setReasonChip(r)}>
                <span>
                  <Check size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  {r}
                </span>
              </button>
            ))}
            <input aria-label="Reason note" value={note} placeholder="Who asked, and when" onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div className={styles.nextRun}>
          <span className={styles.label}>Next run</span>
          <Mono>Wed 30 Sep · from 05:30</Mono>
        </div>

        {offlineSince && (
          <div className={styles.dialogWarn}>
            <WifiOff size={20} />
            <div>
              <b>
                {vehicleId} offline since {offlineSince}, this change cannot reach the driver.
              </b>
              The truck may still deliver. If it does, you'll get a conflict to settle.
            </div>
          </div>
        )}
        <div className={styles.dialogNote}>
          <Info size={15} />
          Creates plan v{nextVersion} · Store told now · {offlineSince ? "Kandy dock and driver get" : "Dock and driver get"} v{nextVersion} {offlineSince ? "on next sync" : "at once"}
        </div>
        {error && <div className={styles.dialogError}>{error}</div>}
        <div className={styles.dialogActions}>
          <Btn variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Btn>
          <Btn icon={<Redo2 size={16} />} disabled={busy || ids.length === 0} onClick={() => onConfirm({ orderIds: ids, kind, reason })}>
            Defer and create v{nextVersion}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
