import type { ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./JourneyTimeline.module.css";

export type JourneyStepState = "done" | "current" | "pending" | "issue" | "deferred";

export type JourneyStep = {
  label: ReactNode;
  /** Who and when, e.g. "Ruwan · 04:50". Rendered in Plex Mono. */
  meta?: ReactNode;
  state: JourneyStepState;
};

export type JourneyTimelineProps = {
  steps: JourneyStep[];
  orientation?: "vertical" | "horizontal";
  /** Where a step's meta sits in the vertical timeline: under the label (default) or right-aligned on its row (S1 "What happens next"). */
  metaAlign?: "below" | "right";
};

const STATE_CLASS: Record<JourneyStepState, string> = {
  done: styles.done,
  current: styles.current,
  pending: styles.pending,
  issue: styles.issue,
  deferred: styles.deferred,
};

/**
 * The order's journey, vertical (S2 "Show all steps") or horizontal (a short
 * summary row). Each step shows who and when; the dot's shape and icon carry
 * the state, never colour alone.
 */
export function JourneyTimeline({
  steps,
  orientation = "vertical",
  metaAlign = "below",
}: JourneyTimelineProps) {
  const classes = [
    orientation === "vertical" ? styles.vertical : styles.horizontal,
    orientation === "vertical" && metaAlign === "right" && styles.metaRight,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <ol className={classes}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <li className={[styles.step, STATE_CLASS[step.state]].join(" ")} key={i}>
            <span className={styles.rail}>
              <span className={styles.dot}>
                {step.state === "done" && <Icon name="check" size={14} />}
                {step.state === "issue" && <Icon name="alert-circle" size={14} />}
                {step.state === "deferred" && <Icon name="calendar-clock" size={14} />}
              </span>
              {!isLast && <span className={styles.line} aria-hidden />}
            </span>
            <span className={styles.body}>
              <div className={styles.label}>{step.label}</div>
              {step.meta && <div className={styles.meta}>{step.meta}</div>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
