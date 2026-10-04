import type { ReactNode } from "react";
import { Archive, CircleAlert, CircleCheck, Fuel, Info, Lock, Snowflake, Split, Truck, Wrench } from "lucide-react";
import { DEPOT_NAME, type CapacityView } from "../../../api/DispatcherApi";
import { Mono } from "../../../shared/ui/Mono";
import { Chip } from "../ui/Chip";
import { Meter } from "../ui/Meter";
import { cx } from "../ui/cx";
import styles from "./Capacity.module.css";

const num = (n: number) => n.toLocaleString("en-US");

/** The binding resource: the one constraint that forces deferrals, drawn largest and the only red on the screen (design fix D-7). */
export function BindingCard({ binding, snapshot }: { binding: NonNullable<CapacityView["binding"]>; snapshot?: boolean }) {
  return (
    <section className={styles.binding} aria-label={`Binding resource: ${binding.resource}`}>
      <div className={styles.bindingTop}>
        <div className={styles.bindingTitle}>
          <Chip tone="signal">BINDING</Chip>
          <Snowflake size={19} color="var(--chilled)" />
          <h2>{binding.resource}</h2>
        </div>
        <div className={styles.bindingRight}>
          {snapshot && (
            <Chip tone="neutral" icon={<Lock size={12} />}>
              Released plan snapshot
            </Chip>
          )}
          <span className={styles.util}>{binding.percent}%</span>
        </div>
      </div>
      <p className={styles.subtle}>
        Demand {num(binding.demand)} vs supply {num(binding.supply)} ({binding.available} available reefers × {binding.perVehicle} min)
      </p>
      <div className={styles.bigFigure}>
        {num(binding.demand)} / {num(binding.supply)} min
      </div>
      <div className={styles.meterBlock}>
        <Meter value={binding.demand} max={binding.supply} height={16} label={binding.resource} />
        <span className={styles.marker} style={{ left: `calc(${(binding.supply / binding.demand) * 100}% - 26px)` }}>
          100%
        </span>
      </div>
      <div className={styles.dangerLine}>
        <CircleAlert size={17} />
        Over by {binding.overBy} min, policy will choose which orders wait
      </div>
    </section>
  );
}

/** The two sample cards: the busiest vehicle's Style+Tech minutes and the closest vehicle's fuel. They are the worst case, not the fleet total. */
export function SampleCards({ view, recorded }: { view: CapacityView; recorded?: boolean }) {
  return (
    <div className={styles.samples}>
      <SampleCard icon={<Wrench size={18} />} title={`${view.busiest.label} · busiest vehicle: ${view.busiest.vehicleId}`} sub={undefined} figure={`${view.busiest.used} / ${view.busiest.limit} ${view.busiest.unit}`} used={view.busiest.used} limit={view.busiest.limit} notes={[...(recorded ? ["Recorded in released plan"] : []), view.busiest.note]} />
      <SampleCard icon={<Fuel size={18} />} title={`${view.closest.label} · closest to limit: ${view.closest.vehicleId}`} sub={view.closest.caption} figure={`${view.closest.used} / ${view.closest.limit} ${view.closest.unit}`} used={view.closest.used} limit={view.closest.limit} notes={[...(recorded ? ["Recorded in released plan"] : []), view.closest.note]} />
    </div>
  );
}

function SampleCard(props: { icon: ReactNode; title: string; sub: string | undefined; figure: string; used: number; limit: number; notes: string[] }) {
  return (
    <div className={styles.sample}>
      <div className={styles.sampleTitle}>
        {props.icon}
        <b>{props.title}</b>
      </div>
      {props.sub && <span className={styles.small}>{props.sub}</span>}
      <div className={styles.figure}>{props.figure}</div>
      <Meter value={props.used} max={props.limit} tone="route" label={props.title} />
      {props.notes.map((n) => (
        <span key={n} className={styles.small}>
          {n}
        </span>
      ))}
    </div>
  );
}

/** The other depot's pool. Pools never share vehicles, and the card says so. */
export function PoolCard({ pool, released, compact, releasedPlan }: { pool: CapacityView["pool"]; released?: boolean; compact?: boolean; releasedPlan?: number }) {
  return (
    <aside className={cx(styles.side, compact && styles.sideCompact)}>
      <div className={styles.sideTop}>
        <span className={styles.label}>{DEPOT_NAME[pool.depot]} pool (separate)</span>
        {released && <Lock size={14} color="var(--ink-muted)" />}
      </div>
      <div className={styles.poolFigure}>
        <Mono>
          {pool.orders} orders · {pool.deferred} deferred
        </Mono>
      </div>
      <Chip tone={pool.enough ? "success" : "warning"} pill icon={<CircleCheck size={15} />}>
        {pool.enough ? "Enough capacity" : "Short on capacity"}
      </Chip>
      <p className={styles.sideText}>Refrigeration and van access are requirements, not priorities.</p>
      {!compact && (
        <>
          <div className={styles.rule} />
          <div className={styles.note}>
            <Split size={18} />
            Not pooled with {pool.depot === "kandy" ? "Peliyagoda" : "Kandy"}
          </div>
        </>
      )}
      {released && releasedPlan !== undefined && (
        <>
          <div className={styles.rule} />
          <div className={styles.releasedLine}>
            <Archive size={16} />
            Included in released plan v{releasedPlan}
          </div>
        </>
      )}
    </aside>
  );
}

/** D2.3: a vehicle that became available after the draft. Visible, but released trips do not change. */
export function SpareCard({ spare }: { spare: NonNullable<CapacityView["spare"]> }) {
  return (
    <div className={styles.spare}>
      <div className={styles.sideTop}>
        <div className={styles.spareTitle}>
          <Truck size={19} />
          <b>
            {spare.vehicleId} · {spare.label}
          </b>
        </div>
        <Lock size={15} color="var(--ink-muted)" />
      </div>
      <div className={styles.chips}>
        <Chip tone="infoOutline">Spare</Chip>
        <Chip tone="chilled" icon={<Snowflake size={13} />}>
          Chilled
        </Chip>
      </div>
      <Mono>
        <span className={styles.spareLine}>
          Spare · {num(spare.kg)} kg · {spare.m3.toFixed(1)} m³ · not on any trip
        </span>
      </Mono>
      {[
        ["Payload", `0 / ${num(spare.kg)} kg`],
        ["Volume", `0 / ${spare.m3.toFixed(1)} m³`],
      ].map(([l, v]) => (
        <div key={l} className={styles.spareMeter}>
          <div className={styles.spareMeterTop}>
            <span>{l}</span>
            <Mono>{v}</Mono>
          </div>
          <Meter value={0} max={1} />
        </div>
      ))}
      <span className={styles.spareNote}>
        <Info size={14} />
        Available now · no released trip changed
      </span>
    </div>
  );
}
