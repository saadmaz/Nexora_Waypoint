import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { Mono } from "../../components/ui/Mono";
import { StatusPill } from "../../components/ui/StatusPill";
import { Tag } from "../../components/ui/Tag";
import { dayLabel } from "../../domain/format";
import type { RecentOrderDay } from "../../domain/order";
import styles from "./HistoryList.module.css";

export type HistoryListProps = {
  days: RecentOrderDay[];
  /** Opens a delivery. Only the current day has one; older rows are display only. */
  onOpen: (date: string) => void;
};

/** The second line of a row: the orders and their tags, "Served next day", or "1 unit short". */
function detail(day: RecentOrderDay) {
  if (day.status === "Deferred" && day.servedNextDay) return <p className={styles.note}>Served next day</p>;
  if (day.status === "Partial") {
    const short = day.shortUnits ?? 0;
    return (
      <p className={styles.note}>
        {short} {short === 1 ? "unit" : "units"} short
      </p>
    );
  }
  if (!day.orderIds && !day.deferralWithdrawn && !day.receiptConfirmedAt) return null;
  return (
    <div className={styles.extra}>
      {day.orderIds && (
        <p className={styles.ids}>
          {day.orderIds.map((id, i) => (
            <span key={id}>
              {i > 0 && " + "}
              <Mono>{id}</Mono>
            </span>
          ))}
        </p>
      )}
      <div className={styles.tags}>
        {day.deferralWithdrawn && <Tag>Deferral withdrawn</Tag>}
        {day.receiptConfirmedAt && (
          <Tag>
            Receipt confirmed <Mono>{day.receiptConfirmedAt}</Mono>
          </Tag>
        )}
      </div>
    </div>
  );
}

/** S4.2's "Delivery days · Mon to Sat": one row per delivery day, newest first. */
export function HistoryList({ days, onOpen }: HistoryListProps) {
  return (
    <Card padded={false}>
      <ul className={styles.list}>
        {days.map((day) => {
          const content = (
            <>
              <span className={styles.head}>
                <span className={styles.date}>{dayLabel(day.date)}</span>
                <span className={styles.status}>
                  {day.deliveredAt && <span className={styles.time}>{day.deliveredAt}</span>}
                  <StatusPill
                    status={day.status}
                    {...(day.deferral ? { deferral: { type: day.deferral.type } } : {})}
                  />
                  {day.current && <Icon name="chevron-right" size={16} />}
                </span>
              </span>
              {detail(day)}
            </>
          );
          return (
            <li key={day.date}>
              {day.current ? (
                <button type="button" className={styles.row} onClick={() => onOpen(day.date)}>
                  {content}
                </button>
              ) : (
                <div className={styles.row}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
