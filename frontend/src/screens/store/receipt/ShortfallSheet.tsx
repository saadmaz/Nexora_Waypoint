import { useState } from "react";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { Sheet } from "../../../shared/ui/Sheet";
import type { DeliveryOrder } from "../../../domain/delivery";
import { unitsLabel } from "../../../domain/estimate";
import styles from "./ShortfallSheet.module.css";

/** Why the count is short, offered before a receipt with a shortfall is sent. */
const REASONS = ["Missing", "Damaged", "Wrong item", "Other"] as const;
export type ShortfallReason = (typeof REASONS)[number];

export type ShortfallSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: DeliveryOrder[];
  counts: Record<string, number>;
  busy: boolean;
  onConfirm: (reason: ShortfallReason) => void;
};

/**
 * "Confirm with a shortfall" asks for a reason before it is sent (S3 rationale). Lists what was
 * counted against what was expected, then the reason, then sends.
 */
export function ShortfallSheet({ open, onOpenChange, orders, counts, busy, onConfirm }: ShortfallSheetProps) {
  const [reason, setReason] = useState<ShortfallReason>("Missing");
  const short = orders.filter((order) => (counts[order.id] ?? order.units) < order.units);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Confirm with a shortfall">
      <div className={styles.body}>
        <ul className={styles.list}>
          {short.map((order) => (
            <li className={styles.row} key={order.id}>
              <Mono>{order.id}</Mono>
              <span>
                {counts[order.id] ?? order.units} of {unitsLabel(order.units)}
              </span>
            </li>
          ))}
        </ul>
        <fieldset className={styles.group}>
          <legend className={styles.label}>Why is it short</legend>
          <div className={styles.chips}>
            {REASONS.map((option) => (
              <button
                type="button"
                key={option}
                className={[styles.chip, option === reason && styles.chipOn].filter(Boolean).join(" ")}
                aria-pressed={option === reason}
                onClick={() => setReason(option)}
              >
                {option === reason && <Icon name="check" size={16} />}
                {option}
              </button>
            ))}
          </div>
        </fieldset>
        <Button busy={busy} disabled={busy} onClick={() => onConfirm(reason)}>
          {busy ? "Sending…" : "Confirm with a shortfall"}
        </Button>
      </div>
    </Sheet>
  );
}
