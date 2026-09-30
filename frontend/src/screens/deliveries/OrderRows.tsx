import { Mono } from "../../components/ui/Mono";
import { StatusPill } from "../../components/ui/StatusPill";
import { Tag } from "../../components/ui/Tag";
import type { DeliveryOrder } from "../../domain/delivery";
import { unitsLabel } from "../../domain/estimate";
import styles from "./OrderRows.module.css";

/** The orders on a delivery day: ID, temperature tag and units on the left, status pill on the right. */
export function OrderRows({ orders }: { orders: DeliveryOrder[] }) {
  return (
    <ul className={styles.list}>
      {orders.map((order) => (
        <li className={styles.row} key={order.id}>
          <div>
            <div className={styles.top}>
              <Mono>{order.id}</Mono>
              {order.kind === "chilled" ? <Tag kind="chilled">Chilled</Tag> : <Tag kind="ambient">Ambient</Tag>}
            </div>
            <div className={styles.units}>{unitsLabel(order.units)}</div>
          </div>
          <StatusPill status={order.status} />
        </li>
      ))}
    </ul>
  );
}
