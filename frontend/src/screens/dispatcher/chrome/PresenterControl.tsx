import { ChevronRight, RotateCcw } from "lucide-react";
import { clockTime, dayLabel } from "../../../domain/format";
import { toIsoDate } from "../../../domain/schedule";
import { Mono } from "../../../shared/ui/Mono";
import { useDispatcher } from "../context";
import { useNow } from "../hooks";
import { scenarioTime } from "../mock/time";
import styles from "./PresenterControl.module.css";

/** The walkthrough moments the dispatcher sees (PRD v3 section 16, steps 1 to 17): where "Go to next step" moves the clock. */
const STEPS: { time: string; label: string }[] = [
  { time: "16:00", label: "Cutoff" },
  { time: "16:05", label: "System draft" },
  { time: "21:15", label: "Kumari's adjustments" },
  { time: "23:35", label: "Ready to release" },
  { time: "23:41", label: "Plan v3 released" },
  { time: "02:45", label: "VEH036 available" },
  { time: "02:56", label: "VEH003 held" },
  { time: "03:02", label: "Plan v4" },
  { time: "04:10", label: "Acknowledgements" },
  { time: "05:12", label: "VEH039 on the road" },
  { time: "05:19", label: "Driver offline" },
  { time: "05:21", label: "Store asks to defer" },
  { time: "06:40", label: "Conflict on sync" },
  { time: "06:46", label: "Waiting for the store" },
  { time: "07:31", label: "Receipt confirmed" },
];

/**
 * The presenter control (PRD v3 section 13), for the dispatcher's mock: a small floating panel, switched on from
 * the avatar menu or `?presenter=1`, that moves the scenario clock forward to the next walkthrough moment and
 * starts the demo again. It never goes backwards; Reset demo reloads the app at the address it opened at.
 */
export function PresenterControl() {
  const { advanceTo, presenter } = useDispatcher();
  const now = useNow();
  if (!advanceTo || !presenter) return null;

  const next = STEPS.find((step) => scenarioTime(step.time).getTime() > now.getTime());

  return (
    <aside className={styles.panel} aria-label="Presenter control">
      <p className={styles.clock}>
        {dayLabel(toIsoDate(now))} <Mono>{clockTime(now)}</Mono>
      </p>
      {next ? (
        <button type="button" className={styles.next} onClick={() => advanceTo(scenarioTime(next.time))}>
          <span>
            Go to <Mono>{next.time}</Mono> · {next.label}
          </span>
          <ChevronRight size={16} />
        </button>
      ) : (
        <p className={styles.end}>End of the dispatcher's walkthrough.</p>
      )}
      <button type="button" className={styles.reset} onClick={() => window.location.reload()}>
        <RotateCcw size={14} />
        Reset demo
      </button>
    </aside>
  );
}
