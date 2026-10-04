import type { ReactNode } from "react";
import { Card } from "../../../shared/ui/Card";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { Tag } from "../../../shared/ui/Tag";
import { estimateFor, formatEstimate, unitsLabel } from "../../../domain/estimate";
import { windowLabel } from "../../../domain/outlet";
import type { OrderKind, RecentOrderDay, UnitFactors } from "../../../domain/order";
import { OrderCard } from "./OrderCard";
import { OrderHeader } from "./OrderHeader";
import { RecentOrdersTable } from "./RecentOrdersTable";
import styles from "./DesktopOrders.module.css";
import { useStore } from "../../../app/StoreContext";

const KINDS: OrderKind[] = ["chilled", "dry"];

export type DesktopOrdersProps = {
  title: string;
  /** "Tue 29 Sep" */
  dateLabel: string;
  /** An alert above the cards: the queued, error or cutoff notice. */
  notice?: ReactNode;
  quantities: Record<OrderKind, number>;
  factors: UnitFactors;
  onChange: (kind: OrderKind, units: number) => void;
  pendingSync?: boolean;
  disabled?: boolean;
  minutesLeft: number;
  /** The buttons in the summary card: Review, or Save changes and Cancel order. */
  actions: ReactNode;
  recent: RecentOrderDay[];
  onOpenDay?: (date: string) => void;
};

/**
 * S1.6, the desktop order form: the two order cards, and beside them the cutoff,
 * the summary with its Review button, and Recent orders.
 */
export function DesktopOrders({
  title,
  dateLabel,
  notice,
  quantities,
  factors,
  onChange,
  pendingSync,
  disabled,
  minutesLeft,
  actions,
  recent,
  onOpenDay,
}: DesktopOrdersProps) {
  const { outlet } = useStore();
  const placed = KINDS.filter((kind) => quantities[kind] > 0);

  return (
    <div className={styles.body}>
      <div className={styles.main}>
        <OrderHeader title={title} dateLabel={dateLabel} inline />
        {notice}
        <div className={styles.cards}>
          {KINDS.map((kind) => (
            <OrderCard
              key={kind}
              kind={kind}
              units={quantities[kind]}
              factors={factors}
              onChange={(units) => onChange(kind, units)}
              {...(pendingSync ? { pendingSync: true } : {})}
              {...(disabled ? { disabled: true } : {})}
            />
          ))}
        </div>
      </div>

      <aside className={styles.side}>
        <Card>
          <div className={styles.cutoff}>
            <span className={styles.label}>Cutoff</span>
            <span className={styles.time}>16:00</span>
            <span className={styles.left}>
              <Icon name="clock" size={16} />
              {minutesLeft} min left
            </span>
          </div>
        </Card>

        <Card>
          <div className={styles.summary}>
            <h2 className={styles.summaryTitle}>
              {placed.length} {placed.length === 1 ? "order" : "orders"} for {dateLabel}
            </h2>
            {placed.map((kind) => (
              <div className={styles.line} key={kind}>
                <div className={styles.lineTop}>
                  {kind === "chilled" ? <Tag kind="chilled">Chilled</Tag> : <Tag kind="ambient">Dry</Tag>}
                  <Mono>{unitsLabel(quantities[kind])}</Mono>
                </div>
                <div className={styles.estimate}>{formatEstimate(estimateFor(factors, kind, quantities[kind]))}</div>
              </div>
            ))}
            <p className={styles.estimate}>
              Window <Mono>{windowLabel(outlet)}</Mono> · {outlet.dock}
            </p>
            {actions}
          </div>
        </Card>

        <section aria-labelledby="recent-title">
          <h2 className={styles.recent} id="recent-title">
            Recent orders
          </h2>
          <RecentOrdersTable days={recent} {...(onOpenDay ? { onOpenDay } : {})} />
        </section>
      </aside>
    </div>
  );
}
