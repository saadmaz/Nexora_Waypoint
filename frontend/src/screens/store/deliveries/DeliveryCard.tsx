import { Card } from "../../../shared/ui/Card";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { Tag } from "../../../shared/ui/Tag";
import { unitsSum, type Delivery } from "../../../domain/delivery";
import { dayLabel } from "../../../domain/format";
import { windowLabel } from "../../../domain/outlet";
import { ArrivalTile } from "./ArrivalTile";
import styles from "./DeliveryCard.module.css";
import { JourneySection } from "./JourneySection";
import { OrderRows } from "./OrderRows";
import { PodPhoto } from "./PodPhoto";
import { useStore } from "../../../app/StoreContext";

export type DeliveryCardProps = {
  delivery: Delivery;
  /** Offline: what was saved is shown as a summary, without the live cue and journey (S2.S C). */
  offline?: boolean;
};

/**
 * One delivery day on the phone (S2.1 to S2.5, S2.7, S2.8): the orders and where they are,
 * the arrival range and receivers cue, the journey. Everything shown comes from the Delivery
 * the API derived from the record and the clock; this component picks no rule of its own.
 */
export function DeliveryCard({ delivery, offline }: DeliveryCardProps) {
  const { outlet } = useStore();
  const { proof, review, arrival } = delivery;

  return (
    <Card>
      <div className={styles.card} aria-live="polite">
        <div className={styles.header}>
          <div>
            <h2 className={styles.date}>{dayLabel(delivery.date)}</h2>
            <p className={styles.window}>
              Window <Mono>{windowLabel(outlet)}</Mono>
            </p>
          </div>
          <div className={styles.tags}>
            <Tag kind="fresh">Fresh</Tag>
            <Tag>{delivery.dock}</Tag>
          </div>
        </div>

        <OrderRows orders={delivery.orders} />

        {delivery.status === "Ordered" && (
          <p className={styles.line}>
            Confirmed at <Mono>16:00</Mono> when orders close.
          </p>
        )}

        {delivery.status === "Confirmed" && (
          <>
            <p className={styles.line}>Confirmed for {dayLabel(delivery.date)}.</p>
            <p className={styles.notice}>
              <Icon name="info" size={20} color="route" />
              <span>Plan not released yet, arrival time follows.</span>
            </p>
          </>
        )}

        {delivery.loaded && (
          <p className={styles.line}>
            Loaded at {delivery.loaded.place} <Mono>{delivery.loaded.at}</Mono> · {unitsSum(delivery)} units on board
          </p>
        )}

        {arrival && (delivery.status === "Planned" || delivery.status === "Loaded" || delivery.status === "Departed") && (
          <ArrivalTile
            arrival={arrival}
            {...(delivery.vehicle ? { vehicle: delivery.vehicle } : {})}
            {...(delivery.onTheWay ? { onTheWay: delivery.onTheWay } : {})}
          />
        )}

        {delivery.receiversCue && arrival && !offline && (
          <div className={styles.cue}>
            <Icon name="user" size={20} color="route" />
            <div>
              <p className={styles.cueTitle}>
                Have receivers ready by <Mono>{arrival.from}</Mono>
              </p>
              {arrival.mayArriveAt && (
                <p className={styles.cueDetail}>
                  Truck may arrive <Mono>{arrival.mayArriveAt}</Mono> and wait
                </p>
              )}
            </div>
          </div>
        )}

        {delivery.lastUpdate && !offline && (
          <p className={styles.muted}>
            <Icon name="wifi-off" size={16} />
            <span>
              Last update <Mono>{delivery.lastUpdate}</Mono>: records arrive when the driver is back in coverage.
            </span>
          </p>
        )}

        {review && proof && (
          <>
            <p className={styles.line}>
              Delivery recorded <Mono>{review.deliveredAt}</Mono>, received by {review.receivedBy}. Dispatch is
              reviewing.
            </p>
            <div className={styles.pod}>
              <PodPhoto />
              <div>
                <p className={styles.podWho}>
                  {proof.receivedBy} · <Mono>{proof.at}</Mono> · <Mono>{proof.vehicle}</Mono>
                </p>
                <p className={styles.podCaption}>Proof of delivery</p>
              </div>
            </div>
          </>
        )}

        {delivery.status === "Delivered" && proof && (
          <>
            {(delivery.tags.length > 0 || delivery.withdrawnNote) && (
              <div className={styles.tagsRow}>
                {delivery.tags.includes("Deferral withdrawn") && <Tag>Deferral withdrawn</Tag>}
                {delivery.tags.includes("Receipt confirmed") && (
                  <Tag kind="success">
                    Receipt confirmed <Mono>{delivery.receiptConfirmedAt}</Mono>
                  </Tag>
                )}
                {delivery.withdrawnNote && <span className={styles.note}>{delivery.withdrawnNote}</span>}
              </div>
            )}
            <p className={styles.line}>
              Delivered <Mono>{proof.at}</Mono> · received by {proof.receivedBy} · {unitsSum(delivery)} units
            </p>
          </>
        )}

        {!review && !offline && <JourneySection journey={delivery.journey} />}
      </div>
    </Card>
  );
}
