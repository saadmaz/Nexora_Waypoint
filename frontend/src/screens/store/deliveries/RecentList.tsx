import { Card } from "../../../shared/ui/Card";
import { Mono } from "../../../shared/ui/Mono";
import { StatusPill } from "../../../shared/ui/StatusPill";
import { dayLabel } from "../../../domain/format";
import type { RecentOrderDay } from "../../../domain/order";
import styles from "./RecentList.module.css";

/** The line under a recent day: "Delivered 05:40", "Deferred · policy → served next day", "Partial · 1 unit short, reported". */
function detail(day: RecentOrderDay) {
  if (day.status === "Deferred") {
    const type = day.deferral?.type;
    return (
      <>
        Deferred{type ? ` · ${type}` : ""}
        {day.servedNextDay ? " → served next day" : ""}
      </>
    );
  }
  if (day.status === "Partial") {
    const short = day.shortUnits ?? 0;
    return <>Partial · {short} {short === 1 ? "unit" : "units"} short, reported</>;
  }
  if (day.deliveredAt) {
    return (
      <>
        Delivered <Mono>{day.deliveredAt}</Mono>
      </>
    );
  }
  return <>{day.status}</>;
}

/** The phone's Recent list on S2.10: one row per past delivery day, display only. */
export function RecentList({ days }: { days: RecentOrderDay[] }) {
  return (
    <Card padded={false}>
      <ul className={styles.list}>
        {days.map((day) => (
          <li className={styles.row} key={day.date}>
            <div>
              <div className={styles.top}>
                <Mono>{dayLabel(day.date)}</Mono>
                <span className={styles.count}>
                  · {day.orderCount} {day.orderCount === 1 ? "order" : "orders"}
                </span>
              </div>
              <div className={styles.detail}>{detail(day)}</div>
            </div>
            <StatusPill status={day.status} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
