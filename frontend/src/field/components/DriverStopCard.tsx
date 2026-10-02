import type { ReactNode } from "react";
import { Mono } from "../../shared/ui/Mono";
import styles from "./DriverStopCard.module.css";

export type DriverStopCardProps = {
  stopNumber: number;
  outletId: string;
  /** "Waypoint Fresh". */
  outletName: string;
  /** For example "ETA 05:26 · Window 05:30-08:00". Wrap times in <Mono>. */
  schedule: ReactNode;
  /** "Kandy · Rear dock · normal parking". */
  place: string;
  /** The tags row: Will wait 4 min, Chilled. */
  tags?: ReactNode;
  /** "2 orders · ORD2001 12 · ORD2002 8". */
  orders: ReactNode;
  /** The current stop is drawn with a 2 px ink border and a signal disc. */
  current?: boolean;
  /** Arrive, Navigate, Problem. Only the current stop carries them. */
  actions?: ReactNode;
  /** Opens the stop. Makes the card's header a link-like button. */
  onOpen?: () => void;
  /** Which outcome the stop already has, for a done stop: a tick disc instead of the number. */
  done?: boolean;
};

/**
 * The driver's stop card, "driverStop" density of the Master Order Component (LIB1, R1.6): a 40 px
 * disc with the stop number, outlet and brand, ETA and window, parking note, tags, the orders
 * and, on the current stop, the 56 px Arrive button with Navigate and Problem beside each other.
 */
export function DriverStopCard({
  stopNumber,
  outletId,
  outletName,
  schedule,
  place,
  tags,
  orders,
  current,
  actions,
  onOpen,
  done,
}: DriverStopCardProps) {
  const header = (
    <div className={styles.row}>
      <span className={[styles.disc, current && styles.discCurrent, done && styles.discDone].filter(Boolean).join(" ")}>
        <Mono>{stopNumber}</Mono>
      </span>
      <div className={styles.stack}>
        <h3 className={styles.title}>
          <Mono>{outletId}</Mono> · {outletName}
        </h3>
        <p className={styles.schedule}>{schedule}</p>
        <p className={styles.place}>{place}</p>
      </div>
    </div>
  );

  return (
    <article className={[styles.card, current && styles.current].filter(Boolean).join(" ")}>
      {onOpen ? (
        <button type="button" className={styles.open} onClick={onOpen}>
          {header}
        </button>
      ) : (
        header
      )}
      {tags && <div className={styles.tags}>{tags}</div>}
      <p className={styles.orders}>{orders}</p>
      {actions && <div className={styles.actions}>{actions}</div>}
    </article>
  );
}
