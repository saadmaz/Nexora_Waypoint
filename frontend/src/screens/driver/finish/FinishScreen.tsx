import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatTime } from "../../../field/clock/clock";
import { PinnedActionBar } from "../../../field/components";
import { useConnectivity } from "../../../field/offline";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { useDriverApi, useT } from "../context/DriverContext";
import { useDriverRun } from "../context/useDriverRun";
import { runDate } from "../../../field/clock/runDate";
import { DriverShell } from "../shell/DriverShell";
import type { FinishedRun, RunDistance } from "../types";
import styles from "./Finish.module.css";

/**
 * R9 Finish run (PRD v3 section 3 R9, section 15 GPS, A24, DP-14): R9.2 the distance the run is closed with and the fuel it
 * implies, R9.3 / R9.4 run complete (with whether every record has reached Dispatch), R9.5 no more runs today.
 */
export function FinishScreen() {
  const t = useT();
  const api = useDriverApi();
  const navigate = useNavigate();
  const connectivity = useConnectivity();
  const { run } = useDriverRun(runDate());
  const [distance, setDistance] = useState<RunDistance | null>(null);
  const [finished, setFinished] = useState<FinishedRun | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([api.getRunDistance(runDate()), api.getFinishedRun(runDate())]).then(([d, f]) => {
      if (!active) return;
      setDistance(d);
      setFinished(f);
    });
    return () => {
      active = false;
    };
  }, [api]);

  const allRecorded = Boolean(run?.stops.every((stop) => stop.orders.every((order) => stop.outcomes[order.id])));
  const vehicleId = run?.vehicle.id ?? "";
  // The server does not always say when the next plan releases; a missing time must never break the screen (R9.5).
  const nextReleaseMs = run ? Date.parse(run.nextPlanReleaseAt) : Number.NaN;
  const nextPlanAt = Number.isFinite(nextReleaseMs) ? formatTime(nextReleaseMs) : null;

  async function finish() {
    setBusy(true);
    try {
      setFinished(await api.finishRun(runDate()));
    } finally {
      setBusy(false);
    }
  }

  if (finished && done) {
    return (
      <DriverShell title={t("finish.title")} onBack={() => navigate("/driver/run")}>
        <div className={styles.centre} role="status">
          <span className={styles.tile}>
            <Icon name="calendar-clock" size={28} />
          </span>
          <h2 className={styles.title}>{t("finish.noMoreTitle")}</h2>
          {nextPlanAt && <p className={styles.muted}>{t("finish.noMoreBody", { time: nextPlanAt })}</p>}
        </div>
      </DriverShell>
    );
  }

  if (finished) {
    const waiting = connectivity.waitingCount;
    return (
      <DriverShell
        title={t("finish.title")}
        onBack={() => navigate("/driver/run")}
        pinned={
          <PinnedActionBar>
            <Button onClick={() => setDone(true)}>{t("finish.done")}</Button>
          </PinnedActionBar>
        }
      >
        <div className={styles.centre} role="status">
          <span className={styles.tile}>
            <Icon name="circle-check" size={28} />
          </span>
          <h2 className={styles.title}>{t("finish.completeTitle")}</h2>
          <p className={styles.muted}>
            <Mono>
              {run?.departedAt ?? ""} to {finished.at} · {finished.distance.totalKm} km · {finished.distance.fuelL} L
            </Mono>
          </p>
          <p className={styles.muted}>
            {waiting === 0 ? t("finish.completeSynced") : waiting === 1 ? t("finish.completeWaitingOne") : t("finish.completeWaiting", { count: waiting })}
          </p>
        </div>
      </DriverShell>
    );
  }

  return (
    <DriverShell
      title={t("finish.title")}
      onBack={() => navigate("/driver/run")}
      pinned={
        <PinnedActionBar helper={allRecorded ? undefined : t("finish.notYet")}>
          <Button icon="flag" busy={busy} disabled={!distance || !allRecorded} onClick={() => void finish()}>
            {t("finish.action")}
          </Button>
        </PinnedActionBar>
      }
    >
      {distance && (
        <Card padded>
          <p className={styles.label}>{distance.source === "gps" ? t("finish.gpsTracked") : t("finish.planned")}</p>
          <p className={styles.big}>
            <Mono>{distance.totalKm} km</Mono>
          </p>
          {distance.source === "gps" && (
            <p className={styles.muted}>
              <Mono>{t("finish.legs", { legs: distance.legsKm.map((km) => km.toFixed(1)).join(" / ") })}</Mono>
            </p>
          )}
          <p className={styles.line}>
            <Mono>{t("finish.fuel", { fuel: distance.fuelL })}</Mono>
          </p>
          <p className={styles.muted}>
            <Mono>{t("finish.plannedLine", { km: distance.plannedKm, vehicleId, kmPerL: distance.kmPerL.toFixed(1) })}</Mono>
          </p>
          <p className={styles.muted}>{distance.source === "gps" ? t("finish.gapNote") : t("finish.plannedNote")}</p>
        </Card>
      )}
    </DriverShell>
  );
}
