import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { JourneyTimeline } from "../../../shared/ui/JourneyTimeline";
import { Mono } from "../../../shared/ui/Mono";
import { StatusPill } from "../../../shared/ui/StatusPill";
import { Tag } from "../../../shared/ui/Tag";
import { unitsLabel } from "../../../domain/estimate";
import { clockTime, dayLabel, displayStatus } from "../../../domain/format";
import type { Order } from "../../../domain/order";
import { windowLabel } from "../../../domain/outlet";
import { isPlanReleased } from "../../../domain/schedule";
import styles from "./ReceivedView.module.css";
import { useStore } from "../../../app/StoreContext";

export type ReceivedViewProps = {
  orders: Order[];
  now: Date;
  /** Opens the edit form. Only offered before the cutoff. */
  onEdit: () => void;
  onSeeDeliveries: () => void;
};

/**
 * S1.3 (received) and S1.3 C (updated): the acknowledgement, what happens
 * next, and Edit order while the 16:00 cutoff has not passed.
 */
export function ReceivedView({ orders, now, onEdit, onSeeDeliveries }: ReceivedViewProps) {
  const { outlet } = useStore();
  const first = orders[0];
  if (!first) return null;

  const updatedAt = orders
    .map((o) => o.updatedAt)
    .filter((t): t is string => Boolean(t))
    .sort()
    .at(-1);
  const receivedAt = orders.map((o) => o.receivedAt).sort()[0] ?? first.receivedAt;
  const editable = orders.every((o) => displayStatus(o, now) === "Ordered");
  const released = isPlanReleased(first.deliveryDate, now);

  return (
    <>
      <section className={styles.ack} aria-labelledby="ack-title">
        <div className={styles.ackHead}>
          <Icon name="circle-check" size={24} color="success" />
          <h1 className={styles.ackTitle} id="ack-title">
            {updatedAt ? "Updated" : "Received"} <Mono>{clockTime(updatedAt ?? receivedAt)}</Mono>
          </h1>
        </div>
        <p className={styles.counts}>Counts for {dayLabel(first.deliveryDate)}.</p>
        <div className={styles.orders}>
          <ul className={styles.orderList}>
            {orders.map((order) => (
              <li className={styles.order} key={order.id}>
                <div>
                  <div className={styles.orderTop}>
                    <Mono>{order.id}</Mono>
                    {order.line.kind === "chilled" ? (
                      <Tag kind="chilled">Chilled</Tag>
                    ) : (
                      <Tag kind="ambient">Ambient</Tag>
                    )}
                  </div>
                  <div className={styles.units}>{unitsLabel(order.line.units)}</div>
                </div>
                <StatusPill status={displayStatus(order, now)} />
              </li>
            ))}
          </ul>
        </div>
        {editable && (
          <p className={styles.note}>
            Confirmed at <Mono>16:00</Mono> when orders close.
          </p>
        )}
      </section>

      {(editable || !released) && (
        <ul className={styles.facts}>
          {editable && (
            <li>
              <Icon name="clock" size={16} />
              <span>
                You can edit until <Mono>16:00</Mono>
              </span>
            </li>
          )}
          {!released && (
            <li>
              <Icon name="calendar" size={16} />
              <span>
                Arrival time is shown after the plan is released at <Mono>23:40</Mono>
              </span>
            </li>
          )}
        </ul>
      )}

      {editable && (
        <Button variant="secondary" onClick={onEdit}>
          Edit order
        </Button>
      )}

      <section aria-labelledby="next-title">
        <h2 className={styles.next} id="next-title">
          What happens next
        </h2>
        <JourneyTimeline
          metaAlign="right"
          steps={[
            { label: "Confirmed", meta: <Mono>16:00</Mono>, state: editable ? "pending" : "done" },
            { label: "Arrival time shared", meta: <Mono>23:40</Mono>, state: released ? "done" : "pending" },
            { label: "Delivery window", meta: <Mono>{windowLabel(outlet)}</Mono>, state: "pending" },
          ]}
        />
      </section>

      <Button variant="ghost" size="medium" auto iconRight="chevron-right" onClick={onSeeDeliveries}>
        See deliveries
      </Button>
    </>
  );
}
