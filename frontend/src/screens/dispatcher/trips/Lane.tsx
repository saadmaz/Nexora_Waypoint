import { Wrench } from "lucide-react";
import type { PlanLane } from "../../../api/DispatcherApi";
import { Mono } from "../../../shared/ui/Mono";
import { Chip } from "../ui/Chip";
import { Meter } from "../ui/Meter";
import { TripCard, type TripCardProps } from "./TripCard";
import styles from "./Trips.module.css";
import { tripKey } from "./types";

export type LaneProps = Omit<TripCardProps, "trip" | "dropState" | "showNewStop"> & {
  lane: PlanLane;
  /** The card the dragged order would land on, and how the rules judge it. */
  hover: { key: string; state: "accept" | "refuse"; showNewStop: boolean } | null;
};

/** One vehicle: its header with the two meters that cap its day, and its trips beside it. */
export function Lane({ lane, hover, ...rest }: LaneProps) {
  if (lane.status === "workshop" || lane.status === "spare") {
    return (
      <section className={styles.lane + " " + styles.laneIdle} aria-label={`${lane.vehicleId}, ${lane.status === "workshop" ? "in workshop" : "spare"}`}>
        <Mono>
          <b className={styles.vehicle}>{lane.vehicleId}</b>
        </Mono>
        <span className={styles.idleText}>
          <Wrench size={18} />
          {lane.status === "workshop" ? `In workshop until ${lane.workshopUntil ?? "02:45"}` : `Spare · available since ${lane.workshopUntil ?? "02:45"}`}
        </span>
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
              <Meter value={m.used} max={m.limit} height={5} tone="route" />
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
      </div>
    </section>
  );
}
