import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { colomboMs, formatTime, minutesUntil } from "../../../field/clock/clock";
import { useNow } from "../../../field/clock/useClock";
import { OfflineBanner, PinnedActionBar } from "../../../field/components";
import { useConnectivity, type ConnectivitySnapshot } from "../../../field/offline";
import { Alert } from "../../../shared/ui/Alert";
import { Button } from "../../../shared/ui/Button";
import { Mono } from "../../../shared/ui/Mono";
import { LoadingSkeleton, StateScreen } from "../../../shared/ui/StateScreen";
import { Tag } from "../../../shared/ui/Tag";
import { useDriverApi, useT } from "../context/DriverContext";
import { useDriverRun } from "../context/useDriverRun";
import { runDate } from "../../../field/clock/runDate";
import { buildOfflineBanner } from "../offlineBanner";
import { DriverShell } from "../shell/DriverShell";
import { dockLabel, isChilled, openMapsFor } from "../stopFormat";
import styles from "./StopScreen.module.css";

export type StopScreenProps = {
  connectivityOverride?: ConnectivitySnapshot;
  forceSaveError?: boolean;
  forceJustSaved?: boolean;
  /** The state gallery only: renders this stop without a real router match. */
  stopIdOverride?: string;
};

/**
 * R2 Stop detail (field conventions section 3; driver prompt 3 section 5): before arrival
 * (R2.1, R2.3 A/B), the just-saved confirmation (R2.S 1), waiting for the window (R2.2 A) and
 * window open (R2.2 B), plus the not-on-route (R2.S 3), save-error (R2.S 2) and loading (R2.S 4)
 * states.
 */
