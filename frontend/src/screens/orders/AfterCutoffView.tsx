import { Alert } from "../../components/ui/Alert";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { Mono } from "../../components/ui/Mono";
import { Tag } from "../../components/ui/Tag";
import { unitsLabel } from "../../domain/estimate";
import { dayLabel } from "../../domain/format";
import type { OrderKind } from "../../domain/order";
import { WINDOW_LABEL } from "../../domain/outlet";
import styles from "./AfterCutoffView.module.css";

export type AfterCutoffViewProps = {
  /** ISO date of the day whose orders just closed, e.g. Tue 29 Sep. */
  closedDate: string;
  /** ISO date of the following run the order goes on, e.g. Wed 30 Sep. */
  runDate: string;
  lines: { kind: OrderKind; units: number }[];
  /** Set once placed: shows the "Placed for" acknowledgement in place of the closed notice. */
  receivedTime?: string;
};

/** S1.4 (after cutoff, before placing) and S1.4 B (placed for the following run). */
export function AfterCutoffView({ closedDate, runDate, lines, receivedTime }: AfterCutoffViewProps) {
  const run = dayLabel(runDate);
  return (
    <>
      <h1 className={styles.title}>Order for {run}</h1>
      {receivedTime ? (
        <Alert tone="success" icon="circle-check" title={`Placed for ${run}`}>
          Received <Mono>{receivedTime}</Mono>.
        </Alert>
      ) : (
        <Alert
          tone="info"
          title={
            <>
              Orders for {dayLabel(closedDate)} closed at <Mono>16:00</Mono>
            </>
          }
        >
          This order goes on the following run, {run}.
        </Alert>
      )}
      <Card>
        <div className={styles.card}>
          <div className={styles.head}>
            <h2 className={styles.cardTitle}>Your order</h2>
            <span className={styles.chip}>
              <Icon name="clock" size={14} />
              For {run} · After cutoff
            </span>
          </div>
          <ul className={styles.list}>
            {lines.map((line) => (
              <li className={styles.row} key={line.kind}>
                {line.kind === "chilled" ? <Tag kind="chilled">Chilled</Tag> : <Tag kind="ambient">Ambient</Tag>}
                <span className={styles.name}>{line.kind === "chilled" ? "Chilled" : "Dry"}</span>
                <Mono>{unitsLabel(line.units)}</Mono>
              </li>
            ))}
          </ul>
          <p className={styles.delivers}>
            Delivers {run} · window <Mono>{WINDOW_LABEL}</Mono>
          </p>
        </div>
      </Card>
    </>
  );
}
