import type { ReactNode } from "react";
import { Alert } from "../../components/ui/Alert";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { JourneyTimeline } from "../../components/ui/JourneyTimeline";
import { Mono } from "../../components/ui/Mono";
import { StatusPill } from "../../components/ui/StatusPill";
import { Tag } from "../../components/ui/Tag";
import type { Delivery, DeliveryOrder } from "../../domain/delivery";
import { unitsLabel } from "../../domain/estimate";
import { dayLabel } from "../../domain/format";
import { affectedText, type Issue } from "../../domain/issue";
import { ReviewNotice } from "../deliveries/ReviewNotice";
import styles from "./ReceiptOutcome.module.css";

/** "Reported 07:32 · ORD2001 · 2 units short · photo attached" */
function reportedLine(issue: Issue): ReactNode {
  return (
    <>
      Reported <Mono>{issue.reportedAt}</Mono>
      {issue.lines.map((line) => (
        <span key={line.orderId}>
          {" · "}
          <Mono>{line.orderId}</Mono> · {affectedText(issue.type, line)}
        </span>
      ))}
      {issue.photo && " · photo attached"}
    </>
  );
}

function OrderStatusCell({ order, receipt }: { order: DeliveryOrder; receipt: boolean }) {
  return (
    <div className={styles.status}>
      <StatusPill status={order.status} />
      {order.issue && <Tag kind="danger">{order.issue}</Tag>}
      {receipt && !order.issue && (
        <Tag kind="success" icon="check">
          Receipt confirmed
        </Tag>
      )}
    </div>
  );
}

export type ReceiptOutcomeProps = {
  delivery: Delivery;
  /** The receipt is confirmed while Dispatch's review is still open (S3.6). */
  reviewOpen?: boolean;
};

/**
 * What the receipt page shows once the store has acted: Receipt confirmed (S3.2), confirmed while
 * the review is still open (S3.6), or an issue reported (S3.4). Says who already knows.
 */
export function ReceiptOutcome({ delivery, reviewOpen }: ReceiptOutcomeProps) {
  const confirmed = Boolean(delivery.receiptConfirmedAt);
  const issue = delivery.issues[0];
  const shortOrders = delivery.orders.filter((order) => order.received !== undefined);
  const at = delivery.receiptConfirmedAt;

  return (
    <>
      {confirmed && !issue && (
        <Alert
          tone="success"
          icon="circle-check"
          title={
            reviewOpen ? (
              <>
                Receipt confirmed <Mono>{at}</Mono>.
              </>
            ) : (
              <>
                Receipt confirmed <Mono>{at}</Mono> · {delivery.receiptBy}
              </>
            )
          }
        />
      )}
      {reviewOpen && delivery.review && (
        <ReviewNotice review={delivery.review} extra="Your receipt is saved. Dispatch will close this review. No action needed from you." />
      )}

      <Card>
        <div className={styles.card}>
          <div className={styles.header}>
            <h2 className={styles.date}>{dayLabel(delivery.date)}</h2>
            <div className={styles.tags}>
              <Tag kind="fresh">Fresh</Tag>
              <Tag>{delivery.dock}</Tag>
            </div>
          </div>
          <ul className={styles.orders}>
            {delivery.orders.map((order) => (
              <li className={styles.order} key={order.id}>
                <div>
                  <div className={styles.top}>
                    <Mono>{order.id}</Mono>
                    {order.kind === "chilled" ? <Tag kind="chilled">Chilled</Tag> : <Tag kind="ambient">Ambient</Tag>}
                  </div>
                  <div className={styles.units}>{unitsLabel(order.units)}</div>
                </div>
                <OrderStatusCell order={order} receipt={confirmed} />
              </li>
            ))}
          </ul>
          {issue && <p className={styles.line}>{reportedLine(issue)}</p>}
          {!issue &&
            shortOrders.map((order) => (
              <p className={styles.line} key={order.id}>
                <Mono>{order.id}</Mono> · {order.received} of {unitsLabel(order.units)} received
                {delivery.shortfallReason ? ` · ${delivery.shortfallReason}` : ""}
              </p>
            ))}
        </div>
      </Card>

      <section aria-labelledby="knows-title">
        <h2 className={styles.label} id="knows-title">
          Who already knows
        </h2>
        <p className={styles.knows}>
          <Icon name="circle-check" size={20} color="success" />
          {issue ? (
            <span>
              Dispatch notified <Mono>{issue.reportedAt}</Mono>
            </span>
          ) : (
            <span>
              Dispatch · <Mono>{at}</Mono>
            </span>
          )}
        </p>
        {issue && <p className={styles.followUp}>Dispatch will follow up.</p>}
      </section>

      {confirmed && !issue && !reviewOpen && (
        <section aria-labelledby="journey-title">
          <h2 className={styles.label} id="journey-title">
            Journey
          </h2>
          <JourneyTimeline
            metaAlign="right"
            steps={delivery.journey.map((step) => ({
              label: step.step,
              meta: step.at ? (
                <>
                  {step.actor} · <Mono>{step.at}</Mono>
                </>
              ) : (
                step.actor
              ),
              state: step.state,
            }))}
          />
        </section>
      )}
    </>
  );
}
