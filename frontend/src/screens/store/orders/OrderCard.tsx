import { StatusPill } from "../../../shared/ui/StatusPill";
import { Card } from "../../../shared/ui/Card";
import { Tag } from "../../../shared/ui/Tag";
import { UnitStepper } from "../../../shared/ui/UnitStepper";
import type { OrderKind, UnitFactors } from "../../../domain/order";
import { estimateFor, formatEstimate } from "../../../domain/estimate";
import styles from "./OrderCard.module.css";

const CARD: Record<OrderKind, { title: string; temp: string }> = {
  chilled: { title: "Chilled", temp: "Chilled" },
  dry: { title: "Dry", temp: "Ambient" },
};

export type OrderCardProps = {
  kind: OrderKind;
  units: number;
  /** Per-unit kg and m3 from the API, so the estimate can follow the stepper. */
  factors: UnitFactors;
  onChange: (units: number) => void;
  /** Show the Pending sync pill (S1.5 A, queued offline). */
  pendingSync?: boolean;
  disabled?: boolean;
};

/**
 * One order card: Chilled or Dry, its tags, and the unit stepper. The kg and m3
 * estimate is computed from the unit count every render, so it follows the
 * stepper (12 units is about 70 kg, 10 units about 58 kg).
 */
export function OrderCard({ kind, units, factors, onChange, pendingSync, disabled }: OrderCardProps) {
  const { title, temp } = CARD[kind];
  return (
    <Card>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          {pendingSync && <StatusPill status="Pending sync" />}
        </div>
        <div className={styles.tags}>
          <Tag kind="fresh">Fresh</Tag>
          {kind === "chilled" ? <Tag kind="chilled">{temp}</Tag> : <Tag kind="ambient">{temp}</Tag>}
        </div>
        <div className={styles.units}>
          <div className={styles.estimate}>
            <span className={styles.label}>Units</span>
            <span className={styles.figures}>{formatEstimate(estimateFor(factors, kind, units))}</span>
          </div>
          <UnitStepper
            value={units}
            onChange={onChange}
            label={`${title.toLowerCase()} unit`}
            {...(disabled ? { disabled: true } : {})}
          />
        </div>
      </div>
    </Card>
  );
}
