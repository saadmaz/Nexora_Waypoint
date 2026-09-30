import { Card } from "../../../shared/ui/Card";
import { Mono } from "../../../shared/ui/Mono";
import { Tag } from "../../../shared/ui/Tag";
import { UnitStepper } from "../../../shared/ui/UnitStepper";
import type { DeliveryOrder } from "../../../domain/delivery";
import styles from "./ReceiptCounts.module.css";

export type ReceiptCountsProps = {
  orders: DeliveryOrder[];
  /** Units counted per order ID. */
  counts: Record<string, number>;
  onChange: (orderId: string, units: number) => void;
  disabled?: boolean;
};

/**
 * "Delivered / expected" on the receipt: one stepper per order, starting at what was expected.
 * Lowering a count is a shortfall, and the main button then reads "Confirm with a shortfall".
 */
export function ReceiptCounts({ orders, counts, onChange, disabled }: ReceiptCountsProps) {
  return (
    <Card>
      <div className={styles.card}>
        <div className={styles.head}>
          <span>Order</span>
          <span>Delivered / expected</span>
        </div>
        <ul className={styles.list}>
          {orders.map((order) => (
            <li className={styles.row} key={order.id}>
              <div className={styles.who}>
                <Mono>{order.id}</Mono>
                <div>{order.kind === "chilled" ? <Tag kind="chilled">Chilled</Tag> : <Tag kind="ambient">Ambient</Tag>}</div>
              </div>
              <UnitStepper
                value={counts[order.id] ?? order.units}
                onChange={(units) => onChange(order.id, units)}
                max={order.units}
                expected={order.units}
                compact
                label={`${order.kind === "chilled" ? "chilled" : "dry"} unit`}
                {...(disabled ? { disabled: true } : {})}
              />
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
