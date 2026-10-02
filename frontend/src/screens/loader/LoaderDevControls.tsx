import { useState } from "react";
import { Button } from "../../shared/ui/Button";
import { useLoader } from "./LoaderContext";
import styles from "./LoaderDevControls.module.css";

/** Shown with `?presenter=1` or `?dev=1`. The judges and the gallery never see it otherwise. */
function devControlsOn(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("presenter") === "1" || params.get("dev") === "1";
}

/**
 * Loader prompt section 5: the mock server stands in for Dispatch, so this lets the flow be played
 * without waiting for 03:00 on the scenario clock. A failed vehicle check is decided (plan v4); any
 * other flag is only marked seen (PRD v3.1 G-14). In API mode the real dispatcher decides at D8, so
 * this control has no job there (PRD v3.1 section 13).
 */
export function LoaderDevControls() {
  const { api } = useLoader();
  const [done, setDone] = useState(false);
  if (!devControlsOn()) return null;
  return (
    <aside className={styles.panel} aria-label="Developer controls" data-keeps-sheet-open>
      <Button
        size="medium"
        variant="secondary"
        onClick={() => {
          void api.devResolveExceptionNow().then(() => setDone(true));
        }}
      >
        {done ? "Dispatch has decided" : "Dispatch decides now"}
      </Button>
    </aside>
  );
}
