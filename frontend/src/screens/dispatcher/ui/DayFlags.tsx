import { CalendarDays, CloudRain } from "lucide-react";
import type { DayFlag, ServiceDayInfo } from "../../../api/DispatcherApi";
import { Chip, type ChipTone } from "./Chip";
import styles from "./DayFlags.module.css";

const TONE: Record<DayFlag["kind"], ChipTone> = {
  payday: "signal",
  festival: "warning",
  weekend: "outlineInk",
  monsoon: "info",
  holiday: "danger",
};

/**
 * What kind of day the plan is for (calendar.csv): payday, festival, weekend, monsoon, holiday, and the next run a
 * deferral goes to. The server words every flag; this only lays them out (dispatch fix plan task 8).
 */
export function DayFlags({ day }: { day: ServiceDayInfo | undefined }) {
  if (!day) return null;
  return (
    <div className={styles.row} aria-label={`Calendar for ${day.label}`}>
      <span className={styles.day}>
        <CalendarDays size={15} aria-hidden />
        {day.label}
      </span>
      {day.flags.length === 0 ? (
        <span className={styles.muted}>No calendar flags</span>
      ) : (
        day.flags.map((flag) => (
          <span key={flag.kind} className={styles.flag}>
            <Chip tone={TONE[flag.kind]} small {...(flag.kind === "monsoon" ? { icon: <CloudRain size={12} /> } : {})}>
              {flag.label}
            </Chip>
            <span className={styles.muted}>{flag.detail}</span>
          </span>
        ))
      )}
      {day.nextRun && <span className={styles.next}>Deferrals go to {day.nextRun}</span>}
    </div>
  );
}
