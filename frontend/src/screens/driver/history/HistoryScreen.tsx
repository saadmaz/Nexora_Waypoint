import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useNow } from "../../../field/clock/useClock";
import { OfflineBanner } from "../../../field/components";
import { useConnectivity } from "../../../field/offline";
import { Card } from "../../../shared/ui/Card";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { Tag } from "../../../shared/ui/Tag";
import { useDriverApi, useT } from "../context/DriverContext";
import { useDriverRun } from "../context/useDriverRun";
import { RUN_DATE } from "../fixtures";
import { DriverShell } from "../shell/DriverShell";
import type { FinishedRun, HistoryDay } from "../types";
import styles from "./History.module.css";

function useHistory(): HistoryDay[] | null {
  const api = useDriverApi();
  const now = useNow();
  const [days, setDays] = useState<HistoryDay[] | null>(null);
  useEffect(() => {
    let active = true;
    void api.getHistory(RUN_DATE).then((next) => {
      if (active) setDays(next);
    });
    return () => {
      active = false;
    };
  }, [api, now]);
  return days;
}

/** R7.4: while offline the history still opens, from the phone, and says so. */
function OfflineNote() {
  const t = useT();
  const connectivity = useConnectivity();
  return connectivity.status === "offline" ? <OfflineBanner>{t("history.offlineNote")}</OfflineBanner> : null;
}

/** R7.1 Trip history (PRD v3 section 3 R7, A34): this run and the earlier ones, read-only. Works offline. */
export function HistoryScreen() {
  const t = useT();
  const navigate = useNavigate();
  const days = useHistory();

  return (
    <DriverShell title={t("history.title")} subtitle={t("history.subtitle")} banner={<OfflineNote />}>
      {days !== null && days.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="history" size={28} />
          <h2 className={styles.title}>{t("history.emptyTitle")}</h2>
          <p className={styles.muted}>{t("history.emptyBody")}</p>
        </div>
      ) : (
        <ul className={styles.list} aria-label={t("history.title")}>
          {(days ?? []).map((day) => (
            <li key={day.date} className={styles.item}>
              {day.run.kind === "no_run" ? (
                <div className={[styles.row, styles.rowMuted].join(" ")}>
                  <span className={styles.day}>{day.label}</span>
                  <span className={styles.muted}>{t("history.noRun", { reason: day.run.reason })}</span>
                </div>
              ) : (
                <button type="button" className={styles.row} onClick={() => navigate(`/driver/history/${day.date}`)}>
                  <span className={styles.stack}>
                    <span className={styles.day}>{day.label}</span>
                    <span className={styles.muted}>
                      <Mono>
                        {day.run.start}
                        {day.run.end ? ` to ${day.run.end}` : ""}
                        {day.run.km !== null ? ` · ${day.run.km} km` : ""}
                        {day.run.duration ? ` · ${day.run.duration}` : ""}
                      </Mono>
                    </span>
                    <span className={styles.muted}>{t("history.stops", { done: day.run.stopsDone, total: day.run.stopsTotal })}</span>
                  </span>
                  <span className={styles.end}>
                    {day.run.end === null ? (
                      <Tag kind="info">{t("history.inProgress")}</Tag>
                    ) : day.run.synced ? (
                      <Tag kind="success">{t("history.synced")}</Tag>
                    ) : (
                      <Tag kind="warn">{t("history.onPhone")}</Tag>
                    )}
                    <Icon name="chevron-right" size={20} />
                  </span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </DriverShell>
  );
}

/**
 * R7.2 run detail with mileage and R7.3 each stop with its proof (receiver, units, photo). Today's run is read from the phone;
 * an earlier run shows its summary row.
 */
export function HistoryDayScreen() {
  const t = useT();
  const api = useDriverApi();
  const navigate = useNavigate();
  const { date = RUN_DATE } = useParams();
  const days = useHistory();
  const { run } = useDriverRun(RUN_DATE);
  const [finished, setFinished] = useState<FinishedRun | null>(null);
  const isToday = date === RUN_DATE;

  useEffect(() => {
    if (!isToday) return;
    let active = true;
    void api.getFinishedRun(RUN_DATE).then((next) => {
      if (active) setFinished(next);
    });
    return () => {
      active = false;
    };
  }, [api, isToday]);

  const day = days?.find((d) => d.date === date);
  const summary = day?.run.kind === "run" ? day.run : null;

  return (
    <DriverShell title={day?.label ?? t("history.title")} subtitle={t("history.subtitle")} onBack={() => navigate("/driver/history")} banner={<OfflineNote />}>
      {summary && (
        <Card padded>
          <dl className={styles.facts}>
            <div>
              <dt>{t("history.time")}</dt>
              <dd>
                <Mono>
                  {summary.start}
                  {summary.end ? ` to ${summary.end}` : ""}
                </Mono>
                {summary.duration ? ` · ${summary.duration}` : ""}
              </dd>
            </div>
            <div>
              <dt>{t("history.distance")}</dt>
              <dd>
                <Mono>{summary.km !== null ? `${summary.km} km` : "–"}</Mono>
              </dd>
            </div>
            {isToday && finished && (
              <>
                <div>
                  <dt>{t("history.legs")}</dt>
                  <dd>
                    <Mono>{finished.distance.legsKm.map((km) => km.toFixed(1)).join(" / ")} km</Mono>
                  </dd>
                </div>
                <div>
                  <dt>{t("history.fuel")}</dt>
                  <dd>
                    <Mono>{finished.distance.fuelL} L</Mono>
                  </dd>
                </div>
              </>
            )}
          </dl>
        </Card>
      )}

      {isToday && run && (
        <>
          <h2 className={styles.heading}>{t("history.stopsHeading")}</h2>
          <ul className={styles.list}>
            {run.stops.map((stop) => {
              const outcomes = stop.orders.map((order) => stop.outcomes[order.id]).filter((o) => o !== undefined);
              const receiver = outcomes.find((o) => o.receiverName)?.receiverName;
              const photo = outcomes.some((o) => o.photoBlobId);
              return (
                <li key={stop.outletId} className={styles.item}>
                  <div className={styles.row}>
                    <span className={styles.stack}>
                      <span className={styles.day}>
                        <Mono>{stop.outletId}</Mono> · {stop.outletName}
                      </span>
                      {outcomes.map((o) => (
                        <span key={o.orderId} className={styles.muted}>
                          <Mono>
                            {o.orderId} · {o.outcome} · {t("stop.units", { count: o.unitsDelivered })} · {o.savedAt}
                          </Mono>
                        </span>
                      ))}
                      {receiver && <span className={styles.muted}>{t("history.receivedBy", { name: receiver })}</span>}
                    </span>
                    {photo && (
                      <span className={styles.end} aria-label={t("history.photo")}>
                        <Icon name="camera" size={20} />
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </DriverShell>
  );
}
