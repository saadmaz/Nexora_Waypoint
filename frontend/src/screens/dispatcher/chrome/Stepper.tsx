import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import type { DepotId } from "../../../api/DispatcherApi";
import { cx } from "../ui/cx";
import { STEPS, withDepot } from "./routes";
import styles from "./Stepper.module.css";

export type StepperProps = {
  /** The step the dispatcher is on (1 to 5). */
  current: number;
  /** Steps that are done. Default: every step before the current one. */
  done?: number[];
  /** Highlight the next step as the one to go to. */
  next?: boolean;
  depot: DepotId;
};

/** The planning stepper: 1 Queue · 2 Capacity · 3 Trips · 4 Deferrals · 5 Release (PRD v3 section 3). */
export function Stepper({ current, done, next, depot }: StepperProps) {
  const doneSet = new Set(done ?? Array.from({ length: current - 1 }, (_, i) => i + 1));
  // The early steps are spread out; once planning reaches the deferrals the steps sit closer (as the design draws them).
  const width = current >= 4 || doneSet.size >= 4 ? 100 : 164;
  return (
    <nav className={styles.stepper} aria-label="Planning steps" style={{ "--step-width": `${width}px` } as CSSProperties}>
      {STEPS.map((step) => {
        const isDone = doneSet.has(step.n);
        const isCurrent = !isDone && step.n === current;
        const isNext = !isDone && next === true && step.n === current + 1;
        return (
          <Link
            key={step.n}
            to={withDepot(step.to, depot)}
            className={cx(styles.step, isDone && styles.done, isCurrent && styles.current, isNext && styles.next, step.n === 5 && styles.last)}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span className={styles.body}>
              <span className={styles.marker}>{isDone && <Check size={9} strokeWidth={3.5} />}</span>
              <span className={styles.label}>
                {step.n} {step.label}
              </span>
            </span>
            {step.n < 5 && <span className={styles.track} />}
          </Link>
        );
      })}
    </nav>
  );
}
