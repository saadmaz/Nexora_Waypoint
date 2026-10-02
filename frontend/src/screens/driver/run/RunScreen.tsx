import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatDate, formatTime } from "../../../field/clock/clock";
import { useNow } from "../../../field/clock/useClock";
import { DriverStopCard, OfflineBanner, PinnedActionBar } from "../../../field/components";
import { connectivity as connectivityStore, useConnectivity, type ConnectivitySnapshot } from "../../../field/offline";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { MonoText } from "../../../shared/ui/MonoText";
import { LoadingSkeleton, StateScreen } from "../../../shared/ui/StateScreen";
import { StatusPill } from "../../../shared/ui/StatusPill";
import { Tag } from "../../../shared/ui/Tag";
import { useDriverApi, useOutboxOpen, useT } from "../context/DriverContext";
import { useDriverRun } from "../context/useDriverRun";
import { RUN_DATE } from "../fixtures";
import { buildOfflineBanner } from "../offlineBanner";
import { DriverShell, type DriverShellProps } from "../shell/DriverShell";
import { RecordPill } from "../outbox/RecordPill";
import { usePhotoState, type PhotoState } from "../sync/usePhotoState";
import { StatusBar, StatusBarButton } from "../outbox/StatusBar";
import { CompletedStopRow } from "../stop/CompletedStopRow";
import { StopOrdersSummary, StopSchedule } from "../stopComponents";
import { isChilled, openMapsFor, primaryStopIndex, stopDone, stopPlace, willWaitMinutes } from "../stopFormat";
import styles from "./RunScreen.module.css";

function depotLabel(depot: string): string {
  return depot.charAt(0).toUpperCase() + depot.slice(1);
}

export type RunScreenProps = {
  /** The state gallery only; see `DriverShellProps.connectivityOverride`. */
  connectivityOverride?: ConnectivitySnapshot;
  /** The state gallery only: shows R1.2 A's progress bar without a real download in flight. */
  forcedProgress?: { done: number; total: number };
  /** The state gallery only: shows R1.S without a real failed download. */
  forceDownloadError?: boolean;
  /** The state gallery only: R3.9 (true, the just-saved toast) vs R3.10 (false, settled) when every
   * stop is already seeded done on mount, which the real app never does in one render. */
  forceJustSaved?: boolean;
  /** The state gallery only; see `DriverShellProps.outboxPreview`. */
  outboxPreview?: DriverShellProps["outboxPreview"];
  /** The state gallery only: the photos on the phone, instead of the phone's own blobs. */
  photoStateOverride?: PhotoState;
};

/**
 * R1 Route (field conventions section 3; driver prompt 3 section 4): one component whose state
 * comes from the run data, connectivity and the clock. Covers R1.1 to R1.6 and the merged
 * R1.3 B / R1.4 "ready to depart" view; R1.10 is this same screen in the Field theme.
 */
