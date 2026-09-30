import { DataTable } from "../../components/ui/DataTable";
import { StatusPill } from "../../components/ui/StatusPill";
import { dayLabel } from "../../domain/format";
import type { RecentOrderDay } from "../../domain/order";
import styles from "./RecentOrdersTable.module.css";

export type RecentOrdersTableProps = {
  days: RecentOrderDay[];
  /** A row opens that day's delivery (S2). */
  onOpenDay?: (date: string) => void;
};

/** S1.6's "Recent orders": one row per past delivery day, Sundays already skipped by the API. */
export function RecentOrdersTable({ days, onOpenDay }: RecentOrdersTableProps) {
  return (
    <DataTable
      columns={[
        { header: "Date", width: "76px" },
        { header: "Orders", width: "46px", right: true },
        { header: "Status", width: "auto" },
      ]}
      rows={days.map((day) => [
        <span key="d" className={styles.figure}>
          {dayLabel(day.date)}
        </span>,
        <span key="n" className={styles.figure}>
          {day.orderCount}
        </span>,
        <StatusPill
          key="s"
          status={day.status}
          {...(day.deferral ? { deferral: day.deferral } : {})}
        />,
      ])}
      {...(onOpenDay ? { onRowClick: (i: number) => days[i] && onOpenDay(days[i].date) } : {})}
    />
  );
}
