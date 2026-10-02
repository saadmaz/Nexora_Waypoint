import type { ReactElement } from "react";
import { Box, Check, CircleCheck, Fuel, Info, Package, Snowflake, Split, Timer, Truck, Van, Weight } from "lucide-react";
import type { CapacityView } from "../../../api/DispatcherApi";
import { Mono } from "../../../shared/ui/Mono";
import { Banner } from "../ui/Banner";
import { Btn } from "../ui/Btn";
import { Chip } from "../ui/Chip";
import { Meter } from "../ui/Meter";
import { cx } from "../ui/cx";
import styles from "./Capacity.module.css";

const num = (n: number) => n.toLocaleString("en-US");

const METER_ICONS: Record<string, ReactElement> = {
  Weight: <Weight size={16} />,
  Volume: <Box size={16} />,
  "Fresh minutes": <Timer size={16} />,
  Fuel: <Fuel size={16} />,
};

const FLEET_ICONS = {
  "reefer-truck": <Snowflake size={15} />,
  "dry-truck": <Package size={15} />,
  "reefer-van": <Snowflake size={15} />,
  "ambient-van": <Van size={15} />,
} as const;

/** D2.2: Kandy has its own pool and, tonight, enough of it. */
export function KandyCapacity({ view, onPeliyagoda }: { view: CapacityView; onPeliyagoda: () => void }) {
  const lane = view.lane;
  const fleet = view.fleet;
  return (
    <>
      <Banner tone="success" icon={<CircleCheck size={19} />} title={
        <>
          Kandy has enough capacity for Tue 29 Sep. <Mono>{view.orders}</Mono> orders, <Mono>{view.deferrals.total}</Mono> deferrals.
        </>
      } />
      <div className={styles.main}>
        <div className={styles.column}>
          <section className={styles.sampleWide}>
            <div className={styles.sampleTop}>
              <div className={styles.sampleTitle}>
                <Snowflake size={19} color="var(--chilled)" />
                <h2 className={styles.h2}>Reefer Fresh minutes</h2>
              </div>
              <Chip tone="success" pill icon={<CircleCheck size={15} />}>
                Within supply
              </Chip>
            </div>
            <span className={styles.subtle}>Planned fresh-delivery minutes remain comfortably inside the Kandy reefer pool.</span>
            <Meter value={(view.freshUse ?? 0.6) * 100} max={100} height={14} tone="route" />
            <span className={styles.healthy}>
              <Check size={14} />
              Healthy headroom for planned demand
            </span>
          </section>
          {lane && (
            <section className={styles.sampleWide}>
              <div className={styles.sampleTop}>
                <div className={styles.sampleTitle}>
                  <Truck size={19} />
                  <b className={styles.laneTitle}>{lane.title}</b>
                </div>
                <Chip tone="chilled" icon={<Snowflake size={14} />}>
                  Reefer
                </Chip>
              </div>
              <Mono>
                <span className={styles.laneSummary}>{lane.summary}</span>
              </Mono>
              <div className={styles.rule} />
              <div className={styles.meters}>
                {lane.meters.map((m) => (
                  <div key={m.label} className={styles.meterRow}>
                    <div className={styles.meterTop}>
                      <span className={styles.meterLabel}>
                        {METER_ICONS[m.label]}
                        {m.label}
                      </span>
                      <Mono>
                        <b className={styles.meterValue}>
                          {num(m.used)} / {num(m.limit)} {m.unit}
                        </b>
                      </Mono>
                    </div>
                    <Meter value={m.used} max={m.limit} tone="route" />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
        {fleet && (
          <aside className={cx(styles.side, styles.fleet)}>
            <b className={styles.fleetTitle}>Kandy fleet</b>
            <div className={styles.fleetCount}>
              <Mono>{fleet.total} vehicles</Mono>
              <span className={styles.small}>Available pool by body and temperature class</span>
            </div>
            <div className={styles.rule} />
            <div>
              {fleet.classes.map((c) => (
                <div key={c.label} className={styles.fleetRow}>
                  <span className={styles.fleetName}>
                    <span className={cx(styles.fleetIcon, c.chilled && styles.fleetChilled)}>{FLEET_ICONS[c.kind]}</span>
                    {c.label}
                  </span>
                  <Mono>
                    <b>{c.count}</b>
                  </Mono>
                </div>
              ))}
            </div>
            <div className={styles.note}>
              <Split size={18} />
              Dedicated Kandy vehicle pool
            </div>
          </aside>
        )}
      </div>
      <Banner
        tone="info"
        icon={<Info size={19} />}
        title={
          <span className={styles.semibold}>
            Peliyagoda is short <Mono>430</Mono> reefer minutes, pools don't share vehicles.
          </span>
        }
        actions={
          <Btn variant="ghost" size="sm" onClick={onPeliyagoda}>
            Switch to Peliyagoda
          </Btn>
        }
      />
    </>
  );
}
