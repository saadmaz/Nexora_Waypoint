import type { ReactNode } from "react";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Facts } from "../../../shared/ui/Facts";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { Tag } from "../../../shared/ui/Tag";
import { unitsSum, type Delivery } from "../../../domain/delivery";
import { dayLabel } from "../../../domain/format";
import type { RecentOrderDay } from "../../../domain/order";
import { windowLabel } from "../../../domain/outlet";
import { RecentOrdersTable } from "../orders/RecentOrdersTable";
import { ArrivalTile } from "./ArrivalTile";
import styles from "./DesktopDelivery.module.css";
import { JourneySection } from "./JourneySection";
import { OrderRows } from "./OrderRows";
import { PodPhoto } from "./PodPhoto";
import { useStore } from "../../../app/StoreContext";

export type DesktopDeliveryProps = {
  delivery: Delivery;
  recent: RecentOrderDay[];
  /** Confirm receipt, offered once the truck has delivered and the store has not yet confirmed. */
  onConfirmReceipt: () => void;
  disabled?: boolean;
  /** Anything to show above the card, such as the review notice. */
  notice?: ReactNode;
};

/**
 * S2.11, the desktop delivery: the day, its horizontal journey and orders on the left, the
 * proof of delivery with Confirm receipt on the right. Recent orders sit under the card, in
 * the same table S1.6 uses.
 */
export function DesktopDelivery({ delivery, recent, onConfirmReceipt, disabled, notice }: DesktopDeliveryProps) {
  const { outlet } = useStore();
  const { proof } = delivery;
  const canConfirm = delivery.status === "Delivered" && !delivery.receiptConfirmedAt;

  return (
    <div className={styles.body}>
      <div className={styles.main}>
        <header>
          <h1 className={styles.title}>{dayLabel(delivery.date)}</h1>
          <p className={styles.sub}>
            Window <Mono>{windowLabel(outlet)}</Mono> · {delivery.dock}
            {delivery.vehicle && (
              <>
                {" "}
                · <Mono>{delivery.vehicle}</Mono>
              </>
            )}
          </p>
        </header>
        {notice}
        <Card>
          <div className={styles.card}>
            <div className={styles.head}>
              <h2 className={styles.cardTitle}>Delivery</h2>
              <span className={styles.tags}>
                <Tag kind="fresh">Fresh</Tag>
                <Tag>{delivery.dock}</Tag>
              </span>
            </div>
            <JourneySection journey={delivery.journey} orientation="horizontal" />
            <OrderRows orders={delivery.orders} />
            {delivery.status === "Confirmed" && (
              <p className={styles.notice}>
                <Icon name="info" size={20} color="route" />
                <span>Plan not released yet, arrival time follows.</span>
              </p>
            )}
            {delivery.arrival &&
              (delivery.status === "Planned" || delivery.status === "Loaded" || delivery.status === "Departed") && (
              <ArrivalTile
                arrival={delivery.arrival}
                {...(delivery.vehicle ? { vehicle: delivery.vehicle } : {})}
                {...(delivery.onTheWay ? { onTheWay: delivery.onTheWay } : {})}
              />
            )}
            {delivery.receiversCue && delivery.arrival && (
              <p className={styles.cue}>
                <Icon name="user" size={20} color="route" />
                <span>
                  Have receivers ready by <Mono>{delivery.arrival.from}</Mono>
                  {delivery.arrival.mayArriveAt && (
                    <>
                      . Truck may arrive <Mono>{delivery.arrival.mayArriveAt}</Mono> and wait.
                    </>
                  )}
                </span>
              </p>
            )}
            {proof && (
              <p className={styles.line}>
                Delivered <Mono>{proof.at}</Mono> · received by {proof.receivedBy} · {unitsSum(delivery)} units
              </p>
            )}
          </div>
        </Card>
        <section aria-labelledby="recent-title">
          <h2 className={styles.recent} id="recent-title">
            Recent orders
          </h2>
          <RecentOrdersTable days={recent} />
        </section>
      </div>

      {proof && (
        <aside className={styles.side}>
          <Card>
            <div className={styles.pod}>
              <h2 className={styles.cardTitle}>Proof of delivery</h2>
              <PodPhoto size="large" caption={`Photo · ${proof.at} · ${proof.receivedBy}`} />
              <Facts
                ruled
                items={[
                  { key: "Received by", value: proof.receivedBy },
                  { key: "Time", value: <Mono>{proof.at}</Mono> },
                  { key: "Driver", value: <Mono>{`${proof.driver} · ${proof.vehicle}`}</Mono> },
                  { key: "Units", value: <Mono>{proof.units.join(" + ")}</Mono> },
                ]}
              />
              {canConfirm && (
                <Button disabled={disabled} onClick={onConfirmReceipt}>
                  Confirm receipt
                </Button>
              )}
            </div>
          </Card>
        </aside>
      )}
    </div>
  );
}
