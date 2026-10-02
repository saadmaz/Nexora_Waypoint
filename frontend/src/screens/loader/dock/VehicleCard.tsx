import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { Tag } from "../../../shared/ui/Tag";
import { Button } from "../../../shared/ui/Button";
import styles from "./VehicleCard.module.css";

export type VehicleCardStatus = "to_load" | "loading" | "loaded" | "held" | "replaced";

export type VehicleCardProps = {
  id: string;
  temperature: "reefer" | "ambient";
  trips: number;
  orderCount: number;
  departsAt: string;
  inLabel: string;
  /** Locked until the dock acknowledges the current plan version. */
  locked: boolean;
  status: VehicleCardStatus;
  checked?: { done: number; total: number };
  /** Shown only while a newer, unacknowledged version exists (L1.5). */
  changeTag?: "Changed" | "No change";
  heldReason?: string;
  /** The version to name on the locked line: "Acknowledge v4 first". */
  lockedVersion?: number;
  /** The card's own action button. Absent for a held vehicle, which instead gets `goTo`. */
  action?: { label: string; primary: boolean; icon?: "truck" };
  /** The held card's "Go to VEH0xx" shortcut to the next vehicle to load. */
  goTo?: { label: string; onClick: () => void };
  onPress: () => void;
};

/** One vehicle card on L1 Dock (L1.1 to L1.6): the Vehicle list item, held variant included. */
export function VehicleCard({
  id,
  temperature,
  trips,
  orderCount,
  departsAt,
  inLabel,
  locked,
  status,
  checked,
  changeTag,
  heldReason,
  lockedVersion,
  action,
  goTo,
  onPress,
}: VehicleCardProps) {
  const held = status === "held";
  // A plain locked card (the first-ever plan, or a newer version with nothing different for this
  // dock) shows nothing beyond the header and meta. Only a real diff (a Changed/No change tag)
  // earns the "Acknowledge first" line and its own disabled button (L1.5).
  const showLockedDetail = locked && changeTag !== undefined;

  const body = (
    <>
      <div className={styles.row}>
        <div className={styles.head}>
          <Mono>
            <span className={styles.id}>{id}</span>
          </Mono>
          {temperature === "reefer" ? (
            <Tag kind="chilled" icon="snowflake">
              Reefer
            </Tag>
          ) : (
            <Tag kind="ambient" icon={null}>
              Ambient
            </Tag>
          )}
          {changeTag && (
            <Tag kind={changeTag === "Changed" ? "warn" : "outline"} icon={null}>
              {changeTag}
            </Tag>
          )}
          {held && (
            <Tag kind="danger" icon="alert-circle">
              Held
            </Tag>
          )}
        </div>
        {!held && <Icon name={locked ? "lock" : "chevron-right"} size={20} color="ink-muted" />}
      </div>

      <div className={styles.meta}>
        <p className={styles.tripsOrders}>
          <Mono>{trips}</Mono> {trips === 1 ? "trip" : "trips"} · <Mono>{orderCount}</Mono> {orderCount === 1 ? "order" : "orders"}
        </p>
        <div className={styles.departure}>
          <p className={styles.departs}>
            Departs <Mono>{departsAt}</Mono>
          </p>
          <p className={[styles.inTime, held && styles.inTimeUrgent].filter(Boolean).join(" ")}>{inLabel}</p>
        </div>
      </div>

      {held && heldReason && (
        <div className={styles.heldBox}>
          <p className={styles.heldReason}>
            <Icon name="alert-circle" size={20} color="danger" />
            {heldReason}
          </p>
          <Tag kind="danger" icon="lock">
            Dispatch is deciding
          </Tag>
          {goTo && <p className={styles.heldNext}>While Dispatch decides: load {goTo.label.replace("Go to ", "")} next</p>}
        </div>
      )}

      {showLockedDetail && !held && (
        <p className={styles.lockedLine}>
          <Icon name="lock" size={16} />
          Acknowledge {lockedVersion !== undefined ? <Mono>v{lockedVersion}</Mono> : "the plan"} first
        </p>
      )}

      {status !== "held" && !locked && checked && (
        <Tag kind="info" icon="route">
          {checked.done} of {checked.total} orders checked
        </Tag>
      )}
      {status === "to_load" && !locked && !checked && (
        <Tag kind="outline" icon="clock">
          Not started
        </Tag>
      )}
      {status === "loaded" && !locked && (
        <Tag kind="success" icon="check">
          Loaded
        </Tag>
      )}

      {goTo ? (
        <Button variant="secondary" onClick={goTo.onClick}>
          {goTo.label}
        </Button>
      ) : action && (!locked || showLockedDetail) ? (
        <Button variant={action.primary ? "primary" : "secondary"} disabled={locked} icon={action.icon} onClick={onPress}>
          {action.label}
        </Button>
      ) : null}
    </>
  );

  return <article className={[styles.card, held && styles.heldCard].filter(Boolean).join(" ")}>{body}</article>;
}
