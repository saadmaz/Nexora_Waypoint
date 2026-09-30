import { Card } from "../../components/ui/Card";
import { Mono } from "../../components/ui/Mono";
import { StatusPill } from "../../components/ui/StatusPill";
import { Tag } from "../../components/ui/Tag";
import type { Delivery } from "../../domain/delivery";
import { dayLabel } from "../../domain/format";
import styles from "./DeliverySummary.module.css";

/** The line after the order IDs: when it arrives, when it was delivered, or what is happening. */
function detail(delivery: Delivery) {
  if (delivery.deferral) return <>next run {delivery.deferral.nextRun.split(" · ")[0]}</>;
  if (delivery.review) return <>Dispatch is reviewing</>;
  if (delivery.proof) {
    return (
      <>
        delivered <Mono>{delivery.proof.at}</Mono>
      </>
    );
  }
  if (delivery.arrival) {
    return (
      <>
        arrives from <Mono>{delivery.arrival.from}</Mono>
      </>
    );
  }
  return <>arrival time follows</>;
}

export type DeliverySummaryProps = {
  delivery: Delivery;
  onOpen: () => void;
};

/**
 * One delivery day as a tappable card on the Deliveries list (S2.10): the day, its status
 * and one line. The whole card opens that day's delivery.
 */
export function DeliverySummary({ delivery, onOpen }: DeliverySummaryProps) {
  const first = delivery.orders[0];
  return (
    <Card padded={false}>
      <button type="button" className={styles.card} onClick={onOpen}>
        <span className={styles.top}>
          <span className={styles.date}>{dayLabel(delivery.date)}</span>
          <span className={styles.tags}>
            <Tag kind="fresh">Fresh</Tag>
            <Tag>{delivery.dock}</Tag>
          </span>
        </span>
        <span className={styles.bottom}>
          <StatusPill
            status={delivery.status}
            {...(delivery.deferral
              ? { deferral: { type: delivery.deferral.type, nextRunShort: delivery.deferral.nextRunShort } }
              : {})}
          />
          <span className={styles.detail}>
            {delivery.orders.map((order, i) => (
              <span key={order.id}>
                {i > 0 && " · "}
                <Mono>{order.id}</Mono>
              </span>
            ))}
            {first ? " · " : ""}
            {detail(delivery)}
          </span>
        </span>
      </button>
    </Card>
  );
}
