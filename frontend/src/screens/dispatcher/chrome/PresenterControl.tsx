import { ChevronRight, Pause, Play, RotateCcw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { clockTime, dayLabel } from "../../../domain/format";
import { colomboMs } from "../../../field/clock/clock";
import { toIsoDate } from "../../../domain/schedule";
import { Mono } from "../../../shared/ui/Mono";
import { useDispatcher } from "../context";
import { useNow } from "../hooks";
import { presenterFailure } from "./presenterFailure";
import styles from "./PresenterControl.module.css";

/** The walkthrough moments the dispatcher sees (PRD v3 section 16, steps 1 to 17): where "Go to next step" moves the clock. */
const STEPS: { time: string; label: string }[] = [
  { time: "16:00", label: "Cutoff" },
  { time: "16:05", label: "System draft" },
  { time: "21:15", label: "Dispatcher's adjustments" },
  { time: "23:35", label: "Ready to release" },
  { time: "23:41", label: "Plan v3 released" },
  { time: "02:45", label: "Workshop vehicle available" },
  { time: "02:56", label: "Reefer held at the dock" },
  { time: "03:02", label: "Plan v4" },
  { time: "04:10", label: "Acknowledgements" },
  { time: "05:12", label: "Driver on the road" },
  { time: "05:19", label: "Driver offline" },
  { time: "05:21", label: "Store asks to defer" },
  { time: "05:30", label: "Fresh store window opens" },
  { time: "06:40", label: "Conflict on sync" },
  { time: "06:46", label: "Waiting for the store" },
  { time: "07:31", label: "Receipt confirmed" },
];

/**
 * The presenter control (PRD v3 section 13), for the dispatcher's mock: a small floating panel, switched on from
 * the avatar menu or `?presenter=1`, that moves the scenario clock forward to the next walkthrough moment and
 * starts the demo again. It never goes backwards; Reset demo reloads the app at the address it opened at. On the real API
 * (`VITE_DISPATCHER_API=api`) the same two buttons call `/demo/advance` and `/demo/reset`.
 *
 * Every button reports what happened. A refused jump (the clock never goes backwards) and an API with no presenter
 * routes both used to leave the panel silent, which reads as a broken button.
 */
export function PresenterControl() {
  const { advanceTo, presenter, resetDemo, pauseClock, resumeClock, paused, scenarioDays } = useDispatcher();
  const now = useNow();
  const [failed, setFailed] = useState("");
  const [busy, setBusy] = useState("");
  if (!advanceTo || !presenter) return null;

  /** Runs one presenter action, keeping its failure on the panel until the next one succeeds. */
  const act = (name: string, run: () => void | Promise<unknown>) => () => {
    setFailed("");
    setBusy(name);
    void Promise.resolve()
      .then(run)
      .catch((error: unknown) => setFailed(presenterFailure(error)))
      .finally(() => setBusy(""));
  };

  // A time before noon is on the service date, the rest on the planning day before it. Both dates come from the server.
  const scenarioTime = (hhmm: string) =>
    new Date(colomboMs(Number(hhmm.slice(0, 2)) < 12 ? scenarioDays.serviceDate : scenarioDays.planningDay, hhmm));
  const next = STEPS.find((step) => scenarioTime(step.time).getTime() > now.getTime());

  return (
    <aside className={styles.panel} aria-label="Presenter control">
      <p className={styles.clock}>
        {dayLabel(toIsoDate(now))} <Mono>{clockTime(now)}</Mono>
      </p>
      {next ? (
        <button
          type="button"
          className={styles.next}
          disabled={busy !== ""}
          onClick={act("next", () => advanceTo(scenarioTime(next.time)))}
        >
          <span>
            Go to <Mono>{next.time}</Mono> · {next.label}
          </span>
          <ChevronRight size={16} />
        </button>
      ) : (
        <p className={styles.end}>End of the dispatcher's walkthrough.</p>
      )}
      {pauseClock && resumeClock && (
        <button
          type="button"
          className={styles.reset}
          disabled={busy !== ""}
          onClick={act("rate", () => (paused ? resumeClock() : pauseClock()))}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
          {paused ? "Resume clock" : "Pause clock"}
        </button>
      )}
      <button
        type="button"
        className={styles.reset}
        disabled={busy !== ""}
        onClick={act("reset", () => (resetDemo ? resetDemo() : window.location.reload()))}
      >
        <RotateCcw size={14} />
        {busy === "reset" ? "Resetting" : "Reset demo"}
      </button>
      {failed && (
        <p className={styles.failed} role="alert">
          <TriangleAlert size={14} aria-hidden />
          {failed}
        </p>
      )}
    </aside>
  );
}
