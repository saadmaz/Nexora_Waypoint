import { Button } from "../shared/ui/Button";
import { Mono } from "../shared/ui/Mono";
import { clockTime, dayLabel } from "../domain/format";
import { toIsoDate } from "../domain/schedule";
import { useNow } from "../hooks/useNow";
import styles from "./PresenterControl.module.css";
import { useStore } from "./StoreContext";

/**
 * The walkthrough moments the store can see (PRD v3 section 16, steps 3, 6, 10 to 17): where "Go to
 * the next step" jumps the scenario clock. Times are the S2 frame times.
 */
const STEPS: { day: string; time: string; label: string }[] = [
  { day: "2026-09-28", time: "16:01", label: "Orders close" },
  { day: "2026-09-28", time: "23:41", label: "Arrival time set" },
  { day: "2026-09-29", time: "04:51", label: "Loaded" },
  { day: "2026-09-29", time: "05:11", label: "On the way" },
  { day: "2026-09-29", time: "05:19", label: "Driver out of coverage" },
  { day: "2026-09-29", time: "05:22", label: "Deferred at your request" },
  { day: "2026-09-29", time: "06:41", label: "Under review" },
  { day: "2026-09-29", time: "06:45", label: "Delivery kept" },
  { day: "2026-09-29", time: "07:28", label: "Ready to confirm" },
];

/**
 * The presenter control (PRD v3 section 13), for the store's mock: a small floating panel, shown
 * with `?presenter=1`, that jumps the scenario clock forward to the next walkthrough moment and
 * resets the demo. It never goes backwards; Reset demo reloads the app at the address it opened at.
 */
export function PresenterControl() {
  const { advanceTo, presenter } = useStore();
  const now = useNow();
  if (!advanceTo || !presenter) return null;

  const next = STEPS.find((step) => new Date(`${step.day}T${step.time}:00`).getTime() > now.getTime());

  return (
    <aside className={styles.panel} aria-label="Presenter control">
      <p className={styles.clock}>
        {dayLabel(toIsoDate(now))} <Mono>{clockTime(now)}</Mono>
      </p>
      {next ? (
        <Button size="medium" onClick={() => advanceTo(new Date(`${next.day}T${next.time}:00`))}>
          Go to <Mono>{next.time}</Mono> · {next.label}
        </Button>
      ) : (
        <p className={styles.end}>End of the store's walkthrough.</p>
      )}
      <Button size="medium" variant="secondary" onClick={() => window.location.reload()}>
        Reset demo
      </Button>
    </aside>
  );
}