export function StopScreen({ connectivityOverride, forceSaveError, forceJustSaved, stopIdOverride }: StopScreenProps = {}) {
  const params = useParams<{ stopId: string }>();
  const stopId = stopIdOverride ?? params.stopId;
  const t = useT();
  const api = useDriverApi();
  const navigate = useNavigate();
  const liveConnectivity = useConnectivity();
  const connectivity = connectivityOverride ?? liveConnectivity;
  const now = useNow();
  const { run, refresh } = useDriverRun(runDate());
  const [justSaved, setJustSaved] = useState(Boolean(forceJustSaved));
  const [saveError, setSaveError] = useState(Boolean(forceSaveError));
  const [saving, setSaving] = useState(false);

  async function handleArrive() {
    if (!stopId) return;
    setSaving(true);
    setSaveError(false);
    try {
      await api.recordArrival(runDate(), stopId);
      refresh();
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 4000);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  // R2.S 4: the run hasn't loaded yet.
  if (!run) {
    return (
      <DriverShell title={t("stop.loadingTitle")} connectivityOverride={connectivityOverride}>
        <p className={styles.body}>{t("stop.opening")}</p>
        <LoadingSkeleton />
      </DriverShell>
    );
  }

  const stop = run.stops.find((s) => s.outletId === stopId);

  // R2.S 3: a stop that isn't on this run.
  if (!stop) {
    return (
      <DriverShell title={t("stop.loadingTitle")} onBack={() => navigate("/driver/run")} connectivityOverride={connectivityOverride}>
        <StateScreen
          icon="map-pin"
          bg="offline-soft"
          fg="offline"
          title={t("stop.notOnRoute")}
          body={t("stop.notOnRouteBody", { runNo: run.runNo })}
          actions={<Button onClick={() => navigate("/driver/run")}>{t("action.backToRun")}</Button>}
        />
      </DriverShell>
    );
  }

  const title = t("stop.title", { number: stop.number, outletId: stop.outletId });
  const subtitle =
    connectivity.status === "offline" ? t("stop.subtitleOffline", { district: stop.district }) : t("stop.subtitleOnline", { district: stop.district });
  const windowOpenMs = colomboMs(runDate(), stop.window.open);
  const insideWindowAlready = now >= windowOpenMs;
  const arrived = Boolean(stop.arrivalAt);

  const zeroStateBanner = (
    <OfflineBanner tone="offline" detail={t("banner.offlineLastSync", { time: connectivity.lastSyncAt ? formatTime(connectivity.lastSyncAt) : "--:--" })}>
      {t("banner.routeSaved")}
    </OfflineBanner>
  );
  const banner = buildOfflineBanner(connectivity, t, zeroStateBanner);

  const navigateAction = (
    <Button variant="secondary" size="medium" icon="navigation" onClick={() => openMapsFor(stop)}>
      {t("action.navigate")}
    </Button>
  );
  // The dataset has no store phone number and none is invented (Contributing section 29), so the button says so instead of
  // doing nothing when tapped.
  const callStoreAction = (
    <Button variant="secondary" size="medium" icon="phone" disabled title={t("action.callStoreNone")} aria-label={`${t("action.callStore")}. ${t("action.callStoreNone")}`}>
      {t("action.callStore")}
    </Button>
  );

  const unloadingSection = (
    <>
      <h3 className={styles.subheading}>{t("stop.unloading")}</h3>
      <p className={styles.body}>
        {t("stop.unloadingNote", { dock: dockLabel(stop.dock), parking: stop.parkingNote ?? "", minutes: stop.unloadMinutes ?? 15 })}
      </p>
    </>
  );

  const stopShortfalls = (run.loaderConfirmation?.shortfalls ?? []).filter((sf) => stop.orders.some((order) => order.id === sf.orderId));

  const ordersSection = (
    <>
      <h3 className={styles.subheading}>{t("stop.ordersOnStop")}</h3>
      <div className={styles.ordersList}>
        {stop.orders.map((order) => {
          const shortfall = stopShortfalls.find((sf) => sf.orderId === order.id);
          return (
            <div key={order.id} className={styles.orderRow}>
              <p className={styles.orderId}>
                <Mono>{order.id}</Mono>
              </p>
              {shortfall ? (
                <div className={styles.orderMeta}>
                  <Tag kind="warn">{t("stop.deliver", { count: order.units - shortfall.shortBy })}</Tag>
                  <span>{t("stop.unitsExpected", { count: order.units })}</span>
                  <Tag kind="warn">{t("stop.short", { count: shortfall.shortBy })}</Tag>
                </div>
              ) : (
                <div className={styles.orderMeta}>
                  <span>{t("stop.units", { count: order.units })}</span>
                  <Tag kind={order.temperature === "chilled" ? "chilled" : "ambient"}>
                    {order.temperature === "chilled" ? t("tag.chilled") : "Ambient"}
                  </Tag>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  // Before arrival: R2.1, R2.3 A, R2.3 B (a loader shortfall on this stop's orders).
  if (!arrived) {
    return (
      <DriverShell
        title={title}
        subtitle={subtitle}
        onBack={() => navigate("/driver/run")}
        banner={saveError ? <Alert tone="danger" title={t("stop.couldNotSaveArrival")}><Button size="medium" auto onClick={handleArrive}>{t("action.retry")}</Button></Alert> : banner}
        connectivityOverride={connectivityOverride}
        pinned={
          <PinnedActionBar>
            <Button busy={saving} onClick={handleArrive}>
              {t("action.recordArrival")}
            </Button>
          </PinnedActionBar>
        }
      >
        <p className={styles.stopOf}>{t("stop.ofTotal", { number: stop.number, total: run.stops.length })}</p>
        <h2 className={styles.heading}>
          <Mono>{stop.outletId}</Mono> · {stop.outletName}
        </h2>
        <div className={styles.tagsRow}>
          <Tag kind="fresh">{stop.brand}</Tag>
          {isChilled(stop) && <Tag kind="chilled">{t("tag.chilled")}</Tag>}
        </div>
        <div className={styles.actionRow}>
          {navigateAction}
          {callStoreAction}
        </div>
        {stopShortfalls.length > 0 && (
          <p className={styles.body}>
            {t("stop.shortfall", {
              short: stopShortfalls[0].shortBy,
              deliver: stop.orders[0].units - stopShortfalls[0].shortBy,
              expected: stop.orders[0].units,
            })}
          </p>
        )}
        <div className={styles.statRow}>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              <Mono>
                {stop.window.open}-{stop.window.close}
              </Mono>
            </span>
            <span className={styles.statLabel}>{t("stop.window")}</span>
          </div>
          <div className={styles.stat}>
            {insideWindowAlready ? (
              <span className={styles.statValue}>{t("stop.insideWindow")}</span>
            ) : (
              <>
                <span className={styles.statValue}>
                  <Mono>{stop.plannedArrival}</Mono>
                </span>
                <span className={styles.statLabel}>{t("stop.plannedArrival")}</span>
              </>
            )}
          </div>
        </div>
        {unloadingSection}
        {ordersSection}
      </DriverShell>
    );
  }

  const arrivalTime = stop.arrivalAt ?? "";
  const arrivalFact = (
    <div className={styles.statRow}>
      <div className={styles.stat}>
        <span className={styles.statValue}>{t("stop.arrival", { time: arrivalTime })}</span>
        <Tag kind="success" icon="check">
          {t("stop.savedOnPhone")}
        </Tag>
      </div>
    </div>
  );

  // R2.S 1: the just-recorded confirmation, before the countdown view takes over.
  if (justSaved) {
    return (
      <DriverShell
        title={title}
        subtitle={subtitle}
        onBack={() => navigate("/driver/run")}
        banner={banner}
        connectivityOverride={connectivityOverride}
        pinned={
          <PinnedActionBar helper={!insideWindowAlready ? t("stop.opensAt", { time: stop.window.open }) : undefined}>
            <Button disabled={!insideWindowAlready} onClick={() => navigate(`/driver/stops/${stop.outletId}/outcome`)}>
              {t("action.recordOutcome")}
            </Button>
          </PinnedActionBar>
        }
      >
        <p className={styles.stopOf}>{t("stop.ofTotal", { number: stop.number, total: run.stops.length })}</p>
        <h2 className={styles.heading}>
          <Mono>{stop.outletId}</Mono> · {stop.outletName}
        </h2>
        <div className={styles.actionRow}>
          {navigateAction}
          {callStoreAction}
        </div>
        {unloadingSection}
        {arrivalFact}
        {ordersSection}
        <div className={styles.confirmLine}>{t("stop.arrivalSavedWillSync")}</div>
      </DriverShell>
    );
  }

  // R2.2 B: the window is open.
  if (insideWindowAlready) {
    return (
      <DriverShell
        title={title}
        subtitle={subtitle}
        onBack={() => navigate("/driver/run")}
        banner={banner}
        connectivityOverride={connectivityOverride}
        pinned={
          <PinnedActionBar>
            <Button onClick={() => navigate(`/driver/stops/${stop.outletId}/outcome`)}>{t("action.recordOutcome")}</Button>
          </PinnedActionBar>
        }
      >
        <h2 className={styles.heading}>{t("stop.windowOpenTitle", { outletId: stop.outletId })}</h2>
        <p className={styles.body}>{t("stop.windowOpenBody")}</p>
        <div className={styles.actionRow}>
          {navigateAction}
          {callStoreAction}
        </div>
        {unloadingSection}
        <div className={styles.statRow}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{t("stop.arrival", { time: arrivalTime })}</span>
            <span className={styles.statLabel}>{t("stop.savedOnPhone")}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {t("stop.windowOpened")} <Mono>{stop.window.open}</Mono>
            </span>
            <span className={styles.statLabel}>{t("stop.waited", { minutes: minutesBetween(arrivalTime, stop.window.open) })}</span>
          </div>
        </div>
        {ordersSection}
      </DriverShell>
    );
  }

  // R2.2 A: arrived, waiting for the window to open.
  const minutesToGo = Math.max(0, minutesUntil(windowOpenMs, now));
  return (
    <DriverShell
      title={title}
      subtitle={subtitle}
      onBack={() => navigate("/driver/run")}
      banner={banner}
      connectivityOverride={connectivityOverride}
      pinned={
        <PinnedActionBar helper={t("stop.opensAt", { time: stop.window.open })}>
          <Button disabled>{t("action.recordOutcome")}</Button>
        </PinnedActionBar>
      }
    >
      <h2 className={styles.heading}>{t("stop.waitingFor", { time: arrivalTime })}</h2>
      <p className={styles.body}>
        {t("stop.windowOpensAt", { time: stop.window.open })} · {t("stop.toGo", { minutes: minutesToGo })}
      </p>
      <div className={styles.actionRow}>
        {navigateAction}
        {callStoreAction}
      </div>
      {unloadingSection}
      {arrivalFact}
      {ordersSection}
    </DriverShell>
  );
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}