export function RunScreen({ connectivityOverride, forcedProgress, forceDownloadError, forceJustSaved, outboxPreview, photoStateOverride }: RunScreenProps = {}) {
  const t = useT();
  const api = useDriverApi();
  const navigate = useNavigate();
  const location = useLocation();
  const liveConnectivity = useConnectivity();
  const connectivity = connectivityOverride ?? liveConnectivity;
  const now = useNow();
  const { run, refresh } = useDriverRun(RUN_DATE);
  const outbox = useOutboxOpen();
  const livePhotos = usePhotoState(run);
  const photos = photoStateOverride ?? livePhotos;

  const [downloading, setDownloading] = useState(Boolean(forcedProgress));
  const [progress, setProgress] = useState(forcedProgress ?? { done: 0, total: 0 });
  const [downloadError, setDownloadError] = useState(Boolean(forceDownloadError));

  const version = run?.currentVersion?.v;
  const downloaded = run !== null && version !== undefined && run?.downloadedVersion === version;
  const acknowledged = run !== null && version !== undefined && run?.acknowledgedVersion === version;
  const departed = run?.departedAt != null;
  const allDone = run ? primaryStopIndex(run.stops) === -1 : false;

  // The gallery seeds both stops done on the very first render, which the real app never does in
  // one frame; `forceJustSaved` picks R3.9 (toast) or R3.10 (settled) for that case directly.
  const [justSaved, setJustSaved] = useState(forceJustSaved ?? false);
  const wasAllDone = useRef(forceJustSaved !== undefined ? allDone : false);
  // "Saved on this phone" shows when the last outcome has just been saved: either it was saved on
  // this screen's watch, or the outcome screen sent the driver here to say so. Opening the run
  // later, or coming back from the sync result, finds the stops already done and says nothing.
  const arrivedSaved = Boolean((location.state as { justSaved?: boolean } | null)?.justSaved);
  const runSeen = useRef(false);

  const hasRun = run !== null;
  useEffect(() => {
    if (forceJustSaved !== undefined || !hasRun) return undefined;
    if (!runSeen.current) {
      runSeen.current = true;
      if (!arrivedSaved) wasAllDone.current = allDone;
    }
    if (allDone && !wasAllDone.current) {
      wasAllDone.current = true;
      setJustSaved(true);
      const id = window.setTimeout(() => setJustSaved(false), 4000);
      return () => window.clearTimeout(id);
    }
    if (!allDone) wasAllDone.current = false;
    return undefined;
  }, [allDone, forceJustSaved, hasRun, arrivedSaved]);

  async function handlePlanAction() {
    if (!run || version === undefined) return;
    if (!downloaded) {
      setDownloadError(false);
      setDownloading(true);
      setProgress({ done: 0, total: 0 });
      try {
        await api.downloadRun(RUN_DATE, version, (done, total) => setProgress({ done, total }));
        refresh();
      } catch {
        setDownloadError(true);
      } finally {
        setDownloading(false);
      }
    } else {
      await api.acknowledgePlan(RUN_DATE, version);
      refresh();
    }
  }

  async function handleStartRoute() {
    await api.startRoute(RUN_DATE);
    refresh();
  }

  async function handleArrive(outletId: string) {
    await api.recordArrival(RUN_DATE, outletId);
    refresh();
    navigate(`/driver/stops/${outletId}`);
  }

  if (!run) {
    return (
      <DriverShell title={t("run.title", { runNo: 1, vehicleId: "" })} connectivityOverride={connectivityOverride} outboxPreview={outboxPreview}>
        <LoadingSkeleton />
      </DriverShell>
    );
  }

  const title = t("run.title", { runNo: run.runNo, vehicleId: run.vehicle.id });
  const banner = buildOfflineBanner(
    connectivity,
    t,
    <OfflineBanner tone="offline">
      {t("banner.offlineWaiting", { time: connectivity.lastSyncAt ? formatTime(connectivity.lastSyncAt) : "--:--", count: 0 })}
    </OfflineBanner>,
  );

  // R1.1: no plan released yet for this driver and date.
  if (!run.currentVersion) {
    const releaseMs = Date.parse(run.nextPlanReleaseAt);
    return (
      <DriverShell title={title} subtitle={t("run.noRoute")} banner={banner} connectivityOverride={connectivityOverride} outboxPreview={outboxPreview}>
        <StateScreen
          icon="route"
          bg="route-soft"
          fg="route"
          title={t("run.noRoute")}
          body={t("run.noRouteBody")}
          facts={[
            { key: t("run.vehicleFact"), value: <Mono>{run.vehicle.id}</Mono> },
            {
              key: t("run.releaseFact"),
              value: (
                <>
                  {formatDate(releaseMs)} <Mono>{formatTime(releaseMs)}</Mono>
                </>
              ),
            },
          ]}
        />
      </DriverShell>
    );
  }

  // R1.S: the route failed to download.
  if (downloadError) {
    return (
      <DriverShell
        title={title}
        subtitle={`${formatDate(now)} · ${t("run.stopsCount", { count: run.stops.length })}`}
        preDeparture
        banner={banner}
        connectivityOverride={connectivityOverride} outboxPreview={outboxPreview}
        pinned={
          <PinnedActionBar helper={t("run.startRouteLocked")}>
            <Button disabled>{t("action.startRoute")}</Button>
          </PinnedActionBar>
        }
      >
        <StateScreen
          icon="wifi-off"
          bg="danger-soft"
          fg="danger"
          title={t("run.downloadFailedTitle")}
          body={t("run.downloadFailedBody")}
          facts={[
            { key: "Stops", value: run.stops.length },
            { key: t("run.downloadedCount"), value: `${progress.done} / ${run.stops.length + 1}` },
          ]}
          actions={
            <>
              <Button onClick={handlePlanAction}>{t("action.tryAgain")}</Button>
              <Button variant="secondary" icon="phone">
                {t("run.callDispatch")}
              </Button>
              <p className={styles.caption}>
                {t("run.dispatchDesk")} · Ref WP-ROUTE-201 · <Mono>{formatTime(now)}</Mono>
              </p>
            </>
          }
        />
      </DriverShell>
    );
  }

  // run.currentVersion is non-null past the R1.1 guard above.
  const planVersion = run.currentVersion.v;

  // Pre-departure: R1.2 A/B (downloading, ready offline), R1.3 A (not yet acknowledged, waiting for
  // loading) and the merged R1.3 B / R1.4 "ready to depart" view.
  if (!departed) {
    const loaderConfirmed = run.loaderConfirmation !== null;
    const totalOrders = run.stops.reduce((sum, stop) => sum + stop.orders.length, 0);
    // R1.3 A alone reads "Plan vN" (the acknowledge flow has not even started downloading yet);
    // every other pre-departure moment, including while downloading, reads "N stops".
    const subtitle =
      !downloaded && !downloading
        ? `${formatDate(now)} · ${t("run.planShort", { version: planVersion })}`
        : `${formatDate(now)} · ${t("run.stopsCount", { count: run.stops.length })}`;

    const planCard = !acknowledged && (
      <Card padded>
        <div className={styles.cardStack}>
          {downloading ? (
            <>
              <p className={styles.body}>{t("run.downloading")}</p>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : "0%" }}
                />
              </div>
              <p className={styles.caption}>
                <Mono>
                  {progress.done} / {progress.total || run.stops.length + 1}
                </Mono>
              </p>
              <p className={styles.caption}>{t("run.planUnchanged", { version: planVersion })}</p>
            </>
          ) : !downloaded ? (
            <>
              <p className={styles.body}>{t("run.planOnPhone", { version: planVersion })}</p>
              <p className={styles.caption}>{t("run.routeUnchanged")}</p>
              <Button onClick={handlePlanAction}>{t("action.acknowledgeV", { version: planVersion })}</Button>
            </>
          ) : (
            <>
              <p className={styles.body}>{t("run.readyOffline")}</p>
              <p className={styles.caption}>
                <Mono>
                  {run.stops.length + 1} / {run.stops.length + 1}
                </Mono>
              </p>
              <p className={styles.caption}>{t("run.planUnchanged", { version: planVersion })}</p>
              <Button onClick={handlePlanAction}>{t("action.acknowledgePlanV", { version: planVersion })}</Button>
            </>
          )}
        </div>
      </Card>
    );

    const loaderLine = loaderConfirmed ? (
      <>
        <p className={styles.body}>{t("run.ordersOnBoard", { count: totalOrders })}</p>
        <p className={styles.body}>{t("run.confirmedBy", { name: run.loaderConfirmation?.by ?? "", time: run.loaderConfirmation?.at ?? "" })}</p>
      </>
    ) : (
      <p className={styles.body}>{t("run.waitingForLoading", { depot: depotLabel(run.depot), vehicleId: run.vehicle.id })}</p>
    );

    const startDisabled = !(acknowledged && loaderConfirmed && downloaded);
    const pinned = (
      <PinnedActionBar helper={!startDisabled ? t("run.startRouteHelper") : undefined}>
        <Button disabled={startDisabled} onClick={handleStartRoute}>
          {t("action.startRoute")}
        </Button>
      </PinnedActionBar>
    );

    const stopCards = run.stops.map((stop, index) => {
      const wait = willWaitMinutes(stop);
      const tags = (
        <>
          {wait !== null && (
            <Tag kind="outline" icon="clock">
              {t("run.willWait", { minutes: wait })}
            </Tag>
          )}
          {isChilled(stop) && <Tag kind="chilled">{t("tag.chilled")}</Tag>}
        </>
      );
      const actions =
        acknowledged && index === 0 ? (
          <Button variant="secondary" size="medium" icon="navigation" onClick={() => openMapsFor(stop)}>
            {t("action.navigate")}
          </Button>
        ) : undefined;
      return (
        <DriverStopCard
          key={stop.outletId}
          stopNumber={stop.number}
          outletId={stop.outletId}
          outletName={stop.outletName}
          schedule={<StopSchedule stop={stop} />}
          place={stopPlace(stop)}
          tags={tags}
          orders={<StopOrdersSummary stop={stop} t={t} />}
          actions={actions}
          onOpen={() => navigate(`/driver/stops/${stop.outletId}`)}
        />
      );
    });

    return (
      <DriverShell
        title={title}
        subtitle={subtitle}
        preDeparture
        banner={banner}
        pinned={pinned}
        connectivityOverride={connectivityOverride} outboxPreview={outboxPreview}
      >
        {planCard}
        {loaderLine}
        <div className={styles.stopsList}>{stopCards}</div>
      </DriverShell>
    );
  }

  // Departed: R1.5 (online), R1.6 (offline), and all-done (R3.9 / R3.10).
  const primaryIndex = primaryStopIndex(run.stops);

  if (allDone) {
    const openConflict = run.stops.find((stop) => stop.conflict && !stop.resolution);
    const resolved = run.stops.filter((stop) => stop.resolution);
    // Nothing left on the phone: R1.7 (a stop under review) and R1.8 (Dispatch decided), or the
    // same screen with no notice once everything is plainly synced. While records still wait it is R3.9 / R3.10.
    const synced = connectivity.waitingCount === 0 && connectivity.status !== "offline";
    const hasNews = synced && (openConflict !== undefined || resolved.length > 0 || photos.failures.length > 0);
    const lastResolved = resolved[resolved.length - 1];
    const failure = photos.failures[0];
    const bar = failure ? (
      <StatusBar
        tone="failed"
        aside={
          <StatusBarButton icon="refresh-cw" onClick={() => void connectivityStore.sendNow()}>
            {t("run.retry")}
          </StatusBarButton>
        }
      >
        <button type="button" className={styles.alertLink} onClick={() => navigate(`/driver/notifications/photo/${failure.blobId}`)}>
          {t("run.photoFailedBar", { number: failure.stopNumber ?? 1 })}
        </button>
      </StatusBar>
    ) : openConflict ? (
      <StatusBar tone="review" aside={<StatusBarButton onClick={() => outbox.setOpen(true)}>{t("action.view")}</StatusBarButton>}>
        <MonoText>{t("run.reviewing", { outletId: openConflict.outletId })}</MonoText>
      </StatusBar>
    ) : lastResolved?.resolution ? (
      <StatusBar tone="synced">
        <MonoText>
          {t(lastResolved.resolution.decision === "keep_partial" ? "run.resolvedPartialBar" : "run.resolvedBar", {
            outletId: lastResolved.outletId,
            by: lastResolved.resolution.by,
            time: lastResolved.resolution.at,
          })}
        </MonoText>
      </StatusBar>
    ) : undefined;

    return (
      <DriverShell
        title={title}
        subtitle={`${t("run.allRecordedShort")} · ${t("run.planShort", { version: planVersion })}`}
        banner={synced ? bar : banner}
        chip={hasNews ? { status: "synced", time: formatTime(photos.failures.length > 0 ? (connectivity.lastFailureAt ?? now) : (connectivity.lastSyncAt ?? now)) } : undefined}
        pinned={
          <PinnedActionBar tone="plain" helperPosition="above" helper={synced ? t("run.finishHelperShort") : t("run.finishHelper")}>
            <Button icon="flag" onClick={() => navigate("/driver/finish")}>
              {t("action.finishRun")}
            </Button>
          </PinnedActionBar>
        }
        connectivityOverride={connectivityOverride}
        outboxPreview={outboxPreview}
      >
        <div className={styles.syncedProgress}>
          <p className={styles.syncedCount}>{t("run.stopsDone", { done: run.stops.length, total: run.stops.length })}</p>
          {synced && photos.onPhoneCount === 0 ? (
            <Tag kind="success" icon="check">
              {t("run.allSynced")}
            </Tag>
          ) : synced ? (
            <RecordPill state="saved" label={t("run.onPhone", { count: photos.onPhoneCount })} />
          ) : (
            <RecordPill state="saved" label={t("run.onPhone", { count: connectivity.waitingCount })} />
          )}
        </div>
        <div className={styles.segments} aria-hidden>
          {run.stops.map((stop) => (
            <span key={stop.outletId} className={styles.segment} />
          ))}
        </div>
        <h2 className={styles.heading}>{t("run.allRecorded")}</h2>
        <p className={styles.body}>{synced ? t("run.syncedBody") : t("run.allRecordedBody")}</p>
        <p className={styles.captionLabel}>{t("run.inTripHistory")}</p>
        <div className={styles.stopsList}>
          {run.stops.map((stop) => (
            <CompletedStopRow key={stop.outletId} stop={stop} variant="synced" waiting={!synced} photoOnPhone={synced && photos.onPhoneOutlets.has(stop.outletId)} onOpen={() => navigate("/driver/history")} />
          ))}
        </div>
        {justSaved && (
          <div className={styles.savedBanner}>
            <Icon name="cloud" size={20} />
            {t("run.savedToast")}
          </div>
        )}
      </DriverShell>
    );
  }

  const current = run.stops[primaryIndex];
  const doneCount = run.stops.filter(stopDone).length;
  const subtitle = `${t("run.stopOf", { number: current.number, total: run.stops.length, district: current.district })}${
    connectivity.status === "offline" ? ` · ${t("run.planShort", { version: planVersion })}` : ""
  }`;
  const statusTail =
    connectivity.waitingCount > 0
      ? undefined
      : connectivity.status === "offline"
        ? t("banner.offlineNothingToSend")
        : t("run.allSynced");

  const stopCardsDeparted = run.stops.map((stop, index) => {
    const isPrimary = index === primaryIndex;
    const done = stopDone(stop);
    if (done) return <CompletedStopRow key={stop.outletId} stop={stop} variant="midRun" />;
    const wait = willWaitMinutes(stop);
    const tags = (
      <>
        {wait !== null && (
          <Tag kind="outline" icon="clock">
            {t("run.willWait", { minutes: wait })}
          </Tag>
        )}
        {isChilled(stop) && <Tag kind="chilled">{t("tag.chilled")}</Tag>}
      </>
    );
    const actions = isPrimary ? (
      <>
        {stop.arrivalAt ? (
          <Button onClick={() => navigate(`/driver/stops/${stop.outletId}/outcome`)}>{t("action.recordOutcome")}</Button>
        ) : (
          <Button icon="map-pin" onClick={() => handleArrive(stop.outletId)}>{t("action.arrive")}</Button>
        )}
        <div className={styles.actionRow}>
          <Button variant="secondary" size="medium" icon="navigation" onClick={() => openMapsFor(stop)}>
            {t("action.navigate")}
          </Button>
          <Button variant="secondary" size="medium" icon="alert-triangle" onClick={() => navigate("/driver/issues")}>
            {t("action.problem")}
          </Button>
        </div>
      </>
    ) : undefined;
    return (
      <DriverStopCard
        key={stop.outletId}
        stopNumber={stop.number}
        outletId={stop.outletId}
        outletName={stop.outletName}
        schedule={<StopSchedule stop={stop} />}
        place={stopPlace(stop)}
        tags={tags}
        orders={<StopOrdersSummary stop={stop} t={t} />}
        current={isPrimary}
        done={done}
        actions={actions}
        onOpen={() => navigate(`/driver/stops/${stop.outletId}`)}
      />
    );
  });

  return (
    <DriverShell title={title} subtitle={subtitle} banner={banner} connectivityOverride={connectivityOverride} outboxPreview={outboxPreview}>
      <StatusPill status="Departed" className={styles.departedPill} />
      <p className={styles.departedLine}>
        {t("run.departedPrefix", { time: run.departedAt ?? "" })} <Mono>{current.outletId}</Mono>
        {t("run.departedSuffix", { eta: current.plannedArrival })}
      </p>
      <p className={styles.statusLine}>{t("run.stopsDone", { done: doneCount, total: run.stops.length })}</p>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${(doneCount / run.stops.length) * 100}%` }} />
      </div>
      {statusTail && <p className={styles.statusLine}>{statusTail}</p>}
      <div className={styles.stopsList}>{stopCardsDeparted}</div>
    </DriverShell>
  );
}
