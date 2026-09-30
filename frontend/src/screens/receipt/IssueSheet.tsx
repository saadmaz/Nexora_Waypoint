import { useState } from "react";
import type { ReportIssueInput } from "../../api/StoreApi";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Mono } from "../../components/ui/Mono";
import { Sheet } from "../../components/ui/Sheet";
import { Tag } from "../../components/ui/Tag";
import { UnitStepper } from "../../components/ui/UnitStepper";
import type { DeliveryOrder } from "../../domain/delivery";
import { unitsLabel } from "../../domain/estimate";
import { REPORTABLE_ISSUES, type IssueType } from "../../domain/issue";
import styles from "./IssueSheet.module.css";

/** What the sheet hands back when the store presses Send to Dispatch. */
export type IssueReport = Pick<ReportIssueInput, "type" | "lines" | "note" | "photo">;

export type IssueSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: DeliveryOrder[];
  /** Sends the report. Offline it cannot go, so the button says so instead. */
  online: boolean;
  busy: boolean;
  onSend: (report: IssueReport) => void;
};

/** Units an affected line starts at (S3.3 draws 2 of 12), never more than the order has. */
function startUnits(order: DeliveryOrder): number {
  return Math.min(2, order.units);
}

/**
 * S3.3, "Report an issue": what happened (one), which orders it affects (any), how many units
 * of each, an optional photo and note. Neutral by design: it sits behind a secondary button so
 * it is not pressed by accident.
 */
export function IssueSheet({ open, onOpenChange, orders, online, busy, onSend }: IssueSheetProps) {
  const [type, setType] = useState<IssueType>("Missing");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(orders.slice(0, 1).map((o) => o.id)));
  const [units, setUnits] = useState<Record<string, number>>(() =>
    Object.fromEntries(orders.map((order) => [order.id, startUnits(order)])),
  );
  const [photo, setPhoto] = useState(false);
  const [note, setNote] = useState("");

  const chosen = orders.filter((order) => selected.has(order.id));

  function toggle(orderId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function send() {
    const trimmed = note.trim();
    onSend({
      type,
      lines: chosen.map((order) => ({ orderId: order.id, units: units[order.id] ?? startUnits(order) })),
      ...(trimmed ? { note: trimmed } : {}),
      photo,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Report an issue">
      <div className={styles.body}>
        <fieldset className={styles.group}>
          <legend className={styles.label}>What happened</legend>
          <div className={styles.chips}>
            {REPORTABLE_ISSUES.map((option) => (
              <button
                type="button"
                key={option}
                className={[styles.chip, option === type && styles.chipOn].filter(Boolean).join(" ")}
                aria-pressed={option === type}
                onClick={() => setType(option)}
              >
                {option === type ? <Icon name="check" size={16} /> : option === "Arrived warm" && <Icon name="snowflake" size={16} />}
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.label}>Affected order</legend>
          <div className={styles.orders}>
            {orders.map((order) => (
              <label
                key={order.id}
                className={[styles.order, selected.has(order.id) && styles.orderOn].filter(Boolean).join(" ")}
              >
                <input
                  type="checkbox"
                  className={styles.check}
                  checked={selected.has(order.id)}
                  onChange={() => toggle(order.id)}
                />
                <span className={styles.orderId}>
                  <Mono>{order.id}</Mono>
                </span>
                {order.kind === "chilled" ? <Tag kind="chilled">Chilled</Tag> : <Tag kind="ambient">Ambient</Tag>}
                <span className={styles.orderUnits}>{unitsLabel(order.units)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {chosen.map((order) => (
          <div className={styles.group} key={order.id}>
            <p className={styles.label}>
              Units affected · <Mono>{order.id}</Mono>
            </p>
            <div className={styles.units}>
              <UnitStepper
                value={units[order.id] ?? startUnits(order)}
                onChange={(next) => setUnits((prev) => ({ ...prev, [order.id]: next }))}
                min={1}
                max={order.units}
                label={`${order.id} unit affected`}
              />
              <span className={styles.of}>of {order.units}</span>
            </div>
          </div>
        ))}

        <div className={styles.extras}>
          <button
            type="button"
            className={[styles.photo, photo && styles.photoOn].filter(Boolean).join(" ")}
            aria-pressed={photo}
            onClick={() => setPhoto((on) => !on)}
          >
            <Icon name={photo ? "check" : "camera"} size={20} />
            {photo ? "Photo added" : "Add photo"}
          </button>
          <textarea
            className={styles.note}
            placeholder="Add a short note (optional)"
            aria-label="Add a short note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {!online && <p className={styles.offline}>You're offline. Reconnect to send this to Dispatch.</p>}
        <Button busy={busy} disabled={busy || !online || chosen.length === 0} onClick={send}>
          {busy ? "Sending…" : "Send to Dispatch"}
        </Button>
      </div>
    </Sheet>
  );
}
