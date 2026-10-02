import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDate, formatTime } from "../../../field/clock/clock";
import { useNow } from "../../../field/clock/useClock";
import { ChoiceChips } from "../../../field/components";
import { useConnectivity, type ConnectivitySnapshot } from "../../../field/offline";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { MonoText } from "../../../shared/ui/MonoText";
import { useOutboxOpen, useT } from "../context/DriverContext";
import { useDriverRun } from "../context/useDriverRun";
import { RUN_DATE } from "../fixtures";
import { DriverShell } from "../shell/DriverShell";
import type { DriverNotice } from "../types";
import { matchesFilter, noticeLook, noticeTarget, type NoticeFilter } from "./noticeView";
import styles from "./NotificationsScreen.module.css";
import { useNotices } from "./useNotices";

export type NotificationsScreenProps = {
  /** The state gallery only; see `DriverShellProps.connectivityOverride`. */
  connectivityOverride?: ConnectivitySnapshot;
};

/**
 * R8.1 Notifications and R8.4 empty (driver prompt 4 section 6): only the changes that affect the
 * driver's own run, kept on the phone so they survive going offline. Unread ones carry a dot and
 * count on the bell. Opening one marks it read and leads to what it is about.
 */
export function NotificationsScreen({ connectivityOverride }: NotificationsScreenProps = {}) {
  const t = useT();
  const navigate = useNavigate();
  const outbox = useOutboxOpen();
  const liveConnectivity = useConnectivity();
  const connectivity = connectivityOverride ?? liveConnectivity;
  const now = useNow();
  const { run } = useDriverRun(RUN_DATE);
  const { notices, unread, loaded, markRead, markAllRead } = useNotices();
  const [filter, setFilter] = useState<NoticeFilter>("all");

  const subtitle = <MonoText>{t("sync.subtitle", { runNo: run?.runNo ?? 1, vehicleId: run?.vehicle.id ?? "VEH039" })}</MonoText>;
  const shown = notices.filter((notice) => matchesFilter(notice, filter));
  const synced = notices.length > 0 && connectivity.status === "online" && connectivity.lastSyncAt !== null;

  function open(notice: DriverNotice) {
    void markRead([notice.id]);
    const target = noticeTarget(notice);
    if (target?.type === "path") navigate(target.to);
    else if (target?.type === "outbox") outbox.setOpen(true);
  }

  return (
    <DriverShell
      title={t("notifications.title")}
      subtitle={subtitle}
      onBack={() => navigate("/driver/run")}
      hideBell
      chip={synced ? { status: "synced", time: formatTime(connectivity.lastSyncAt ?? now) } : undefined}
      connectivityOverride={connectivityOverride}
    >
      {loaded && notices.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyTile}>
            <Icon name="bell" size={28} />
          </span>
          <h2 className={styles.emptyTitle}>{t("notifications.emptyTitle")}</h2>
          <p className={styles.emptyBody}>{t("notifications.emptyBody")}</p>
        </div>
      ) : (
        <>
          <ChoiceChips
            label={t("notifications.filter")}
            value={filter}
            onChange={setFilter}
            options={[
              { key: "all", label: t("notifications.filterAll") },
              { key: "sync", label: t("notifications.filterSync") },
              { key: "dispatch", label: t("notifications.filterDispatch") },
              { key: "run", label: t("notifications.filterRun") },
            ]}
          />
          <div className={styles.dayRow}>
            <p className={styles.day}>{unread > 0 ? t("notifications.dayUnread", { date: formatDate(now), count: unread }) : formatDate(now)}</p>
            {unread > 0 && (
              <button type="button" className={styles.markAll} onClick={() => void markAllRead()}>
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>
          {shown.length > 0 ? (
            <ul className={styles.list}>
              {shown.map((notice) => (
                <NoticeRow key={notice.id} notice={notice} onOpen={() => open(notice)} />
              ))}
            </ul>
          ) : (
            <p className={styles.filterEmpty}>{t("notifications.filterEmpty")}</p>
          )}
          <p className={styles.footer}>{t("notifications.footer")}</p>
        </>
      )}
    </DriverShell>
  );
}

function NoticeRow({ notice, onOpen }: { notice: DriverNotice; onOpen: () => void }) {
  const { icon, tone } = noticeLook(notice);
  const target = noticeTarget(notice);
  const content = (
    <>
      <span className={[styles.tile, styles[`tile_${tone}`]].join(" ")}>
        <Icon name={icon} size={20} />
      </span>
      <span className={styles.stack}>
        <span className={styles.rowTitle}>
          <MonoText>{notice.title}</MonoText>
        </span>
        {notice.body && (
          <span className={styles.rowBody}>
            <MonoText>{notice.body}</MonoText>
          </span>
        )}
      </span>
      <span className={styles.meta}>
        <Mono>{notice.at}</Mono>
        {!notice.read && <span className={styles.dot} aria-label="Unread" />}
      </span>
    </>
  );
  return (
    <li className={styles.item}>
      {target ? (
        <button type="button" className={styles.row} onClick={onOpen}>
          {content}
        </button>
      ) : (
        <div className={styles.row}>{content}</div>
      )}
    </li>
  );
}
