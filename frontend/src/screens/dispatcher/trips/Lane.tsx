import type { DragEvent } from "react";
import { Plus, Wrench } from "lucide-react";
import type { MoveTarget, PlanLane } from "../../../api/DispatcherApi";
import { Mono } from "../../../shared/ui/Mono";
import { Chip } from "../ui/Chip";
import { cx } from "../ui/cx";
import { Meter } from "../ui/Meter";
import { TripCard, type TripCardProps } from "./TripCard";
import styles from "./Trips.module.css";
import { newTripOf, tripKey } from "./types";

export type LaneProps = Omit<TripCardProps, "trip" | "dropState" | "showNewStop"> & {
  lane: PlanLane;
  /** The card the dragged order would land on, and how the rules judge it. */
  hover: { key: string; state: "accept" | "refuse"; showNewStop: boolean } | null;
};

type ZoneProps = Pick<LaneProps, "onDragOver" | "onDragLeave" | "onDrop"> & {
  vehicleId: string;
  trip: number;
  dropState: "none" | "accept" | "refuse";
  /** The lane has no trip yet, so the zone fills it and says so. */
  first: boolean;
};

/**
 * Where a dropped order starts a run: the vehicle's next trip. The rules decide whether it may (the server checks the move
 * like any other), so the zone only offers the target; it is the popover anchor for the trip it would become.
 */
function NewTripZone({ vehicleId, trip, dropState, first, onDragOver, onDragLeave, onDrop }: ZoneProps) {
  const target: MoveTarget = { vehicleId, trip };
  const over = (event: DragEvent) => {
    event.preventDefault();
    onDragOver(target);
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    onDrop(target);
  };
  return (
    <div
      className={cx(styles.newTrip, first && styles.newTripFirst, dropState === "accept" && styles.tripAccept, dropState === "refuse" && styles.tripRefuse)}
      data-anchor={tripKey(vehicleId, trip)}
      aria-label={`${vehicleId} new trip ${trip}`}
      onDragOver={over}
      onDragLeave={onDragLeave}
      onDrop={drop}
    >
      <Plus size={16} />
      <span>{first ? `No trips yet. Drop an order to start Trip ${trip}` : `New trip ${trip}`}</span>
    </div>
  );
}

/** One vehicle: its header with its driver and the two meters that cap its day, its trips, and room for the next one. */
export function Lane({ lane, hover, ...rest }: LaneProps) {
  const next = newTripOf(lane);
  const zoneState = (trip: number) => (hover !== null && hover.key === tripKey(lane.vehicleId, trip) ? hover.state : "none");
  const zone = (first: boolean) =>
    next !== null && !rest.readOnly ? (
      <NewTripZone
        vehicleId={lane.vehicleId}
        trip={next}
        dropState={zoneState(next)}
        first={first}
        onDragOver={rest.onDragOver}
        onDragLeave={rest.onDragLeave}
        onDrop={rest.onDrop}
      />
    ) : null;

  if (lane.status === "workshop" || lane.status === "spare") {
    const label = lane.status === "workshop" ? `In workshop until ${lane.workshopUntil ?? "02:45"}` : `Spare · available since ${lane.workshopUntil ?? "02:45"}`;
    return (
      <section className={styles.lane + " " + styles.laneIdle} aria-label={`${lane.vehicleId}, ${lane.status === "workshop" ? "in workshop" : "spare"}`}>
        <span className={styles.idleName}>
          <Mono>
            <b className={styles.vehicle}>{lane.vehicleId}</b>
          </Mono>
          {lane.driver && <span className={styles.driver}>{lane.driver}</span>}
        </span>
        <span className={styles.idleText}>
          <Wrench size={18} />
          {label}
        </span>
        {/* A workshop vehicle may still take a run that leaves after it is back; the server says when it can't. */}
        {zone(true)}
      </section>
    );
  }
  const replaced = lane.status === "replaced";
  return (
    <section className={styles.lane + (replaced ? " " + styles.laneReplaced : "")} aria-label={lane.vehicleId}>
      <header className={styles.laneHead}>
        <div className={styles.laneTitle}>
          <Mono>
            <b className={styles.vehicle}>{lane.vehicleId}</b>
          </Mono>
          <Chip tone={lane.reefer ? "chilled" : "outline"} small>
            {replaced ? "Replaced" : lane.kind}
          </Chip>
        </div>
        {lane.driver && <span className={styles.driver}>Driver: {lane.driver}</span>}
        {replaced ? (
          <span className={styles.replacedNote}>Reefer not holding temperature</span>
        ) : (
          lane.meters.map((m) => (
            <div key={m.label} className={styles.laneMeter}>
              <div className={styles.laneMeterTop}>
                <span>{m.label}</span>
                <Mono>
                  {m.used} / {m.limit} {m.unit}
                </Mono>
              </div>
              <Meter value={m.used} max={m.limit} height={5} tone="route" label={`${m.label}: ${m.used} of ${m.limit} ${m.unit}`} />
            </div>
          ))
        )}
      </header>
      <div className={styles.tripsRow}>
        {lane.trips.map((trip) => {
          const key = tripKey(trip.vehicleId, trip.trip);
          const isHover = hover !== null && hover.key === key;
          return <TripCard key={key} {...rest} trip={trip} dropState={isHover ? hover.state : "none"} showNewStop={isHover && hover.state === "accept" && hover.showNewStop} />;
        })}
        {zone(lane.trips.length === 0)}
      </div>
    </section>
  );
}
