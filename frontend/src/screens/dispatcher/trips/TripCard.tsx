import type { DragEvent } from "react";
import { GripVertical, Plus } from "lucide-react";
import type { MoveTarget, PlanTrip } from "../../../api/DispatcherApi";
import { Mono } from "../../../shared/ui/Mono";
import { BrandChip, Chip } from "../ui/Chip";
import { cx } from "../ui/cx";
import styles from "./Trips.module.css";
import { tripKey } from "./types";

const num = (n: number) => n.toLocaleString("en-US");

export type TripCardProps = {
  trip: PlanTrip;
  readOnly: boolean;
  /** The order selected for "Move to…". */
  selected: string | null;
  /** The order being dragged, to draw its place as a ghost. */
  dragging: string | null;
  /** This card is where the dragged order would land. */
  dropState: "none" | "accept" | "refuse";
  /** Closed loop: the ghost row "New stop added at the end" shows under an accepted drop. */
  showNewStop: boolean;
  onSelect: (orderId: string) => void;
  onMoveTo: (orderId: string) => void;
  onWhy: (orderId: string) => void;
  onDragStart: (orderId: string) => void;
  onDragEnd: () => void;
  onDragOver: (target: MoveTarget) => void;
  onDragLeave: () => void;
  onDrop: (target: MoveTarget) => void;
};

/** One trip: a vehicle's run with its stops in order, what it carries against what it can, and how long it takes. */
export function TripCard(props: TripCardProps) {
  const { trip, readOnly, selected, dragging, dropState } = props;
  const key = tripKey(trip.vehicleId, trip.trip);
  const droppable = !readOnly;

  const over = (event: DragEvent) => {
    if (!droppable) return;
    event.preventDefault();
    props.onDragOver({ vehicleId: trip.vehicleId, trip: trip.trip });
  };
  const drop = (event: DragEvent) => {
    if (!droppable) return;
    event.preventDefault();
    props.onDrop({ vehicleId: trip.vehicleId, trip: trip.trip });
  };

  return (
    <article
      className={cx(styles.trip, dropState === "accept" && styles.tripAccept, dropState === "refuse" && styles.tripRefuse)}
      data-anchor={key}
      aria-label={`${trip.vehicleId} trip ${trip.trip}`}
      onDragOver={over}
      onDragLeave={props.onDragLeave}
      onDrop={drop}
    >
      <h3 className={styles.tripTitle}>
        <Mono>
          {trip.vehicleId} · Trip {trip.trip} · departs {trip.departs}
        </Mono>
      </h3>
      <div className={styles.tripChips}>
        <BrandChip brand={trip.brand} small dot={false} />
        <Chip tone="outlineInk" small>
          {trip.district}
        </Chip>
      </div>
      <ol className={styles.stops}>
        {trip.stops.map((stop) => {
          const id = stop.orderIds[0] ?? stop.orderId;
          const isSelected = selected !== null && stop.orderIds.includes(selected);
          const isGhost = dragging !== null && stop.orderIds.includes(dragging);
          return (
            <li
              key={stop.orderId}
              className={cx(styles.stop, isSelected && styles.stopSelected, isGhost && styles.stopGhost)}
              draggable={!readOnly}
              tabIndex={readOnly ? -1 : 0}
              aria-label={`Stop ${stop.seq}, ${stop.outletId}, ${stop.orderId}`}
              onClick={() => !readOnly && props.onSelect(id)}
              onKeyDown={(event) => {
                if (readOnly) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  props.onSelect(id);
                }
              }}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", id);
                event.dataTransfer.effectAllowed = "move";
                props.onDragStart(id);
              }}
              onDragEnd={props.onDragEnd}
              data-order={id}
            >
              {isGhost ? (
                <span className={styles.ghostText}>Order lifted from this position</span>
              ) : (
                <>
                  <GripVertical size={14} className={cx(styles.grip, readOnly && styles.gripHidden)} aria-hidden />
                  <span className={styles.seq}>{stop.seq}</span>
                  <Mono>
                    <b className={styles.outlet}>{stop.outletId}</b>
                  </Mono>
                  <Mono>
                    <span className={styles.arrival}>{stop.arrival}</span>
                  </Mono>
                  {stop.note && <span className={styles.stopNote}>{stop.note}</span>}
                  {!readOnly && (
                    <span className={styles.stopActions}>
                      <button type="button" className={styles.miniButton} onClick={(e) => { e.stopPropagation(); props.onWhy(id); }}>
                        Why?
                      </button>
                      <button type="button" className={styles.miniButton} onClick={(e) => { e.stopPropagation(); props.onMoveTo(id); }}>
                        Move to…
                      </button>
                    </span>
                  )}
                </>
              )}
            </li>
          );
        })}
        {props.showNewStop && (
          <li className={styles.newStop}>
            <Plus size={14} />
            New stop added at the end
          </li>
        )}
      </ol>
      <dl className={styles.totals}>
        <div>
          <dt>Weight</dt>
          <dd>
            <Mono>
              {num(trip.kg)}
              {trip.kgCap ? ` / ${num(trip.kgCap)}` : ""} kg
            </Mono>
          </dd>
          <span className={styles.bar} style={{ width: `${Math.min(100, trip.fill.kg * 100)}%` }} />
        </div>
        <div>
          <dt>Volume</dt>
          <dd>
            <Mono>
              {trip.m3.toFixed(1)}
              {trip.m3Cap ? ` / ${trip.m3Cap.toFixed(1)}` : ""} m³
            </Mono>
          </dd>
          <span className={styles.bar} style={{ width: `${Math.min(100, trip.fill.m3 * 100)}%` }} />
        </div>
        <div>
          <dt>Trip</dt>
          <dd>
            <Mono>{trip.minutes} min</Mono>
          </dd>
          <span className={styles.bar} style={{ width: `${Math.min(100, trip.fill.minutes * 100)}%` }} />
        </div>
      </dl>
    </article>
  );
}
