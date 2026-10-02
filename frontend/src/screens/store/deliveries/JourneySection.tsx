import { useState } from "react";
import { Button } from "../../../shared/ui/Button";
import { JourneyTimeline, type JourneyStep as TimelineStep } from "../../../shared/ui/JourneyTimeline";
import { Mono } from "../../../shared/ui/Mono";
import type { JourneyStep } from "../../../domain/delivery";
import styles from "./JourneySection.module.css";

/** "Dispatch · 16:00", or just "Loader" while the step is still to come. */
function metaOf(step: JourneyStep) {
  return step.at ? (
    <>
      {step.actor} · <Mono>{step.at}</Mono>
    </>
  ) : (
    step.actor
  );
}

/** Steps reached at or below which the journey starts collapsed behind "Show all steps" (S2.1). */
const COLLAPSE_AT = 2;

export type JourneySectionProps = {
  journey: JourneyStep[];
  /** The desktop draws the journey as one horizontal row with every step. */
  orientation?: "vertical" | "horizontal";
};

/**
 * The order's journey on a delivery card. Early on only what has happened is shown, with
 * "Show all steps" for the rest (S2.1); from Planned on every step is listed (S2.2 to S2.8).
 */
export function JourneySection({ journey, orientation = "vertical" }: JourneySectionProps) {
  const [showAll, setShowAll] = useState(false);
  const reached = journey.filter((step) => step.state !== "pending");
  const collapsible = orientation === "vertical" && reached.length <= COLLAPSE_AT;
  const visible = collapsible && !showAll ? reached : journey;

  const steps: TimelineStep[] = visible.map((step) => ({
    label: step.step,
    meta: metaOf(step),
    state: step.state,
  }));

  // On the desktop the row sits directly under the card's title, with no heading of its own.
  if (orientation === "horizontal") return <JourneyTimeline steps={steps} orientation="horizontal" />;

  return (
    <section className={styles.section} aria-labelledby="journey-title">
      <h2 className={styles.title} id="journey-title">
        Journey
      </h2>
      <JourneyTimeline steps={steps} metaAlign="right" />
      {collapsible && (
        <div className={styles.toggle}>
          <Button
          variant="ghost"
          size="medium"
          auto
          iconRight={showAll ? "chevron-down" : "chevron-right"}
          aria-expanded={showAll}
          onClick={() => setShowAll((open) => !open)}
        >
          {showAll ? "Show fewer steps" : "Show all steps"}
          </Button>
        </div>
      )}
    </section>
  );
}
